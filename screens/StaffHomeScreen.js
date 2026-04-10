import React, { useEffect, useState, useCallback } from 'react';
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
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { buildGreeting, getStoredFullName } from '../utils/greeting';
import { getAccessToken } from '../utils/auth';
import {
  getNotificationUnreadCount,
  refreshNotificationUnreadCount,
  subscribeNotificationUnreadChange,
} from '../utils/notificationUnread';
import API_URL from '../constants/api';
import {
  TEXT_PRIMARY,
  BACKGROUND_WHITE,
  TEXT_SECONDARY,
  PRIMARY_COLOR,
} from '../constants/colors';

const STAFF_TASKS_CACHE_KEY = 'staffTasksCache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 phút
const PAGE_SIZE = 10;

const resolveImageUri = (img) => {
  if (!img || typeof img !== 'string') return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${API_URL}${img}`;
};

const formatTimeRange = (startIso, endIso) => {
  if (!startIso) return '—';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const time = (d) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${date(start)}`;
};

/** Trạng thái đơn:
 *  1,2,4: Sắp tới
 *  5,6: Đang diễn ra / Thanh toán
 *  7: Hoàn thành
 *  3,8: Bị hủy
 */
const ORDER_STATUS_HIDE_ON_HOME = [3, 7, 8]; // ẩn Bị hủy và Hoàn thành (hiển thị ở lịch sử)

const ORDER_STATUS_LABEL = {
  1: 'Sắp tới',
  2: 'Sắp tới',
  3: 'Bị hủy',
  4: 'Đang chuẩn bị',
  5: 'Đang diễn ra',
  6: 'Thanh toán',
  7: 'Hoàn thành',
  8: 'Bị hủy',
};

const getOrderStatus = (orderDetail) =>
  Number(orderDetail?.orderStatus ?? orderDetail?.status ?? 0);

/** Từ items (task có orderDetail) gộp theo orderDetailId → [{ orderDetail, tasks }] */
function buildOrdersFromTaskItems(items) {
  const map = new Map();
  (items || []).forEach((task) => {
    const od = task.orderDetail;
    if (!od || od.orderDetailId == null) return;
    const id = od.orderDetailId;
    if (!map.has(id)) {
      map.set(id, { orderDetail: od, tasks: [] });
    }
    map.get(id).tasks.push(task);
  });
  return Array.from(map.values());
}

