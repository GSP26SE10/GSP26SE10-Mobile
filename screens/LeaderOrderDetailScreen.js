import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Image as ExpoImage } from 'expo-image';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { useSwipeBack } from '../hooks/useSwipeBack';
import {
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BACKGROUND_WHITE,
  BORDER_LIGHT,
  PRIMARY_COLOR,
  INPUT_BACKGROUND,
} from '../constants/colors';
import { getAccessToken } from '../utils/auth';
import API_URL from '../constants/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getOrderStatusProgressStepIndex } from '../utils/orderStatusSteps';
import { normalizeLeaderOrdersOverviewApi } from '../utils/leaderOrdersOverview';

const LEADER_GROUP_MEMBERS_KEY = 'leaderGroupMembers';
const LEADER_OVERVIEW_CACHE_KEY = 'leaderOverviewCache:v2';
const LEADER_OVERVIEW_API = '/api/staff-group/leader/orders-overview';
const TASK_TEMPLATE_API = '/api/task-template?page=1&pageSize=10';

const formatTimeRangeFromOrder = (order) => {
  if (!order?.startTime) return '—';
  const start = new Date(order.startTime);
  const end = order?.endTime ? new Date(order.endTime) : start;
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${date(start)}`;
};

const emptyPartyDetail = {
  id: 0,
  image: null,
  name: '—',
  dishes: '—',
  guests: '—',
  timeRange: '—',
  address: '—',
  contactName: '—',
  phone: '',
  status: '—',
  subtotal: '—',
  vat: '—',
  deposit: '—',
  remaining: '—',
};

const TASK_STATUS_LABEL = {
  1: 'Chưa bắt đầu',   // PENDING
  2: 'Đang thực hiện', // IN_PROGRESS
  3: 'Hoàn thành',     // COMPLETED
  5: 'Trễ deadline',   // OVERDUE
  PENDING: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
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
  return fallback || `extra-charge-${Date.now()}.jpg`;
};

const buildQrImageFromText = (text) => {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(raw)}`;
};

const getPaymentQrImageUrl = (paymentData) => {
  if (!paymentData || typeof paymentData !== 'object') return '';
  const directQr = [
    paymentData.qrUrl,
    paymentData.qrImageUrl,
    paymentData.qrCodeUrl,
  ].find((v) => typeof v === 'string' && v.trim());
  if (directQr) return String(directQr).trim();

  const zaloOrderUrl = [
    paymentData.orderUrl,
    paymentData.paymentUrl,
    paymentData.checkoutUrl,
  ].find((v) => typeof v === 'string' && v.trim());
  return zaloOrderUrl ? buildQrImageFromText(zaloOrderUrl) : '';
};

const getTaskTemplateName = (item) => {
  if (!item || typeof item !== 'object') return '';
  const raw =
    item.taskTemplateName ??
    item.taskName ??
    item.title ??
    item.name ??
    '';
  return String(raw).trim();
};

