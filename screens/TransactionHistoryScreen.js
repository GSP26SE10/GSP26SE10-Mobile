import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useSwipeBack } from '../hooks/useSwipeBack';
import API_URL from '../constants/api';
import { getAccessToken } from '../utils/auth';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const PAGE_SIZE = 10;

const formatVnd = (value) => {
  const val = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  } catch {
    return `${val.toLocaleString('vi-VN')} đ`;
  }
};

const formatDateTime = (iso) => {
  if (!iso) return '---';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '---';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const mapPaymentType = (paymentType) => {
  if (Number(paymentType) === 1) return 'Đặt cọc';
  if (Number(paymentType) === 2) return 'Thanh toán còn lại';
  return 'Không xác định';
};

const mapPaymentMethod = (paymentMethod) => {
  if (Number(paymentMethod) === 1) return 'Tiền mặt';
  if (Number(paymentMethod) === 2) return 'Chuyển khoản ngân hàng';
  if (Number(paymentMethod) === 3) return 'ZaloPay';
  return 'Không xác định';
};

const mapPaymentStatus = (paymentStatus) => {
  if (Number(paymentStatus) === 1) return 'Chưa trả tiền';
  if (Number(paymentStatus) === 2) return 'Đã trả tiền';
  return 'Không xác định';
};

const sortPaymentsDesc = (a, b) => {
  const ta = a?.paidAt ? new Date(a.paidAt).getTime() : 0;
  const tb = b?.paidAt ? new Date(b.paidAt).getTime() : 0;
  return tb - ta;
};

export default function TransactionHistoryScreen({ navigation }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [contentHeights, setContentHeights] = useState({});
  const [payments, setPayments] = useState([]);
  const [orderNameMap, setOrderNameMap] = useState({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState('');

  const animationsRef = React.useRef({});
  const orderNameCacheRef = useRef({});
  const loadingRef = useRef(false);
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const fetchOrderName = useCallback(async (orderId, token) => {
    const numericOrderId = Number(orderId);
    if (!numericOrderId) return null;

    if (orderNameCacheRef.current[numericOrderId]) {
      return orderNameCacheRef.current[numericOrderId];
    }

    try {
      const res = await fetch(
        `${API_URL}/api/order?OrderId=${numericOrderId}&page=1&pageSize=10`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      const json = await res.json().catch(() => null);
      const items = Array.isArray(json?.items) ? json.items : [];
      const first = items[0] || null;
      const name =
        first?.menuName ||
        first?.menu?.menuName ||
        first?.orderDetails?.[0]?.menuName ||
        `Tiệc #${numericOrderId}`;

      orderNameCacheRef.current[numericOrderId] = name;
      return name;
    } catch {
      const fallback = `Tiệc #${numericOrderId}`;
      orderNameCacheRef.current[numericOrderId] = fallback;
      return fallback;
    }
  }, []);

  const fetchPaymentsPage = useCallback(async (targetPage, reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    if (reset) {
      setInitialLoading(true);
      setErrorText('');
    } else {
      setLoadingMore(true);
    }

    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/api/payment/my-payment?page=${targetPage}&pageSize=${PAGE_SIZE}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || 'Không tải được lịch sử giao dịch');
      }

      const incoming = Array.isArray(json?.items) ? json.items : [];
      const nextTotalPages = Number(json?.totalPages ?? 1) || 1;

      const uniqueOrderIds = [...new Set(incoming.map((p) => Number(p?.orderId)).filter(Boolean))];
      const missingOrderIds = uniqueOrderIds.filter((id) => !orderNameCacheRef.current[id]);

      if (missingOrderIds.length) {
        const names = await Promise.all(
          missingOrderIds.map(async (orderId) => {
            const name = await fetchOrderName(orderId, token);
            return [orderId, name];
          }),
        );

        setOrderNameMap((prev) => {
          const next = { ...prev };
          names.forEach(([orderId, name]) => {
            next[orderId] = name;
          });
          return next;
        });
      }

      setPayments((prev) => {
        const merged = reset ? incoming : [...prev, ...incoming];
        const seen = new Set();
        return merged.filter((p) => {
          const key = Number(p?.paymentId ?? 0);
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });

      setPage(targetPage);
      setTotalPages(nextTotalPages);
    } catch (error) {
      if (reset) {
        setPayments([]);
      }
      setErrorText(error?.message || 'Không tải được lịch sử giao dịch');
    } finally {
      loadingRef.current = false;
      setInitialLoading(false);
      setLoadingMore(false);
    }
  }, [fetchOrderName]);

  React.useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', () => {
      setExpandedItems({});
      setPage(1);
      setTotalPages(1);
      fetchPaymentsPage(1, true);
    });

    // initial load in case focus listener does not fire on first mount
    fetchPaymentsPage(1, true);

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigation, fetchPaymentsPage]);

  const getAnimation = (itemId) => {
    if (!animationsRef.current[itemId]) {
      animationsRef.current[itemId] = new Animated.Value(0);
    }
    return animationsRef.current[itemId];
  };

  const setMeasuredHeight = (itemId, height) => {
    const safeHeight = Math.max(0, Math.ceil(Number(height) || 0));
    if (!safeHeight) return;
    setContentHeights((prev) => {
      if (prev[itemId] === safeHeight) return prev;
      return { ...prev, [itemId]: safeHeight };
    });
  };

  const toggleItem = (itemId) => {
    const isExpanded = expandedItems[itemId];
    setExpandedItems({
      ...expandedItems,
      [itemId]: !isExpanded,
    });

    const animation = getAnimation(itemId);
    Animated.timing(animation, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const groupedTransactions = useMemo(() => {
    const byOrderId = new Map();
    payments.forEach((payment) => {
      const orderId = Number(payment?.orderId ?? 0);
      if (!orderId) return;
      if (!byOrderId.has(orderId)) byOrderId.set(orderId, []);
      byOrderId.get(orderId).push(payment);
    });

    const grouped = Array.from(byOrderId.entries()).map(([orderId, orderPayments]) => ({
      id: orderId,
      name: orderNameMap[orderId] || orderNameCacheRef.current[orderId] || `Tiệc #${orderId}`,
      payments: [...orderPayments].sort(sortPaymentsDesc),
    }));

    return grouped.sort((a, b) => {
      const ta = a.payments[0]?.paidAt ? new Date(a.payments[0].paidAt).getTime() : 0;
      const tb = b.payments[0]?.paidAt ? new Date(b.payments[0].paidAt).getTime() : 0;
      return tb - ta;
    });
  }, [payments, orderNameMap]);

  const canLoadMore = page < totalPages;

  const onEndReached = () => {
    if (!canLoadMore || loadingMore || initialLoading) return;
    fetchPaymentsPage(page + 1, false);
  };

  const renderTransactionItem = ({ item: transaction }) => {
    const isExpanded = expandedItems[transaction.id];
    const animation = getAnimation(transaction.id);

    const measuredHeight = contentHeights[transaction.id] || Math.max(1, transaction.payments.length) * 140;
    const maxHeight = animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, measuredHeight],
    });

    const rotate = animation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '90deg'],
    });

    return (
      <View style={styles.transactionItem}>
        <TouchableOpacity
          style={styles.transactionHeader}
          onPress={() => toggleItem(transaction.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.transactionName} numberOfLines={2}>{transaction.name}</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </Animated.View>
        </TouchableOpacity>
        <View style={styles.transactionDivider} />
        
        <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
          <View onLayout={(e) => setMeasuredHeight(transaction.id, e.nativeEvent.layout.height)}>
            {transaction.payments.map((payment, index) => (
              <View key={String(payment?.paymentId ?? index)} style={styles.paymentItem}>
                <View style={styles.paymentHeader}>
                  <Text style={styles.paymentLabel}>{mapPaymentType(payment?.paymentType)}</Text>
                  <Text
                    style={[
                      styles.paymentStatus,
                      Number(payment?.paymentStatus) === 2 ? styles.paymentStatusPaid : styles.paymentStatusUnpaid,
                    ]}
                  >
                    {mapPaymentStatus(payment?.paymentStatus)}
                  </Text>
                </View>
                <View style={styles.paymentDetails}>
                  <Text style={styles.paymentText}>Số tiền: {formatVnd(payment?.amount)}</Text>
                  <Text style={styles.paymentText}>Phương thức: {mapPaymentMethod(payment?.paymentMethod)}</Text>
                  <Text style={styles.paymentText}>Thời gian: {formatDateTime(payment?.paidAt)}</Text>
                </View>
                {index < transaction.payments.length - 1 && (
                  <View style={styles.paymentDivider} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>
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
        <Text style={styles.headerTitle}>Lịch sử giao dịch</Text>
        <View style={styles.headerRight} />
      </View>

      {initialLoading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={PRIMARY_COLOR} />
          <Text style={styles.loadingText}>Đang tải giao dịch...</Text>
        </View>
      ) : errorText ? (
        <View style={styles.centerWrap}>
          <Text style={styles.errorText}>{errorText}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchPaymentsPage(1, true)}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          data={groupedTransactions}
          renderItem={renderTransactionItem}
          keyExtractor={(item) => String(item.id)}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListEmptyComponent={
            <View style={styles.centerWrap}>
              <Text style={styles.emptyText}>Chưa có giao dịch nào</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={PRIMARY_COLOR} />
                <Text style={styles.footerLoadingText}>Đang tải thêm...</Text>
              </View>
            ) : <View style={{ height: 8 }} />
          }
        />
      )}

      <BottomNavigation activeTab="Account" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 110,
  },
  transactionItem: {
    paddingHorizontal: 20,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  transactionName: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    flex: 1,
    paddingRight: 12,
  },
  transactionDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
  },
  paymentItem: {
    paddingLeft: 20,
    paddingVertical: 12,
  },
  paymentHeader: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  paymentStatus: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  paymentStatusPaid: {
    color: '#0B7A35',
    backgroundColor: '#EAF8EF',
  },
  paymentStatusUnpaid: {
    color: '#9A6700',
    backgroundColor: '#FFF6E5',
  },
  paymentDetails: {
    marginTop: 4,
    gap: 4,
  },
  paymentText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginTop: 12,
    marginLeft: -20,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#B42318',
    textAlign: 'center',
    fontWeight: '600',
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: BACKGROUND_WHITE,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  footerLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 12,
  },
  footerLoadingText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
});
