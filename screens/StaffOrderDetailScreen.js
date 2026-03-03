import React, { useState, useRef, useEffect } from 'react';
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
  BUTTON_TEXT_WHITE,
} from '../constants/colors';

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
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'tasks'
  const [tasks, setTasks] = useState(mockTasks);
  const [confirmTask, setConfirmTask] = useState(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const handleConfirmTask = (taskId) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, done: true } : t
      )
    );
  };

  const handleOpenCalendar = async () => {
    const title = encodeURIComponent(`Tiệc ${mockPartyDetail.name}`);
    const details = encodeURIComponent(
      `${mockPartyDetail.dishes}, ${mockPartyDetail.guests}, ${mockPartyDetail.address}`
    );
    // Parse thời gian & ngày từ chuỗi timeRange (vd: "9:30 – 10/01/2026")
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
      const end = new Date(year, month, day, hour + 2, minute); // giả định tiệc kéo dài 2h

      const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
      const format = (d) =>
        `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(
          d.getHours()
        )}${pad(d.getMinutes())}00`;

      datesParam = `&dates=${format(start)}/${format(end)}`;
    } catch (e) {
      console.warn('Cannot parse timeRange for calendar, fallback to current date.', e);
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
    const query = encodeURIComponent(mockPartyDetail.address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.error('Open maps error:', e);
      Alert.alert('Lỗi', 'Không thể mở Google Maps.');
    }
  };

  const handleCallPhone = () => {
    Alert.alert(
      'Gọi điện',
      `Bạn có muốn gọi ${mockPartyDetail.phone} không?`,
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
          const isActive = step === mockPartyDetail.status;
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
              menuId: 1,
              buffetType: 'Buffet Bò',
              fromStaff: true,
            })
          }
        >
          <Image
            source={{
              uri: mockPartyDetail.image,
            }}
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
    return (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {tasks.map((task) => (
          <TouchableOpacity
            key={task.id}
            style={styles.taskRow}
            activeOpacity={0.8}
            onPress={() => {
              if (!task.done) {
                setConfirmTask(task);
                setConfirmVisible(true);
              }
            }}
          >
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View
              style={[
                styles.taskStatusBadge,
                task.done && styles.taskStatusBadgeDone,
              ]}
            >
              <Text
                style={[
                  styles.taskStatusText,
                  task.done && styles.taskStatusTextDone,
                ]}
              >
                {task.done ? 'Đã xong' : 'Chưa xong'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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

      {/* Modal xác nhận hoàn thành công việc */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setConfirmVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Xác nhận hoàn thành công việc</Text>
            <Text style={styles.modalTaskTitle}>
              {confirmTask?.title || ''}
            </Text>
            <SlideToConfirm
              disabled={!confirmTask}
              onComplete={() => {
                if (confirmTask) {
                  handleConfirmTask(confirmTask.id);
                  setConfirmVisible(false);
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
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
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

