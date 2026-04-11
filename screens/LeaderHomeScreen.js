import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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
import { TEXT_PRIMARY, BACKGROUND_WHITE, TEXT_SECONDARY, PRIMARY_COLOR } from '../constants/colors';
import { normalizeLeaderOrdersOverviewApi } from '../utils/leaderOrdersOverview';

const LEADER_GROUP_MEMBERS_KEY = 'leaderGroupMembers';
const LEADER_OVERVIEW_CACHE_KEY = 'leaderOverviewCache:v2';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 phút

const resolveImageUri = (img) => {
  if (!img || typeof img !== 'string') return '';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${API_URL}${img}`;
};

const pickFirstImage = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === 'string' && v.trim().length > 0);
    return first || '';
  }
  return '';
};

const getMenuImageFromOrder = (order) => {
  if (!order || typeof order !== 'object') return '';

  const direct =
    order.menuImage ||
    order.image ||
    order.menu?.image ||
    pickFirstImage(order.menuSnapshot?.imgUrl) ||
    pickFirstImage(order.imgUrl);
  if (direct) return direct;

  const firstDetail = Array.isArray(order.orderDetails) ? order.orderDetails[0] : null;
  if (!firstDetail || typeof firstDetail !== 'object') return '';

  return (
    firstDetail.menuImage ||
    firstDetail.image ||
    firstDetail.menu?.image ||
    pickFirstImage(firstDetail.menuSnapshot?.imgUrl) ||
    pickFirstImage(firstDetail.imgUrl) ||
    ''
  );
};

const formatTimeRange = (startIso, endIso) => {
  if (!startIso) return '—';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${date(start)}`;
};

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

const HOME_TABS = [
  { key: 'orders', label: 'Đơn hàng' },
  { key: 'group', label: 'Nhóm' },
];

