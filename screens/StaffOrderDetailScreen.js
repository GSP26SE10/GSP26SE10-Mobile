import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  PanResponder,
  Modal,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { getAccessToken } from '../utils/auth';
import API_URL from '../constants/api';
import {
  TEXT_PRIMARY,
  BACKGROUND_WHITE,
  PRIMARY_COLOR,
  TEXT_SECONDARY,
  BORDER_LIGHT,
  BUTTON_TEXT_WHITE,
} from '../constants/colors';

const TASK_STATUS_MAP = {
  1: 'Chưa bắt đầu',   // PENDING
  2: 'Đang thực hiện',  // IN_PROGRESS
  3: 'Hoàn thành',      // COMPLETED
};

/** Trạng thái tiếp theo: chỉ 1→2, 2→3. 3 → null (không đổi). */
const getNextTaskStatus = (current) =>
  current === 1 ? 2 : current === 2 ? 3 : null;

const formatTaskTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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

const mockPartyDetail = {
  id: 1,
  image: 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg',
  name: 'Buffet Lẩu Bò Mỹ',
  dishes: '10 MÓN',
  guests: '10 NGƯỜI',
  timeRange: '9:30 – 10/01/2026',
  address: '16 Nguyễn Trãi, Quận 1, Thành phố Hồ Chí Minh',
  contactName: 'Nguyễn Văn A',
  phone: '0123456789',
  status: 'Đang chuẩn bị',
  subtotal: '2.489.000₫',
  vat: '248.900₫',
  deposit: '1.368.950₫',
  remaining: '1.368.950₫',
};

const mockTasks = [
  { id: 1, title: 'Chuẩn bị nguyên liệu A – 08:00', done: true },
  { id: 2, title: 'Chuẩn bị nguyên liệu B – 08:15', done: false },
  { id: 3, title: 'Chuẩn bị nguyên liệu C – 08:30', done: false },
];

function buildPartyDetailFromOrderDetail(od) {
  if (!od) return null;
  return {
    id: od.orderDetailId,
    image: null,
    name: od.menuName || '—',
    dishes: '—',
    guests: `${od.numberOfGuests ?? 0} người`,
    timeRange: formatTimeRange(od.startTime, od.endTime),
    address: od.address || '—',
    contactName: '—',
    phone: '—',
    status: '—',
    subtotal: '—',
    vat: '—',
    deposit: '—',
    remaining: '—',
  };
}

function mapApiTaskToDisplay(t) {
  const statusNum = t.taskStatus;
  const done = statusNum === 3;
  return {
    ...t,
    id: t.taskId,
    title: t.taskName || '—',
    statusLabel: TASK_STATUS_MAP[statusNum] || 'Chưa bắt đầu',
    done,
  };
}

const SLIDER_WIDTH = 260;
const SLIDER_KNOB_SIZE = 52;

