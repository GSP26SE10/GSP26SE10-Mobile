import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
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
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useMutation } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ExpoImagePicker from 'expo-image-picker';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { getAccessToken } from '../utils/auth';
import { getOrderStatusProgressStepIndex } from '../utils/orderStatusSteps';
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
  5: 'Trễ deadline',     // OVERDUE
};

const getTaskStatusNumber = (task) => Number(task?.taskStatus ?? task?.status ?? 1);

/** Trạng thái tiếp theo: chỉ 1→2, 2→3. 3 → null (không đổi). */
const getNextTaskStatus = (current) =>
  current === 1 ? 2 : current === 2 ? 3 : null;

const guessMimeTypeFromUri = (uri) => {
  if (!uri || typeof uri !== 'string') return 'image/jpeg';
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
};

const getFileNameFromUri = (uri, fallback = 'completion.jpg') => {
  if (!uri || typeof uri !== 'string') return fallback;
  const clean = uri.split('?')[0];
  const parts = clean.split('/');
  const last = parts[parts.length - 1];
  return last || fallback;
};

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
  return `${time(start)} – ${time(end)}, ${date(start)}`;
};

const resolveImageUri = (img) => {
  if (!img || typeof img !== 'string') return null;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${API_URL}${img}`;
};

const getImageDimensions = (screenWidth, preferredHeight = 120) => {
  // Calculate width to maintain aspect ratio for container
  // preferredHeight is the target height, width fills available space
  return {
    width: '100%',
    height: preferredHeight,
  };
};

const pickMenuId = (...candidates) => {
  for (const candidate of candidates) {
    if (candidate == null || candidate === '') continue;
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
};

const resolveMenuIdFromOrderDetail = (od) => {
  if (!od || typeof od !== 'object') return null;
  const menu = od.menu || {};
  const menuSnapshot = od.menuSnapshot || {};
  return pickMenuId(
    od.menuId,
    od.menuID,
    menu.menuId,
    menu.menuID,
    menu.id,
    menuSnapshot.menuId,
    menuSnapshot.menuID,
    menuSnapshot.id
  );
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
  phone: '—',
  status: '—',
  subtotal: '—',
  vat: '—',
  deposit: '—',
  remaining: '—',
};

const mockTasks = [];

const mapOrderStatusToPartyStatus = (orderStatus) => {
  switch (Number(orderStatus)) {
    // Sắp tới (1,2,4) -> bước "Đang chuẩn bị"
    case 1:
    case 2:
    case 4:
      return 'Đang chuẩn bị';
    // Đang diễn ra (5,6 - 6 chờ thanh toán nốt)
    case 5:
    case 6:
      return 'Đang diễn ra';
    case 7:
      return 'Kết thúc tiệc';
    // Bị hủy
    case 3:
    case 8:
      return '—';
    default:
      return '—';
  }
};

function buildPartyDetailFromOrderDetail(od) {
  if (!od) return null;

  const services = Array.isArray(od?.serviceSnapshot?.services) ? od.serviceSnapshot.services : [];
  const customDishes = Array.isArray(od?.customDishSnapshot?.customDishes) ? od.customDishSnapshot.customDishes : [];

  return {
    id: od.orderDetailId,
    menuId: resolveMenuIdFromOrderDetail(od),
    image: resolveImageUri(od.menuImage ?? od?.menu?.image),
    name: od.menuName ?? od?.menu?.name ?? '—',
    dishes: od.partyCategory ?? od?.party?.category ?? '—',
    guests: `${od.numberOfGuests ?? od?.party?.numberOfGuests ?? 0} người`,
    timeRange: formatTimeRange(od.startTime ?? od?.schedule?.startTime, od.endTime ?? od?.schedule?.endTime),
    address: od.address ?? od?.schedule?.address ?? '—',
    contactName: '—',
    phone: '—',
    status: mapOrderStatusToPartyStatus(od.orderStatus ?? od.status),
    subtotal: '—',
    vat: '—',
    deposit: '—',
    remaining: '—',
    services,
    customDishes,
  };
}

function mapApiTaskToDisplay(t) {
  const statusNum = getTaskStatusNumber(t);
  const done = statusNum === 3;
  return {
    ...t,
    taskStatus: statusNum,
    id: t.taskId,
    title: t.taskName || '—',
    statusLabel: TASK_STATUS_MAP[statusNum] || 'Chưa bắt đầu',
    done,
    taskStartTime: t.taskStartTime ?? t.startTime ?? null,
    taskEndTime: t.taskEndTime ?? t.endTime ?? null,
  };
}

const SLIDER_WIDTH = 260;
const SLIDER_KNOB_SIZE = 52;

function SlideToConfirm({ onComplete, disabled }) {
  const [completed, setCompleted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const translateX = useRef(new Animated.Value(0)).current;
  const arrowOpacity = useRef(new Animated.Value(1)).current;
  const maxTranslate = SLIDER_WIDTH - SLIDER_KNOB_SIZE;
  const progress = translateX.interpolate({
    inputRange: [0, maxTranslate],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && !completed,
      onPanResponderGrant: () => {
        if (disabled || completed) return;
        setIsDragging(true);
        arrowOpacity.stopAnimation();
        arrowOpacity.setValue(1);
      },
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
            setIsDragging(false);
            onComplete && onComplete();
          });
        } else {
          Animated.timing(translateX, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            setIsDragging(false);
          });
        }
      },
      onPanResponderTerminate: () => {
        setIsDragging(false);
        Animated.timing(translateX, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (completed || disabled || isDragging) {
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
  }, [completed, disabled, isDragging, arrowOpacity]);

  return (
    <View style={styles.sliderContainer}>
      <View
        style={styles.sliderTrack}
        {...(!disabled && !completed ? panResponder.panHandlers : {})}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sliderProgressFill,
            {
              transform: [
                { translateX: -SLIDER_WIDTH / 2 },
                { scaleX: progress },
                { translateX: SLIDER_WIDTH / 2 },
              ],
            },
          ]}
        />
        <Text style={styles.sliderText}>
          {completed ? 'Đã xác nhận' : 'Trượt để xác nhận'}
        </Text>
        <Animated.View
          style={[
            styles.sliderKnob,
            { transform: [{ translateX }], opacity: isDragging ? 1 : arrowOpacity },
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
  const initialOrderStatusNum = Number(
    orderDetail?.orderStatus ?? orderDetail?.status ?? 0
  );
  const [resolvedOrderStatusNum, setResolvedOrderStatusNum] = useState(
    initialOrderStatusNum
  );
  const displayPartyStatus =
    mapOrderStatusToPartyStatus(resolvedOrderStatusNum) || partyDetail.status;
  const allowTaskConfirmByOrder = !fromApi
    ? true
    : [4, 5].includes(resolvedOrderStatusNum);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks'
  const [tasks, setTasks] = useState(fromApi ? initialTasksFromApi : mockTasks);
  const [confirmTask, setConfirmTask] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const [completionImage, setCompletionImage] = useState(null);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  const [tasksReady, setTasksReady] = useState(!fromApi);
  const [taskEvidenceMap, setTaskEvidenceMap] = useState({});
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const refreshFnRef = useRef(null);

  const allTasksDisplay = fromApi ? tasks : tasks.map((t) => ({ ...t, statusLabel: t.done ? 'Đã xong' : 'Chưa xong' }));

  useEffect(() => {
    setResolvedOrderStatusNum(initialOrderStatusNum);
  }, [
    initialOrderStatusNum,
    orderDetail?.orderDetailId,
    orderDetail?.orderStatus,
    orderDetail?.status,
  ]);

  const getTaskBadgeVariant = (task) => {
    const statusNum = getTaskStatusNumber(task);
    if (statusNum === 3) return 'done';
    if (statusNum === 5) return 'overdue';
    if (statusNum === 2) return 'inProgress';
    return 'default';
  };

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
      const latestOrderDetail = forOrder.find(
        (t) => t?.orderDetail?.orderStatus != null || t?.orderDetail?.status != null
      )?.orderDetail;
      if (latestOrderDetail) {
        const nextOrderStatusNum = Number(
          latestOrderDetail.orderStatus ?? latestOrderDetail.status
        );
        if (!Number.isNaN(nextOrderStatusNum)) {
          setResolvedOrderStatusNum(nextOrderStatusNum);
        }
      }
      const displayTasks = forOrder.map(mapApiTaskToDisplay);
      setTasks(displayTasks);
      // Fetch evidence images for all tasks
      const evidenceMap = {};
      for (const task of displayTasks) {
        const taskId = task.taskId ?? task.id;
        if (taskId != null) {
          const evidenceUrl = await fetchTaskEvidence(taskId);
          if (evidenceUrl) {
            evidenceMap[taskId] = evidenceUrl;
          }
        }
      }
      setTaskEvidenceMap(evidenceMap);
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

  const acceptTaskMutation = useMutation({
    mutationFn: async ({ taskId }) => {
      const token = await getAccessToken();
      const res = await fetch(
        `${API_URL}/api/order-detail-staff-task/${taskId}/accept`,
        {
          method: 'PATCH',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Không thể nhận công việc.');
      }
    },
    onMutate: async ({ taskId, previousTasks }) => {
      const optimisticList = applyOptimisticTaskStatus(
        previousTasks,
        taskId,
        2
      );
      setTasks(optimisticList);
      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks != null) {
        setTasks(context.previousTasks);
      }
      Alert.alert(
        'Lỗi',
        'Không thể nhận công việc. Vui lòng thử lại.'
      );
    },
    onSettled: () => {
      if (fromApi) refreshTasksForOrder();
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async ({ taskId, image, note }) => {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('CompletionImage', {
        uri: image.uri,
        type: image.type || guessMimeTypeFromUri(image.uri),
        name: image.name || getFileNameFromUri(image.uri),
      });
      formData.append('Note', note?.trim() || '');

      const res = await fetch(
        `${API_URL}/api/order-detail-staff-task/${taskId}/complete`,
        {
          method: 'PATCH',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Không thể hoàn thành công việc.');
      }
    },
    onSuccess: () => {
      setCompletionImage(null);
      setCompletionNote('');
      if (fromApi) refreshTasksForOrder();
    },
    onError: (error) => {
      Alert.alert('Lỗi', error?.message || 'Không thể hoàn thành công việc.');
    },
  });

  const pickCompletionImage = async () => {
    try {
      const permission = await ExpoImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Quyền truy cập ảnh', 'Vui lòng cho phép truy cập thư viện ảnh.');
        return;
      }
      const result = await ExpoImagePicker.launchImageLibraryAsync({
        mediaTypes: ExpoImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 0.8,
      });
      if (result?.canceled) return;
      const first = Array.isArray(result?.assets) ? result.assets[0] : null;
      if (!first?.uri) return;
      setCompletionImage({
        uri: first.uri,
        type: first?.mimeType || guessMimeTypeFromUri(first.uri),
        name: first?.fileName || getFileNameFromUri(first.uri),
      });
    } catch (_) {
      Alert.alert('Lỗi', 'Không thể chọn ảnh. Vui lòng thử lại.');
    }
  };

  const handleSubmitComplete = async () => {
    if (!confirmTask) return;
    const taskId = confirmTask.taskId ?? confirmTask.id;
    if (!taskId) {
      Alert.alert('Lỗi', 'Không xác định được công việc.');
      return;
    }
    if (!completionImage?.uri) {
      Alert.alert('Thiếu ảnh', 'Vui lòng chọn ảnh hoàn thành để gửi Leader.');
      return;
    }
    try {
      await completeTaskMutation.mutateAsync({
        taskId,
        image: completionImage,
        note: completionNote,
      });
      setConfirmVisible(false);
      setConfirmTask(null);
    } catch (_) {
      // handled by mutation onError
    }
  };

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${partyDetail.name}`);
    const details = encodeURIComponent(
      `${partyDetail.address}`
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
    const currentIndex = steps.indexOf(displayPartyStatus);
    const dotStepIndex = getOrderStatusProgressStepIndex(resolvedOrderStatusNum);
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isLabelActive =
            currentIndex >= 0 ? index <= currentIndex : step === displayPartyStatus;
          const isDotActive =
            dotStepIndex != null
              ? index <= dotStepIndex
              : isLabelActive;
          return (
            <View key={step} style={styles.statusStep}>
              <View
                style={[
                  styles.statusDot,
                  isDotActive && styles.statusDotActive,
                ]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  isLabelActive && styles.statusLabelActive,
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
              menuId: partyDetail.menuId,
              menuName: partyDetail.name,
              buffetType: orderDetail?.partyCategory ?? partyDetail.dishes ?? 'Buffet Bò',
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
          </View>
          <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        {(partyDetail.services || []).length > 0 && (
          <View style={styles.snapshotSectionCard}>
            <Text style={styles.snapshotSectionTitle}>Dịch vụ đã chọn</Text>
            {(partyDetail.services || []).map((service, idx) => (
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
                  SL: {service?.quantity ?? 1} · Đơn giá: {Number(service?.basePrice ?? 0).toLocaleString('vi-VN')}₫
                </Text>
              </View>
            ))}
          </View>
        )}

        {(partyDetail.customDishes || []).length > 0 && (
          <View style={styles.snapshotSectionCard}>
            <Text style={styles.snapshotSectionTitle}>Món lẻ đã chọn</Text>
            {(partyDetail.customDishes || []).map((dish, idx) => (
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
                  Đơn giá: {Number(dish?.unitPrice ?? 0).toLocaleString('vi-VN')}₫ · Tổng: {Number(dish?.totalAmount ?? 0).toLocaleString('vi-VN')}₫
                </Text>
              </View>
            ))}
          </View>
        )}

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
          const statusNum = getTaskStatusNumber(task);
          const badgeVariant = getTaskBadgeVariant(task);
          const canChangeStatusBase = fromApi
            ? statusNum !== 3 && getNextTaskStatus(statusNum) != null
            : !task.done;
          const canChangeStatus = canChangeStatusBase && allowTaskConfirmByOrder;
          return (
          <TouchableOpacity
            key={task.id}
            style={styles.taskRowWrap}
            activeOpacity={0.8}
            onPress={() => {
              if (canChangeStatus) {
                setCompletionImage(null);
                setCompletionNote('');
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
                    {formatTaskTime(task.taskStartTime ?? task.startTime)} → {formatTaskTime(task.taskEndTime ?? task.endTime)}
                  </Text>
                )}
                {fromApi && task.note != null && task.note !== '' && (
                  <Text style={styles.taskNote} numberOfLines={2}>
                    {task.note}
                  </Text>
                )}
                {fromApi && taskEvidenceMap[task.taskId ?? task.id] && (
                  
                  <Image
                    source={{ uri: taskEvidenceMap[task.taskId ?? task.id] }}
                    style={styles.taskEvidenceThumb}
                  />
                )}
              </View>
              <View
                style={[
                  styles.taskStatusBadge,
                  badgeVariant === 'done' && styles.taskStatusBadgeDone,
                  badgeVariant === 'inProgress' && styles.taskStatusBadgeInProgress,
                  badgeVariant === 'overdue' && styles.taskStatusBadgeOverdue,
                ]}
              >
                <Text
                  style={[
                    styles.taskStatusText,
                    badgeVariant === 'done' && styles.taskStatusTextDone,
                    badgeVariant === 'inProgress' && styles.taskStatusTextInProgress,
                    badgeVariant === 'overdue' && styles.taskStatusTextOverdue,
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
        onRequestClose={() => {
          setConfirmVisible(false);
          setCompletionImage(null);
          setCompletionNote('');
        }}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => {
              setConfirmVisible(false);
              setCompletionImage(null);
              setCompletionNote('');
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            style={styles.modalKeyboardWrapper}
          >
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  setConfirmVisible(false);
                  setCompletionImage(null);
                  setCompletionNote('');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {confirmTask?.taskStatus === 1
                  ? 'Xác nhận nhận việc'
                  : 'Gửi bằng chứng hoàn thành'}
              </Text>
              <Text style={styles.modalTaskTitle}>
                {confirmTask?.title || confirmTask?.taskName || ''}
              </Text>
              {confirmTask?.taskStatus === 1 ? (
                <SlideToConfirm
                  disabled={!confirmTask || acceptTaskMutation.isPending}
                  onComplete={() => {
                    if (!confirmTask) return;
                    setConfirmVisible(false);
                    if (fromApi) {
                      const taskId = confirmTask.taskId ?? confirmTask.id;
                      acceptTaskMutation.mutate({
                        taskId,
                        previousTasks: tasks,
                      });
                    } else {
                      handleConfirmTask(confirmTask.id);
                    }
                  }}
                />
              ) : (
                <View>
                  <TouchableOpacity
                    style={styles.evidencePickButton}
                    activeOpacity={0.85}
                    onPress={pickCompletionImage}
                    disabled={completeTaskMutation.isPending}
                  >
                    <Ionicons name="image-outline" size={18} color={TEXT_PRIMARY} />
                    <Text style={styles.evidencePickButtonText}>
                      {completionImage?.uri ? 'Đổi ảnh minh chứng' : 'Chọn ảnh minh chứng'}
                    </Text>
                  </TouchableOpacity>

                  {completionImage?.uri ? (
                    <Image source={{ uri: completionImage.uri }} style={styles.evidencePreview} resizeMode="contain" />
                  ) : null}

                  <TextInput
                    style={styles.evidenceNoteInput}
                    placeholder="Ghi chú"
                    placeholderTextColor={TEXT_SECONDARY}
                    multiline
                    value={completionNote}
                    onChangeText={setCompletionNote}
                    editable={!completeTaskMutation.isPending}
                  />

                  <TouchableOpacity
                    style={[
                      styles.evidenceSubmitButton,
                      (!completionImage?.uri || completeTaskMutation.isPending) && styles.evidenceSubmitButtonDisabled,
                    ]}
                    activeOpacity={0.85}
                    onPress={handleSubmitComplete}
                    disabled={!completionImage?.uri || completeTaskMutation.isPending}
                  >
                    <Text style={styles.evidenceSubmitButtonText}>
                      {completeTaskMutation.isPending ? 'Đang gửi...' : 'Xác nhận hoàn thành'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </KeyboardAvoidingView>
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
    marginTop: -8,
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
  snapshotItemImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#EFEFEF',
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
  taskEvidenceThumb: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#EFEFEF',
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
  sliderProgressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SLIDER_WIDTH,
    backgroundColor: PRIMARY_COLOR,
    opacity: 0.6,
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
  modalKeyboardWrapper: {
    width: '100%',
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
  evidencePickButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    gap: 8,
  },
  evidencePickButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  evidencePreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: '#EFEFEF',
  },
  evidenceNoteInput: {
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: TEXT_PRIMARY,
    textAlignVertical: 'top',
  },
  evidenceSubmitButton: {
    marginTop: 12,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_COLOR,
  },
  evidenceSubmitButtonDisabled: {
    opacity: 0.6,
  },
  evidenceSubmitButtonText: {
    color: BUTTON_TEXT_WHITE,
    fontSize: 14,
    fontWeight: '700',
  },
});

