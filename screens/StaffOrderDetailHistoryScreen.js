import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
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

const TASK_STATUS_MAP = { 1: 'Chưa bắt đầu', 2: 'Đang thực hiện', 3: 'Hoàn thành', 5: 'Trễ deadline' };

const getTaskStatusNumber = (task) => Number(task?.taskStatus ?? task?.status ?? 1);

const resolveImageUri = (img) => {
  if (!img || typeof img !== 'string') return null;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${API_URL}${img}`;
};

function buildPartyDetailFromOrderDetail(od) {
  if (!od) return null;
  return {
    id: od.orderDetailId,
    image: resolveImageUri(od.menuImage),
    name: od.menuName || '—',
    dishes: od.partyCategory || '—',
    guests: `${od.numberOfGuests ?? 0} người`,
    timeRange: formatTimeRange(od.startTime, od.endTime),
    address: od.address || '—',
    contactName: '—',
    phone: '—',
    status: 'Kết thúc tiệc',
  };
}

function mapTaskToDisplay(t) {
  const statusNum = getTaskStatusNumber(t);
  return {
    ...t,
    id: t.taskId,
    title: t.taskName || '—',
    taskStatus: statusNum,
    statusLabel: TASK_STATUS_MAP[statusNum] || 'Chưa bắt đầu',
    done: statusNum === 3,
  };
}

export default function StaffOrderDetailHistoryScreen({ navigation, route }) {
  const orderDetail = route?.params?.orderDetail;
  const paramsTasks = route?.params?.tasks ?? [];
  const fromParams = orderDetail && Array.isArray(paramsTasks);

  const partyDetail = useMemo(
    () => buildPartyDetailFromOrderDetail(orderDetail) || {
      id: 0,
      name: '—',
      dishes: '—',
      guests: '—',
      timeRange: '—',
      address: '—',
      contactName: '—',
      phone: '—',
      status: 'Kết thúc tiệc',
    },
    [orderDetail]
  );

  const tasks = useMemo(
    () => (fromParams ? paramsTasks.map(mapTaskToDisplay) : []),
    [fromParams, paramsTasks]
  );

  const swipeBack = useSwipeBack(() => navigation.goBack());

  const renderStatusSteps = () => {
    const steps = ['Đang chuẩn bị', 'Đang diễn ra', 'Kết thúc tiệc'];
    const mapped = getOrderStatusProgressStepIndex(
      orderDetail?.status ?? orderDetail?.orderStatus
    );
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
              {index < steps.length - 1 && (
                <View style={styles.statusLine} />
              )}
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
            menuId: orderDetail?.menuId ?? 1,
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
          <View style={[styles.partyImage, styles.partyImagePlaceholder]}>
            <Ionicons name="image-outline" size={40} color={TEXT_SECONDARY} />
          </View>
        )}
        <View style={styles.partyInfo}>
          <Text style={styles.partyName}>{partyDetail.name}</Text>
          <Text style={styles.partyMeta}>
            {partyDetail.dishes} · {partyDetail.guests} · {partyDetail.timeRange}
          </Text>
          <Text style={styles.partyAddress} numberOfLines={2}>
            {partyDetail.address}
          </Text>
          <Text style={styles.partyContact}>
            Khách hàng: {partyDetail.contactName}
            {partyDetail.phone ? ` – ${partyDetail.phone}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
      </TouchableOpacity>

      {renderStatusSteps()}
    </ScrollView>
  );

  const renderTasksTab = () => (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {tasks.length === 0 ? (
        <View style={styles.emptyTasks}>
          <Text style={styles.emptyTasksText}>Không có công việc</Text>
        </View>
      ) : (
        tasks.map((task) => {
          const statusNum = getTaskStatusNumber(task);
          const isDone = statusNum === 3;
          const isInProgress = statusNum === 2;
          const isOverdue = statusNum === 5;
          return (
            <View key={task.id} style={styles.taskRow}>
              <Text style={styles.taskTitle}>{task.title}</Text>
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
                  {task.statusLabel}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  const [activeTab, setActiveTab] = React.useState('overview');

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
        activeTab="StaffOrderHistory"
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
  partyInfo: {
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
  partyAddress: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  partyContact: {
    fontSize: 12,
    color: TEXT_SECONDARY,
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
  reviewSection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFF8EE',
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewScore: {
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginRight: 4,
  },
  reviewText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  emptyTasks: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyTasksText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
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

