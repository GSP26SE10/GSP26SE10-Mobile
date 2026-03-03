import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { TEXT_PRIMARY, BACKGROUND_WHITE, TEXT_SECONDARY, PRIMARY_COLOR } from '../constants/colors';

const mockParties = [
  {
    id: 1,
    name: 'Buffet Lẩu Bò Mỹ',
    dishes: '10 MÓN',
    guests: '10 NGƯỜI',
    timeRange: '9:30 – 10/01/2026',
    address: '16 Nguyễn Trãi, Quận 1, Thành phố Hồ Chí Minh',
    status: 'Đang chuẩn bị',
  },
  {
    id: 2,
    name: 'Buffet Lẩu Bò Mỹ',
    dishes: '10 MÓN',
    guests: '10 NGƯỜI',
    timeRange: '15:00 – 10/01/2026',
    address: '16 Nguyễn Trãi, Quận 1, Thành phố Hồ Chí Minh',
    status: 'Đang diễn ra',
  },
];

export default function LeaderHomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Xin chào, Team Leader!</Text>
          <Text style={styles.subtitle}>Danh sách các buổi tiệc bạn đang quản lý.</Text>
        </View>

        {mockParties.map((party) => (
          <TouchableOpacity
            key={party.id}
            style={styles.partyCard}
            activeOpacity={0.8}
            onPress={() =>
              navigation.navigate('LeaderOrderDetail', {
                partyId: party.id,
                status: party.status,
              })
            }
          >
            <Image
              source={{
                uri: 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg',
              }}
              style={styles.partyImage}
              resizeMode="cover"
            />
            <View style={styles.partyInfo}>
              <Text style={styles.partyName}>{party.name}</Text>
              <Text style={styles.partyMeta}>
                {party.dishes} · {party.guests} · {party.timeRange}
              </Text>
              <Text style={styles.partyAddress} numberOfLines={1}>
                {party.address}
              </Text>
              <Text style={styles.partyStatus}>{party.status}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <BottomNavigationStaff activeTab="LeaderHome" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 100,
  },
  header: {
    marginBottom: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  partyCard: {
    flexDirection: 'row',
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 10,
    marginTop: 12,
  },
  partyImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  partyInfo: {
    flex: 1,
    marginLeft: 10,
    justifyContent: 'center',
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
  partyStatus: {
    fontSize: 12,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
});
