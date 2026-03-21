import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  TouchableOpacity,
  Modal,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
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

const guessMimeTypeFromUri = (uri) => {
  const lower = String(uri ?? '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/jpeg';
};

const getFileNameFromUri = (uri, fallback = '') => {
  const raw = String(uri ?? '');
  const cleaned = raw.split('?')[0];
  const last = cleaned.split('/').filter(Boolean).pop();
  if (last) return last;
  return fallback || `feedback-${Date.now()}.jpg`;
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
  const sourceTab = route?.params?.sourceTab || 'cart';
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [payment, setPayment] = useState(null);
  const [payments, setPayments] = useState([]);
  const [extraCharges, setExtraCharges] = useState([]);
  const [loadingExtraCharges, setLoadingExtraCharges] = useState(false);
  const [expandedDishesSet, setExpandedDishesSet] = useState(() => new Set());
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackTargets, setFeedbackTargets] = useState([]);
  const [currentFeedbackIndex, setCurrentFeedbackIndex] = useState(0);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackImages, setFeedbackImages] = useState([]); // [{ uri, type, name }]
  const [previewFeedbackImage, setPreviewFeedbackImage] = useState('');
  const [previewExtraChargeImage, setPreviewExtraChargeImage] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [existingMenuFeedbacks, setExistingMenuFeedbacks] = useState([]);
  const [existingServiceFeedbacks, setExistingServiceFeedbacks] = useState([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
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
        setPayment(null);
        setPayments([]);
        let customerId = null;
        try {
          const raw = await AsyncStorage.getItem('userData');
          if (raw) {
            const user = JSON.parse(raw);
            customerId = user?.userId ?? user?.customerId;
          }
        } catch (_) { }

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
            const list = Array.isArray(payJson?.items) ? payJson.items : [];

            // Backend: type 1 = deposit, type 2 = full. If there are 2 records, full is already paid.
            const fullRecord =
              list.find((p) => Number(p?.paymentType) === 2 && Number(p?.paymentStatus) === 2) ??
              list.find((p) => Number(p?.paymentType) === 2) ??
              null;
            const depositRecord = list.find((p) => Number(p?.paymentType) === 1) ?? null;

            setPayments(list);
            setPayment(fullRecord ?? depositRecord ?? list[0] ?? null);
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

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingExtraCharges(true);
        setExtraCharges([]);
        const res = await fetch(`${API_URL}/api/order-detail-extra-charge/order/${orderId}`);
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : [];
        if (cancelled) return;
        setExtraCharges(list);
      } catch (e) {
        if (cancelled) return;
        console.error('Failed to load extra charges', e);
        setExtraCharges([]);
      } finally {
        if (!cancelled) setLoadingExtraCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const orderDetails = order?.orderDetails ?? [];
  const canCancel = order?.status === 1;
  const showCancelButton = canCancel && sourceTab !== 'ongoing';
  const isCompleted = Number(order?.status) === 7;
  const hasExistingFeedback =
    (existingMenuFeedbacks?.length ?? 0) > 0 || (existingServiceFeedbacks?.length ?? 0) > 0;

  const paidAmount = (payments ?? []).reduce((sum, p) => {
    return Number(p?.paymentStatus) === 2 ? sum + Number(p?.amount ?? 0) : sum;
  }, 0);
  const depositPayments = (payments ?? []).filter((p) => Number(p?.paymentType) === 1);
  const fullPayments = (payments ?? []).filter((p) => Number(p?.paymentType) === 2);

  const depositPlannedAmount = depositPayments.reduce((sum, p) => sum + Number(p?.amount ?? 0), 0);

  const totalPriceNum = Number(order?.totalPrice ?? 0);
  const depositAmount =
    depositPlannedAmount > 0 ? depositPlannedAmount : Math.round(totalPriceNum / 2);

  const depositPayment =
    depositPayments.find((p) => Number(p?.paymentStatus) === 2) ?? depositPayments[0] ?? null;
  const fullPayment =
    fullPayments.find((p) => Number(p?.paymentStatus) === 2) ?? fullPayments[0] ?? null;

  const extraChargeTotal = (extraCharges ?? []).reduce((sum, c) => {
    return sum + Number(c?.totalAmount ?? 0);
  }, 0);

  // "Thanh toán nốt" = (totalPrice - depositAmount) + tiền đền bù
  const dueFullPlusExtra = Math.max(0, totalPriceNum - depositAmount) + extraChargeTotal;

  // "Còn lại" được tính theo tổng phải trả = totalPrice + extraCharges
  const paymentRemainingAfterExtra = Math.max(0, Number(order?.totalPrice ?? 0) + extraChargeTotal - paidAmount);
  const isPaidFullAfterExtra = paymentRemainingAfterExtra <= 0;

  const mapOrderStatusToPartyStatus = (orderStatus) => {
    switch (orderStatus) {
      case 1:
      case 2:
      case 4:
        return 'Sắp tới';
      case 5:
      case 6:
        return 'Đang diễn ra';
      case 7:
        return 'Kết thúc tiệc';
      case 3:
      case 8:
        return 'Bị hủy';
      default:
        return null;
    }
  };

  const getOrderDetailStatusLabel = (od) => {
    const statusNum = Number(
      od?.status ?? od?.orderStatus ?? od?.orderDetailStatus ?? order?.status ?? 0
    );
    return mapOrderStatusToPartyStatus(statusNum);
  };

  const getDetailImageUri = (detail) => {
    const imgUrl = detail?.menuSnapshot?.imgUrl;
    return Array.isArray(imgUrl) ? imgUrl[0] : imgUrl;
  };

  const buildFeedbackTargets = () => {
    if (!orderDetails || orderDetails.length === 0) return [];
    const ratedMenuIds = new Set(
      (existingMenuFeedbacks || [])
        .map((fb) => Number(fb?.menuId ?? 0))
        .filter((id) => !!id),
    );
    const ratedServiceIds = new Set(
      (existingServiceFeedbacks || [])
        .map((fb) => Number(fb?.serviceId ?? 0))
        .filter((id) => !!id),
    );

    const targets = [];
    const seenTargetKeys = new Set();
    orderDetails.forEach((od) => {
      if (od.menuId) {
        const mid = Number(od.menuId);
        if (!ratedMenuIds.has(mid)) {
          const key = `menu:${mid}`;
          if (!seenTargetKeys.has(key)) {
            seenTargetKeys.add(key);
            targets.push({
              type: 'menu',
              id: mid,
              name: od.menuName || od.menuSnapshot?.menuName || 'Menu',
            });
          }
        }
      }
      const services = Array.isArray(od.serviceSnapshot?.services)
        ? od.serviceSnapshot.services
        : [];
      services.forEach((s) => {
        if (s.serviceId) {
          const sid = Number(s.serviceId);
          if (ratedServiceIds.has(sid)) return;
          const key = `service:${sid}`;
          if (!seenTargetKeys.has(key)) {
            seenTargetKeys.add(key);
            targets.push({
              type: 'service',
              id: sid,
              name: s.serviceName || 'Dịch vụ',
            });
          }
        }
      });
    });
    return targets;
  };

  useEffect(() => {
    if (!orderId) return;
    if (!isCompleted) {
      setExistingMenuFeedbacks([]);
      setExistingServiceFeedbacks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingFeedbacks(true);
      try {
        const [menuRes, serviceRes] = await Promise.all([
          fetch(`${API_URL}/api/feedback-menu?OrderId=${orderId}&page=1&pageSize=10`),
          fetch(`${API_URL}/api/feedback-service?OrderId=${orderId}&page=1&pageSize=10`),
        ]);
        const menuJson = await menuRes.json().catch(() => null);
        const serviceJson = await serviceRes.json().catch(() => null);
        const menuItems = Array.isArray(menuJson?.items) ? menuJson.items : [];
        const serviceItems = Array.isArray(serviceJson?.items) ? serviceJson.items : [];
        if (cancelled) return;
        setExistingMenuFeedbacks(menuItems);
        setExistingServiceFeedbacks(serviceItems);
      } catch (e) {
        if (cancelled) return;
        setExistingMenuFeedbacks([]);
        setExistingServiceFeedbacks([]);
      } finally {
        if (!cancelled) setLoadingFeedbacks(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, isCompleted]);

  const pickFeedbackImages = async () => {
    if (submittingFeedback) return;
    if (feedbackImages.length >= 4) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Quyền truy cập ảnh', 'Vui lòng cho phép truy cập thư viện ảnh để gửi đánh giá.');
        return;
      }

      const remaining = Math.max(0, 4 - feedbackImages.length);
      if (!remaining) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });

      if (result?.canceled) return;
      const assets = Array.isArray(result?.assets) ? result.assets : [];
      if (!assets.length) return;

      const next = assets.map((a, idx) => {
        const uri = a?.uri;
        return {
          uri,
          type: a?.mimeType || guessMimeTypeFromUri(uri),
          name: a?.fileName || getFileNameFromUri(uri, `feedback-${Date.now()}-${idx}.jpg`),
        };
      });

      setFeedbackImages((prev) => [...prev, ...next].slice(0, 2));
    } catch (_) { }
  };

  const openFeedbackFlow = () => {
    const targets = buildFeedbackTargets();
    if (!targets.length) return;
    setFeedbackTargets(targets);
    setCurrentFeedbackIndex(0);
    setFeedbackRating(5);
    setFeedbackComment('');
    setFeedbackImages([]);
    setFeedbackVisible(true);
  };

  const handleSubmitFeedback = async () => {
    if (submittingFeedback) return;
    const target = feedbackTargets[currentFeedbackIndex];
    if (!target || !orderId) return;
    setSubmittingFeedback(true);
    try {
      let customerId = null;
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (raw) {
          const user = JSON.parse(raw);
          customerId = user?.userId ?? user?.customerId ?? null;
        }
      } catch (e) { }

      const payloadBase = {
        orderId: Number(orderId),
        customerId: customerId ? Number(customerId) : 0,
        rating: feedbackRating,
        comment: feedbackComment?.trim() || '',
      };

      let url = '';
      if (target.type === 'menu') {
        url = `${API_URL}/api/feedback-menu`;
      } else {
        url = `${API_URL}/api/feedback-service`;
      }

      const formData = new FormData();
      formData.append('OrderId', String(payloadBase.orderId));
      formData.append('CustomerId', String(payloadBase.customerId));
      formData.append('Rating', String(payloadBase.rating));
      formData.append('Comment', payloadBase.comment);

      if (target.type === 'menu') {
        formData.append('MenuId', String(target.id));
      } else {
        formData.append('ServiceId', String(target.id));
      }

      // Backend expects array of uploaded files for `ImgFiles`.
      feedbackImages.forEach((img) => {
        if (!img?.uri) return;
        formData.append('ImgFiles', {
          uri: img.uri,
          type: img.type || guessMimeTypeFromUri(img.uri),
          name: img.name || getFileNameFromUri(img.uri, `feedback-${Date.now()}.jpg`),
        });
      });

      await fetch(url, {
        method: 'POST',
        body: formData,
      }).catch(() => { });

      const nextIndex = currentFeedbackIndex + 1;
      if (nextIndex < feedbackTargets.length) {
        setCurrentFeedbackIndex(nextIndex);
        setFeedbackRating(5);
        setFeedbackComment('');
        setFeedbackImages([]);
      } else {
        setFeedbackImages([]);
        setFeedbackVisible(false);

        // Refresh feedback list so "Đánh giá" button disappears after submit.
        if (orderId && isCompleted) {
          setLoadingFeedbacks(true);
          try {
            const [menuRes, serviceRes] = await Promise.all([
              fetch(`${API_URL}/api/feedback-menu?OrderId=${orderId}&page=1&pageSize=10`),
              fetch(`${API_URL}/api/feedback-service?OrderId=${orderId}&page=1&pageSize=10`),
            ]);
            const menuJson = await menuRes.json().catch(() => null);
            const serviceJson = await serviceRes.json().catch(() => null);
            const menuItems = Array.isArray(menuJson?.items) ? menuJson.items : [];
            const serviceItems = Array.isArray(serviceJson?.items) ? serviceJson.items : [];
            setExistingMenuFeedbacks(menuItems);
            setExistingServiceFeedbacks(serviceItems);
          } catch (_) {
            setExistingMenuFeedbacks([]);
            setExistingServiceFeedbacks([]);
          } finally {
            setLoadingFeedbacks(false);
          }
        }
      }
    } catch (e) {
      // bỏ qua lỗi, có thể bổ sung toast sau
    } finally {
      setSubmittingFeedback(false);
    }
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
                        <Ionicons name="ribbon-outline" size={16} color={TEXT_SECONDARY} style={styles.detailMetaIcon} />
                        <Text style={styles.detailMetaText}>
                          {od.partyCategoryName ?? od.partyCategory ?? '—'}
                        </Text>
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
                {(() => {
                  const detailStatusLabel = getOrderDetailStatusLabel(od);
                  if (!detailStatusLabel) return null;
                  return (
                    <View style={styles.statusSteps}>
                      {['Sắp tới', 'Đang diễn ra', 'Kết thúc tiệc'].map((step, index, arr) => {
                        const currentIndex = ['Sắp tới', 'Đang diễn ra', 'Kết thúc tiệc'].indexOf(
                          detailStatusLabel,
                        );
                        const isActive =
                          currentIndex >= 0 ? index <= currentIndex : step === detailStatusLabel;
                        return (
                          <View key={`${od.orderDetailId ?? idx}-${step}`} style={styles.statusStep}>
                            <View
                              style={[styles.statusDot, isActive && styles.statusDotActive]}
                            />
                            <Text
                              style={[
                                styles.statusLabel,
                                isActive && styles.statusLabelActive,
                              ]}
                            >
                              {step}
                            </Text>
                            {index < arr.length - 1 && <View style={styles.statusLine} />}
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
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
              {(payments ?? []).length > 0 && (
                <>
                  <View style={[styles.payRow, { marginTop: 4 }]}>
                    <View style={styles.payLabelWithIcon}>
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color={TEXT_SECONDARY}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.payLabel}>Cọc 50%</Text>
                    </View>
                    <Text style={styles.payValue}>{formatVnd(depositAmount)}</Text>
                  </View>
                  <View style={[styles.payRow, { marginTop: 8 }]}>
                    <Text style={styles.payLabel}>Thời gian</Text>
                    <Text style={styles.payValueSmall}>
                      {formatDateTime(depositPayment?.paidAt)}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Phương thức</Text>
                    <Text style={styles.payValueSmall}>
                      {formatPaymentMethod(depositPayment?.paymentMethod)}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Trạng thái</Text>
                    <Text style={styles.payValueSmall}>
                      {formatPaymentStatus(depositPayment?.paymentStatus)}
                    </Text>
                  </View>

                  {!loadingExtraCharges && (extraCharges?.length ?? 0) > 0 && (
                    <View style={styles.extraChargeSection}>
                      <View style={styles.extraChargeHeaderRow}>
                        <Text style={styles.extraChargeTitle}>Chi phí phát sinh</Text>
                        <Text style={styles.extraChargeTotal}>{formatVnd(extraChargeTotal)}</Text>
                      </View>

                      {extraCharges.map((c, idx) => {
                        const imgUrl = Array.isArray(c?.image) && c.image.length > 0 ? c.image[0] : null;
                        const amount = Number(c?.unitPrice ?? 0) * Number(c?.quantity ?? 1);
                        const displayTotal = Number(c?.totalAmount ?? amount ?? 0);
                        const timeIso = c?.incurredAt ?? c?.createdAt;
                        return (
                          <View key={c?.orderDetailExtraChargeId ?? idx} style={styles.extraChargeCard}>
                            <View style={styles.extraChargeTopRow}>
                              {imgUrl ? (
                                <TouchableOpacity
                                  activeOpacity={0.85}
                                  onPress={() => setPreviewExtraChargeImage(String(imgUrl))}
                                >
                                  <View style={styles.extraChargeImgWrap}>
                                    <ExpoImage
                                      source={{ uri: String(imgUrl) }}
                                      style={styles.extraChargeImg}
                                      contentFit="cover"
                                      cachePolicy="disk"
                                    />
                                  </View>
                                </TouchableOpacity>
                              ) : (
                                <View style={[styles.extraChargeImgWrap, styles.imagePlaceholder]} />
                              )}
                              <View style={styles.extraChargeInfo}>
                                <Text style={styles.extraChargeCardTitle}>{c?.title || 'Phụ phí'}</Text>
                                {!!c?.description && (
                                  <Text style={styles.extraChargeDesc} numberOfLines={2}>
                                    {String(c.description)}
                                  </Text>
                                )}
                                <View style={styles.extraChargeMeta}>
                                  <Text style={styles.extraChargeMetaText}>
                                    Đơn giá: {formatVnd(c?.unitPrice)} / {c?.unit || 'item'}
                                  </Text>
                                  <Text style={styles.extraChargeMetaText}>
                                    SL: {c?.quantity ?? 1}
                                  </Text>
                                  <Text style={styles.extraChargeMetaTextStrong}>
                                    Tổng: {formatVnd(displayTotal)}
                                  </Text>
                                  <Text style={styles.extraChargeMetaText}>
                                    Thời gian: {formatDateTime(timeIso)}
                                  </Text>
                                </View>
                                {!!c?.note && (
                                  <Text style={styles.extraChargeNote} numberOfLines={2}>
                                    Ghi chú: {String(c.note)}
                                  </Text>
                                )}
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  <View style={[styles.payRow, { marginTop: 14 }]}>
                    <View style={styles.payLabelWithIcon}>
                      <Ionicons
                        name="wallet-outline"
                        size={16}
                        color={TEXT_SECONDARY}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.payLabel}>Thanh toán nốt</Text>
                    </View>
                    <Text style={styles.payValue}>
                      {formatVnd(dueFullPlusExtra)}
                    </Text>
                  </View>
                  <View style={[styles.payRow, { marginTop: 8 }]}>
                    <Text style={styles.payLabel}>Thời gian</Text>
                    <Text style={styles.payValueSmall}>
                      {formatDateTime(fullPayment?.paidAt)}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Phương thức</Text>
                    <Text style={styles.payValueSmall}>
                      {formatPaymentMethod(fullPayment?.paymentMethod)}
                    </Text>
                  </View>
                  <View style={styles.payRow}>
                    <Text style={styles.payLabel}>Trạng thái</Text>
                    <Text style={styles.payValueSmall}>
                      {formatPaymentStatus(fullPayment?.paymentStatus)}
                    </Text>
                  </View>

                  {!isPaidFullAfterExtra && (
                    <View style={[styles.payRow, { marginTop: 10 }]}>
                      <Text style={styles.payLabelStrong}>Còn lại</Text>
                      <Text style={styles.payValueStrong}>
                        {formatVnd(paymentRemainingAfterExtra)}
                      </Text>
                    </View>
                  )}
                </>
              )}
            </>
          )}
        </View>

        {(() => {
          const pendingTargets = buildFeedbackTargets();
          const canShowFeedbackButton = !loading && isCompleted && !loadingFeedbacks && pendingTargets.length > 0;
          return canShowFeedbackButton ? (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.feedbackButton}
              activeOpacity={0.85}
              onPress={openFeedbackFlow}
            >
              <Ionicons
                name="star"
                size={18}
                color={BACKGROUND_WHITE}
                style={{ marginRight: 6 }}
              />
              <Text style={styles.feedbackButtonText}>Đánh giá đơn hàng</Text>
            </TouchableOpacity>
          </View>
          ) : null;
        })()}

        {!loading && isCompleted && (hasExistingFeedback || loadingFeedbacks) && (
          <View style={styles.section}>
            {loadingFeedbacks ? (
              <Text style={styles.feedbackSectionTitle}>Đang tải đánh giá...</Text>
            ) : (
              <>
                {(existingMenuFeedbacks?.length ?? 0) > 0 && (
                  <View style={{ marginBottom: (existingServiceFeedbacks?.length ?? 0) > 0 ? 14 : 0 }}>
                    <Text style={styles.feedbackSectionTitle}>Đánh giá của bạn về menu</Text>
                    {existingMenuFeedbacks.map((fb, idx) => (
                      <View key={`${fb.menuId ?? 'menu'}-${fb.feedbackId ?? idx}`} style={styles.feedbackItem}>
                        <Text style={styles.feedbackItemName} numberOfLines={2}>
                          {fb.menuName || `Menu #${fb.menuId ?? ''}`}
                        </Text>
                        <View style={styles.feedbackStarsSmallRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons
                              key={s}
                              name={s <= Number(fb.rating ?? 0) ? 'star' : 'star-outline'}
                              size={16}
                              color={PRIMARY_COLOR}
                            />
                          ))}
                        </View>
                        {!!fb.comment && (
                          <Text style={styles.feedbackItemComment}>{String(fb.comment)}</Text>
                        )}
                        <Text style={styles.feedbackItemMeta}>
                          {fb?.customerName || `#${fb?.customerId ?? ''}`}
                          {!!fb?.createdAt ? ` · ${formatDateTime(fb.createdAt)}` : ''}
                        </Text>
                        {Array.isArray(fb?.img) && fb.img.length > 0 && (
                          <View style={styles.feedbackItemImageRow}>
                            {fb.img.slice(0, 2).map((imgUrl, i) => (
                              <TouchableOpacity
                                key={`${imgUrl}-${i}`}
                                activeOpacity={0.85}
                                onPress={() => setPreviewFeedbackImage(String(imgUrl))}
                              >
                                <ExpoImage
                                  source={{ uri: String(imgUrl) }}
                                  style={styles.feedbackItemImageThumb}
                                  contentFit="cover"
                                  cachePolicy="disk"
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {(existingServiceFeedbacks?.length ?? 0) > 0 && (
                  <View>
                    <Text style={styles.feedbackSectionTitle}>Đánh giá của bạn về dịch vụ</Text>
                    {existingServiceFeedbacks.map((fb, idx) => (
                      <View key={`${fb.serviceId ?? 'service'}-${fb.feedbackId ?? idx}`} style={styles.feedbackItem}>
                        <Text style={styles.feedbackItemName} numberOfLines={2}>
                          {fb.serviceName || `Dịch vụ #${fb.serviceId ?? ''}`}
                        </Text>
                        <View style={styles.feedbackStarsSmallRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Ionicons
                              key={s}
                              name={s <= Number(fb.rating ?? 0) ? 'star' : 'star-outline'}
                              size={16}
                              color={PRIMARY_COLOR}
                            />
                          ))}
                        </View>
                        {!!fb.comment && (
                          <Text style={styles.feedbackItemComment}>{String(fb.comment)}</Text>
                        )}
                        <Text style={styles.feedbackItemMeta}>
                          {fb?.customerName || `#${fb?.customerId ?? ''}`}
                          {!!fb?.createdAt ? ` · ${formatDateTime(fb.createdAt)}` : ''}
                        </Text>
                        {Array.isArray(fb?.img) && fb.img.length > 0 && (
                          <View style={styles.feedbackItemImageRow}>
                            {fb.img.slice(0, 2).map((imgUrl, i) => (
                              <TouchableOpacity
                                key={`${imgUrl}-${i}`}
                                activeOpacity={0.85}
                                onPress={() => setPreviewFeedbackImage(String(imgUrl))}
                              >
                                <ExpoImage
                                  source={{ uri: String(imgUrl) }}
                                  style={styles.feedbackItemImageThumb}
                                  contentFit="cover"
                                  cachePolicy="disk"
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Feedback modal */}
      <Modal
        visible={feedbackVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingFeedback) setFeedbackVisible(false);
        }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.feedbackOverlay}>
            <KeyboardAvoidingView
              style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={0}
            >
              <TouchableWithoutFeedback onPress={() => { }}>
                <View style={styles.feedbackCard}>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 10 }}
                  >
                    <TouchableOpacity
                      style={styles.feedbackCloseButton}
                      onPress={() => !submittingFeedback && setFeedbackVisible(false)}
                      activeOpacity={0.7}
                    >
                    </TouchableOpacity>

                    {feedbackTargets[currentFeedbackIndex] && (
                      <>
                        <Text style={styles.feedbackTitle}>
                          Đánh giá{' '}
                          {feedbackTargets[currentFeedbackIndex].type === 'menu'
                            ? 'menu'
                            : 'dịch vụ'}
                        </Text>
                        <Text style={styles.feedbackSubtitle} numberOfLines={2}>
                          {feedbackTargets[currentFeedbackIndex].name}
                        </Text>
                      </>
                    )}

                    <View style={styles.feedbackImagesSection}>
                      <TouchableOpacity
                        style={styles.feedbackImagesPickBtn}
                        activeOpacity={0.8}
                        disabled={submittingFeedback}
                        onPress={pickFeedbackImages}
                      >
                        <Ionicons name="image-outline" size={18} color={TEXT_PRIMARY} />
                        <Text style={styles.feedbackImagesPickText}>Chọn ảnh</Text>
                        <Text style={styles.feedbackImagesPickSubText}>
                          ({feedbackImages.length}/4)
                        </Text>
                      </TouchableOpacity>

                      {!!feedbackImages.length && (
                        <View style={styles.feedbackImagesRow}>
                          {feedbackImages.map((img, idx) => (
                            <TouchableOpacity
                              key={`${img?.name ?? 'img'}-${idx}`}
                              style={styles.feedbackImageThumbWrap}
                              activeOpacity={0.85}
                              disabled={submittingFeedback}
                              onPress={() =>
                                setFeedbackImages((prev) => prev.filter((_, i) => i !== idx))
                              }
                            >
                              <ExpoImage
                                source={{ uri: img.uri }}
                                style={styles.feedbackImageThumb}
                              />
                              <View style={styles.feedbackImageRemoveBadge}>
                                <Ionicons name="close" size={12} color={BACKGROUND_WHITE} />
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                          key={star}
                          style={styles.starButton}
                          activeOpacity={0.7}
                          onPress={() => setFeedbackRating(star)}
                          disabled={submittingFeedback}
                        >
                          <Ionicons
                            name={star <= feedbackRating ? 'star' : 'star-outline'}
                            size={28}
                            color={PRIMARY_COLOR}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.feedbackInputBox}>
                      <Text style={styles.feedbackInputLabel}>Nhận xét</Text>
                      <TextInput
                        style={styles.feedbackInput}
                        multiline
                        placeholder="Hãy chia sẻ trải nghiệm của bạn..."
                        placeholderTextColor={TEXT_SECONDARY}
                        value={feedbackComment}
                        onChangeText={setFeedbackComment}
                        editable={!submittingFeedback}
                      />
                    </View>

                    <View style={styles.feedbackActions}>
                      <TouchableOpacity
                        style={[styles.feedbackActionBtn, styles.feedbackCancelBtn]}
                        activeOpacity={0.8}
                        disabled={submittingFeedback}
                        onPress={() => setFeedbackVisible(false)}
                      >
                        <Text style={styles.feedbackCancelText}>Đóng</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.feedbackActionBtn, styles.feedbackSubmitBtn]}
                        activeOpacity={0.8}
                        disabled={submittingFeedback}
                        onPress={handleSubmitFeedback}
                      >
                        <Text style={styles.feedbackSubmitText}>
                          {submittingFeedback ? 'Đang gửi...' : 'Gửi đánh giá'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={!!previewFeedbackImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewFeedbackImage('')}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewFeedbackImage('')}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color={BACKGROUND_WHITE} />
          </TouchableOpacity>
          <ExpoImage
            source={{ uri: previewFeedbackImage }}
            style={styles.previewImage}
            contentFit="contain"
            cachePolicy="disk"
          />
        </View>
      </Modal>

      {/* Extra charge preview modal */}
      <Modal
        visible={!!previewExtraChargeImage}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewExtraChargeImage('')}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewExtraChargeImage('')}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={24} color={BACKGROUND_WHITE} />
          </TouchableOpacity>
          <ExpoImage
            source={{ uri: previewExtraChargeImage }}
            style={styles.previewImage}
            contentFit="contain"
            cachePolicy="disk"
          />
        </View>
      </Modal>

      {/* Bottom: cancel button if pending and not from "Đang diễn ra" tab */}
      {showCancelButton && (
        <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={() => {
                // TODO: call cancel API when backend ready
              }}
            >
              <Text style={styles.cancelButtonText}>Hủy đơn</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
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
  statusSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 16,
  },
  statusStep: {
    flex: 1,
    alignItems: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  statusDotActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  statusLabel: {
    marginTop: 4,
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  statusLabelActive: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  statusLine: {
    position: 'absolute',
    top: 6,
    right: -40,
    width: 80,
    height: 2,
    backgroundColor: '#E0E0E0',
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
  extraChargeSection: {
    marginTop: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 12,
  },
  extraChargeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  extraChargeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  extraChargeTotal: {
    fontSize: 14,
    fontWeight: '900',
    color: PRIMARY_COLOR,
  },
  extraChargeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  extraChargeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  extraChargeImgWrap: {
    width: 62,
    height: 62,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: '#E0E0E0',
  },
  extraChargeImg: {
    width: '100%',
    height: '100%',
  },
  extraChargeInfo: {
    flex: 1,
  },
  extraChargeCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  extraChargeDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  extraChargeMeta: {
    gap: 2,
  },
  extraChargeMetaText: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  extraChargeMetaTextStrong: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '800',
  },
  extraChargeNote: {
    marginTop: 6,
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  extraChargeOrange: {
    color: '#FF8A00',
    fontWeight: '900',
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
  feedbackButton: {
    marginTop: 8,
    height: 48,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 15,
    fontWeight: '700',
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  feedbackCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: BACKGROUND_WHITE,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 16,
  },
  feedbackCloseButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  feedbackSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  starButton: {
    paddingHorizontal: 4,
  },
  feedbackInputBox: {
    marginTop: 10,
  },
  feedbackInputLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  feedbackInput: {
    minHeight: 80,
    maxHeight: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    textAlignVertical: 'top',
  },
  feedbackActions: {
    flexDirection: 'row',
    columnGap: 10,
    marginTop: 16,
  },
  feedbackActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackCancelBtn: {
    backgroundColor: BACKGROUND_WHITE,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  feedbackSubmitBtn: {
    backgroundColor: PRIMARY_COLOR,
  },
  feedbackCancelText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  feedbackSubmitText: {
    fontSize: 14,
    color: BACKGROUND_WHITE,
    fontWeight: '700',
  },
  feedbackSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  feedbackItem: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: BACKGROUND_WHITE,
  },
  feedbackItemName: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  feedbackStarsSmallRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 4,
    columnGap: 2,
  },
  feedbackItemComment: {
    marginTop: 6,
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  feedbackItemMeta: {
    marginTop: 6,
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  feedbackItemImageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  feedbackItemImageThumb: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#EAEAEA',
    marginRight: 8,
    marginBottom: 8,
  },
  feedbackImagesSection: {
    marginTop: 10,
  },
  feedbackImagesPickBtn: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feedbackImagesPickText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  feedbackImagesPickSubText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  feedbackImagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  feedbackImageThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#EAEAEA',
    position: 'relative',
  },
  feedbackImageThumb: {
    width: '100%',
    height: '100%',
  },
  feedbackImageRemoveBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 52,
    right: 18,
    zIndex: 5,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '72%',
  },
});