export default function LeaderOrderDetailScreen({ navigation, route }) {
  const orderFromParams = route?.params?.order;
  const [refreshedOrder, setRefreshedOrder] = useState(null);

  useLayoutEffect(() => {
    setRefreshedOrder(null);
  }, [orderFromParams?.orderDetailId]);

  const order = refreshedOrder ?? orderFromParams;
  const initialTasks = (order?.tasks && Array.isArray(order.tasks))
    ? order.tasks.map(mapApiTaskToDisplay)
    : [];
  const formatVnd = (n) =>
    n != null && n !== '' ? `${Number(n).toLocaleString('vi-VN')}₫` : '—';

  const partyDetail = order
    ? {
        id: order.orderDetailId,
        image: order.menuImage || null,
        name: order.menuName || '—',
        guests: `${order.numberOfGuests ?? 0} NGƯỜI`,
        timeRange: formatTimeRangeFromOrder(order),
        address: order.address || '—',
        contactName: order.customerName || '—',
        phone: order.customerPhone || '',
        status: route?.params?.status && typeof route.params.status === 'string' ? route.params.status : '—',
        subtotal: formatVnd(order.totalPrice),
        vat: '—',
        deposit: formatVnd(order.depositAmount),
        remaining: formatVnd(order.remainingAmount),
      }
    : emptyPartyDetail;

  const mapOrderStatusToPartyStatus = (orderStatus) => {
    switch (orderStatus) {
      case 4:
        return 'Đang chuẩn bị';
      case 5:
      case 6:
        return 'Đang diễn ra';
      case 7:
        return 'Kết thúc tiệc';
      default:
        return null;
    }
  };

  const initialStatus =
    route?.params?.status && typeof route.params.status === 'string'
      ? route.params.status
      : mapOrderStatusToPartyStatus(
          order?.orderStatus ?? order?.orderDetailStatus
        ) ||
        (partyDetail.status !== '—' ? partyDetail.status : 'Đang chuẩn bị');
  const [partyStatus, setPartyStatus] = useState(initialStatus);
  const [activeTab, setActiveTab] = useState('overview');
  const [tasks, setTasks] = useState(initialTasks);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [loadingTaskTemplates, setLoadingTaskTemplates] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [newDateTime, setNewDateTime] = useState(new Date());
  const [newEndDateTime, setNewEndDateTime] = useState(() => {
    const d = new Date();
    d.setTime(d.getTime() + 60 * 60 * 1000);
    return d;
  });
  const [newNote, setNewNote] = useState('');
  const [members, setMembers] = useState([]);
  const [leaderFullName, setLeaderFullName] = useState('');
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [refreshingTasks, setRefreshingTasks] = useState(false);
  const [tasksReady, setTasksReady] = useState(false);
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const refreshFnRef = useRef(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState('date');
  const [pickerTarget, setPickerTarget] = useState('start');
  const [compModalVisible, setCompModalVisible] = useState(false);
  const [compCatalogItems, setCompCatalogItems] = useState([]);
  const [loadingCompCatalog, setLoadingCompCatalog] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState(null);
  const [compCatalogDropdownOpen, setCompCatalogDropdownOpen] = useState(false);
  const [compQuantity, setCompQuantity] = useState('1');
  const [compNote, setCompNote] = useState('');
  const [compImages, setCompImages] = useState([]); // [{ uri, type, name }]
  const [submittingComp, setSubmittingComp] = useState(false);
  const [totalCompAmount, setTotalCompAmount] = useState(
    () => Number(orderFromParams?.extraChargeCost ?? orderFromParams?.extraChargeTotal ?? 0) || 0
  );
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [paymentSuccessVisible, setPaymentSuccessVisible] = useState(false);
  const [changingToBilling, setChangingToBilling] = useState(false);
  const [isBilling, setIsBilling] = useState(
    () =>
      Number(
        orderFromParams?.orderStatus ?? orderFromParams?.orderDetailStatus
      ) === 6
  );
  const paymentPollRef = useRef(null);
  const successHandledRef = useRef(false);
  const paymentAwaitingConfirmationRef = useRef(false);
  const queryClient = useQueryClient();

  const orderDetailId = order?.orderDetailId ?? partyDetail?.id ?? null;
  /** Theo API overview: orderStatus / orderDetailStatus — billing = 6 */
  const [orderStatusNum, setOrderStatusNum] = useState(() =>
    Number(orderFromParams?.orderStatus ?? orderFromParams?.orderDetailStatus ?? 0)
  );
  const isOrderBilling = orderStatusNum === 6;
  /**
   * create-full-qr / create-full-cash / poll payment: path & query dùng OrderId (đơn cha).
   * Không fallback orderDetailId — backend sẽ trả "order not found".
   */
  const paymentOrderId =
    order?.orderId ??
    route?.params?.orderId ??
    null;
  const endTimeIso = order?.endTime ?? null;

  useEffect(() => {
    // Auto move to BILLING when reaching endTime.
    if (!endTimeIso) return;
    let timer = null;
    const tick = () => {
      try {
        if (isBilling) return;
        const end = new Date(endTimeIso);
        if (Number.isNaN(end.getTime())) return;
        if (Date.now() >= end.getTime()) {
          setIsBilling(true);
          setPartyStatus('Kết thúc tiệc');
        }
      } catch (_) {}
    };
    tick();
    timer = setInterval(tick, 15_000);
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [endTimeIso, isBilling]);

  useEffect(() => {
    const nextStatus = Number(
      orderFromParams?.orderStatus ?? orderFromParams?.orderDetailStatus ?? 0
    );
    setOrderStatusNum(nextStatus);
    setIsBilling(nextStatus === 6);
    if (nextStatus === 6) {
      setPartyStatus('Kết thúc tiệc');
    }
  }, [
    orderFromParams?.orderStatus,
    orderFromParams?.orderDetailStatus,
    orderFromParams?.orderDetailId,
  ]);

  useEffect(() => {
    setPaymentMethod(null);
    setIsSubmittingPayment(false);
  }, [orderFromParams?.orderDetailId]);

  const stopPaymentPolling = () => {
    if (paymentPollRef.current) {
      clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
    }
  };

  const startPaymentPolling = async () => {
    if (!paymentOrderId) return;
    stopPaymentPolling();
    const token = await getAccessToken();
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/payment?OrderId=${paymentOrderId}&page=1&pageSize=10`,
          { headers },
        );
        const json = await res.json().catch(() => null);
        const payment = json?.items?.[0];
        const isPaid =
          payment &&
          (payment.paymentStatus === 2 ||
            payment.paymentStatus === '2' ||
            payment.paymentStatus === 'PAID');
        if (isPaid && paymentAwaitingConfirmationRef.current && !successHandledRef.current) {
          successHandledRef.current = true;
          stopPaymentPolling();
          setQrVisible(false);
          setPaymentSuccessVisible(true);
          paymentAwaitingConfirmationRef.current = false;
        }
      } catch (_) {}
    };

    poll();
    paymentPollRef.current = setInterval(poll, 2000);
  };

  useEffect(() => {
    // Không tự poll ngay khi vào màn BILLING:
    // chỉ poll khi người dùng đã bấm tạo QR (createFullQr).
    if (!isOrderBilling) {
      paymentAwaitingConfirmationRef.current = false;
      successHandledRef.current = false;
      stopPaymentPolling();
    }
    return () => {};
  }, [isOrderBilling, paymentOrderId]);

  useEffect(() => {
    (async () => {
      try {
        // Load current leader name to exclude from assignee list
        try {
          const rawUser = await AsyncStorage.getItem('userData');
          const user = rawUser ? JSON.parse(rawUser) : null;
          if (user?.roleName === 'GROUP_LEADER' && user?.fullName) {
            setLeaderFullName(String(user.fullName));
          }
        } catch (e) {}

        const raw = await AsyncStorage.getItem(LEADER_GROUP_MEMBERS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        setMembers(Array.isArray(list) ? list : []);
      } catch (e) {
        setMembers([]);
      }
    })();
  }, []);

  useEffect(() => {
    const orderTasks = (orderFromParams?.tasks && Array.isArray(orderFromParams.tasks))
      ? orderFromParams.tasks.map(mapApiTaskToDisplay)
      : [];
    setTasks(orderTasks);
  }, [orderFromParams?.orderDetailId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!createVisible) return;
      try {
        setLoadingTaskTemplates(true);
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}${TASK_TEMPLATE_API}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json)
          ? json
          : Array.isArray(json?.items)
            ? json.items
            : Array.isArray(json?.data?.items)
              ? json.data.items
              : [];
        const names = Array.from(
          new Set(list.map(getTaskTemplateName).filter(Boolean))
        );
        if (!cancelled) setTaskTemplates(names);
      } catch (_) {
        if (!cancelled) setTaskTemplates([]);
      } finally {
        if (!cancelled) setLoadingTaskTemplates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createVisible]);

  const refreshTasksForOrder = async () => {
    const orderDetailId = orderFromParams?.orderDetailId ?? partyDetail?.id;
    if (orderDetailId == null) return;
    setRefreshingTasks(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}${LEADER_OVERVIEW_API}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const payload = normalizeLeaderOrdersOverviewApi(data);
      const orders = payload.orders;
      const order = orders.find((o) => o.orderDetailId === orderDetailId);
      const orderTasks = (order?.tasks && Array.isArray(order.tasks))
        ? order.tasks.map(mapApiTaskToDisplay)
        : [];
      setTasks(orderTasks);
      if (order) {
        setRefreshedOrder(order);
        const nextSt = Number(order.orderStatus ?? order.orderDetailStatus ?? 0);
        setOrderStatusNum(nextSt);
        setIsBilling(nextSt === 6);
        const stLabel = mapOrderStatusToPartyStatus(nextSt);
        if (stLabel) setPartyStatus(stLabel);
        const extra = Number(order.extraChargeCost ?? order.extraChargeTotal ?? 0) || 0;
        setTotalCompAmount(extra);
      }
      await AsyncStorage.setItem(
        LEADER_OVERVIEW_CACHE_KEY,
        JSON.stringify({ data: payload, at: Date.now() })
      );
      if (Array.isArray(payload.members) && payload.members.length > 0) {
        await AsyncStorage.setItem(LEADER_GROUP_MEMBERS_KEY, JSON.stringify(payload.members));
      }
    } catch (e) {
      // keep current tasks on error
    } finally {
      setRefreshingTasks(false);
      setTasksReady(true);
    }
  };

  refreshFnRef.current = refreshTasksForOrder;

  useLayoutEffect(() => {
    const orderDetailId = orderFromParams?.orderDetailId ?? partyDetail?.id;
    if (orderDetailId != null && refreshFnRef.current) {
      refreshFnRef.current();
    }
  }, [orderFromParams?.orderDetailId, partyDetail?.id]);

  const createTaskMutation = useMutation({
    mutationFn: async (payload) => {
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/order-detail-staff-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || 'Tạo công việc thất bại.');
      }
      return res.json().catch(() => null);
    },
    onError: (error, _variables, context) => {
      // rollback optimistic UI
      if (context?.previousTasks) {
        setTasks(context.previousTasks);
      }
      Alert.alert('Lỗi', error?.message || 'Không thể tạo công việc.');
    },
    onSettled: () => {
      setCreatingTask(false);
    },
  });

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${partyDetail.name}`);
    const details = encodeURIComponent(
      `${partyDetail.address}`
    );
    let datesParam = '';
    if (order?.startTime) {
      try {
        const start = new Date(order.startTime);
        const end = order.endTime ? new Date(order.endTime) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
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
    const currentIndex = steps.indexOf(partyStatus);
    const dotStepIndex = getOrderStatusProgressStepIndex(orderStatusNum);
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isLabelActive =
            currentIndex >= 0 ? index <= currentIndex : step === partyStatus;
          const isDotActive =
            dotStepIndex != null
              ? index <= dotStepIndex
              : isLabelActive;
          return (
            <View key={step} style={styles.statusStep}>
              <View
                style={[styles.statusDot, isDotActive && styles.statusDotActive]}
              />
              <Text
                style={[
                  styles.statusLabel,
                  isLabelActive && styles.statusLabelActive,
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

  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(searchKeyword.toLowerCase().trim())
  );

  const resetForm = () => {
    const start = new Date();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    setNewTitle('');
    setSelectedMember(null);
    setAssigneeDropdownOpen(false);
    setNewDateTime(start);
    setNewEndDateTime(end);
    setNewNote('');
  };

  const formatDateLabel = (d) =>
    `${d.getDate()} tháng ${d.getMonth() + 1} ${d.getFullYear()}`;

  const formatTimeLabel = (d) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const clampToNow = (d) => {
    const now = new Date();
    return d.getTime() < now.getTime() ? now : d;
  };

  const showAndroidPicker = (mode, target) => {
    const value = target === 'end' ? newEndDateTime : newDateTime;
    const setter = target === 'end' ? setNewEndDateTime : setNewDateTime;
    const minDate = target === 'end' ? newDateTime : new Date();
    DateTimePickerAndroid.open({
      value,
      mode,
      is24Hour: false,
      ...(mode === 'date' ? { minimumDate: minDate } : {}),
      onChange: (event, selected) => {
        if (event?.type === 'dismissed' || !selected) return;
        setter((prev) => {
          const next = new Date(prev);
          if (mode === 'date') {
            next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
          } else {
            next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          }
          return target === 'start' ? clampToNow(next) : next;
        });
      },
    });
  };

  const openDatePicker = (target = 'start') => {
    setPickerTarget(target);
    if (Platform.OS === 'android') {
      showAndroidPicker('date', target);
    } else {
      setPickerMode('date');
      setPickerVisible(true);
    }
  };

  const openTimePicker = (target = 'start') => {
    setPickerTarget(target);
    if (Platform.OS === 'android') {
      showAndroidPicker('time', target);
    } else {
      setPickerMode('time');
      setPickerVisible(true);
    }
  };

  const handlePickerChange = (_event, selected) => {
    if (!selected) return;
    const setter = pickerTarget === 'end' ? setNewEndDateTime : setNewDateTime;
    setter((prev) => {
      const next = new Date(prev);
      if (pickerMode === 'date') {
        next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return pickerTarget === 'start' ? clampToNow(next) : next;
    });
    if (Platform.OS === 'ios') setPickerVisible(false);
  };

  const pickerValue = pickerTarget === 'end' ? newEndDateTime : newDateTime;
  const pickerMinDate = pickerTarget === 'end' ? newDateTime : new Date();

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    if (!selectedMember?.staffId) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn nhân viên.');
      return;
    }
    const orderDetailId = order?.orderDetailId ?? partyDetail?.id;
    if (orderDetailId == null) {
      Alert.alert('Lỗi', 'Không xác định được đơn.');
      return;
    }
    const startTime = new Date(newDateTime.getTime());
    const endTime = new Date(newEndDateTime.getTime());
    if (endTime.getTime() <= startTime.getTime()) {
      Alert.alert('Lỗi', 'Giờ kết thúc phải sau giờ bắt đầu.');
      return;
    }

    const payload = {
      orderDetailId: Number(orderDetailId),
      staffId: Number(selectedMember.staffId),
      taskName: newTitle.trim(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      note: newNote.trim() || null,
    };

    // Optimistic: thêm ngay vào list
    const optimisticTask = mapApiTaskToDisplay({
      taskId: `tmp-${Date.now()}`,
      taskName: payload.taskName,
      startTime: payload.startTime,
      endTime: payload.endTime,
      assigneeName: selectedMember.staffName,
      note: payload.note,
      status: 1,
    });

    const previousTasks = tasks;
    setTasks((prev) => [optimisticTask, ...prev]);
    setCreateVisible(false);
    resetForm();
    setCreatingTask(true);

    createTaskMutation.mutate(payload, {
      context: { previousTasks },
      onSuccess: async () => {
        await refreshTasksForOrder();
      },
    });
  };

  const parseMoney = (text) => {
    const digits = text.replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  };

  const formatMoney = (value) =>
    `${value.toLocaleString('vi-VN')}₫`;
  const remainingWithExtraCharge = formatMoney(
    (Number(order?.remainingAmount ?? 0) || 0) + totalCompAmount
  );

  const openCompModal = () => {
    setCompModalVisible(true);
    setCompCatalogDropdownOpen(false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!compModalVisible) return;
      try {
        setLoadingCompCatalog(true);
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/api/order-detail-extra-charge/catalog/active`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json) ? json : Array.isArray(json?.items) ? json.items : [];
        if (!cancelled) setCompCatalogItems(list);
      } catch (_) {
        if (!cancelled) setCompCatalogItems([]);
      } finally {
        if (!cancelled) setLoadingCompCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [compModalVisible]);

  const pickCompImages = async () => {
    if (submittingComp) return;
    if (compImages.length >= 4) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Quyền truy cập ảnh', 'Vui lòng cho phép truy cập thư viện ảnh để tải ảnh đền bù.');
        return;
      }
      const remaining = Math.max(0, 4 - compImages.length);
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
          name: a?.fileName || getFileNameFromUri(uri, `extra-charge-${Date.now()}-${idx}.jpg`),
        };
      });
      setCompImages((prev) => [...prev, ...next].slice(0, 4));
    } catch (_) {}
  };

  const handleSubmitCompensation = async () => {
    if (submittingComp) return;
    if (!orderDetailId) {
      Alert.alert('Lỗi', 'Thiếu OrderDetailId.');
      return;
    }
    const qty = Number(String(compQuantity).replace(/[^\d]/g, '') || 0);
    if (!selectedCatalogId) {
      Alert.alert('Lỗi', 'Vui lòng chọn hạng mục đền bù.');
      return;
    }
    if (!qty || qty <= 0) {
      Alert.alert('Lỗi', 'Vui lòng nhập số lượng hợp lệ.');
      return;
    }

    const selected = compCatalogItems.find((c) => Number(c?.extraChargeCatalogId) === Number(selectedCatalogId));
    const unitPrice = Number(selected?.unitPrice ?? 0);

    setSubmittingComp(true);
    try {
      const token = await getAccessToken();
      const formData = new FormData();
      formData.append('OrderDetailId', String(orderDetailId));
      formData.append('ExtraChargeCatalogId', String(selectedCatalogId));
      formData.append('Quantity', String(qty));
      formData.append('IncurredAt', new Date().toISOString());
      formData.append('Note', compNote?.trim() || '');

      compImages.forEach((img) => {
        if (!img?.uri) return;
        formData.append('ImageFiles', {
          uri: img.uri,
          type: img.type || guessMimeTypeFromUri(img.uri),
          name: img.name || getFileNameFromUri(img.uri, `extra-charge-${Date.now()}.jpg`),
        });
      });

      const res = await fetch(`${API_URL}/api/order-detail-extra-charge`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Tạo chi phí đền bù thất bại.');
      }

      // Update UI total (server will compute totalAmount = unitPrice * quantity)
      if (unitPrice > 0) {
        setTotalCompAmount((prev) => prev + unitPrice * qty);
      }

      setCompModalVisible(false);
      setSelectedCatalogId(null);
      setCompQuantity('1');
      setCompNote('');
      setCompImages([]);
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể thêm chi phí đền bù.');
    } finally {
      setSubmittingComp(false);
    }
  };

  const handleMoveToBilling = async () => {
    if (!orderDetailId || changingToBilling) return;
    try {
      setChangingToBilling(true);
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/order-detail/end-early/${orderDetailId}`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || 'Không thể chuyển trạng thái sang chờ thanh toán.');
      }
      setOrderStatusNum(6);
      setIsBilling(true);
      setPaymentMethod(null);
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể chuyển sang trạng thái thanh toán.');
    } finally {
      setChangingToBilling(false);
    }
  };

  const createFullQr = async (methodValue) => {
    if (isSubmittingPayment) return;
    if (!paymentOrderId) {
      Alert.alert(
        'Lỗi',
        'Thiếu orderId đơn hàng (không phải orderDetailId). Vui lòng làm mới danh sách từ trang chủ.',
      );
      return;
    }
    try {
      setIsSubmittingPayment(true);
      const paymentMethodValue = Number(methodValue);
      if (![2, 3].includes(paymentMethodValue)) {
        Alert.alert('Lỗi', 'Phương thức thanh toán không hợp lệ.');
        return;
      }
      paymentAwaitingConfirmationRef.current = true;
      successHandledRef.current = false;
      setPaymentSuccessVisible(false);
      const token = await getAccessToken();
      const url = `${API_URL}/api/payment/create-full-qr/${paymentOrderId}?paymentMethod=${encodeURIComponent(String(paymentMethodValue))}`;
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      const res = await fetch(url, { method: 'POST', headers });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {
        json = { raw: text };
      }
      if (!res.ok) throw new Error(json?.message || 'Không thể tạo QR thanh toán.');
      const data = json?.data ?? json;
      setQrData({
        ...data,
        qrUrl: getPaymentQrImageUrl(data),
      });
      setQrVisible(true);
      await startPaymentPolling();
    } catch (e) {
      paymentAwaitingConfirmationRef.current = false;
      Alert.alert('Lỗi', e?.message || 'Không thể tạo QR thanh toán.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const createFullCash = async () => {
    if (isSubmittingPayment) return;
    if (!paymentOrderId) {
      Alert.alert(
        'Lỗi',
        'Thiếu orderId đơn hàng (không phải orderDetailId). Vui lòng làm mới danh sách từ trang chủ.',
      );
      return;
    }
    try {
      setIsSubmittingPayment(true);
      paymentAwaitingConfirmationRef.current = false;
      const token = await getAccessToken();
      const res = await fetch(`${API_URL}/api/payment/create-full-cash/${paymentOrderId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || 'Không thể xác nhận thanh toán tiền mặt.');
      }
      successHandledRef.current = true;
      stopPaymentPolling();
      setQrVisible(false);
      setPaymentSuccessVisible(false);

      Alert.alert('Thành công', 'Đã hoàn thành thanh toán (tiền mặt).', [
        {
          text: 'Về trang chủ',
          onPress: () => navigation.navigate('LeaderHome'),
        },
      ]);
    } catch (e) {
      Alert.alert('Lỗi', e?.message || 'Không thể xác nhận thanh toán tiền mặt.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const renderOverviewTab = () => {
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
        <TouchableOpacity
          style={styles.partyCard}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate('MenuDetail', {
              menuId: order?.menuId ?? 1,
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
              {partyDetail.guests}
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

        {orderStatusNum === 5 && (
          <TouchableOpacity
            style={[styles.finishButton, changingToBilling && { opacity: 0.7 }]}
            activeOpacity={0.85}
            onPress={handleMoveToBilling}
            disabled={changingToBilling}
          >
            <Text style={styles.finishButtonText}>
              {changingToBilling ? 'Đang chuyển...' : 'Cho khách hàng thanh toán'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.summarySection}>
          {isOrderBilling && (
            <View style={styles.compHeaderRow}>
              <Text style={styles.compTitle}>+ Thêm chi phí hư hại / đền bù:</Text>
              <TouchableOpacity
                style={styles.compAddButton}
                activeOpacity={0.8}
                onPress={openCompModal}
              >
                <Text style={styles.compAddButtonText}>Thêm</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.summaryRow, { marginTop: 8 }]}>
            <Text style={styles.summaryLabel}>Tổng tiền</Text>
            <Text style={styles.summaryValue}>{partyDetail.subtotal}</Text>
          </View>
          {/* Thuế VAT (10%) - chưa dùng
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Thuế VAT (10%)</Text>
            <Text style={styles.summaryValue}>{partyDetail.vat}</Text>
          </View>
          */}
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Đã cọc</Text>
            <Text style={styles.summaryValue}>{partyDetail.deposit}</Text>
          </View>
          {totalCompAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Chi phí phát sinh</Text>
              <Text style={styles.summaryValue}>{formatMoney(totalCompAmount)}</Text>
            </View>
          )}
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.summaryHighlight]}>
              Còn lại
            </Text>
            <Text style={[styles.summaryValue, styles.summaryHighlight]}>
              {remainingWithExtraCharge}
            </Text>
          </View>
        </View>

        {isOrderBilling && (
          <>
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle}>Thanh toán</Text>
              {[
                { key: 'bank', label: 'Chuyển khoản ngân hàng', paymentMethodValue: 2 },
                { key: 'zalopay', label: 'ZaloPay', paymentMethodValue: 3 },
                { key: 'cash', label: 'Tiền mặt' },
              ].map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={[
                    styles.paymentMethodCard,
                    paymentMethod === method.key && styles.paymentMethodCardActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setPaymentMethod(method.key)}
                >
                  <View style={styles.paymentMethodLeft}>
                    <View style={styles.paymentMethodIconWrap}>
                      {method.key === 'bank' ? (
                        <Image
                          source={require('../assets/logo-vietqr.webp')}
                          style={styles.paymentMethodLogo}
                          resizeMode="contain"
                        />
                      ) : method.key === 'zalopay' ? (
                        <Image
                          source={require('../assets/zalopay.jpg')}
                          style={styles.paymentMethodLogoZalo}
                          resizeMode="cover"
                        />
                      ) : (
                        <Ionicons name="cash-outline" size={20} color={PRIMARY_COLOR} />
                      )}
                    </View>
                    <Text style={styles.paymentLabel}>{method.label}</Text>
                  </View>
                  <Ionicons
                    name={
                      paymentMethod === method.key
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={18}
                    color={PRIMARY_COLOR}
                  />
                </TouchableOpacity>
              ))}
            </View>

            {(paymentMethod === 'cash' || paymentMethod === 'bank' || paymentMethod === 'zalopay') && (
              <TouchableOpacity
                style={[styles.finishButton, isSubmittingPayment && { opacity: 0.7 }]}
                activeOpacity={0.85}
                onPress={() => {
                  if (isSubmittingPayment) return;
                  if (paymentMethod === 'cash') createFullCash();
                  else createFullQr(paymentMethod === 'zalopay' ? 3 : 2);
                }}
                disabled={isSubmittingPayment}
              >
                <Text style={styles.finishButtonText}>
                  {isSubmittingPayment
                    ? 'Đang xử lý...'
                    : paymentMethod === 'cash'
                      ? 'Xác nhận tiền mặt'
                      : 'Tạo QR thanh toán'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderTasksTab = () => {
    const showEmptyState = tasksReady && filteredTasks.length === 0;
    const showTaskList = tasksReady;
    return (
      <View style={styles.tasksContainer}>
        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons
              name="search"
              size={18}
              color={TEXT_SECONDARY}
              style={styles.searchIcon}
            />
            <TextInput
              placeholder="Tìm công việc..."
              placeholderTextColor={TEXT_SECONDARY}
              style={styles.searchInput}
              value={searchKeyword}
              onChangeText={setSearchKeyword}
            />
          </View>
          <TouchableOpacity
            style={styles.addTaskButton}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color={BACKGROUND_WHITE} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            !showTaskList ? styles.tasksListEmpty
              : showEmptyState ? styles.tasksListEmpty : styles.tasksList
          }
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
              <View key={i} style={styles.taskRow}>
                <View style={styles.taskInfo}>
                  <View style={[styles.taskTitleSkeleton, styles.skeleton]} />
                  <View style={[styles.taskMetaSkeleton, styles.skeleton]} />
                </View>
                <View style={[styles.taskStatusBadgeSkeleton, styles.skeleton]} />
              </View>
            ))
          ) : showEmptyState ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="cube-outline"
                size={64}
                color={PRIMARY_COLOR}
                style={styles.emptyIcon}
              />
              <Text style={styles.emptyTitle}>Chưa có công việc</Text>
              <Text style={styles.emptySubtitle}>Tạo công việc ngay</Text>
            </View>
          ) : (
            filteredTasks.map((task) => (
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
                  {!!task.note && (
                    <Text style={styles.taskNote} numberOfLines={2}>Ghi chú: {task.note}</Text>
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
      </View>
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

      <Modal
        visible={createVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCreateVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={styles.modalKeyboardWrapper}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Tạo công việc</Text>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.fieldLabel}>Tên công việc</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập tên công việc"
                    placeholderTextColor={TEXT_SECONDARY}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    returnKeyType="next"
                  />
                  <Text style={styles.taskTemplateLabel}>Gợi ý thường dùng</Text>
                  {loadingTaskTemplates ? (
                    <Text style={styles.taskTemplateHint}>Đang tải gợi ý...</Text>
                  ) : taskTemplates.length === 0 ? (
                    <Text style={styles.taskTemplateHint}>Chưa có gợi ý. Bạn vẫn có thể nhập tay.</Text>
                  ) : (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.taskTemplateList}
                      contentContainerStyle={styles.taskTemplateListContent}
                      keyboardShouldPersistTaps="handled"
                    >
                      {taskTemplates.map((name, idx) => {
                        const isActive = newTitle.trim() === name;
                        return (
                          <TouchableOpacity
                            key={`${name}-${idx}`}
                            style={[
                              styles.taskTemplateChip,
                              isActive && styles.taskTemplateChipActive,
                            ]}
                            activeOpacity={0.8}
                            onPress={() => setNewTitle(name)}
                          >
                            <Text
                              style={[
                                styles.taskTemplateChipText,
                                isActive && styles.taskTemplateChipTextActive,
                              ]}
                            >
                              {name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  )}

                  <Text style={styles.fieldLabel}>Nhân viên</Text>
                  <TouchableOpacity
                    style={styles.assigneeSelectOnly}
                    onPress={() => setAssigneeDropdownOpen((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Text style={selectedMember ? styles.assigneeSelectText : styles.assigneeSelectPlaceholder}>
                      {selectedMember ? selectedMember.staffName : 'Chọn nhân viên'}
                    </Text>
                    <Ionicons name={assigneeDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={TEXT_SECONDARY} />
                  </TouchableOpacity>
                  {assigneeDropdownOpen && (
                    <View style={styles.assigneeDropdown}>
                      {(() => {
                        const filtered = (members || []).filter((m) => {
                          const name = (m?.staffName || '').trim();
                          return !leaderFullName || name !== String(leaderFullName).trim();
                        });
                        if (filtered.length === 0) {
                          return <Text style={styles.assigneeDropdownEmpty}>Chưa có danh sách nhân viên</Text>;
                        }
                        return (
                          <ScrollView
                            style={styles.assigneeDropdownList}
                            nestedScrollEnabled
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                          >
                            {filtered.map((item, idx) => {
                              const isSelected = Number(selectedMember?.staffId) === Number(item.staffId);
                              return (
                                <View key={String(item.staffId)}>
                                  {idx > 0 && <View style={styles.assigneeDropdownSeparator} />}
                                  <TouchableOpacity
                                    style={[styles.assigneeDropdownItem, isSelected && styles.assigneeDropdownItemSelected]}
                                    onPress={() => {
                                      setSelectedMember({ staffId: item.staffId, staffName: item.staffName || `#${item.staffId}` });
                                      setAssigneeDropdownOpen(false);
                                    }}
                                    activeOpacity={0.7}
                                  >
                                    <Text style={[styles.assigneeDropdownItemText, isSelected && styles.assigneeDropdownItemTextSelected]}>
                                      {item.staffName || `#${item.staffId}`}
                                    </Text>
                                    {isSelected && <Ionicons name="checkmark" size={18} color={PRIMARY_COLOR} />}
                                  </TouchableOpacity>
                                </View>
                              );
                            })}
                          </ScrollView>
                        );
                      })()}
                    </View>
                  )}

                  <View style={styles.row}>
                    <View style={[styles.rowItem, { marginRight: 6 }]}>
                      <Text style={styles.fieldLabel}>Ngày bắt đầu</Text>
                      <TouchableOpacity
                        style={[styles.textInput, styles.selectInput]}
                        onPress={() => openDatePicker('start')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectText}>
                          {formatDateLabel(newDateTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.rowItem, { marginLeft: 6 }]}>
                      <Text style={styles.fieldLabel}>Giờ bắt đầu</Text>
                      <TouchableOpacity
                        style={[styles.textInput, styles.selectInput]}
                        onPress={() => openTimePicker('start')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectText}>
                          {formatTimeLabel(newDateTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <View style={[styles.rowItem, { marginRight: 6 }]}>
                      <Text style={styles.fieldLabel}>Ngày kết thúc</Text>
                      <TouchableOpacity
                        style={[styles.textInput, styles.selectInput]}
                        onPress={() => openDatePicker('end')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectText}>
                          {formatDateLabel(newEndDateTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.rowItem, { marginLeft: 6 }]}>
                      <Text style={styles.fieldLabel}>Giờ kết thúc</Text>
                      <TouchableOpacity
                        style={[styles.textInput, styles.selectInput]}
                        onPress={() => openTimePicker('end')}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectText}>
                          {formatTimeLabel(newEndDateTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {Platform.OS === 'ios' && pickerVisible && (
                    <View style={styles.inlinePickerContainer}>
                      <View style={styles.inlinePickerCard}>
                        <DateTimePicker
                          value={pickerValue}
                          mode={pickerMode}
                          minimumDate={pickerMinDate}
                          display="spinner"
                          onChange={handlePickerChange}
                          style={styles.inlinePicker}
                        />
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.modalButton,
                          styles.modalButtonSecondary,
                          { marginTop: 10 },
                        ]}
                        onPress={() => setPickerVisible(false)}
                      >
                        <Text style={styles.modalButtonSecondaryText}>Xong</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Ghi chú</Text>
                  <TextInput
                    style={[styles.textInput, styles.noteInput]}
                    placeholder="Thêm ghi chú"
                    placeholderTextColor={TEXT_SECONDARY}
                    value={newNote}
                    onChangeText={setNewNote}
                    multiline
                    scrollEnabled={false}
                  />
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => {
                      setCreateVisible(false);
                      resetForm();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonSecondaryText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonPrimary,
                      (creatingTask || !newTitle.trim() || !selectedMember?.staffId) && styles.modalButtonDisabled,
                    ]}
                    onPress={handleAddTask}
                    disabled={creatingTask || !newTitle.trim() || !selectedMember?.staffId}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonPrimaryText}>{creatingTask ? 'Đang tạo...' : 'Thêm'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal thêm chi phí đền bù */}
      <Modal
        visible={compModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCompModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
            style={styles.modalKeyboardWrapper}
          >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Thêm chi phí đền bù</Text>
                <ScrollView
                  style={styles.modalScroll}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.fieldLabel}>Chọn hạng mục</Text>
                  {loadingCompCatalog ? (
                    <Text style={styles.compHintText}>Đang tải danh sách...</Text>
                  ) : compCatalogItems.length === 0 ? (
                    <Text style={styles.compHintText}>Không có hạng mục đền bù khả dụng.</Text>
                  ) : (
                    <View>
                      <TouchableOpacity
                        style={styles.compCatalogDropdownHeader}
                        activeOpacity={0.9}
                        onPress={() => setCompCatalogDropdownOpen((v) => !v)}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.compCatalogDropdownTitle} numberOfLines={2}>
                            {(() => {
                              const selected = compCatalogItems.find(
                                (c) => Number(c?.extraChargeCatalogId) === Number(selectedCatalogId),
                              );
                              return selected?.title || 'Chọn hạng mục đền bù';
                            })()}
                          </Text>
                          <Text style={styles.compCatalogDropdownSub} numberOfLines={1}>
                            {(() => {
                              const selected = compCatalogItems.find(
                                (c) => Number(c?.extraChargeCatalogId) === Number(selectedCatalogId),
                              );
                              const unitPrice = Number(selected?.unitPrice ?? 0);
                              return `${formatMoney(unitPrice)} / ${selected?.unit || 'đơn vị'}`;
                            })()}
                          </Text>
                        </View>
                        <Ionicons
                          name={compCatalogDropdownOpen ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={PRIMARY_COLOR}
                        />
                      </TouchableOpacity>

                      {compCatalogDropdownOpen && (
                        <View style={styles.compCatalogDropdownListWrap}>
                          <ScrollView
                            style={{ maxHeight: 220 }}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                          >
                            {compCatalogItems.map((c) => {
                              const id = c?.extraChargeCatalogId;
                              const isSelected = Number(id) === Number(selectedCatalogId);
                              return (
                                <TouchableOpacity
                                  key={String(id)}
                                  style={[
                                    styles.compCatalogItem,
                                    isSelected && styles.compCatalogItemSelected,
                                    { marginBottom: 0 },
                                  ]}
                                  activeOpacity={0.85}
                                  onPress={() => {
                                    setSelectedCatalogId(id);
                                    setCompCatalogDropdownOpen(false);
                                  }}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.compCatalogTitle} numberOfLines={2}>
                                      {c?.title || '—'}
                                    </Text>
                                    <Text style={styles.compCatalogSub} numberOfLines={2}>
                                      {formatMoney(Number(c?.unitPrice ?? 0))} / {c?.unit || 'đơn vị'}
                                    </Text>
                                  </View>
                                  <Ionicons
                                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                    size={18}
                                    color={PRIMARY_COLOR}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  )}

                  <Text style={styles.fieldLabel}>Số lượng</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="1"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="numeric"
                    value={compQuantity}
                    onChangeText={setCompQuantity}
                  />

                  <Text style={styles.fieldLabel}>Ghi chú</Text>
                  <TextInput
                    style={[styles.textInput, styles.noteInput]}
                    placeholder="Thêm ghi chú"
                    placeholderTextColor={TEXT_SECONDARY}
                    value={compNote}
                    onChangeText={setCompNote}
                    multiline
                    scrollEnabled={false}
                  />

                  <Text style={styles.fieldLabel}>Ảnh minh chứng</Text>
                  <TouchableOpacity
                    style={styles.compPickBtn}
                    activeOpacity={0.85}
                    disabled={submittingComp}
                    onPress={pickCompImages}
                  >
                    <Ionicons name="image-outline" size={18} color={TEXT_PRIMARY} />
                    <Text style={styles.compPickBtnText}>Chọn ảnh</Text>
                    <Text style={styles.compPickBtnSubText}>({compImages.length}/4)</Text>
                  </TouchableOpacity>
                  {!!compImages.length && (
                    <View style={styles.compThumbRow}>
                      {compImages.map((img, idx) => (
                        <TouchableOpacity
                          key={`${img?.name ?? 'img'}-${idx}`}
                          style={styles.compThumbWrap}
                          activeOpacity={0.85}
                          disabled={submittingComp}
                          onPress={() => setCompImages((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <ExpoImage source={{ uri: img.uri }} style={styles.compThumb} />
                          <View style={styles.compThumbRemoveBadge}>
                            <Ionicons name="close" size={12} color={BACKGROUND_WHITE} />
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => {
                      setCompModalVisible(false);
                      setCompCatalogDropdownOpen(false);
                      setSelectedCatalogId(null);
                      setCompQuantity('1');
                      setCompNote('');
                      setCompImages([]);
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonSecondaryText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalButtonPrimary,
                      (submittingComp || !selectedCatalogId) && styles.modalButtonDisabled,
                    ]}
                    onPress={handleSubmitCompensation}
                    disabled={submittingComp || !selectedCatalogId}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonPrimaryText}>{submittingComp ? 'Đang gửi...' : 'Thêm'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* QR modal */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => setQrVisible(false)}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <TouchableOpacity
              style={styles.qrCloseBtn}
              activeOpacity={0.8}
              onPress={() => setQrVisible(false)}
            >
              <Text style={styles.qrCloseText}>X</Text>
            </TouchableOpacity>
            <Text style={styles.qrTitle}>Quét mã để thanh toán</Text>
            {qrData?.qrUrl ? (
              <ExpoImage source={{ uri: qrData.qrUrl }} style={styles.qrImage} contentFit="contain" />
            ) : (
              <View style={[styles.qrImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="qr-code-outline" size={44} color={TEXT_SECONDARY} />
              </View>
            )}
            <View style={styles.qrMeta}>
              <View style={styles.qrMetaRow}>
                <Text style={styles.qrMetaLabel}>Mã thanh toán</Text>
                <Text style={styles.qrMetaValue}>{qrData?.paymentCode || ''}</Text>
              </View>
              <View style={styles.qrMetaRow}>
                <Text style={styles.qrMetaLabel}>Số tiền</Text>
                <Text style={styles.qrMetaValue}>
                  {qrData?.amount != null ? `${Number(qrData.amount).toLocaleString('vi-VN')}₫` : '—'}
                </Text>
              </View>
            </View>
            <Text style={styles.qrHint}>Đang chờ xác nhận thanh toán...</Text>
          </View>
        </View>
      </Modal>

      {/* Payment success modal */}
      <Modal visible={paymentSuccessVisible} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={PRIMARY_COLOR} />
            <Text style={styles.successTitle}>Thanh toán thành công</Text>
            <TouchableOpacity
              style={styles.successBtn}
              activeOpacity={0.85}
              onPress={() => {
                setPaymentSuccessVisible(false);
                navigation.navigate('LeaderHome');
              }}
            >
              <Text style={styles.successBtnText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>


      <BottomNavigationStaff
        activeTab="LeaderHome"
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
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assigneeInput: {
    flex: 1,
  },
  assigneeSelectButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PRIMARY_COLOR,
  },
  assigneeSelectButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  assigneeSelectOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: INPUT_BACKGROUND,
    minHeight: 48,
  },
  assigneeSelectText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  assigneeSelectPlaceholder: {
    fontSize: 15,
    color: TEXT_SECONDARY,
    flex: 1,
  },
  assigneeDropdown: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    backgroundColor: BACKGROUND_WHITE,
    overflow: 'hidden',
  },
  assigneeDropdownList: {
    maxHeight: 220,
  },
  assigneeDropdownSeparator: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
  },
  assigneeDropdownEmpty: {
    padding: 12,
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  assigneeDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  assigneeDropdownItemSelected: {
    backgroundColor: 'rgba(232, 113, 46, 0.08)',
  },
  assigneeDropdownItemText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    flex: 1,
    marginRight: 10,
  },
  assigneeDropdownItemTextSelected: {
    color: PRIMARY_COLOR,
    fontWeight: '800',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },

  compHintText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    marginBottom: 6,
  },
  compCatalogList: {
    marginTop: 6,
    marginBottom: 4,
  },
  compCatalogDropdownHeader: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    backgroundColor: INPUT_BACKGROUND,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compCatalogDropdownTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  compCatalogDropdownSub: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  compCatalogDropdownListWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    backgroundColor: BACKGROUND_WHITE,
    padding: 8,
  },
  compCatalogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: BACKGROUND_WHITE,
  },
  compCatalogItemSelected: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'rgba(232, 113, 46, 0.06)',
  },
  compCatalogTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginRight: 10,
  },
  compCatalogSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    marginRight: 10,
  },
  compPickBtn: {
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compPickBtnText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  compPickBtnSubText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  compThumbRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  compThumbWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#EAEAEA',
    position: 'relative',
  },
  compThumb: {
    width: '100%',
    height: '100%',
  },
  compThumbRemoveBadge: {
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
  compHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  compTitle: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  compAddButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
  },
  compAddButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: BACKGROUND_WHITE,
  },
  tasksContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 20,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  addTaskButton: {
    marginLeft: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  emptySubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  tasksList: {
    paddingTop: 4,
  },
  tasksListEmpty: {
    flexGrow: 1,
    paddingTop: 4,
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
  skeleton: {
    backgroundColor: '#E5E5E5',
    borderRadius: 4,
  },
  taskTitleSkeleton: {
    height: 16,
    width: '80%',
    marginBottom: 8,
  },
  taskMetaSkeleton: {
    height: 12,
    width: '50%',
  },
  taskStatusBadgeSkeleton: {
    width: 90,
    height: 28,
    borderRadius: 12,
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
  taskNote: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '99%',
    flexDirection: 'column',
  },
  modalKeyboardWrapper: {
    width: '100%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginTop: 8,
    marginBottom: 4,
  },
  taskTemplateLabel: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 8,
    marginBottom: 6,
  },
  taskTemplateHint: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  taskTemplateList: {
    marginBottom: 2,
  },
  taskTemplateListContent: {
    paddingRight: 8,
  },
  taskTemplateChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: BACKGROUND_WHITE,
    marginRight: 8,
  },
  taskTemplateChipActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'rgba(232, 113, 46, 0.08)',
  },
  taskTemplateChipText: {
    fontSize: 12,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  taskTemplateChipTextActive: {
    color: PRIMARY_COLOR,
  },
  textInput: {
    borderRadius: 10,
    backgroundColor: INPUT_BACKGROUND,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalScroll: {
    flexGrow: 0,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowItem: {
    flex: 1,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    columnGap: 10,
  },
  inlinePickerContainer: {
    marginTop: 10,
  },
  inlinePickerCard: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: BACKGROUND_WHITE,
    maxHeight: 160,
    maxWidth: '100%',
  },
  inlinePicker: {
    height: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginLeft: -15,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: BACKGROUND_WHITE,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonSecondary: {
    backgroundColor: BACKGROUND_WHITE,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  modalButtonPrimary: {
    backgroundColor: PRIMARY_COLOR,
  },
  modalButtonSecondaryText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  modalButtonPrimaryText: {
    fontSize: 14,
    color: BACKGROUND_WHITE,
    fontWeight: '600',
  },
  paymentSection: {
    marginTop: 20,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 14,
    backgroundColor: BACKGROUND_WHITE,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  paymentMethodCardActive: {
    borderColor: PRIMARY_COLOR,
    backgroundColor: 'rgba(232, 113, 46, 0.08)',
  },
  paymentMethodLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  paymentMethodIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  paymentMethodLogo: {
    width: 24,
    height: 24,
  },
  paymentMethodLogoZalo: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  finishButton: {
    marginTop: 24,
    borderRadius: 24,
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  finishButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BACKGROUND_WHITE,
  },
  qrOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  qrCard: {
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 16,
    padding: 16,
    position: 'relative',
  },
  qrCloseBtn: {
    position: 'absolute',
    top: 10,
    right: 12,
    zIndex: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qrCloseText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_SECONDARY,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  qrImage: {
    width: '100%',
    height: 260,
    marginTop: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
  },
  qrMeta: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER_LIGHT,
    paddingTop: 12,
  },
  qrMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  qrMetaLabel: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '700' },
  qrMetaValue: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '900' },
  qrHint: { marginTop: 10, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    width: '100%',
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  successTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '900',
    color: TEXT_PRIMARY,
  },
  successBtn: {
    marginTop: 16,
    width: '100%',
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: BACKGROUND_WHITE,
  },
  selectInput: {
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  selectorOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});

