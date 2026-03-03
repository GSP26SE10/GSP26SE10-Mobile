import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
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

const mockPartyDetail = {
  id: 1,
  image:
    'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg',
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

const mockTasksInitial = [
  {
    id: 1,
    title: 'Chuẩn bị nguyên liệu (An)',
    dateLabel: '10 tháng 1 2026',
    timeLabel: '8:00 AM',
    assignee: 'An',
    note: '',
    status: 'Đang chuẩn bị',
  },
  {
    id: 2,
    title: 'Setup bàn ghế (Bình)',
    dateLabel: '10 tháng 1 2026',
    timeLabel: '9:00 AM',
    assignee: 'Bình',
    note: '',
    status: 'Chưa bắt đầu',
  },
];

export default function LeaderOrderDetailScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks'
  const [tasks, setTasks] = useState(mockTasksInitial);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDateTime, setNewDateTime] = useState(new Date());
  const [newNote, setNewNote] = useState('');
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState('date'); // 'date' | 'time'

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${mockPartyDetail.name}`);
    const details = encodeURIComponent(
      `${mockPartyDetail.dishes}, ${mockPartyDetail.guests}, ${mockPartyDetail.address}`
    );
    let datesParam = '';
    try {
      const [timePartRaw, datePartRaw] = mockPartyDetail.timeRange
        .split('–')
        .map((s) => s.trim());
      const timePart = timePartRaw.replace('h', ':');
      const [hourStr, minuteStr] = timePart.split(':');
      const [dayStr, monthStr, yearStr] = datePartRaw.split('/');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10) || 0;

      const start = new Date(year, month, day, hour, minute);
      const end = new Date(year, month, day, hour + 2, minute);

      const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
      const format = (d) =>
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
          d.getHours()
        )}${pad(d.getMinutes())}00`;

      datesParam = `&dates=${format(start)}/${format(end)}`;
    } catch (e) {
      // ignore parse failures
    }

    const url = `https://calendar.google.com/calendar/r/eventedit?text=${title}&details=${details}${datesParam}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể mở Google Calendar.');
    }
  };

  const handleOpenMaps = async () => {
    const query = encodeURIComponent(mockPartyDetail.address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể mở Google Maps.');
    }
  };

  const handleCallPhone = () => {
    Alert.alert('Gọi điện', `Bạn có muốn gọi ${mockPartyDetail.phone} không?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Gọi',
        style: 'destructive',
        onPress: async () => {
          const url = `tel:${mockPartyDetail.phone}`;
          try {
            await Linking.openURL(url);
          } catch (e) {
            Alert.alert('Lỗi', 'Không thể thực hiện cuộc gọi.');
          }
        },
      },
    ]);
  };

  const renderStatusSteps = () => {
    const steps = ['Đang chuẩn bị', 'Đang diễn ra', 'Kết thúc tiệc'];
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isActive = step === mockPartyDetail.status;
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
    setNewTitle('');
    setNewAssignee('');
    setNewDateTime(new Date());
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

  const showAndroidPicker = (mode) => {
    DateTimePickerAndroid.open({
      value: newDateTime,
      mode,
      is24Hour: false,
      ...(mode === 'date' ? { minimumDate: new Date() } : {}),
      onChange: (event, selected) => {
        if (event?.type === 'dismissed' || !selected) {
          return;
        }
        setNewDateTime((prev) => {
          const next = new Date(prev);
          if (mode === 'date') {
            next.setFullYear(
              selected.getFullYear(),
              selected.getMonth(),
              selected.getDate()
            );
          } else {
            next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
          }
          return clampToNow(next);
        });
      },
    });
  };

  const openDatePicker = () => {
    if (Platform.OS === 'android') {
      showAndroidPicker('date');
    } else {
      setPickerMode('date');
      setPickerVisible(true);
    }
  };

  const openTimePicker = () => {
    if (Platform.OS === 'android') {
      showAndroidPicker('time');
    } else {
      setPickerMode('time');
      setPickerVisible(true);
    }
  };

  const handlePickerChange = (_event, selected) => {
    if (!selected) return;

    setNewDateTime((prev) => {
      const next = new Date(prev);
      if (pickerMode === 'date') {
        next.setFullYear(
          selected.getFullYear(),
          selected.getMonth(),
          selected.getDate()
        );
      } else {
        next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      }
      return clampToNow(next);
    });

    if (Platform.OS === 'ios') {
      setPickerVisible(false);
    }
  };

  const handleAddTask = () => {
    if (!newTitle.trim()) {
      return;
    }
    const nextTask = {
      id: tasks.length ? tasks[tasks.length - 1].id + 1 : 1,
      title: newTitle.trim(),
      assignee: newAssignee.trim(),
      dateLabel: formatDateLabel(newDateTime),
      timeLabel: formatTimeLabel(newDateTime),
      note: newNote.trim(),
      status: 'Chưa bắt đầu',
    };
    setTasks((prev) => [...prev, nextTask]);
    setCreateVisible(false);
    resetForm();
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
              menuId: 1,
              buffetType: 'Buffet Bò',
              fromStaff: true,
            })
          }
        >
          <Image
            source={{ uri: mockPartyDetail.image }}
            style={styles.partyImage}
            resizeMode="cover"
          />
          <View style={styles.partyCardLeft}>
            <Text style={styles.partyName}>{mockPartyDetail.name}</Text>
            <Text style={styles.partyMeta}>
              {mockPartyDetail.dishes} · {mockPartyDetail.guests}
            </Text>
            <Text style={styles.partyMeta}>
              <Text style={styles.partyMetaLabel}>Thời gian: </Text>
              <Text style={styles.partyLink} onPress={handleOpenCalendar}>
                {mockPartyDetail.timeRange}
              </Text>
            </Text>

            <Text style={styles.partyMeta}>Địa chỉ: </Text>
            <Text
              style={[styles.partyAddress, styles.partyLink]}
              numberOfLines={2}
              onPress={handleOpenMaps}
            >
              {mockPartyDetail.address}
            </Text>
            <Text style={styles.partyContact}>
              Khách hàng: {mockPartyDetail.contactName}
            </Text>
            <Text
              style={[styles.partyContact, styles.partyPhone]}
              onPress={handleCallPhone}
            >
              Số điện thoại: {mockPartyDetail.phone}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
        </TouchableOpacity>

        {renderStatusSteps()}

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryValue}>{mockPartyDetail.subtotal}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Thuế VAT (10%)</Text>
            <Text style={styles.summaryValue}>{mockPartyDetail.vat}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Đã cọc</Text>
            <Text style={styles.summaryValue}>{mockPartyDetail.deposit}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.summaryHighlight]}>
              Còn lại
            </Text>
            <Text style={[styles.summaryValue, styles.summaryHighlight]}>
              {mockPartyDetail.remaining}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderTasksTab = () => {
    const showEmptyState = filteredTasks.length === 0;
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

        {showEmptyState ? (
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
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.tasksList}
            showsVerticalScrollIndicator={false}
          >
            {filteredTasks.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {!!task.timeLabel && (
                    <Text style={styles.taskMeta}>
                      {task.dateLabel ? `${task.dateLabel} · ` : ''}
                      {task.timeLabel}
                    </Text>
                  )}
                  {!!task.assignee && (
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
            ))}
          </ScrollView>
        )}
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
                  <TextInput
                    style={styles.textInput}
                    placeholder="Chọn / nhập nhân viên"
                    placeholderTextColor={TEXT_SECONDARY}
                    value={newAssignee}
                    onChangeText={setNewAssignee}
                    returnKeyType="done"
                  />

                  <View style={styles.row}>
                    <View style={[styles.rowItem, { marginRight: 6 }]}>
                      <Text style={styles.fieldLabel}>Ngày</Text>
                      <TouchableOpacity
                        style={[styles.textInput, styles.selectInput]}
                        onPress={openDatePicker}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectText}>
                          {formatDateLabel(newDateTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <View style={[styles.rowItem, { marginLeft: 6 }]}>
                      <Text style={styles.fieldLabel}>Giờ</Text>
                      <TouchableOpacity
                        style={[styles.textInput, styles.selectInput]}
                        onPress={openTimePicker}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.selectText}>
                          {formatTimeLabel(newDateTime)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {Platform.OS === 'ios' && pickerVisible && (
                    <View style={styles.inlinePickerContainer}>
                      <View style={styles.inlinePickerCard}>
                        <DateTimePicker
                          value={newDateTime}
                          mode={pickerMode}
                          minimumDate={new Date()}
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
                    style={[styles.modalButton, styles.modalButtonPrimary]}
                    onPress={handleAddTask}
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
  },
  inlinePicker: {
    height: 190,
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

