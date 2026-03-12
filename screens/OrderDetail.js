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

const formatPaymentMethod = (method) => {
  if (!method) return '';
  if (method === 'BANK_TRANSFER') return 'Chuyển khoản ngân hàng';
  return method;
};

export default function OrderDetail({ navigation, route }) {
  const orderId = route?.params?.orderId;
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [menuImage, setMenuImage] = useState(null);
  const [payment, setPayment] = useState(null);

  useEffect(() => {
    if (!orderId) return;

    const fetchDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_URL}/api/order-detail?OrderId=${orderId}&page=1&pageSize=10`,
        );
        const json = await res.json();
        const first = Array.isArray(json?.items) ? json.items[0] : null;
        setDetail(first || null);

        if (first?.menuId) {
          try {
            const menuRes = await fetch(
              `${API_URL}/api/menu?MenuId=${first.menuId}&page=1&pageSize=1`,
            );
            const menuJson = await menuRes.json();
            const menu = Array.isArray(menuJson?.items) ? menuJson.items[0] : null;
            if (menu?.imgUrl) {
              setMenuImage(menu.imgUrl);
            }
          } catch (e) {
            // ignore image errors
          }
        }

        // Fetch payment info (deposit) for this order
        try {
          const payRes = await fetch(
            `${API_URL}/api/payment?OrderId=${orderId}&page=1&pageSize=1`,
          );
          const payJson = await payRes.json();
          const pay = Array.isArray(payJson?.items) ? payJson.items[0] : null;
          if (pay) {
            setPayment(pay);
          }
        } catch (e) {
          console.error('Failed to load payment info', e);
        }
      } catch (e) {
        console.error('Failed to load order detail', e);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [orderId]);

  const canCancel = detail?.status === 'PENDING';

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
        {/* Order card */}
        <View style={styles.card}>
          <View style={styles.rowTop}>
            <View style={styles.imageWrap}>
              {loading ? (
                <View style={[styles.image, styles.skeletonBox]} />
              ) : menuImage ? (
                <ExpoImage
                  source={{ uri: menuImage }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : (
                <View style={[styles.image, styles.imagePlaceholder]}>
                  <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
                </View>
              )}
            </View>
            <View style={styles.info}>
              {loading ? (
                <>
                  <View style={[styles.skeletonBox, { height: 18, width: '70%', marginBottom: 6 }]} />
                  <View style={[styles.skeletonBox, { height: 14, width: '40%', marginBottom: 6 }]} />
                  <View style={[styles.skeletonBox, { height: 16, width: '50%' }]} />
                </>
              ) : (
                <>
                  <Text style={styles.menuName} numberOfLines={2}>
                    {detail ? `Tiệc ${detail.menuName || ''}` : ''}
                  </Text>
                  {detail && (
                    <Text style={styles.menuSub}>
                      {detail.numberOfGuests || 0} khách
                    </Text>
                  )}
                  {detail && (
                    <Text style={styles.menuPrice}>
                      {formatVnd(detail.totalPrice)}
                    </Text>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        {/* Time & location */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Ngày tổ chức</Text>
          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={TEXT_SECONDARY}
                style={{ marginRight: 6 }}
              />
              {loading ? (
                <View style={[styles.skeletonBox, { height: 14, width: 110 }]} />
              ) : (
                <Text style={styles.chipText}>
                  {detail ? formatDate(detail.startTime) : ''}
                </Text>
              )}
            </View>
            <View style={styles.chip}>
              <Ionicons
                name="time-outline"
                size={16}
                color={TEXT_SECONDARY}
                style={{ marginRight: 6 }}
              />
              {loading ? (
                <View style={[styles.skeletonBox, { height: 14, width: 70 }]} />
              ) : (
                <Text style={styles.chipText}>
                  {detail ? formatTime(detail.startTime) : ''}
                </Text>
              )}
            </View>
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Địa điểm</Text>
          <View style={styles.addressBox}>
            <Ionicons
              name="location-outline"
              size={18}
              color={TEXT_SECONDARY}
              style={{ marginRight: 8 }}
            />
            {loading ? (
              <View style={[styles.skeletonBox, { height: 16, width: '80%' }]} />
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {detail?.address || ''}
              </Text>
            )}
          </View>
        </View>

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
                <Text style={styles.payValue}>{formatVnd(detail?.totalPrice)}</Text>
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
                      <Text style={styles.payLabel}>Đã cọc (50%)</Text>
                    </View>
                    <Text style={styles.payValue}>
                      {formatVnd(payment.amount)}
                    </Text>
                  </View>
                  <View style={[styles.payRow, { marginTop: 8 }]}>
                    <Text style={styles.payLabel}>Thời gian cọc</Text>
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
              <View style={[styles.payRow, { marginTop: 8 }]}>
                <Text style={styles.payLabelStrong}>Còn lại</Text>
                <Text style={styles.payValueStrong}>
                  {formatVnd(
                    (detail?.totalPrice || 0) - (payment.amount || 0),
                  )}
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

