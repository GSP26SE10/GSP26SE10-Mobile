import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

export default function AccountScreen({ navigation }) {
  const handleLogout = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tài khoản</Text>
        </View>

        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileImageContainer}>
            <Image
              source={{ uri: 'https://scontent.fsgn16-1.fna.fbcdn.net/v/t39.30808-6/548570477_1189728099855961_5240077253445441952_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Lqp7XKTpjhEQ7kNvwGmL7JP&_nc_oc=AdlFm094dgSxWykFEBHlV5urvU6TtYvqvBW6vGbcWA82Mvri8OXfcl2mq02l7coDg9n7jaq7KjGdKQ3oAFYMnzGc&_nc_zt=23&_nc_ht=scontent.fsgn16-1.fna&_nc_gid=QckBobUcEcuU-15xcs2WdA&oh=00_AfuoPMLP6B9c7ArmiRL3hG_mzjPAZa_aRe3Yl5zro9aGxw&oe=698954C8' }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.userName}>Mr Beast</Text>
          <Text style={styles.userEmail}>mrbeast@example.com</Text>
          <Text style={styles.userPhone}>+84 555-012-708</Text>
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('TransactionHistory')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Lịch sử giao dịch</Text>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              // TODO: Navigate to settings
              console.log('Settings');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Cài đặt</Text>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              // TODO: Navigate to settings
              console.log('Settings');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Cài đặt</Text>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              // TODO: Navigate to settings
              console.log('Settings');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Cài đặt</Text>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>

      <BottomNavigation activeTab="Account" onTabPress={(tab) => navigation.navigate(tab)} />
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
    paddingBottom: 100,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8E8E8',
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  userEmail: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 4,
  },
  userPhone: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  menuSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  menuText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  menuDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
  },
  logoutButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 32,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: BACKGROUND_WHITE,
  },
});
