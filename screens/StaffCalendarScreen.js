import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ScrollView, PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-big-calendar';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { TEXT_PRIMARY, BACKGROUND_WHITE } from '../constants/colors';

const initialDate = new Date();

const events = [
  {
    title: 'Chuẩn bị nguyên liệu',
    start: new Date(2026, 0, 20, 9, 0),
    end: new Date(2026, 0, 20, 9, 30),
  },
  {
    title: 'Tiệc A',
    start: new Date(2026, 0, 20, 10, 15),
    end: new Date(2026, 0, 20, 13, 0),
  },
  {
    title: 'Tiệc B',
    start: new Date(2026, 0, 20, 14, 0),
    end: new Date(2026, 0, 20, 16, 30),
  },
];

function getWednesdayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday + 2);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

export default function StaffCalendarScreen({ navigation }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);

  const wednesday = getWednesdayOfWeek(currentDate);
  const monthLabel = `Tháng ${wednesday.getMonth() + 1}, ${wednesday.getFullYear()}`;

  const goToPrevWeek = useCallback(() => {
    setCurrentDate(prev => addWeeks(prev, -1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentDate(prev => addWeeks(prev, 1));
  }, []);

  const handleSelectMonth = (monthIndex, year) => {
    setCurrentDate(new Date(year, monthIndex, 1));
    setMonthPickerVisible(false);
  };

  // PanResponder để detect swipe ngang trên calendar
  const panResponder = useRef(
    PanResponder.create({
      // Chỉ capture gesture ngang rõ ràng
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        // Swipe trái (dx < 0) → tuần sau, swipe phải (dx > 0) → tuần trước
        if (Math.abs(dx) > 50 || Math.abs(vx) > 0.3) {
          if (dx < 0) {
            setCurrentDate(prev => addWeeks(prev, 1));
          } else {
            setCurrentDate(prev => addWeeks(prev, -1));
          }
        }
      },
    })
  ).current;

  const formatEventTimeRange = (event) => {
    if (!event) return '';
    const options = { hour: '2-digit', minute: '2-digit' };
    const startStr = event.start.toLocaleTimeString('vi-VN', options);
    const endStr = event.end.toLocaleTimeString('vi-VN', options);
    return `${startStr} - ${endStr}`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Xin chào, Nguyễn Văn A!</Text>
        <Text style={styles.subtitle}>Lịch làm việc</Text>
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={goToPrevWeek} style={styles.arrowButton} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthSelector}
            onPress={() => setMonthPickerVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={TEXT_PRIMARY} />
          </TouchableOpacity>

          <TouchableOpacity onPress={goToNextWeek} style={styles.arrowButton} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Wrap calendar với PanResponder để catch swipe và sync label tháng */}
      <View style={styles.calendarContainer} {...panResponder.panHandlers}>
        <Calendar
          locale="vi"
          date={currentDate}
          events={events}
          height={600}
          mode="week"
          weekStartsOn={1}
          swipeEnabled={true}
          onPressEvent={(event) => {
            setSelectedEvent(event);
            setEventModalVisible(true);
          }}
        />
      </View>

      <Modal
        visible={monthPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMonthPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Chọn tháng</Text>
            <ScrollView>
              {Array.from({ length: 12 }).map((_, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.monthItem}
                  onPress={() => handleSelectMonth(index, wednesday.getFullYear())}
                >
                  <Text style={styles.monthItemText}>
                    {new Date(wednesday.getFullYear(), index, 1).toLocaleString('vi-VN', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeButton} onPress={() => setMonthPickerVisible(false)}>
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={eventModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEventModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.eventModalContent}>
            <Text style={styles.modalTitle}>{selectedEvent?.title ?? ''}</Text>
            <Text style={styles.eventTimeText}>{formatEventTimeRange(selectedEvent)}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setEventModalVisible(false)}>
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <BottomNavigationStaff
        activeTab="StaffCalendar"
        onTabPress={(tab) => navigation.navigate(tab)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_WHITE },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  greeting: { fontSize: 18, fontWeight: 'bold', color: TEXT_PRIMARY },
  subtitle: { fontSize: 14, color: TEXT_PRIMARY, marginTop: 2 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  arrowButton: { padding: 6 },
  monthSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  monthLabel: { fontSize: 16, fontWeight: '600', color: TEXT_PRIMARY },
  calendarContainer: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '80%',
    maxHeight: '60%',
  },
  eventModalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 12,
    textAlign: 'center',
  },
  eventTimeText: { fontSize: 14, color: TEXT_PRIMARY, marginBottom: 16 },
  monthItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  monthItemText: { fontSize: 15, color: TEXT_PRIMARY, textAlign: 'center' },
  closeButton: {
    marginTop: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: { fontSize: 15, color: TEXT_PRIMARY, fontWeight: '500' },
});