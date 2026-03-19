import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import API_URL from '../constants/api';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { BACKGROUND_WHITE, BORDER_LIGHT, PRIMARY_COLOR, TEXT_PRIMARY, TEXT_SECONDARY } from '../constants/colors';

const formatDateTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

function StarsRow({ rating }) {
  const r = Number(rating ?? 0);
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= r ? 'star' : 'star-outline'}
          size={16}
          color={PRIMARY_COLOR}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}

export default function FeedbackScreen({ navigation, route }) {
  const params = route?.params || {};
  const menuId = params?.menuId ?? null;
  const serviceId = params?.serviceId ?? null;
  const type = menuId ? 'menu' : serviceId ? 'service' : null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const swipeBack = useSwipeBack(() => navigation.goBack());

  const title = useMemo(() => {
    if (type === 'menu') return 'Đánh giá menu';
    if (type === 'service') return 'Đánh giá dịch vụ';
    return 'Đánh giá';
  }, [type]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!type) {
        setItems([]);
        return;
      }
      try {
        setLoading(true);
        const url =
          type === 'menu'
            ? `${API_URL}/api/feedback-menu?MenuId=${menuId}&page=1&pageSize=10`
            : `${API_URL}/api/feedback-service?ServiceId=${serviceId}&page=1&pageSize=10`;
        const res = await fetch(url);
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.items) ? json.items : [];
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, menuId, serviceId]);

  const renderItem = ({ item }) => {
    const name = type === 'menu' ? item?.menuName : item?.serviceName;
    const customerName = item?.customerName || `#${item?.customerId ?? ''}`;
    const comment = item?.comment || '';
    const createdAt = item?.createdAt;
    const imgs = Array.isArray(item?.img)
      ? item.img
      : Array.isArray(item?.imgUrl)
        ? item.imgUrl
        : [];
    return (
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {name || (type === 'menu' ? 'Menu' : 'Dịch vụ')}
          </Text>
          <StarsRow rating={item?.rating} />
        </View>
        <Text style={styles.cardMeta}>
          {customerName}
          {!!createdAt ? ` · ${formatDateTime(createdAt)}` : ''}
        </Text>
        {!!comment && <Text style={styles.cardComment}>{String(comment)}</Text>}
        {!!imgs.length && (
          <View style={styles.imgRow}>
            {imgs.slice(0, 3).map((u, idx) => (
              <ExpoImage
                key={`${u}-${idx}`}
                source={{ uri: String(u) }}
                style={styles.imgThumb}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerRight} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(it, idx) =>
          String(
            it?.feedbackMenuId ??
              it?.feedbackServiceId ??
              it?.id ??
              it?.createdAt ??
              idx,
          )
        }
        contentContainerStyle={items.length ? styles.list : styles.listEmpty}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={renderItem}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>
                {type ? 'Chưa có đánh giá nào' : 'Thiếu thông tin đánh giá'}
              </Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Đang tải...</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_WHITE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  headerRight: { width: 44 },
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  listEmpty: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 },
  card: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 14,
    padding: 14,
    backgroundColor: BACKGROUND_WHITE,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY, marginRight: 10 },
  starsRow: { flexDirection: 'row', alignItems: 'center' },
  cardMeta: { marginTop: 6, fontSize: 12, color: TEXT_SECONDARY, fontWeight: '600' },
  cardComment: { marginTop: 10, fontSize: 13, color: TEXT_PRIMARY, lineHeight: 18 },
  imgRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  imgThumb: {
    width: 70,
    height: 70,
    borderRadius: 14,
    marginRight: 10,
    backgroundColor: '#EAEAEA',
    overflow: 'hidden',
  },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: TEXT_SECONDARY, fontWeight: '700' },
});

