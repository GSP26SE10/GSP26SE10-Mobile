import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  useWindowDimensions,
} from 'react-native';
import { AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-big-calendar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { buildGreeting, getStoredFullName } from '../utils/greeting';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR } from '../constants/colors';
import { normalizeLeaderOrdersOverviewApi } from '../utils/leaderOrdersOverview';

const initialDate = new Date();
const BASE_YEAR = initialDate.getFullYear();
const YEAR_RANGE = 10;

const LEADER_OVERVIEW_CACHE_KEY = 'leaderOverviewCache';

const CALENDAR_SCREEN_HEADER = 168;
const BOTTOM_NAV_FLOATING_CLEARANCE = 204;
const CALENDAR_MIN_HEIGHT = 300;

const toDateSafe = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

function buildEventsFromLeaderOrders(orders) {
  return (orders || [])
    .map((order) => {
      const start = toDateSafe(order?.startTime);
      const end = toDateSafe(order?.endTime) || start;
      if (!start) return null;
      return {
        title: order?.menuName
          ? `${order.menuName} (${order?.numberOfGuests ?? 0} khách)`
          : `Tiệc #${order?.orderDetailId ?? ''}`,
        start,
        end,
        address: order?.address || '—',
      };
    })
    .filter(Boolean);
}

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

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export default function LeaderCalendarScreen({ navigation }) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const calendarHeight = Math.max(
    CALENDAR_MIN_HEIGHT,
    Math.round(
      windowHeight -
        insets.top -
        CALENDAR_SCREEN_HEADER -
        BOTTOM_NAV_FLOATING_CLEARANCE
    )
  );

  const [greetingText, setGreetingText] = useState('Xin chào!');
  const [events, setEvents] = useState([]);
  const cacheDigestRef = useRef('');

  useEffect(() => {
    (async () => {
      const fullName = await getStoredFullName();
      setGreetingText(buildGreeting(fullName));
    })();
  }, []);
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [monthPickerDate, setMonthPickerDate] = useState(initialDate);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);

  const wednesday = getWednesdayOfWeek(currentDate);
  const monthLabel = `Tháng ${wednesday.getMonth() + 1}, ${wednesday.getFullYear()}`;

  const goToPrevWeek = useCallback(() => {
    setCurrentDate((prev) => addWeeks(prev, -1));
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentDate((prev) => addWeeks(prev, 1));
  }, []);

  const handleSelectMonth = (monthIndex, year) => {
    setCurrentDate(new Date(year, monthIndex, 1));
    setMonthPickerVisible(false);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 1.5;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        if (Math.abs(dx) > 50 || Math.abs(vx) > 0.3) {
          if (dx < 0) {
            setCurrentDate((prev) => addWeeks(prev, 1));
          } else {
            setCurrentDate((prev) => addWeeks(prev, -1));
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

  const loadCalendarEventsFromCache = useCallback(async () => {
    try {
      const rawValue = await AsyncStorage.getItem(LEADER_OVERVIEW_CACHE_KEY);
      const raw = rawValue || '';
      const digest = `${raw.length}:${raw.slice(0, 120)}`;
      if (digest === cacheDigestRef.current) return;
      cacheDigestRef.current = digest;
      const parsed = JSON.parse(raw || '{}');
      const payload = normalizeLeaderOrdersOverviewApi(parsed?.data || {});
      const orders = payload.orders || [];
      setEvents(buildEventsFromLeaderOrders(orders));
    } catch (_) {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    loadCalendarEventsFromCache();
  }, [loadCalendarEventsFromCache]);

  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadCalendarEventsFromCache();
      }
    });
    const interval = setInterval(() => {
      loadCalendarEventsFromCache();
    }, 2500);
    return () => {
      appStateSub?.remove?.();
      clearInterval(interval);
    };
  }, [loadCalendarEventsFromCache]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greetingText}</Text>
        <Text style={styles.subtitle}>Lịch làm việc</Text>
        <View style={styles.monthRow}>
          <TouchableOpacity
            onPress={goToPrevWeek}
            style={styles.arrowButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.monthSelector}
            onPress={() => {
              setMonthPickerDate(currentDate);
              setMonthPickerVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={TEXT_PRIMARY} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goToNextWeek}
            style={styles.arrowButton}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.calendarContainer} {...panResponder.panHandlers}>
        <Calendar
          locale="vi"
          date={currentDate}
          events={events}
          height={calendarHeight}
          hourRowHeight={28}
          minHour={0}
          maxHour={23}
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
            <Text style={styles.modalTitle}>Chọn ngày</Text>

            <View style={styles.monthPickerHeader}>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setMonthPickerDate((prev) => addMonths(prev, -1))}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              <Text style={styles.monthPickerLabel}>
                {monthPickerDate.toLocaleString('vi-VN', {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={styles.arrowButton}
                onPress={() => setMonthPickerDate((prev) => addMonths(prev, 1))}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-forward" size={20} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.weekdayRow}>
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((d) => (
                <Text key={d} style={styles.weekdayText}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.daysGrid}>
              {(() => {
                const year = monthPickerDate.getFullYear();
                const month = monthPickerDate.getMonth();
                const first = new Date(year, month, 1);
                const firstDay = first.getDay();
                const startIndex = (firstDay + 6) % 7;
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const totalCells = Math.ceil((startIndex + daysInMonth) / 7) * 7;
                const today = new Date();

                const cells = [];
                for (let i = 0; i < totalCells; i++) {
                  if (i < startIndex || i >= startIndex + daysInMonth) {
                    cells.push(
                      <View key={`empty-${i}`} style={styles.dayCell} />
                    );
                  } else {
                    const day = i - startIndex + 1;
                    const cellDate = new Date(year, month, day);
                    const isToday =
                      cellDate.getDate() === today.getDate() &&
                      cellDate.getMonth() === today.getMonth() &&
                      cellDate.getFullYear() === today.getFullYear();
                    cells.push(
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayCell,
                          isToday && styles.dayCellToday,
                        ]}
                        onPress={() => {
                          setCurrentDate(cellDate);
                          setMonthPickerVisible(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isToday && styles.dayTextToday,
                          ]}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                }
                return cells;
              })()}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setMonthPickerVisible(false)}
            >
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
          <View style={styles.eventModalCard}>
            <View style={styles.eventModalHeader}>
              <Ionicons name="calendar-outline" size={18} color={PRIMARY_COLOR} />
              <Text style={styles.eventModalTitle}>
                {selectedEvent ? selectedEvent.title : 'Tiệc'}
              </Text>
            </View>
            <View style={styles.eventInfoRow}>
              <Ionicons name="time-outline" size={16} color={TEXT_PRIMARY} />
              <Text style={styles.eventInfoText}>
                {selectedEvent ? formatEventTimeRange(selectedEvent) : ''}
              </Text>
            </View>
            <View style={styles.eventInfoRow}>
              <Ionicons name="location-outline" size={16} color={TEXT_PRIMARY} />
              <Text style={styles.eventInfoText} numberOfLines={3}>
                {selectedEvent?.address || '—'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setEventModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BottomNavigationStaff
        activeTab="LeaderCalendar"
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: TEXT_PRIMARY,
  },
  monthItem: {
    paddingVertical: 10,
  },
  monthPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  monthPickerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    borderRadius: 20,
  },
  dayCellToday: {
    backgroundColor: '#F0F4FF',
  },
  dayText: {
    fontSize: 13,
    color: TEXT_PRIMARY,
  },
  dayTextToday: {
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  monthItemText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    textTransform: 'capitalize',
  },
  closeButton: {
    marginTop: 4,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  eventModalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '84%',
  },
  eventModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  eventModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginLeft: 8,
    flex: 1,
  },
  eventInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eventInfoText: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginLeft: 8,
    flex: 1,
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
});
