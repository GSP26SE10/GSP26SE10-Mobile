import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { useSwipeBack } from '../hooks/useSwipeBack';
import {
  TEXT_PRIMARY,
  BACKGROUND_WHITE,
  PRIMARY_COLOR,
  TEXT_SECONDARY,
  BORDER_LIGHT,
} from '../constants/colors';
import API_URL from '../constants/api';
import { getOrderStatusProgressStepIndex } from '../utils/orderStatusSteps';
import { getAccessToken } from '../utils/auth';

const formatTimeRangeFromOrder = (order) => {
  const startIso = order?.startTime ?? order?.schedule?.startTime;
  const endIso = order?.endTime ?? order?.schedule?.endTime;
  if (!startIso) return '—';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${time(end)}, ${date(start)}`;
};

const TASK_STATUS_LABEL = {
  1: 'Chưa bắt đầu',
  2: 'Đang thực hiện',
  3: 'Hoàn thành',
  5: 'Trễ deadline',
};

const getTaskStatusNumber = (task) => Number(task?.taskStatus ?? task?.status ?? 1);

const formatTaskDeadline = (startIso, endIso) => {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${time(end)}, ${date(start)}`;
};

const mapApiTaskToDisplay = (t) => {
  const statusNum = getTaskStatusNumber(t);
  const dateLabel = t.startTime
    ? `${String(new Date(t.startTime).getDate()).padStart(2, '0')}/${String(new Date(t.startTime).getMonth() + 1).padStart(2, '0')}/${new Date(t.startTime).getFullYear()}`
    : '';
  const timeLabel = t.startTime && t.endTime
    ? `${new Date(t.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(t.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return {
    id: t.taskId,
    title: t.taskName || '—',
    taskStatus: statusNum,
    dateLabel,
    timeLabel,
    assignee: t.assigneeName || t.assignee || '—',
    note: t.note || '',
    status: TASK_STATUS_LABEL[statusNum] ?? TASK_STATUS_LABEL[String(statusNum)] ?? 'Chưa bắt đầu',
    startTime: t.startTime,
    endTime: t.endTime,
  };
};

const mockPartyDetail = {
  id: 0,
  image: null,
  name: '—',
  dishes: '—',
  guests: '—',
  timeRange: '—',
  address: '—',
  contactName: '—',
  phone: '',
  subtotal: '—',
  deposit: '—',
  remaining: '—',
};

const pickMenuId = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
};

const resolveMenuIdFromOrder = (order) => {
  if (!order || typeof order !== 'object') return null;
  const menu = order.menu || {};
  const menuSnapshot = order.menuSnapshot || {};
  return pickMenuId(
    order.menuId,
    order.menuID,
    menu.menuId,
    menu.menuID,
    menu.id,
    menuSnapshot.menuId,
    menuSnapshot.menuID,
    menuSnapshot.id
  );
};

const PAYMENT_METHOD_LABEL = {
  1: 'Tiền mặt',
  2: 'Chuyển khoản ngân hàng',
  3: 'ZaloPay',
};

const PAYMENT_TYPE_LABEL = {
  1: 'Thanh toán cọc',
  2: 'Thanh toán nốt',
};

const PAYMENT_STATUS_LABEL = {
  1: 'Chưa thanh toán',
  2: 'Đã thanh toán',
  3: 'Đã hủy',
};

export default function LeaderOrderDetailHistoryScreen({ navigation, route }) {
  const orderFromParams = route?.params?.order;
  const [currentOrder, setCurrentOrder] = useState(orderFromParams ?? null);
  const formatVnd = (n) =>
    n != null && n !== '' ? `${Number(n).toLocaleString('vi-VN')}₫` : '—';
  const effectiveOrder = currentOrder ?? orderFromParams ?? null;

  const partyDetail = effectiveOrder
    ? {
        id: effectiveOrder.orderDetailId,
        image: effectiveOrder.menuImage ?? effectiveOrder?.menu?.image ?? null,
        name: effectiveOrder.menuName ?? effectiveOrder?.menu?.name ?? '—',
        dishes: effectiveOrder.partyCategory ?? effectiveOrder?.party?.category ?? '—',
        guests: `${effectiveOrder.numberOfGuests ?? effectiveOrder?.party?.numberOfGuests ?? 0} NGƯỜI`,
        timeRange: formatTimeRangeFromOrder(effectiveOrder),
        address: effectiveOrder.address ?? effectiveOrder?.schedule?.address ?? '—',
        contactName: effectiveOrder.customerName ?? effectiveOrder?.customer?.name ?? '—',
        phone: effectiveOrder.customerPhone ?? effectiveOrder?.customer?.phone ?? '',
        subtotal: formatVnd(effectiveOrder.totalPrice),
        deposit: formatVnd(effectiveOrder.depositAmount),
        remaining: formatVnd(effectiveOrder.remainingAmount),
        menuId: resolveMenuIdFromOrder(effectiveOrder),
      }
    : mockPartyDetail;

  const selectedServices = useMemo(() => {
    const list = effectiveOrder?.serviceSnapshot?.services;
    return Array.isArray(list) ? list : [];
  }, [effectiveOrder?.serviceSnapshot?.services]);

  const selectedCustomDishes = useMemo(() => {
    const list = effectiveOrder?.customDishSnapshot?.customDishes;
    return Array.isArray(list) ? list : [];
  }, [effectiveOrder?.customDishSnapshot?.customDishes]);

  const initialExtraCharges = useMemo(() => {
    const list = Array.isArray(effectiveOrder?.extraCharges) ? effectiveOrder.extraCharges : [];
    return list;
  }, [effectiveOrder?.extraCharges]);

  const tasks = (effectiveOrder?.tasks && Array.isArray(effectiveOrder.tasks))
    ? effectiveOrder.tasks.map(mapApiTaskToDisplay)
    : [];

  const [activeTab, setActiveTab] = useState('overview');
  const [taskEvidenceMap, setTaskEvidenceMap] = useState({});
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const orderId =
    effectiveOrder?.orderId ??
    effectiveOrder?.orderDetailId ??
    effectiveOrder?.id ??
    route?.params?.orderId ??
    route?.params?.orderDetailId ??
    null;

  const [extraCharges, setExtraCharges] = useState(initialExtraCharges);
  const [loadingExtraCharges, setLoadingExtraCharges] = useState(false);
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  useEffect(() => {
    setCurrentOrder(orderFromParams ?? null);
  }, [orderFromParams]);

  useEffect(() => {
    setExtraCharges(initialExtraCharges);
  }, [initialExtraCharges]);

  const fetchOrderDetailByIds = async ({ token, orderId, orderDetailId }) => {
    if (!orderId || !orderDetailId) return null;
    const res = await fetch(
      `${API_URL}/api/order-detail?OrderDetailId=${encodeURIComponent(String(orderDetailId))}&OrderId=${encodeURIComponent(String(orderId))}&page=1&pageSize=10`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    const items = Array.isArray(json?.items) ? json.items : [];
    return (
      items.find(
        (item) =>
          Number(item?.orderDetailId) === Number(orderDetailId) &&
          Number(item?.orderId) === Number(orderId)
      ) || items[0] || null
    );
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const orderIdValue =
        effectiveOrder?.orderId ??
        orderFromParams?.orderId ??
        route?.params?.orderId ??
        null;
      const orderDetailIdValue =
        effectiveOrder?.orderDetailId ??
        orderFromParams?.orderDetailId ??
        route?.params?.orderDetailId ??
        null;
      if (!orderIdValue || !orderDetailIdValue) return;
      try {
        const token = await getAccessToken();
        const detailOrder = await fetchOrderDetailByIds({
          token,
          orderId: orderIdValue,
          orderDetailId: orderDetailIdValue,
        });
        if (!detailOrder || cancelled) return;
        const baseOrder = effectiveOrder ?? orderFromParams ?? {};
        setCurrentOrder({
          ...baseOrder,
          ...detailOrder,
          // order-detail API can miss task list from overview.
          tasks: Array.isArray(baseOrder?.tasks)
            ? baseOrder.tasks
            : Array.isArray(detailOrder?.tasks)
              ? detailOrder.tasks
              : [],
        });
      } catch (_) {
        // Keep current order data if detail API fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrder?.orderId, effectiveOrder?.orderDetailId, orderFromParams, route?.params?.orderId, route?.params?.orderDetailId]);

  const fetchTaskEvidence = async (taskId) => {
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/api/order-detail-staff-task?TaskId=${taskId}&page=1&pageSize=10`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const first = items[0];
      return first?.img || null;
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId) return;
      try {
        setLoadingExtraCharges(true);
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/api/order-detail-extra-charge/order/${orderId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
        if (!cancelled) setExtraCharges(list.length > 0 ? list : initialExtraCharges);
      } catch (_) {
        if (!cancelled) setExtraCharges(initialExtraCharges);
      } finally {
        if (!cancelled) setLoadingExtraCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, initialExtraCharges]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const targetOrderId =
        effectiveOrder?.orderId ??
        orderFromParams?.orderId ??
        route?.params?.orderId ??
        null;
      if (!targetOrderId) {
        setPayments([]);
        return;
      }
      try {
        setLoadingPayments(true);
        const token = await getAccessToken();
        const res = await fetch(
          `${API_URL}/api/payment?OrderId=${encodeURIComponent(String(targetOrderId))}&page=1&pageSize=10`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.items) ? json.items : Array.isArray(json) ? json : [];
        if (!cancelled) {
          const sorted = [...list].sort((a, b) => {
            const tA = new Date(a?.paidAt ?? 0).getTime();
            const tB = new Date(b?.paidAt ?? 0).getTime();
            return tB - tA;
          });
          setPayments(sorted);
        }
      } catch (_) {
        if (!cancelled) setPayments([]);
      } finally {
        if (!cancelled) setLoadingPayments(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveOrder?.orderId, orderFromParams?.orderId, route?.params?.orderId]);

  useEffect(() => {
    const fetchAllEvidence = async () => {
      const evidenceMap = {};
      for (const task of tasks) {
        const taskId = task.id;
        if (taskId != null) {
          const evidenceUrl = await fetchTaskEvidence(taskId);
          if (evidenceUrl) {
            evidenceMap[taskId] = evidenceUrl;
          }
        }
      }
      setTaskEvidenceMap(evidenceMap);
    };
    if (tasks.length > 0) {
      fetchAllEvidence();
    }
  }, [tasks]);

  const extraChargeTotal = useMemo(() => {
    return (Array.isArray(extraCharges) ? extraCharges : []).reduce(
      (sum, it) => sum + Number(it?.totalAmount ?? 0),
      0,
    );
  }, [extraCharges]);
  const formatDateTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (_) {
      return '';
    }
  };
  const actualEndTimeLabel = formatDateTime(effectiveOrder?.actualEndTime);
  const hasOvertimeMinutes = effectiveOrder?.overtimeMinutes != null;
  const overtimeMinutesLabel = hasOvertimeMinutes
    ? `${Number(effectiveOrder?.overtimeMinutes || 0).toLocaleString('vi-VN')} phút`
    : '';
  const hasServiceDurationMinutes = effectiveOrder?.serviceDurationMinutes != null;
  const serviceDurationMinutesLabel = hasServiceDurationMinutes
    ? `${Number(effectiveOrder?.serviceDurationMinutes || 0).toLocaleString('vi-VN')} phút`
    : '';
  const noteOrderDetailText = String(effectiveOrder?.noteOrderDetail ?? '').trim();

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${partyDetail.name}`);
    const details = encodeURIComponent(
      `${partyDetail.dishes}, ${partyDetail.guests}, ${partyDetail.address}`
    );
    let datesParam = '';
    if (effectiveOrder?.startTime) {
      try {
        const start = new Date(effectiveOrder.startTime);
        const end = effectiveOrder.endTime ? new Date(effectiveOrder.endTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
        const format = (d) =>
          `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
        datesParam = `&dates=${format(start)}/${format(end)}`;
      } catch (e) {}
    }
    const url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}${datesParam}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể mở Google Calendar.');
    }
  };

  const handleOpenMaps = async () => {
    const query = encodeURIComponent(partyDetail.address || '');
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể mở Google Maps.');
    }
  };

  const handleCallPhone = () => {
    if (!partyDetail.phone) {
      Alert.alert('Thông báo', 'Chưa có số điện thoại.');
      return;
    }
    Alert.alert('Gọi điện', `Bạn có muốn gọi ${partyDetail.phone} không?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gọi',
        style: 'destructive',
        onPress: async () => {
          try {
            await Linking.openURL(`tel:${partyDetail.phone}`);
          } catch (e) {
            Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi.');
          }
        },
      },
    ]);
  };

  const renderStatusSteps = () => {
    const steps = ['Đang chuẩn bị', 'Đang diễn ra', 'Kết thúc tiệc'];
    const orderStatus = effectiveOrder?.orderStatus ?? route?.params?.orderStatus;
    const mapped = getOrderStatusProgressStepIndex(orderStatus);
    // 4→0, 5/6→1, 7→2; mã khác giữ như cũ (coi như đã xong)
    const currentIndex = mapped != null ? mapped : 2;
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isActive = index <= currentIndex;
          return (
            <View key={step} style={styles.statusStep}>
              <View
                style={[
                  styles.statusDot,
                  isActive && styles.statusDotActive,
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  isActive && styles.statusLabelActive,
                ]}
              >
                {step}
              </Text>
              {index < steps.length - 1 && <View style={styles.statusLine} />}
            </View>
          );
        })}
      </View>
    );
  };

  const renderOverviewTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={styles.partyCard}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate('MenuDetail', {
            menuId: partyDetail.menuId,
            menuName: partyDetail.name,
            buffetType: partyDetail.dishes,
            menuImage: partyDetail.image,
            fromStaff: true,
            readOnly: true,
          })
        }
      >
        {partyDetail.image ? (
          <Image
            source={{ uri: partyDetail.image }}
            style={styles.partyImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.partyImagePlaceholder}>
            <Ionicons name="image-outline" size={40} color={TEXT_SECONDARY} />
          </View>
        )}
        <View style={styles.partyCardLeft}>
          <Text style={styles.partyName}>{partyDetail.name}</Text>
          <Text style={styles.partyMeta}>
            {partyDetail.dishes} · {partyDetail.guests}
          </Text>
          <Text style={styles.partyMeta}>
            <Text style={styles.partyMetaLabel}>Thời gian: </Text>
            <Text style={styles.partyLink} onPress={handleOpenCalendar}>
              {partyDetail.timeRange}
            </Text>
          </Text>
          <Text style={styles.partyMeta}>Địa chỉ: </Text>
          <Text
            style={[styles.partyAddress, styles.partyLink]}
            numberOfLines={2}
            onPress={handleOpenMaps}
          >
            {partyDetail.address}
          </Text>
          <Text style={styles.partyContact}>
            Khách hàng: {partyDetail.contactName}
          </Text>
          {partyDetail.phone ? (
            <Text
              style={[styles.partyContact, styles.partyPhone]}
              onPress={handleCallPhone}
            >
              Số điện thoại: {partyDetail.phone}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
      </TouchableOpacity>

      {selectedServices.length > 0 && (
        <View style={styles.snapshotSectionCard}>
          <Text style={styles.snapshotSectionTitle}>Dịch vụ đã chọn</Text>
          {selectedServices.map((service, idx) => (
            <View key={`svc-${service?.serviceId ?? idx}-${idx}`} style={styles.snapshotRowItem}>
              {service?.img && (
                <Image
                  source={{ uri: service.img }}
                  style={styles.snapshotItemImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.snapshotRowTitle}>{service?.serviceName || 'Dịch vụ'}</Text>
              <Text style={styles.snapshotRowMeta}>
                SL: {service?.quantity ?? 1} · Đơn giá: {formatVnd(service?.basePrice ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {selectedCustomDishes.length > 0 && (
        <View style={styles.snapshotSectionCard}>
          <Text style={styles.snapshotSectionTitle}>Món lẻ đã chọn</Text>
          {selectedCustomDishes.map((dish, idx) => (
            <View key={`dish-${dish?.dishId ?? idx}-${idx}`} style={styles.snapshotRowItem}>
              {dish?.img && (
                <Image
                  source={{ uri: dish.img }}
                  style={styles.snapshotItemImage}
                  resizeMode="contain"
                />
              )}
              <Text style={styles.snapshotRowTitle}>{dish?.dishName || 'Món lẻ'}</Text>
              <Text style={styles.snapshotRowMeta}>
                Đơn giá: {formatVnd(dish?.unitPrice ?? 0)} · Tổng: {formatVnd(dish?.totalAmount ?? 0)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {renderStatusSteps()}

      {(!!actualEndTimeLabel || hasOvertimeMinutes || hasServiceDurationMinutes || !!noteOrderDetailText) && (
        <View style={[styles.summarySection, { marginBottom: 14 }]}>
          {!!actualEndTimeLabel && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thời gian kết thúc thực tế</Text>
              <Text style={styles.summaryValue}>{actualEndTimeLabel}</Text>
            </View>
          )}
          {hasOvertimeMinutes && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thời gian quá giờ</Text>
              <Text style={styles.summaryValue}>{overtimeMinutesLabel}</Text>
            </View>
          )}
          {hasServiceDurationMinutes && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thời gian phục vụ</Text>
              <Text style={styles.summaryValue}>{serviceDurationMinutesLabel}</Text>
            </View>
          )}
          {!!noteOrderDetailText && (
            <View style={styles.summaryNoteBox}>
              <Text style={styles.summaryNoteTitle}>Ghi chú</Text>
              <Text style={styles.summaryNoteText}>{noteOrderDetailText}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.summarySection}>
        <View style={[styles.summaryRow, { marginTop: 8 }]}>
          <Text style={styles.summaryLabel}>Tổng tiền</Text>
          <Text style={styles.summaryValue}>{partyDetail.subtotal}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Đã cọc</Text>
          <Text style={styles.summaryValue}>{partyDetail.deposit}</Text>
        </View>
        {extraChargeTotal > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Chi phí phát sinh</Text>
            <Text style={styles.summaryValue}>{formatVnd(extraChargeTotal)}</Text>
          </View>
        )}
        {Number(effectiveOrder?.remainingAmount ?? 0) > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.summaryHighlight]}>
              Còn lại
            </Text>
            <Text style={[styles.summaryValue, styles.summaryHighlight]}>
              {partyDetail.remaining}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.extraChargeSection}>
        <Text style={styles.extraChargeTitle}>Chi phí phát sinh</Text>
        {loadingExtraCharges ? (
          <Text style={styles.extraChargeHint}>Đang tải...</Text>
        ) : extraCharges.length === 0 ? (
          <Text style={styles.extraChargeHint}>Không có chi phí phát sinh.</Text>
        ) : (
          extraCharges.map((ec, idx) => {
            const images = Array.isArray(ec?.images)
              ? ec.images
              : Array.isArray(ec?.image)
                ? ec.image
                : [];
            return (
              <View
                key={String(ec?.orderDetailExtraChargeId ?? ec?.id ?? `${ec?.extraChargeCatalogId ?? 'ec'}-${idx}`)}
                style={styles.extraChargeCard}
              >
                <View style={styles.extraChargeTopRow}>
                  <Text style={styles.extraChargeCardTitle} numberOfLines={2}>
                    {ec?.title || '—'}
                  </Text>
                  <Text style={styles.extraChargeAmount}>
                    {formatVnd(ec?.totalAmount ?? 0)}
                  </Text>
                </View>
                <Text style={styles.extraChargeMeta}>
                  {`${formatVnd(ec?.unitPrice ?? 0)} × ${ec?.quantity ?? 0} ${ec?.unit || ''}`.trim()}
                </Text>
                <Text style={styles.extraChargeMeta}>
                  {(ec?.creatorName || ec?.createdBy?.name)
                    ? `Người tạo: ${ec?.creatorName || ec?.createdBy?.name}`
                    : '—'}
                  {!!(ec?.createdAt || ec?.incurredAt)
                    ? ` · ${formatDateTime(ec?.createdAt || ec?.incurredAt)}`
                    : ''}
                </Text>
                {!!ec?.note && <Text style={styles.extraChargeNote}>{String(ec.note)}</Text>}
                {!!images.length && (
                  <View style={styles.extraChargeImgRow}>
                    {images.slice(0, 4).map((u, i) => (
                      <Image
                        key={`${u}-${i}`}
                        source={{ uri: String(u) }}
                        style={styles.extraChargeImg}
                        resizeMode="contain"
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>

      <View style={styles.paymentSection}>
        <View style={styles.payHeaderRow}>
          <Ionicons
            name="card-outline"
            size={18}
            color={TEXT_SECONDARY}
            style={{ marginRight: 6 }}
          />
          <Text style={styles.paymentTitle}>Thanh toán</Text>
        </View>
        {loadingPayments ? (
          <Text style={styles.paymentHint}>Đang tải...</Text>
        ) : payments.length === 0 ? (
          <Text style={styles.paymentHint}>Chưa có giao dịch thanh toán.</Text>
        ) : (
          payments.map((p, idx) => (
            <View
              key={String(p?.paymentId ?? `payment-${idx}`)}
              style={[styles.paymentCard, idx > 0 && { marginTop: 10 }]}
            >
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Loại</Text>
                <Text style={styles.summaryValue}>
                  {PAYMENT_TYPE_LABEL[Number(p?.paymentType)] ?? '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phương thức</Text>
                <Text style={styles.summaryValue}>
                  {PAYMENT_METHOD_LABEL[Number(p?.paymentMethod)] ?? '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Thời gian</Text>
                <Text style={styles.summaryValue}>{formatDateTime(p?.paidAt)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Trạng thái</Text>
                <Text style={styles.summaryValue}>
                  {PAYMENT_STATUS_LABEL[Number(p?.paymentStatus)] ?? '—'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, styles.summaryHighlight]}>Số tiền</Text>
                <Text style={[styles.summaryValue, styles.summaryHighlight]}>
                  {formatVnd(p?.amount ?? 0)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  const renderTasksTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={tasks.length === 0 ? styles.tasksListEmpty : styles.tasksList}
      showsVerticalScrollIndicator={false}
    >
      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="cube-outline"
            size={64}
            color={PRIMARY_COLOR}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>Không có công việc</Text>
        </View>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <View style={styles.taskInfo}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {(task.timeLabel || task.dateLabel) && (
                <Text style={styles.taskMeta}>
                  Deadline: {task.dateLabel ? `${task.dateLabel} · ` : ''}{task.timeLabel || formatTaskDeadline(task.startTime, task.endTime)}
                </Text>
              )}
              {!!task.assignee && task.assignee !== '—' && (
                <Text style={styles.taskMeta}>Nhân viên: {task.assignee}</Text>
              )}
              {taskEvidenceMap[task.id] && (
                <Image
                  source={{ uri: taskEvidenceMap[task.id] }}
                  style={styles.taskEvidenceThumb}
                  resizeMode="contain"
                />
              )}
            </View>
            {(() => {
              const statusNum = getTaskStatusNumber(task);
              const isDone = statusNum === 3;
              const isInProgress = statusNum === 2;
              const isOverdue = statusNum === 5;
              return (
            <View
              style={[
                styles.taskStatusBadge,
                isDone && styles.taskStatusBadgeDone,
                isInProgress && styles.taskStatusBadgeInProgress,
                isOverdue && styles.taskStatusBadgeOverdue,
              ]}
            >
              <Text
                style={[
                  styles.taskStatusText,
                  isDone && styles.taskStatusTextDone,
                  isInProgress && styles.taskStatusTextInProgress,
                  isOverdue && styles.taskStatusTextOverdue,
                ]}
              >
                {task.status}
              </Text>
            </View>
              );
            })()}
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
      {...swipeBack.panHandlers}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'overview' && styles.tabLabelActive,
            ]}
          >
            Tổng quan
          </Text>
          {activeTab === 'overview' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tab}
          onPress={() => setActiveTab('tasks')}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'tasks' && styles.tabLabelActive,
            ]}
          >
            Công việc
          </Text>
          {activeTab === 'tasks' && <View style={styles.tabIndicator} />}
        </TouchableOpacity>
      </View>

      {activeTab === 'overview' ? renderOverviewTab() : renderTasksTab()}

      <BottomNavigationStaff
        activeTab="LeaderOrderHistory"
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
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    paddingTop: 4,
    paddingBottom: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: PRIMARY_COLOR,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 100,
  },
  partyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
  },
  partyImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginRight: 10,
  },
  partyCardLeft: {
    flex: 1,
    marginRight: 4,
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
  partyMetaLabel: {
    fontWeight: '500',
  },
  partyLink: {
    color: PRIMARY_COLOR,
    textDecorationLine: 'underline',
  },
  partyAddress: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  partyContact: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  partyPhone: {
    color: PRIMARY_COLOR,
    textDecorationLine: 'underline',
  },
  partyImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  snapshotSectionCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FAFAFA',
    padding: 12,
    marginTop: -10,
    marginBottom: 16,
  },
  snapshotSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  snapshotRowItem: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  snapshotRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  snapshotRowMeta: {
    marginTop: 2,
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  snapshotItemImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    backgroundColor: '#EAEAEA',
    marginBottom: 8,
  },
  statusSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
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
  summarySection: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  summaryValue: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  summaryHighlight: {
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  summaryNoteBox: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    paddingTop: 10,
  },
  summaryNoteTitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryNoteText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 18,
    fontWeight: '600',
  },
  paymentSection: {
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  payHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  paymentHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  paymentCard: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 14,
    padding: 12,
    backgroundColor: BACKGROUND_WHITE,
  },
  extraChargeSection: {
    marginTop: 14,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  extraChargeTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  extraChargeHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  extraChargeCard: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 14,
    padding: 12,
    backgroundColor: BACKGROUND_WHITE,
    marginBottom: 10,
  },
  extraChargeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  extraChargeCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  extraChargeAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: PRIMARY_COLOR,
  },
  extraChargeMeta: {
    marginTop: 6,
    fontSize: 12,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  extraChargeNote: {
    marginTop: 8,
    fontSize: 13,
    color: TEXT_PRIMARY,
    lineHeight: 18,
    fontWeight: '600',
  },
  extraChargeImgRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  extraChargeImg: {
    width: 72,
    height: 72,
    borderRadius: 14,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#EAEAEA',
  },
  tasksList: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  tasksListEmpty: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  taskInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  taskMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 2,
  },
  taskEvidenceThumb: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#EFEFEF',
  },
  taskStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_WHITE,
  },
  taskStatusBadgeDone: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'rgba(232, 113, 46, 0.08)',
  },
  taskStatusBadgeInProgress: {
    borderColor: '#1D4ED8',
    backgroundColor: 'rgba(29, 78, 216, 0.08)',
  },
  taskStatusBadgeOverdue: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
  },
  taskStatusText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  taskStatusTextDone: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  taskStatusTextInProgress: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  taskStatusTextOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
});
