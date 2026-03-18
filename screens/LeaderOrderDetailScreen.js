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

const LEADER_GROUP_MEMBERS_KEY = 'leaderGroupMembers';
const LEADER_OVERVIEW_CACHE_KEY = 'leaderOverviewCache';
const LEADER_OVERVIEW_API = '/api/staff-group/leader/orders-overview';

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
  PENDING: 'Chưa bắt đầu',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  DONE: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
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

export default function LeaderOrderDetailScreen({ navigation, route }) {
  const orderFromParams = route?.params?.order;
  const initialTasks = (orderFromParams?.tasks && Array.isArray(orderFromParams.tasks))
    ? orderFromParams.tasks.map(mapApiTaskToDisplay)
    : [];
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
        status: route?.params?.status && typeof route.params.status === 'string' ? route.params.status : '—',
        subtotal: formatVnd(orderFromParams.totalPrice),
        vat: '—',
        deposit: formatVnd(orderFromParams.depositAmount),
        remaining: formatVnd(orderFromParams.remainingAmount),
      }
    : emptyPartyDetail;

  const mapOrderStatusToPartyStatus = (orderStatus) => {
    switch (orderStatus) {
      case 4:
        return 'Đang chuẩn bị';
      case 5:
        return 'Đang diễn ra';
      case 6:
        return 'Kết thúc tiệc';
      default:
        return null;
    }
  };

  const initialStatus =
    route?.params?.status && typeof route.params.status === 'string'
      ? route.params.status
      : mapOrderStatusToPartyStatus(orderFromParams?.orderStatus) ||
        (partyDetail.status !== '—' ? partyDetail.status : 'Đang chuẩn bị');
  const [partyStatus, setPartyStatus] = useState(initialStatus);
  const [activeTab, setActiveTab] = useState('overview');
  const [tasks, setTasks] = useState(initialTasks);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
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
  const [compName, setCompName] = useState('');
  const [compAmount, setCompAmount] = useState('');
  const [compNote, setCompNote] = useState('');
  const [totalCompAmount, setTotalCompAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('zalopay');
  const queryClient = useQueryClient();

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
      const orders = Array.isArray(data?.orders) ? data.orders : [];
      const order = orders.find((o) => o.orderDetailId === orderDetailId);
      const orderTasks = (order?.tasks && Array.isArray(order.tasks))
        ? order.tasks.map(mapApiTaskToDisplay)
        : [];
      setTasks(orderTasks);
      const payload = {
        staffGroupId: data.staffGroupId,
        staffGroupName: data.staffGroupName,
        leaderId: data.leaderId,
        leaderName: data.leaderName,
        members: Array.isArray(data.members) ? data.members : [],
        orders,
      };
      await AsyncStorage.setItem(
        LEADER_OVERVIEW_CACHE_KEY,
        JSON.stringify({ data: payload, at: Date.now() })
      );
      if (Array.isArray(data.members) && data.members.length > 0) {
        await AsyncStorage.setItem(LEADER_GROUP_MEMBERS_KEY, JSON.stringify(data.members));
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
    const currentIndex = steps.indexOf(partyStatus);
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isActive =
            currentIndex >= 0 ? index <= currentIndex : step === partyStatus;
          return (
            <View key={step} style={styles.statusStep}>
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
    const orderDetailId = orderFromParams?.orderDetailId ?? partyDetail?.id;
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

  const handleAddCompensation = () => {
    const amountNumber = parseMoney(compAmount);
    if (!amountNumber) {
      Alert.alert('Lỗi', 'Vui lòng nhập số tiền đền bù hợp lệ.');
      return;
    }
    setTotalCompAmount((prev) => prev + amountNumber);
    setCompModalVisible(false);
    setCompName('');
    setCompAmount('');
    setCompNote('');
  };

  const handleFinishParty = () => {
    Alert.alert(
      'Hoàn thành tiệc',
      'Bạn có chắc muốn kết thúc tiệc không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Hoàn thành',
          style: 'destructive',
          onPress: () => setPartyStatus('Kết thúc tiệc'),
        },
      ]
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
            {partyDetail.status === '—' ? (
              <Text style={styles.partyStatusPlaceholder}>Trạng thái: —</Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        {renderStatusSteps()}

        <View style={styles.summarySection}>
          {partyStatus === 'Đang diễn ra' && (
            <View style={styles.compHeaderRow}>
              <Text style={styles.compTitle}>+ Thêm chi phí hư hại / đền bù:</Text>
              <TouchableOpacity
                style={styles.compAddButton}
                activeOpacity={0.8}
                onPress={() => setCompModalVisible(true)}
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
              <Text style={styles.summaryLabel}>Chi phí đền bù</Text>
              <Text style={styles.summaryValue}>{formatMoney(totalCompAmount)}</Text>
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

        {partyStatus === 'Đang diễn ra' && (
          <>
            <View style={styles.paymentSection}>
              <Text style={styles.paymentTitle}>Phương thức thanh toán:</Text>
              {[
                { key: 'zalopay', label: 'Thanh toán qua Zalopay' },
                { key: 'bank', label: 'Chuyển khoản ngân hàng' },
                { key: 'cash', label: 'Tiền mặt' },
              ].map((method) => (
                <TouchableOpacity
                  key={method.key}
                  style={styles.paymentRow}
                  activeOpacity={0.7}
                  onPress={() => setPaymentMethod(method.key)}
                >
                  <Ionicons
                    name={
                      paymentMethod === method.key
                        ? 'radio-button-on'
                        : 'radio-button-off'
                    }
                    size={18}
                    color={PRIMARY_COLOR}
                  />
                  <Text style={styles.paymentLabel}>{method.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.finishButton}
              activeOpacity={0.85}
              onPress={handleFinishParty}
            >
              <Text style={styles.finishButtonText}>Hoàn thành tiệc</Text>
            </TouchableOpacity>
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                  <Text style={styles.fieldLabel}>Chọn món đền bù</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Nhập tên hạng mục đền bù"
                    placeholderTextColor={TEXT_SECONDARY}
                    value={compName}
                    onChangeText={setCompName}
                  />

                  <Text style={styles.fieldLabel}>Số tiền</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0đ"
                    placeholderTextColor={TEXT_SECONDARY}
                    keyboardType="numeric"
                    value={compAmount}
                    onChangeText={setCompAmount}
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
                </ScrollView>

                <View style={styles.modalButtonsRow}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonSecondary]}
                    onPress={() => {
                      setCompModalVisible(false);
                      setCompName('');
                      setCompAmount('');
                      setCompNote('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonSecondaryText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleAddCompensation}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.modalButtonPrimaryText}>Thêm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
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
  partyStatusPlaceholder: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 4,
    fontStyle: 'italic',
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
  taskStatusText: {
    fontSize: 11,
    color: TEXT_SECONDARY,
  },
  taskStatusTextDone: {
    color: PRIMARY_COLOR,
    fontWeight: '600',
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
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  paymentLabel: {
    marginLeft: 8,
    fontSize: 14,
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

