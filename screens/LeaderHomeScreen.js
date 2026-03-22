import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { buildGreeting, getStoredFullName } from '../utils/greeting';
import { getAccessToken } from '../utils/auth';
import API_URL from '../constants/api';
import { TEXT_PRIMARY, BACKGROUND_WHITE, TEXT_SECONDARY, PRIMARY_COLOR } from '../constants/colors';
import { normalizeLeaderOrdersOverviewApi } from '../utils/leaderOrdersOverview';

const LEADER_GROUP_MEMBERS_KEY = 'leaderGroupMembers';
const LEADER_OVERVIEW_CACHE_KEY = 'leaderOverviewCache';
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 phút

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

export default function LeaderHomeScreen({ navigation }) {
  const [greetingText, setGreetingText] = useState('Xin chào!');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getAccessToken();
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
  }, []);

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
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => navigation.navigate('LeaderNotification')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={22} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
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
        ) : orders.length === 0 ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.emptyText}>Chưa có đơn nào</Text>
          </View>
        ) : (
          orders.map((order) => (
            <TouchableOpacity
              key={order.orderDetailId}
              style={styles.partyCard}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('LeaderOrderDetail', {
                  orderDetailId: order.orderDetailId,
                  orderId: order.orderId,
                  order,
                  status: null,
                })
              }
            >
              <View style={styles.partyImageWrap}>
                {order.menuImage ? (
                  <Image
                    source={{ uri: order.menuImage }}
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
                <Text style={styles.partyStatus}>
                  {ORDER_STATUS_LABEL[order.orderStatus] ?? '—'}
                </Text>
              </View>
            </TouchableOpacity>
          ))
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0)',
    marginLeft: 12,
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
});
