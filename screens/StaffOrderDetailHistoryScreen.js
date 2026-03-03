import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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

const mockPartyDetailHistory = {
  id: 1,
  name: 'Buffet Lẩu Bò Mỹ',
  dishes: '10 MÓN',
  guests: '10 NGƯỜI',
  timeRange: '9:30 – 10/01/2025',
  address: '16 Nguyễn Trãi, Quận 1, Thành phố Hồ Chí Minh',
  contactName: 'Nguyễn Văn A',
  phone: '0123456789',
  status: 'Kết thúc tiệc',
  subtotal: '2.489.000₫',
  vat: '248.900₫',
  deposit: '1.368.950₫',
  remaining: '0₫',
  reviewerName: 'Nguyễn Văn B',
  rating: 5,
  reviewText:
    'Thịt bò tươi, mềm, để nhúng lẩu, ba chỉ và gầu bò được yêu thích nhất. Rau và nấm tươi, menu đa dạng, dễ ăn, phù hợp đi nhóm và gia đình.',
};

const mockTasksHistory = [
  { id: 1, title: 'Chuẩn bị nguyên liệu A – 08:00', done: true },
  { id: 2, title: 'Chuẩn bị nguyên liệu B – 08:15', done: true },
  { id: 3, title: 'Chuẩn bị nguyên liệu C – 08:30', done: true },
];

export default function StaffOrderDetailHistoryScreen({ navigation, route }) {
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const renderStatusSteps = () => {
    const steps = ['Đang chuẩn bị', 'Đang diễn ra', 'Kết thúc tiệc'];
    const currentIndex = steps.indexOf(mockPartyDetailHistory.status);
    return (
      <View style={styles.statusSteps}>
        {steps.map((step, index) => {
          const isActive = currentIndex >= 0 ? index <= currentIndex : step === mockPartyDetailHistory.status;
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
        <View style={styles.partyCardStatic}>
          <Text style={styles.partyName}>{mockPartyDetailHistory.name}</Text>
          <Text style={styles.partyMeta}>
            {mockPartyDetailHistory.dishes} · {mockPartyDetailHistory.guests} · {mockPartyDetailHistory.timeRange}
          </Text>
          <Text style={styles.partyAddress} numberOfLines={2}>
            {mockPartyDetailHistory.address}
          </Text>
          <Text style={styles.partyContact}>
            Khách hàng: {mockPartyDetailHistory.contactName} – {mockPartyDetailHistory.phone}
          </Text>
        </View>

        {renderStatusSteps()}

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tạm tính</Text>
            <Text style={styles.summaryValue}>{mockPartyDetailHistory.subtotal}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Thuế VAT (10%)</Text>
            <Text style={styles.summaryValue}>{mockPartyDetailHistory.vat}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Đã cọc</Text>
            <Text style={styles.summaryValue}>{mockPartyDetailHistory.deposit}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, styles.summaryHighlight]}>
              Còn lại
            </Text>
            <Text style={[styles.summaryValue, styles.summaryHighlight]}>
              {mockPartyDetailHistory.remaining}
            </Text>
          </View>
        </View>

        {/* Đánh giá từ khách hàng */}
        <View style={styles.reviewSection}>
          <Text style={styles.reviewTitle}>Đánh giá từ khách hàng</Text>
          <View style={styles.reviewHeader}>
            <Text style={styles.reviewerName}>{mockPartyDetailHistory.reviewerName}</Text>
            <View style={styles.reviewRatingRow}>
              <Text style={styles.reviewScore}>{mockPartyDetailHistory.rating}</Text>
              <Ionicons name="star" size={16} color="#FFD700" />
            </View>
          </View>
          <Text style={styles.reviewText}>{mockPartyDetailHistory.reviewText}</Text>
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
        {mockTasksHistory.map((task) => (
          <View key={task.id} style={styles.taskRow}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={[styles.taskStatusBadge, styles.taskStatusBadgeDone]}>
              <Text style={[styles.taskStatusText, styles.taskStatusTextDone]}>
                Đã xong
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  };

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
  partyCardStatic: {
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 12,
    marginBottom: 24,
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
});