function SlideToConfirm({ onComplete, disabled }) {
  const [completed, setCompleted] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(1)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !completed,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        if (disabled || completed) return false;
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (disabled || completed) return;
        const dx = Math.max(0, Math.min(gestureState.dx, SLIDER_WIDTH - SLIDER_KNOB_SIZE));
        translateX.setValue(dx);
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (disabled || completed) return;
        const dx = Math.max(0, Math.min(gestureState.dx, SLIDER_WIDTH - SLIDER_KNOB_SIZE));
        const shouldComplete = dx > (SLIDER_WIDTH - SLIDER_KNOB_SIZE) * 0.7;
        if (shouldComplete) {
          Animated.timing(translateX, {
            toValue: SLIDER_WIDTH - SLIDER_KNOB_SIZE,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setCompleted(true);
            onComplete && onComplete();
          });
        } else {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (completed || disabled) {
      arrowOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowOpacity, {
          toValue: 0.2,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(arrowOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [completed, disabled, arrowOpacity]);

  return (
    <View style={styles.sliderContainer}>
      <View
        style={styles.sliderTrack}
        {...(!disabled && !completed ? panResponder.panHandlers : {})}
      >
        <Text style={styles.sliderText}>
          {completed ? 'Đã xác nhận' : 'Trượt để xác nhận'}
        </Text>
        <Animated.View
          style={[
            styles.sliderKnob,
            { transform: [{ translateX }], opacity: arrowOpacity },
          ]}
        >
          <Ionicons name="chevron-forward" size={24} color={BUTTON_TEXT_WHITE} />
        </Animated.View>
      </View>
    </View>
  );
}

export default function StaffOrderDetailScreen({ navigation, route }) {
  const orderDetail = route?.params?.orderDetail;
  const paramsTasks = route?.params?.tasks;
  const fromApi = orderDetail && Array.isArray(paramsTasks);
  const partyDetailFromParams = buildPartyDetailFromOrderDetail(orderDetail);
  const partyDetail = partyDetailFromParams || mockPartyDetail;
  const initialTasksFromApi = (paramsTasks || []).map(mapApiTaskToDisplay);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks'
  const [tasks, setTasks] = useState(fromApi ? initialTasksFromApi : mockTasks);
  const [confirmTask, setConfirmTask] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  const [tasksReady, setTasksReady] = useState(!fromApi);
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const refreshFnRef = useRef(null);

  const allTasksDisplay = fromApi ? tasks : tasks.map((t) => ({ ...t, statusLabel: t.done ? 'Đã xong' : 'Chưa xong' }));

  const refreshTasksForOrder = async () => {
    if (!fromApi) return;
    const orderDetailId = route?.params?.orderDetailId ?? orderDetail?.orderDetailId;
    if (orderDetailId == null) return;
    setRefreshingTasks(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/api/order-detail-staff-task/staff-tasks?page=1&pageSize=50`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) return;
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      const forOrder = items.filter(
        (t) => t.orderDetail?.orderDetailId === orderDetailId
      );
      setTasks(forOrder.map(mapApiTaskToDisplay));
    } catch (e) {
      // keep current tasks
    } finally {
      setRefreshingTasks(false);
      setTasksReady(true);
    }
  };

  refreshFnRef.current = refreshTasksForOrder;

  useLayoutEffect(() => {
    if (!fromApi) return;
    const orderDetailId = route?.params?.orderDetailId ?? orderDetail?.orderDetailId;
    if (orderDetailId != null && refreshFnRef.current) {
      refreshFnRef.current();
    }
  }, [fromApi, route?.params?.orderDetailId, orderDetail?.orderDetailId]);

  const handleConfirmTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, done: true, statusLabel: 'Hoàn thành' } : t
      )
    );
  };

  const applyOptimisticTaskStatus = (taskList, taskId, nextStatus) =>
    taskList.map((t) =>
      t.id === taskId
        ? {
            ...t,
            taskStatus: nextStatus,
            statusLabel: TASK_STATUS_MAP[nextStatus] || t.statusLabel,
            done: nextStatus === 3,
          }
        : t
    );

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, nextStatus }) => {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/api/order-detail-staff-task/${taskId}/staff-task-status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ taskStatus: nextStatus }),
        }
      );
      if (!res.ok) throw new Error('API failed');
    },
    onMutate: async ({ taskId, nextStatus, previousTasks }) => {
      const optimisticList = applyOptimisticTaskStatus(
        previousTasks,
        taskId,
        nextStatus
      );
      setTasks(optimisticList);
      return { previousTasks };
    },
    onError: (err, { previousTasks }, context) => {
      if (context?.previousTasks != null) {
        setTasks(context.previousTasks);
      }
      Alert.alert(
        'Lỗi',
        'Không thể cập nhật trạng thái. Vui lòng thử lại.'
      );
    },
    onSettled: () => {
      if (fromApi) refreshTasksForOrder();
    },
  });

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${partyDetail.name}`);
    const details = encodeURIComponent(
      `${partyDetail.dishes}, ${partyDetail.guests}, ${partyDetail.address}`
    );
    let datesParam = '';
    if (orderDetail?.startTime && orderDetail?.endTime) {
      try {
        const start = new Date(orderDetail.startTime);
        const end = new Date(orderDetail.endTime);
        const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
        const format = (d) =>
          `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
            d.getHours()
          )}${pad(d.getMinutes())}00`;
        datesParam = `&dates=${format(start)}/${format(end)}`;
      } catch (e) {
        console.warn('Parse calendar dates failed', e);
      }
    }
    if (!datesParam) {
      try {
        const [timePartRaw, datePartRaw] = (partyDetail.timeRange || '–')
          .split('–')
          .map((s) => s?.trim() || '');
        if (datePartRaw) {
          const [hourStr, minuteStr] = (timePartRaw || '0:0').split(':');
          const [dayStr, monthStr, yearStr] = datePartRaw.split('/');
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10) - 1;
          const day = parseInt(dayStr, 10);
          const hour = parseInt(hourStr, 10) || 0;
          const minute = parseInt(minuteStr, 10) || 0;
          const start = new Date(year, month, day, hour, minute);
          const end = new Date(year, month, day, hour + 2, minute);
          const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
          const format = (d) =>
            `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
              d.getHours()
            )}${pad(d.getMinutes())}00`;
          datesParam = `&dates=${format(start)}/${format(end)}`;
        }
      } catch (e) {
        console.warn('Cannot parse timeRange for calendar.', e);
      }
    }
    const url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}${datesParam}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error('Open calendar error:', e);
      Alert.alert('Lỗi', 'Không thể mở Google Calendar.');
    }
  };

  const handleOpenMaps = async () => {
    const query = encodeURIComponent(partyDetail.address || '');
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error('Open maps error:', e);
      Alert.alert('Lỗi', 'Không thể mở Google Maps.');
    }
  };

  const handleCallPhone = () => {
    if (partyDetail.phone === '—' || !partyDetail.phone) return;
    Alert.alert(
      'Gọi điện',
      `Bạn có muốn gọi ${partyDetail.phone} không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gọi',
          style: 'destructive',
          onPress: async () => {
            const url = `tel:${mockPartyDetail.phone}`;
            try {
              await Linking.openURL(url);
            } catch (e) {
              console.error('Call phone error:', e);
              Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi.');
            }
          },
        },
      ]
    );
  };

  const renderStatusSteps = () => {
    const steps = ['Đang chuẩn bị', 'Đang diễn ra', 'Kết thúc tiệc'];
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isActive = step === partyDetail.status;
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
              {index < steps.length - 1 && (
                <View style={styles.statusLine} />
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderOverviewTab = () => {
    return (
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
              menuId: orderDetail?.menuId ?? 1,
              menuName: partyDetail.name,
              buffetType: orderDetail?.partyCategory ?? partyDetail.dishes ?? 'Buffet Bò',
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
            <View style={[styles.partyImage, styles.partyImagePlaceholder]}>
              <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
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
            {partyDetail.contactName !== '—' && (
              <Text style={styles.partyContact}>
                Khách hàng: {partyDetail.contactName}
              </Text>
            )}
            {partyDetail.phone !== '—' && (
              <Text
                style={[styles.partyContact, styles.partyPhone]}
                onPress={handleCallPhone}
              >
                Số điện thoại: {partyDetail.phone}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        {renderStatusSteps()}

        {(partyDetail.subtotal !== '—' || partyDetail.remaining !== '—') && (
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tạm tính</Text>
              <Text style={styles.summaryValue}>{partyDetail.subtotal}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Thuế VAT (10%)</Text>
              <Text style={styles.summaryValue}>{partyDetail.vat}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Đã cọc</Text>
              <Text style={styles.summaryValue}>{partyDetail.deposit}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.summaryHighlight]}>
                Còn lại
              </Text>
              <Text style={[styles.summaryValue, styles.summaryHighlight]}>
                {partyDetail.remaining}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderTasksTab = () => {
    const list = fromApi ? allTasksDisplay : tasks;
    const showTaskList = !fromApi || tasksReady;
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshingTasks}
            onRefresh={refreshTasksForOrder}
            colors={[PRIMARY_COLOR]}
          />
        }
      >
        {!showTaskList ? (
          [1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.taskRowWrap}>
              <View style={styles.taskRow}>
                <View style={styles.taskRowLeft}>
                  <View style={[styles.taskTitleSkeleton, styles.skeleton]} />
                  <View style={[styles.taskTimeSkeleton, styles.skeleton]} />
                </View>
                <View style={[styles.taskStatusBadgeSkeleton, styles.skeleton]} />
              </View>
            </View>
          ))
        ) : (
        list.map((task) => {
          const canChangeStatus = fromApi
            ? task.taskStatus !== 3 && getNextTaskStatus(task.taskStatus) != null
            : !task.done;
          return (
          <TouchableOpacity
            key={task.id}
            style={styles.taskRowWrap}
            activeOpacity={0.8}
            onPress={() => {
              if (canChangeStatus) {
                setConfirmTask(task);
                setConfirmVisible(true);
              }
            }}
          >
            <View style={styles.taskRow}>
              <View style={styles.taskRowLeft}>
                <Text style={styles.taskTitle} numberOfLines={2}>
                  {task.title}
                </Text>
                {fromApi && (task.taskStartTime != null || task.taskEndTime != null) && (
                  <Text style={styles.taskTime}>
                    {formatTaskTime(task.taskStartTime)} → {formatTaskTime(task.taskEndTime)}
                  </Text>
                )}
                {fromApi && task.note != null && task.note !== '' && (
                  <Text style={styles.taskNote} numberOfLines={2}>
                    {task.note}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.taskStatusBadge,
                  (task.done || task.statusLabel === 'Hoàn thành') &&
                    styles.taskStatusBadgeDone,
                ]}
              >
                <Text
                  style={[
                    styles.taskStatusText,
                    (task.done || task.statusLabel === 'Hoàn thành') &&
                      styles.taskStatusTextDone,
                  ]}
                >
                  {task.statusLabel || (task.done ? 'Đã xong' : 'Chưa xong')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
          );
        })
        )}
      </ScrollView>
    );
  };

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

      {/* Modal đổi trạng thái: 1→2 (bắt đầu), 2→3 (hoàn thành). Trượt để xác nhận. Bấm ra ngoài để tắt. */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setConfirmVisible(false)}
          />
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setConfirmVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {confirmTask?.taskStatus === 1
                ? 'Bắt đầu công việc'
                : 'Xác nhận hoàn thành công việc'}
            </Text>
            <Text style={styles.modalTaskTitle}>
              {confirmTask?.title || confirmTask?.taskName || ''}
            </Text>
            <SlideToConfirm
              disabled={!confirmTask}
              onComplete={() => {
                if (!confirmTask) return;
                setConfirmVisible(false);
                if (fromApi) {
                  const nextStatus = getNextTaskStatus(confirmTask.taskStatus);
                  if (nextStatus != null) {
                    const taskId = confirmTask.taskId ?? confirmTask.id;
                    updateTaskStatusMutation.mutate({
                      taskId,
                      nextStatus,
                      previousTasks: tasks,
                    });
                  }
                } else {
                  handleConfirmTask(confirmTask.id);
                }
              }}
            />
          </View>
        </View>
      </Modal>

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
  partyImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
  taskRowWrap: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    paddingVertical: 14,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  taskRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  skeleton: {
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
  },
  taskTitleSkeleton: {
    height: 16,
    width: '80%',
    marginBottom: 8,
  },
  taskTimeSkeleton: {
    height: 12,
    width: '50%',
  },
  taskStatusBadgeSkeleton: {
    width: 90,
    height: 28,
    borderRadius: 12,
  },
  taskTime: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 4,
  },
  taskNote: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 4,
    fontStyle: 'italic',
  },
  taskTitle: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    flex: 1,
    marginRight: 12,
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
  sliderContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  sliderText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    textAlign: 'center',
  },
  sliderTrack: {
    width: SLIDER_WIDTH,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  sliderKnob: {
    width: SLIDER_KNOB_SIZE,
    height: SLIDER_KNOB_SIZE,
    borderRadius: SLIDER_KNOB_SIZE / 2,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#FFF8EE',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalTaskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 20,
  },
});

