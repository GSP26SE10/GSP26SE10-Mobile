import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BACKGROUND_WHITE, BORDER_LIGHT, PRIMARY_COLOR, TEXT_PRIMARY, TEXT_SECONDARY } from '../constants/colors';
import { useSwipeBack } from '../hooks/useSwipeBack';

const mockNotifications = [
  {
    id: 'n1',
    title: 'Công việc mới',
    content: 'Bạn được giao công việc “Chuẩn bị bàn tiệc”.',
    createdAt: '2026-03-16T08:12:00.000Z',
  },
  {
    id: 'n2',
    title: 'Nhắc nhở',
    content: 'Tiệc “Combo Bò Đặc Biệt” sẽ bắt đầu sau 30 phút.',
    createdAt: '2026-03-16T06:30:00.000Z',
  },
  {
    id: 'n3',
    title: 'Cập nhật trạng thái',
    content: 'Một công việc đã được đánh dấu “Hoàn thành”.',
    createdAt: '2026-03-15T15:05:00.000Z',
  },
];

const formatTime = (iso) => {
  try {
    const d = new Date(iso);
    const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const date = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    return `${time} · ${date}`;
  } catch {
    return '';
  }
};

export default function StaffNotificationScreen({ navigation }) {
  const data = useMemo(() => mockNotifications, []);
  const swipeBack = useSwipeBack(() => navigation.goBack());

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={26} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        contentContainerStyle={data.length ? styles.list : styles.listEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="notifications" size={18} color={BACKGROUND_WHITE} />
            </View>
            <View style={styles.body}>
              <View style={styles.rowTop}>
                <Text style={styles.title} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.content} numberOfLines={3}>
                {item.content}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="notifications-off-outline" size={52} color={PRIMARY_COLOR} />
            <Text style={styles.emptyTitle}>Chưa có thông báo</Text>
            <Text style={styles.emptySub}>Thông báo mới sẽ hiển thị tại đây.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_WHITE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  listEmpty: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 24, justifyContent: 'center' },
  separator: { height: 12 },
  card: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFFFFF',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  body: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, marginRight: 10, fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY },
  time: { fontSize: 11, color: TEXT_SECONDARY },
  content: { marginTop: 6, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18 },
  emptyWrap: { alignItems: 'center' },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  emptySub: { marginTop: 4, fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center' },
});

