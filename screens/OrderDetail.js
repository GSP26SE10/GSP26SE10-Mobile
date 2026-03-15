import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../constants/api';
import { TEXT_PRIMARY, TEXT_SECONDARY, PRIMARY_COLOR, BACKGROUND_WHITE, BORDER_LIGHT } from '../constants/colors';

const formatVnd = (value) => {
  const val = Number(value ?? 0);
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  } catch (e) {
    return `${val.toLocaleString('vi-VN')} đ`;
  }
};

const formatDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

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

const PAYMENT_METHOD = {
  1: 'Tiền mặt',
  2: 'Chuyển khoản ngân hàng',
};
const PAYMENT_TYPE = {
  1: 'Đặt cọc',
  2: 'Thanh toán nốt',
};
const PAYMENT_STATUS = {
  1: 'Chưa trả tiền',
  2: 'Đã trả tiền',
};

const formatPaymentMethod = (method) => {
  if (method == null || method === '') return '';
  return PAYMENT_METHOD[Number(method)] ?? String(method);
};

const formatPaymentType = (type) => {
  if (type == null || type === '') return '';
  return PAYMENT_TYPE[Number(type)] ?? String(type);
};

const formatPaymentStatus = (status) => {
  if (status == null || status === '') return '';
  return PAYMENT_STATUS[Number(status)] ?? String(status);
};