export default function StaffHomeScreen({ navigation }) {
  const [greetingText, setGreetingText] = useState('Xin chào!');
  const [allTaskItems, setAllTaskItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const refreshUnreadBadge = useCallback(async () => {
    try {
      const n = await refreshNotificationUnreadCount();
      setUnreadNotifications(n);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getNotificationUnreadCount()
      .then((count) => {
        if (mounted) setUnreadNotifications(Number(count) || 0);
      })
      .catch(() => {
        if (mounted) setUnreadNotifications(0);
      });

    const unsubscribe = subscribeNotificationUnreadChange((nextCount) => {
      if (!mounted) return;
      setUnreadNotifications(Number(nextCount) || 0);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const allOrders = buildOrdersFromTaskItems(allTaskItems);
  const orders = allOrders.filter(
    (item) => !ORDER_STATUS_HIDE_ON_HOME.includes(getOrderStatus(item.orderDetail))
  );

  const fetchPage = useCallback(async (pageNum, append = false) => {
    const token = await getAccessToken();
    const res = await fetch(
      `${API_URL}/api/order-detail-staff-task/staff-tasks?page=${pageNum}&pageSize=${PAGE_SIZE}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!res.ok) return null;
    return res.json();
  }, []);

  const loadFirst = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STAFF_TASKS_CACHE_KEY);
      if (raw) {
        const { data, at } = JSON.parse(raw);
        if (data && at && Date.now() - at < CACHE_MAX_AGE_MS && Array.isArray(data.items)) {
          setAllTaskItems(data.items);
          setPage(data.page ?? 1);
          setTotalPages(data.totalPages ?? 1);
          setLoading(false);
          return;
        }
      }
    } catch (_) {}

    setLoading(true);
    try {
      const data = await fetchPage(1);
      if (data && Array.isArray(data.items)) {
        setAllTaskItems(data.items);
        setPage(data.page ?? 1);
        setTotalPages(data.totalPages ?? 1);
        await AsyncStorage.setItem(
          STAFF_TASKS_CACHE_KEY,
          JSON.stringify({
            data: {
              items: data.items,
              page: data.page,
              totalPages: data.totalPages ?? 1,
            },
            at: Date.now(),
          })
        );
      } else {
        setAllTaskItems([]);
        setTotalPages(1);
      }
    } catch (e) {
      console.warn('Staff staff-tasks failed', e);
      setAllTaskItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    (async () => {
      const fullName = await getStoredFullName();
      setGreetingText(buildGreeting(fullName));
    })();
  }, []);

  useEffect(() => {
    loadFirst();
  }, [loadFirst]);

  useEffect(() => {
    refreshUnreadBadge();
  }, [refreshUnreadBadge]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      refreshUnreadBadge();
      const data = await fetchPage(1);
      if (data && Array.isArray(data.items)) {
        setAllTaskItems(data.items);
        setPage(data.page ?? 1);
        setTotalPages(data.totalPages ?? 1);
        await AsyncStorage.setItem(
          STAFF_TASKS_CACHE_KEY,
          JSON.stringify({
            data: {
              items: data.items,
              page: data.page,
              totalPages: data.totalPages ?? 1,
            },
            at: Date.now(),
          })
        );
      }
    } catch (e) {
      console.warn('Staff staff-tasks refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchPage(nextPage);
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        setAllTaskItems((prev) => [...prev, ...data.items]);
        setPage(data.page ?? nextPage);
        setTotalPages(data.totalPages ?? 1);
      } else {
        setPage(nextPage);
      }
    } catch (e) {
      console.warn('Staff staff-tasks loadMore failed', e);
    } finally {
      setLoadingMore(false);
    }
  }, [page, totalPages, loadingMore, fetchPage]);

  const onPressOrder = useCallback(
    (item) => {
      navigation.navigate('StaffOrderDetail', {
        orderDetailId: item.orderDetail?.orderDetailId,
        orderDetail: item.orderDetail,
        tasks: item.tasks || [],
      });
    },
    [navigation]
  );

  const renderSkeleton = () => (
    <>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.partyCard}>
          <View style={[styles.partyImagePlaceholder, styles.skeleton]} />
          <View style={styles.partyInfo}>
            <View
              style={[
                styles.skeleton,
                { height: 16, width: '70%', marginBottom: 8, borderRadius: 4 },
              ]}
            />
            <View
              style={[
                styles.skeleton,
                { height: 12, width: '90%', marginBottom: 6, borderRadius: 4 },
              ]}
            />
            <View
              style={[
                styles.skeleton,
                { height: 12, width: '60%', marginBottom: 6, borderRadius: 4 },
              ]}
            />
            <View
              style={[styles.skeleton, { height: 12, width: '50%', borderRadius: 4 }]}
            />
          </View>
        </View>
      ))}
    </>
  );

  const renderOrderCard = useCallback(
    ({ item }) => {
      const od = item.orderDetail || {};
      const menuImageUri = resolveImageUri(od.menuImage);
      return (
        <TouchableOpacity
          style={styles.partyCard}
          activeOpacity={0.8}
          onPress={() => onPressOrder(item)}
        >
          {menuImageUri ? (
            <Image
              source={{ uri: menuImageUri }}
              style={styles.partyImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={120}
            />
          ) : (
            <View style={styles.partyImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color={TEXT_SECONDARY} />
            </View>
          )}
          <View style={styles.partyInfo}>
            <Text style={styles.partyName}>{od.menuName || '—'}</Text>
            <Text style={styles.partyMeta}>
              {od.partyCategory || '—'} · {od.numberOfGuests ?? 0} người ·{' '}
              {formatTimeRange(od.startTime, od.endTime)}
            </Text>
            <Text style={styles.partyAddress} numberOfLines={1}>
              {od.address || '—'}
            </Text>
            <Text style={styles.partyStatus}>
              {ORDER_STATUS_LABEL[getOrderStatus(od)] ?? '—'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [onPressOrder]
  );

  const renderFooter = () =>
    loadingMore ? (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={PRIMARY_COLOR} />
      </View>
    ) : null;

  const renderEmpty = () =>
    !loading ? (
      <View style={styles.loadingWrap}>
        <Text style={styles.emptyText}>Chưa có đơn nào</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingText}</Text>
            <Text style={styles.subtitle}>
              Danh sách tiệc và công việc cần làm.
            </Text>
          </View>
          <View style={styles.bellWrap}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => navigation.navigate('StaffNotification')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            {unreadNotifications > 0 ? (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {loading && orders.length === 0 ? (
        <FlatList
          data={[]}
          keyExtractor={() => 'skeleton'}
          renderItem={null}
          ListHeaderComponent={renderSkeleton}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) =>
            String(item.orderDetail?.orderDetailId ?? `order-${Math.random()}`)
          }
          renderItem={renderOrderCard}
          contentContainerStyle={[
            styles.content,
            orders.length === 0 && styles.contentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={() => loadMore()}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[PRIMARY_COLOR]}
            />
          }
        />
      )}

      <BottomNavigationStaff
        activeTab="StaffHome"
        onTabPress={(tab) => navigation.navigate(tab)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellWrap: {
    marginLeft: 12,
    width: 40,
    height: 40,
    position: 'relative',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0)',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: BACKGROUND_WHITE,
    fontSize: 10,
    fontWeight: '800',
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  partyCard: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 10,
    marginTop: 12,
  },
  partyImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  partyImagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeleton: {
    backgroundColor: '#E5E5E5',
  },
  partyInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
  },
  partyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  partyMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  partyAddress: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  partyStatus: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
});
