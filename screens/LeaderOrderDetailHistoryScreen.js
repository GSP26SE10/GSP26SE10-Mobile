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
import { getAccessToken } from '../utils/auth';

const formatTimeRangeFromOrder = (order) => {
  if (!order?.startTime) return '—';
  const start = new Date(order.startTime);
  const end = order?.endTime ? new Date(order.endTime) : start;
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${date(start)}`;
};

const TASK_STATUS_LABEL = {
  1: 'Chưa bắt đầu',
  2: 'Đang thực hiện',
  3: 'Hoàn thành',
};

const formatTaskDeadline = (startIso, endIso) => {
  if (!startIso) return '';
  const start = new Date(startIso);
  const end = endIso ? new Date(endIso) : start;
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${time(end)}, ${date(start)}`;
};

const mapApiTaskToDisplay = (t) => {
  const dateLabel = t.startTime
    ? `${String(new Date(t.startTime).getDate()).padStart(2, '0')}/${String(new Date(t.startTime).getMonth() + 1).padStart(2, '0')}/${new Date(t.startTime).getFullYear()}`
    : '';
  const timeLabel = t.startTime && t.endTime
    ? `${new Date(t.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – ${new Date(t.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return {
    id: t.taskId,
    title: t.taskName || '—',
    dateLabel,
    timeLabel,
    assignee: t.assigneeName || t.assignee || '—',
    note: t.note || '',
    status: TASK_STATUS_LABEL[t.status] ?? TASK_STATUS_LABEL[String(t.status)] ?? 'Chưa bắt đầu',
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

export default function LeaderOrderDetailHistoryScreen({ navigation, route }) {
  const orderFromParams = route?.params?.order;
  const formatVnd = (n) =>
    n != null && n !== '' ? `${Number(n).toLocaleString('vi-VN')}₫` : '—';

  const partyDetail = orderFromParams
    ? {
        id: orderFromParams.orderDetailId,
        image: orderFromParams.menuImage || null,
        name: orderFromParams.menuName || '—',
        dishes: orderFromParams.partyCategory || '—',
        guests: `${orderFromParams.numberOfGuests ?? 0} NGƯỜI`,
        timeRange: formatTimeRangeFromOrder(orderFromParams),
        address: orderFromParams.address || '—',
        contactName: '—',
        phone: '',
        subtotal: formatVnd(orderFromParams.totalPrice),
        deposit: formatVnd(orderFromParams.depositAmount),
        remaining: formatVnd(orderFromParams.remainingAmount),
      }
    : mockPartyDetail;

  const tasks = (orderFromParams?.tasks && Array.isArray(orderFromParams.tasks))
    ? orderFromParams.tasks.map(mapApiTaskToDisplay)
    : [];

  const [activeTab, setActiveTab] = useState('overview');
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const orderId =
    orderFromParams?.orderId ??
    orderFromParams?.orderDetailId ??
    orderFromParams?.id ??
    route?.params?.orderId ??
    route?.params?.orderDetailId ??
    null;

  const [extraCharges, setExtraCharges] = useState([]);
  const [loadingExtraCharges, setLoadingExtraCharges] = useState(false);

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
        if (!cancelled) setExtraCharges(list);
      } catch (_) {
        if (!cancelled) setExtraCharges([]);
      } finally {
        if (!cancelled) setLoadingExtraCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

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

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${partyDetail.name}`);
    const details = encodeURIComponent(
      `${partyDetail.dishes}, ${partyDetail.guests}, ${partyDetail.address}`
    );
    let datesParam = '';
    if (orderFromParams?.startTime) {
      try {
        const start = new Date(orderFromParams.startTime);
        const end = orderFromParams.endTime ? new Date(orderFromParams.endTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
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
    const orderStatus = Number(orderFromParams?.orderStatus ?? route?.params?.orderStatus ?? 0);
    // orderStatus: 4 = preparing, 5 = ongoing, 6 = billing, 7 = completed
    const currentIndex =
      orderStatus === 4 ? 0 : orderStatus === 5 ? 1 : 2; // (6,7, others -> show completed step)
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
            menuId: orderFromParams?.menuId ?? 1,
            menuName: partyDetail.name,
            buffetType: partyDetail.dishes,
            fromStaff: true,
          })
        }
      >
        {partyDetail.image ? (
          <Image
            source={{ uri: partyDetail.image }}
            style={styles.partyImage}
            resizeMode="cover"
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

      {renderStatusSteps()}

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
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, styles.summaryHighlight]}>
            Còn lại
          </Text>
          <Text style={[styles.summaryValue, styles.summaryHighlight]}>
            {partyDetail.remaining}
          </Text>
        </View>
      </View>

      <View style={styles.extraChargeSection}>
        <Text style={styles.extraChargeTitle}>Chi phí phát sinh / đền bù</Text>
        {loadingExtraCharges ? (
          <Text style={styles.extraChargeHint}>Đang tải...</Text>
        ) : extraCharges.length === 0 ? (
          <Text style={styles.extraChargeHint}>Không có chi phí phát sinh.</Text>
        ) : (
          extraCharges.map((ec, idx) => {
            const images = Array.isArray(ec?.image) ? ec.image : [];
            return (
              <View
                key={String(ec?.orderDetailExtraChargeId ?? `${ec?.extraChargeCatalogId ?? 'ec'}-${idx}`)}
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
                  {ec?.creatorName ? `Người tạo: ${ec.creatorName}` : '—'}
                  {!!ec?.createdAt ? ` · ${formatDateTime(ec.createdAt)}` : ''}
                </Text>
                {!!ec?.note && <Text style={styles.extraChargeNote}>{String(ec.note)}</Text>}
                {!!images.length && (
                  <View style={styles.extraChargeImgRow}>
                    {images.slice(0, 4).map((u, i) => (
                      <Image
                        key={`${u}-${i}`}
                        source={{ uri: String(u) }}
                        style={styles.extraChargeImg}
                        resizeMode="cover"
                      />
                    ))}
                  </View>
                )}
              </View>
            );
          })
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
            </View>
            <View
              style={[
                styles.taskStatusBadge,
                task.status === 'Hoàn thành' && styles.taskStatusBadgeDone,
              ]}
            >
              <Text
                style={[
                  styles.taskStatusText,
                  task.status === 'Hoàn thành' && styles.taskStatusTextDone,
                ]}
              >
                {task.status}
              </Text>
            </View>
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
  taskStatusText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  taskStatusTextDone: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
});
