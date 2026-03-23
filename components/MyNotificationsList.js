import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BACKGROUND_WHITE, BORDER_LIGHT, PRIMARY_COLOR, TEXT_PRIMARY, TEXT_SECONDARY } from '../constants/colors';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { getAccessToken } from '../utils/auth';
import { fetchMyNotificationsPage, markNotificationRead } from '../utils/notificationsApi';

const PAGE_SIZE = 10;

const formatTime = (iso) => {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return `${time} · ${date}`;
  } catch {
    return '';
  }
};

export default function MyNotificationsList({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);

  const swipeBack = useSwipeBack(() => navigation.goBack());

  const loadPage = useCallback(async (pageNum, { append } = { append: false }) => {
    const token = await getAccessToken();
    const data = await fetchMyNotificationsPage(token, pageNum, PAGE_SIZE);
    if (data.totalPages != null) totalPagesRef.current = data.totalPages;
    if (!data.ok) {
      if (!append) setItems([]);
      return data;
    }
    if (append) {
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.notificationId));
        const next = [...prev];
        for (const it of data.items) {
          const id = it?.notificationId;
          if (id == null || seen.has(id)) continue;
          seen.add(id);
          next.push(it);
        }
        return next;
      });
    } else {
      setItems(data.items);
    }
    return data;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      pageRef.current = 1;
      totalPagesRef.current = 1;
      await loadPage(1, { append: false });
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      pageRef.current = 1;
      await loadPage(1, { append: false });
      pageRef.current = 1;
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing) return;
    const nextPage = pageRef.current + 1;
    if (nextPage > totalPagesRef.current) return;
    setLoadingMore(true);
    try {
      const data = await loadPage(nextPage, { append: true });
      if (data?.ok) pageRef.current = nextPage;
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, loadPage]);

  const onPressItem = useCallback(async (item) => {
    const id = item?.notificationId;
    if (id == null) return;
    const wasUnread = item?.isRead === false;
    if (wasUnread) {
      setItems((prev) =>
        prev.map((n) =>
          Number(n?.notificationId) === Number(id) ? { ...n, isRead: true } : n,
        ),
      );
    }
    const token = await getAccessToken();
    const ok = await markNotificationRead(token, id);
    if (!ok && wasUnread) {
      setItems((prev) =>
        prev.map((n) =>
          Number(n?.notificationId) === Number(id) ? { ...n, isRead: false } : n,
        ),
      );
    }
  }, []);

  const renderItem = ({ item }) => {
    const unread = item?.isRead === false;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.75}
        onPress={() => onPressItem(item)}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="notifications" size={18} color={BACKGROUND_WHITE} />
        </View>
        <View style={styles.body}>
          <View style={styles.rowTop}>
            <View style={styles.titleRow}>
              {unread ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotPlaceholder} />}
              <Text
                style={[styles.title, unread && styles.titleUnread]}
                numberOfLines={2}
              >
                {item.title || 'Thông báo'}
              </Text>
            </View>
            <Text style={[styles.time, unread && styles.timeUnread]}>
              {formatTime(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.content, unread && styles.contentUnread]} numberOfLines={4}>
            {item.body || ''}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFooter = () =>
    loadingMore ? (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={PRIMARY_COLOR} />
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={styles.backButton} />
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it?.notificationId ?? Math.random())}
          contentContainerStyle={items.length ? styles.list : styles.listEmpty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[PRIMARY_COLOR]} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.35}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="notifications-off-outline" size={52} color={PRIMARY_COLOR} />
              <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
              <Text style={styles.emptySub}>Thông báo mới sẽ hiển thị tại đây.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_WHITE },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24, justifyContent: 'center' },
  separator: { height: 12 },
  card: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', marginRight: 8 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginTop: 5,
    marginRight: 8,
  },
  unreadDotPlaceholder: { width: 8, marginRight: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY },
  titleUnread: { fontWeight: '800' },
  time: { fontSize: 11, color: TEXT_SECONDARY, maxWidth: 100, textAlign: 'right' },
  timeUnread: { fontWeight: '700', color: TEXT_PRIMARY },
  content: { marginTop: 6, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  contentUnread: { color: TEXT_PRIMARY, fontWeight: '600' },
  emptyWrap: { alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  emptySub: { marginTop: 4, fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' },
  footer: { paddingVertical: 16, alignItems: 'center' },
});
