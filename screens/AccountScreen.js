import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';
import {
  activateCurrentDeviceAsync,
  deactivateCurrentDeviceAsync,
  getNotificationEnabledSettingAsync,
  setNotificationEnabledSettingAsync,
} from '../utils/notification';
import { clearCartOnLogout } from '../utils/cartStorage';
import { clearChatUnreadOnLogout } from '../utils/chatUnread';
import { clearNotificationUnreadOnLogout } from '../utils/notificationUnread';

export default function AccountScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [updatingNotificationSetting, setUpdatingNotificationSetting] = useState(false);

  const avatarUri =
    typeof user?.avatar === 'string' && user.avatar.trim().length > 0
      ? user.avatar.trim()
      : null;

  useEffect(() => {
    let mounted = true;
    const loadUser = async () => {
      try {
        const [stored, enabled] = await Promise.all([
          AsyncStorage.getItem('userData'),
          getNotificationEnabledSettingAsync(),
        ]);
        if (!mounted) return;
        if (stored) {
          setUser(JSON.parse(stored));
        } else {
          setUser(null);
        }
        setNotificationEnabled(Boolean(enabled));
      } catch (error) {
        if (mounted) {
          setUser(null);
          setNotificationEnabled(true);
        }
        console.error('Failed to load user data', error);
      }
    };

    loadUser();
    const unsubscribe =
      typeof navigation?.addListener === 'function'
        ? navigation.addListener('focus', loadUser)
        : null;

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [navigation]);

  const handleLogout = async () => {
    try {
      await deactivateCurrentDeviceAsync();
      await clearCartOnLogout();
      await clearChatUnreadOnLogout();
      await clearNotificationUnreadOnLogout();
      await AsyncStorage.multiRemove(['accessToken', 'userData']);
    } catch (error) {
      console.error('Failed to clear auth data', error);
    }
    navigation.navigate('Home', { fromLogout: true });
  };

  const handleToggleNotification = async (nextValue) => {
    if (updatingNotificationSetting) return;
    setUpdatingNotificationSetting(true);
    setNotificationEnabled(nextValue);
    try {
      const ok = nextValue
        ? await activateCurrentDeviceAsync()
        : (await deactivateCurrentDeviceAsync(), true);
      if (!ok) {
        throw new Error('toggle-notification-failed');
      }
      await setNotificationEnabledSettingAsync(nextValue);
    } catch (_) {
      setNotificationEnabled(!nextValue);
      Alert.alert('Lỗi', 'Không thể cập nhật cài đặt thông báo. Vui lòng thử lại.');
    } finally {
      setUpdatingNotificationSetting(false);
    }
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
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.profileImageFallback}>
                <Ionicons name="person" size={44} color={TEXT_SECONDARY} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{user?.fullName || 'Khách hàng'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'Chưa có email'}</Text>
          <Text style={styles.userPhone}>{user?.phone || ''}</Text>
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <View style={styles.menuItem}>
            <Text style={styles.menuText}>Cài đặt thông báo</Text>
            <Switch
              value={notificationEnabled}
              onValueChange={handleToggleNotification}
              disabled={updatingNotificationSetting}
              trackColor={{ false: '#D1D5DB', true: 'rgba(232, 113, 46, 0.35)' }}
              thumbColor={notificationEnabled ? PRIMARY_COLOR : '#F3F4F6'}
            />
          </View>
          <View style={styles.menuDivider} />

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
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Thông tin cá nhân</Text>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
          <View style={styles.menuDivider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('ChangePassword')}
            activeOpacity={0.7}
          >
            <Text style={styles.menuText}>Đổi mật khẩu</Text>
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
  profileImageFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E8E8E8',
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