export default function LeaderHomeScreen({ navigation }) {
  const [greetingText, setGreetingText] = useState('Xin chào!');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [activeTab, setActiveTab] = useState('orders');

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

  useEffect(() => {
    refreshUnreadBadge();
  }, [refreshUnreadBadge]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getAccessToken();
      refreshUnreadBadge();
      const res = await fetch(`${API_URL}/api/staff-group/leader/orders-overview`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        setOverview({ orders: [], members: [] });
        return;
      }
      const data = await res.json();
      const payload = normalizeLeaderOrdersOverviewApi(data);
      setOverview(payload);
      await AsyncStorage.setItem(LEADER_OVERVIEW_CACHE_KEY, JSON.stringify({ data: payload, at: Date.now() }));
      if (Array.isArray(payload.members) && payload.members.length > 0) {
        await AsyncStorage.setItem(LEADER_GROUP_MEMBERS_KEY, JSON.stringify(payload.members));
      }
    } catch (e) {
      console.warn('Leader orders-overview refresh failed', e);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUnreadBadge]);

  useEffect(() => {
    (async () => {
      const fullName = await getStoredFullName();
      setGreetingText(buildGreeting(fullName));
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchOverview = async (useCache = true) => {
      if (useCache) {
        try {
          const raw = await AsyncStorage.getItem(LEADER_OVERVIEW_CACHE_KEY);
          if (raw) {
            const { data, at } = JSON.parse(raw);
            if (data && at && Date.now() - at < CACHE_MAX_AGE_MS) {
              setOverview(data);
              setLoading(false);
              if (!cancelled) return;
            }
          }
        } catch (_) {}
      }
      try {
        setLoading(true);
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/api/staff-group/leader/orders-overview`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          setOverview({ orders: [], members: [] });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const payload = normalizeLeaderOrdersOverviewApi(data);
        setOverview(payload);
        await AsyncStorage.setItem(LEADER_OVERVIEW_CACHE_KEY, JSON.stringify({ data: payload, at: Date.now() }));
        if (Array.isArray(payload.members) && payload.members.length > 0) {
          await AsyncStorage.setItem(LEADER_GROUP_MEMBERS_KEY, JSON.stringify(payload.members));
        }
      } catch (e) {
        if (!cancelled) setOverview({ orders: [], members: [] });
        console.warn('Leader orders-overview failed', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchOverview(true);
    return () => { cancelled = true; };
  }, []);

  const allOrders = overview?.orders ?? [];
  // Home: hiển thị các buổi chưa kết thúc (sắp tới/đang diễn ra/thanh toán)
  const orders = allOrders.filter((o) =>
    [1, 2, 4, 5, 6].includes(Number(o?.orderStatus)),
  );
  const groupName = overview?.staffGroupName || 'Chưa có tên nhóm';
  const leaderName = overview?.leaderName || '';
  const groupMembers = useMemo(() => {
    const list = Array.isArray(overview?.members) ? overview.members : [];
    const map = new Map();
    list.forEach((m, idx) => {
      const key = m?.staffId ?? `m-${idx}`;
      if (!map.has(key)) map.set(key, m);
    });
    return Array.from(map.values());
  }, [overview?.members]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY_COLOR]} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greetingText}</Text>
              <Text style={styles.subtitle}>Danh sách các buổi tiệc bạn đang quản lý.</Text>
            </View>
            <View style={styles.bellWrap}>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={() => navigation.navigate('LeaderNotification')}
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

        <View style={styles.tabContainer}>
          <View style={styles.tabBar}>
            {HOME_TABS.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                activeOpacity={0.7}
                onPress={() => setActiveTab(tab.key)}
              >
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {activeTab === tab.key ? <View style={styles.tabIndicator} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {activeTab === 'orders' && loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <View key={i} style={styles.partyCard}>
                <View style={[styles.partyImagePlaceholder, styles.skeleton]} />
                <View style={styles.partyInfo}>
                  <View style={[styles.skeleton, { height: 16, width: '70%', marginBottom: 8, borderRadius: 4 }]} />
                  <View style={[styles.skeleton, { height: 12, width: '90%', marginBottom: 6, borderRadius: 4 }]} />
                  <View style={[styles.skeleton, { height: 12, width: '60%', marginBottom: 6, borderRadius: 4 }]} />
                  <View style={[styles.skeleton, { height: 12, width: '50%', borderRadius: 4 }]} />
                </View>
              </View>
            ))}
          </>
        ) : activeTab === 'orders' && orders.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.emptyText}>Chưa có đơn nào</Text>
          </View>
        ) : activeTab === 'orders' ? (
          orders.map((order, index) => {
            const menuImageUri = resolveImageUri(getMenuImageFromOrder(order));
            const safeOrderDetailId =
              order.orderDetailId ??
              (Array.isArray(order.orderDetails) ? order.orderDetails?.[0]?.orderDetailId : null);
            const cardKey = safeOrderDetailId ?? `${order.orderId ?? 'order'}-${index}`;
            return (
            <TouchableOpacity
              key={cardKey}
              style={styles.partyCard}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('LeaderOrderDetail', {
                  orderDetailId: safeOrderDetailId,
                  orderId: order.orderId,
                  order,
                  status: null,
                })
              }
            >
              <View style={styles.partyImageWrap}>
                {menuImageUri ? (
                  <Image
                    source={{ uri: menuImageUri }}
                    style={styles.partyImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.partyImagePlaceholder}>
                    <Ionicons name="image-outline" size={32} color={TEXT_SECONDARY} />
                  </View>
                )}
              </View>
              <View style={styles.partyInfo}>
                <Text style={styles.partyName}>{order.menuName || '—'}</Text>
                <Text style={styles.partyMeta}>
                  {order.partyCategory || '—'} · {order.numberOfGuests ?? 0} người · {formatTimeRange(order.startTime, order.endTime)}
                </Text>
                <Text style={styles.partyAddress} numberOfLines={1}>
                  {order.address || '—'}
                </Text>
                <Text style={styles.partySubMeta}>
                  Dịch vụ: {Array.isArray(order?.serviceSnapshot?.services) ? order.serviceSnapshot.services.length : 0} · Món lẻ: {Array.isArray(order?.customDishSnapshot?.customDishes) ? order.customDishSnapshot.customDishes.length : 0}
                </Text>
                <Text style={styles.partyStatus}>
                  {ORDER_STATUS_LABEL[order.orderStatus] ?? '—'}
                </Text>
              </View>
            </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.groupSection}>
            <View style={styles.groupCard}>
              <Text style={styles.groupName}>{groupName}</Text>
              {!!leaderName && <Text style={styles.groupLeader}>Leader: {leaderName}</Text>}
              <Text style={styles.groupCount}>Thành viên: {groupMembers.length}</Text>
            </View>

            {groupMembers.length === 0 ? (
              <View style={styles.loadingWrap}>
                <Text style={styles.emptyText}>Chưa có thành viên trong nhóm</Text>
              </View>
            ) : (
              groupMembers.map((member, idx) => (
                <View key={String(member?.staffId ?? `member-${idx}`)} style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person-outline" size={16} color={PRIMARY_COLOR} />
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{member?.staffName || `Nhân viên #${member?.staffId ?? ''}`}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
      <BottomNavigationStaff activeTab="LeaderHome" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  loadingWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  header: {
    marginBottom: 16,
  },
  tabContainer: {
    marginBottom: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F2F2F2',
    borderRadius: 14,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  tabTextActive: {
    color: PRIMARY_COLOR,
    fontWeight: '800',
  },
  tabIndicator: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 4,
    height: 2,
    borderRadius: 1,
    backgroundColor: PRIMARY_COLOR,
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
  emptyText: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  partyCard: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 10,
    marginTop: 12,
  },
  partyImageWrap: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
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
  partyImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
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
  partySubMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  groupSection: {
    marginTop: 8,
  },
  groupCard: {
    borderRadius: 14,
    backgroundColor: '#F7F7F7',
    padding: 14,
    marginBottom: 10,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  groupLeader: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  groupCount: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F7F7F7',
    marginBottom: 8,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF3E6',
    marginRight: 10,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  memberMeta: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
});