export default function OrderDetail({ navigation, route }) {
  const orderId = route?.params?.orderId;
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [expandedDishesSet, setExpandedDishesSet] = useState(() => new Set());
  const toggleDishes = (idx) => {
    setExpandedDishesSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  useEffect(() => {
    if (!orderId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        let customerId = null;
        try {
          const raw = await AsyncStorage.getItem('userData');
          if (raw) {
            const user = JSON.parse(raw);
            customerId = user?.userId ?? user?.customerId;
          }
        } catch (_) {}

        const orderUrl = customerId
          ? `${API_URL}/api/order?OrderId=${orderId}&CustomerId=${customerId}&page=1&pageSize=1`
          : `${API_URL}/api/order?OrderId=${orderId}&page=1&pageSize=1`;
        const res = await fetch(orderUrl);
        const json = await res.json();
        const orderList = Array.isArray(json?.items) ? json.items : [];
        let fullOrder = orderList.find((o) => Number(o.orderId) === Number(orderId)) ?? orderList[0] ?? null;

        if (!fullOrder) {
          const detailRes = await fetch(
            `${API_URL}/api/order-detail?OrderId=${orderId}&page=1&pageSize=50`,
          );
          const detailJson = await detailRes.json();
          const details = Array.isArray(detailJson?.items) ? detailJson.items : [];
          if (details.length > 0) {
            const totalPrice = details.reduce((sum, d) => sum + Number(d.totalPrice ?? 0), 0);
            fullOrder = {
              orderId: Number(orderId),
              totalPrice,
              orderDetails: details,
            };
          }
        }

        setOrder(fullOrder);

        if (fullOrder) {
          try {
            const payRes = await fetch(
              `${API_URL}/api/payment?OrderId=${orderId}&page=1&pageSize=10`,
            );
            const payJson = await payRes.json();
            const payments = Array.isArray(payJson?.items) ? payJson.items : [];
            setPayment(payments[0] ?? null);
          } catch (e) {
            console.error('Failed to load payment info', e);
          }
        }
      } catch (e) {
        console.error('Failed to load order detail', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [orderId]);

  const orderDetails = order?.orderDetails ?? [];
  const canCancel = order?.status === 1;

  const getDetailImageUri = (detail) => {
    const imgUrl = detail?.menuSnapshot?.imgUrl;
    return Array.isArray(imgUrl) ? imgUrl[0] : imgUrl;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            const sourceTab = route?.params?.sourceTab || 'cart';
            navigation.navigate('Orders', { initialTab: sourceTab });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <>
            <View style={[styles.detailBlock, styles.detailBlockFirst]}>
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <View style={[styles.skeletonBox, { height: 18, width: '60%', marginBottom: 0 }]} />
                  <View style={[styles.skeletonBox, { height: 32, width: 72, borderRadius: 10 }]} />
                </View>
                <View style={styles.detailRow}>
                  <View style={[styles.detailThumb, styles.skeletonBox]} />
                  <View style={styles.detailMeta}>
                    <View style={[styles.skeletonBox, { height: 14, width: '70%', marginBottom: 8 }]} />
                    <View style={[styles.skeletonBox, { height: 14, width: '85%', marginBottom: 8 }]} />
                    <View style={[styles.skeletonBox, { height: 14, width: '50%' }]} />
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.detailBlock}>
              <View style={styles.detailCard}>
                <View style={styles.detailCardHeader}>
                  <View style={[styles.skeletonBox, { height: 18, width: '55%', marginBottom: 0 }]} />
                  <View style={[styles.skeletonBox, { height: 32, width: 72, borderRadius: 10 }]} />
                </View>
                <View style={styles.detailRow}>
                  <View style={[styles.detailThumb, styles.skeletonBox]} />
                  <View style={styles.detailMeta}>
                    <View style={[styles.skeletonBox, { height: 14, width: '65%', marginBottom: 8 }]} />
                    <View style={[styles.skeletonBox, { height: 14, width: '80%', marginBottom: 8 }]} />
                    <View style={[styles.skeletonBox, { height: 14, width: '45%' }]} />
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
        {!loading && order?.noteOrder ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Ghi chú đơn hàng</Text>
            <View style={styles.noteBox}>
              <Text style={styles.noteText}>{order.noteOrder}</Text>
            </View>
          </View>
        ) : null}

        {!loading &&
          orderDetails.map((od, idx) => {
            const menuSnapshot = od.menuSnapshot ?? {};
            const serviceSnapshot = od.serviceSnapshot ?? {};
            const dishes = Array.isArray(menuSnapshot.dishes) ? menuSnapshot.dishes : [];
            const services = Array.isArray(serviceSnapshot.services) ? serviceSnapshot.services : [];
            const imgUri = getDetailImageUri(od);
            const isDishesExpanded = expandedDishesSet.has(idx);
            const mid = Math.ceil(dishes.length / 2);
            const leftDishes = dishes.slice(0, mid);
            const rightDishes = dishes.slice(mid);
            return (
              <View key={od.orderDetailId ?? idx} style={[styles.detailBlock, idx === 0 && styles.detailBlockFirst]}>
                <View style={styles.detailCard}>
                  <View style={styles.detailCardHeader}>
                    <Text style={styles.detailBlockTitle} numberOfLines={1}>
                      Tiệc {od.menuName ?? menuSnapshot.menuName ?? 'Menu'}
                    </Text>
                    {dishes.length > 0 && (
                      <TouchableOpacity
                        style={styles.dishesDropdown}
                        onPress={() => toggleDishes(idx)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isDishesExpanded ? 'chevron-up' : 'chevron-down'}
                          size={22}
                          color={PRIMARY_COLOR}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.detailRow}>
                    {imgUri ? (
                      <ExpoImage
                        source={{ uri: imgUri }}
                        style={styles.detailThumb}
                        contentFit="cover"
                        cachePolicy="disk"
                      />
                    ) : (
                      <View style={[styles.detailThumb, styles.imagePlaceholder]}>
                        <Ionicons name="image-outline" size={24} color={TEXT_SECONDARY} />
                      </View>
                    )}
                    <View style={styles.detailMeta}>
                      <View style={styles.detailMetaRow}>
                        <Ionicons name="people-outline" size={16} color={TEXT_SECONDARY} style={styles.detailMetaIcon} />
                        <Text style={styles.detailMetaText}>{od.numberOfGuests ?? 0} khách</Text>
                      </View>
                      <View style={styles.detailMetaRow}>
                        <Ionicons name="time-outline" size={16} color={TEXT_SECONDARY} style={styles.detailMetaIcon} />
                        <Text style={styles.detailMetaText}>{formatTime(od.startTime)} {formatDate(od.startTime)}</Text>
                      </View>
                      {od.address ? (
                        <View style={styles.detailMetaRow}>
                          <Ionicons name="location-outline" size={16} color={TEXT_SECONDARY} style={styles.detailMetaIcon} />
                          <Text style={styles.detailAddress} numberOfLines={2}>{od.address}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
                {dishes.length > 0 && isDishesExpanded && (
                  <View style={styles.dishesTwoColWrap}>
                    <View style={styles.dishesCol}>
                      {leftDishes.map((d, i) => (
                        <Text key={d.dishId ?? i} style={styles.dishesColItem}>• {d.dishName}</Text>
                      ))}
                    </View>
                    <View style={styles.dishesCol}>
                      {rightDishes.map((d, i) => (
                        <Text key={d.dishId ?? `r-${i}`} style={styles.dishesColItem}>• {d.dishName}</Text>
                      ))}
                    </View>
                  </View>
                )}
                {services.length > 0 && (
                  <View style={styles.snapshotSection}>
                    <Text style={styles.snapshotLabel}>Dịch vụ</Text>
                    {services.map((s, i) => {
                      const serviceImg = s.img ?? (Array.isArray(s.imgUrl) ? s.imgUrl[0] : s.imgUrl);
                      return (
                        <View key={`${s.serviceId}-${i}`} style={styles.serviceRow}>
                          {serviceImg ? (
                            <ExpoImage source={{ uri: serviceImg }} style={styles.serviceThumb} contentFit="cover" cachePolicy="disk" />
                          ) : (
                            <View style={[styles.serviceThumb, styles.imagePlaceholder]}>
                              <Ionicons name="construct-outline" size={20} color={TEXT_SECONDARY} />
                            </View>
                          )}
                          <View style={styles.serviceInfo}>
                            <Text style={styles.serviceName}>{s.serviceName}</Text>
                            <Text style={styles.serviceMeta}>SL: {s.quantity ?? 1} × {formatVnd(s.basePrice)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {od.noteOrderDetail ? (
                  <View style={styles.noteBox}>
                    <Text style={styles.noteLabel}>Ghi chú tiệc</Text>
                    <Text style={styles.noteText}>{od.noteOrderDetail}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}

        {/* Payment info */}
        <View style={styles.section}>
          <View style={styles.payHeaderRow}>
            <Ionicons
              name="card-outline"
              size={18}
              color={TEXT_SECONDARY}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.sectionLabel}>Thanh toán</Text>
          </View>
          {loading ? (
            <>
              <View style={styles.payRow}>
                <View style={[styles.skeletonBox, { height: 14, width: 90 }]} />
                <View style={[styles.skeletonBox, { height: 16, width: 80 }]} />
              </View>
              <View style={styles.payRow}>
                <View style={[styles.skeletonBox, { height: 14, width: 110 }]} />
                <View style={[styles.skeletonBox, { height: 16, width: 80 }]} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.payRow}>
                <View style={styles.payLabelWithIcon}>
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={TEXT_SECONDARY}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.payLabel}>Tổng đơn</Text>
                </View>
                <Text style={styles.payValue}>{formatVnd(order?.totalPrice)}</Text>
              </View>
              {payment && (
                <>
                  <View style={styles.payRow}>
                    <View style={styles.payLabelWithIcon}>
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color={TEXT_SECONDARY}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.payLabel}>
                        {formatPaymentType(payment.paymentType) || 'Đã cọc (50%)'}
                      </Text>
                    </View>
                    <Text style={styles.payValue}>
                      {formatVnd(payment.amount)}
                    </Text>
                  </View>
                  <View style={[styles.payRow, { marginTop: 8 }]}>
                    <Text style={styles.payLabel}>Thời gian thanh toán</Text>
                    <Text style={styles.payValueSmall}>
                      {formatDateTime(payment.paidAt)}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Phương thức</Text>
                    <Text style={styles.payValueSmall}>
                      {formatPaymentMethod(payment.paymentMethod)}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Trạng thái</Text>
                    <Text style={styles.payValueSmall}>
                      {formatPaymentStatus(payment.paymentStatus)}
                    </Text>
                  </View>
                  <View style={[styles.payRow, { marginTop: 8 }]}>
                    <Text style={styles.payLabelStrong}>Còn lại</Text>
                    <Text style={styles.payValueStrong}>
                      {formatVnd((order?.totalPrice ?? 0) - (payment.amount ?? 0))}
                    </Text>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom: cancel button if pending */}
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.cancelButton, !canCancel && styles.cancelButtonDisabled]}
            activeOpacity={0.8}
            disabled={!canCancel}
            onPress={() => {
              // TODO: call cancel API when backend ready
            }}
          >
            <Text style={styles.cancelButtonText}>Hủy đơn</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  headerRight: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#F7F7F7',
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageWrap: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 12,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
  },
  skeletonBox: {
    backgroundColor: '#E5E5E5',
    borderRadius: 8,
  },
  info: {
    flex: 1,
  },
  menuName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  menuSub: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  menuPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  section: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  addressBox: {
    marginTop: 6,
    borderRadius: 12,
    paddingHorizontal: 0,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  noteBox: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  detailBlock: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  detailBlockFirst: {
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
  },
  detailCard: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 14,
    marginBottom: 0,
  },
  detailCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailBlockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 8,
  },
  dishesDropdown: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  dishesTwoColWrap: {
    flexDirection: 'row',
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  dishesCol: {
    flex: 1,
    paddingHorizontal: 8,
  },
  dishesColItem: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 0,
  },
  detailThumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginRight: 12,
  },
  detailMeta: {
    flex: 1,
  },
  detailMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailMetaIcon: {
    marginRight: 6,
  },
  detailMetaText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  detailAddress: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  snapshotSection: {
    marginTop: 12,
    marginBottom: 8,
  },
  snapshotLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  snapshotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  snapshotItemText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  snapshotPrice: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginLeft: 8,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  serviceThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
    marginRight: 12,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  serviceMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  payHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  payLabelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  payValue: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
  payValueSmall: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  payLabelStrong: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '800',
  },
  payValueStrong: {
    fontSize: 16,
    color: PRIMARY_COLOR,
    fontWeight: '800',
  },
  bottomSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKGROUND_WHITE,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cancelButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
});

