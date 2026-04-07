import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import API_URL from '../constants/api';
import { incrementChatUnreadCount, resetChatUnreadCount } from './chatUnread';

// Hiển thị thông báo cả khi app đang mở (foreground). Không lưu nội dung push vào app — chỉ OS hiển thị một lần.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Tạm thời chỉ dùng push cho chat; backend có thể gửi data.type / data.screen / data.channel */
export function isChatPushNotificationData(data) {
  if (!data || typeof data !== 'object') return true;
  const t = String(data.type ?? data.Type ?? '').toLowerCase();
  const screen = String(data.screen ?? data.Screen ?? '').toLowerCase();
  const channel = String(data.channel ?? data.Channel ?? '').toLowerCase();
  if (t === 'chat' || t === 'message' || screen === 'chat' || channel === 'chat' || channel === 'message') {
    return true;
  }
  if (!t && !screen && !channel) return false;
  return false;
}

/**
 * Tap push → mở đúng màn theo role.
 * - STAFF → StaffNotification
 * - GROUP_LEADER → LeaderNotification
 * - USER → CustomerNotification
 * - USER (khách): chỉ khi payload coi là chat → Chat
 */
async function openScreenFromPushNotificationAsync(getNavigation, data) {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return;
    const user = JSON.parse(raw);
    const role = String(user?.roleName ?? 'USER').trim();
    const nav = typeof getNavigation === 'function' ? getNavigation() : null;
    if (!nav?.navigate) return;

    if (role === 'STAFF') {
      nav.navigate('StaffNotification', { fromPushNotification: true });
      return;
    }
    if (role === 'GROUP_LEADER') {
      nav.navigate('LeaderNotification', { fromPushNotification: true });
      return;
    }
    if (isChatPushNotificationData(data)) {
      await resetChatUnreadCount();
      nav.navigate('Chat', { fromPushNotification: true });
      return;
    }
    nav.navigate('CustomerNotification', { fromPushNotification: true });
  } catch (_) {}
}

/**
 * Foreground chat push -> increase unread counter when user is not on Chat screen.
 * @param {() => string} getCurrentScreen
 */
export function attachChatUnreadNotificationCounter(getCurrentScreen) {
  const onReceived = (notification) => {
    try {
      const data = notification?.request?.content?.data ?? {};
      if (!isChatPushNotificationData(data)) return;
      const currentScreen =
        typeof getCurrentScreen === 'function' ? String(getCurrentScreen() ?? '') : '';
      if (currentScreen === 'Chat') return;
      void incrementChatUnreadCount(1);
    } catch (_) {}
  };

  const sub = Notifications.addNotificationReceivedListener(onReceived);

  return {
    remove: () => {
      try {
        sub.remove();
      } catch (_) {}
    },
  };
}

/**
 * @param {() => { navigate: (name: string, params?: object) => void }} getNavigation
 * @returns {{ remove: () => void, flushInitialResponse: () => Promise<void> }}
 */
export function attachChatNotificationNavigation(getNavigation) {
  const onResponse = (response) => {
    try {
      const data = response?.notification?.request?.content?.data ?? {};
      void openScreenFromPushNotificationAsync(getNavigation, data);
    } catch (_) {}
  };

  const sub = Notifications.addNotificationResponseReceivedListener(onResponse);

  const flushInitialResponse = async () => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!last?.notification) return;
      const data = last.notification.request?.content?.data ?? {};
      await openScreenFromPushNotificationAsync(getNavigation, data);
    } catch (_) {}
  };

  return {
    remove: () => {
      try {
        sub.remove();
      } catch (_) {}
    },
    flushInitialResponse,
  };
}

export const logAccessTokenNow = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    console.log('[notification] accessToken', accessToken);
  } catch (e) {
    console.log('[notification] accessToken read error', e);
  }
};

const DEVICE_ID_KEY = 'deviceId';
const EXPO_PUSH_TOKEN_KEY = 'expoPushToken';

const getOrCreateDeviceId = async () => {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const newId = `device-${Platform.OS}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
};

const registerDeviceOnBackend = async (expoPushToken, options = {}) => {
  try {
    const providedToken = typeof options?.accessToken === 'string' ? options.accessToken : null;
    const providedUser = options?.userData && typeof options.userData === 'object' ? options.userData : null;

    const storedToken = await AsyncStorage.getItem('accessToken');
    const rawUser = await AsyncStorage.getItem('userData');
    const storedUser = rawUser ? JSON.parse(rawUser) : null;

    const accessToken = String(providedToken || storedToken || '').trim();
    const user = providedUser || storedUser;
    const userId = user?.userId ?? null;
    if (!accessToken || !userId || !expoPushToken) {
      console.log('[devices/register] skip — thiếu dữ liệu', {
        hasAccessToken: !!accessToken,
        userId: userId ?? null,
        hasExpoPushToken: !!expoPushToken,
      });
      return;
    }

    const deviceId = await getOrCreateDeviceId();
    const payload = {
      userId: Number(userId),
      expoPushToken: String(expoPushToken),
      deviceId: String(deviceId),
      platform: Platform.OS,
      isActive: true,
    };
    const url = `${API_URL}/api/devices/register`;
    console.log('[devices/register] đang gửi', {
      url,
      body: { ...payload, expoPushToken: `${String(expoPushToken).slice(0, 24)}…` },
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: '*/*',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = { raw: text };
    }
    console.log('[devices/register] phản hồi', {
      status: res.status,
      ok: res.ok,
      body: json,
    });
  } catch (e) {
    console.log('[notification] registerDeviceOnBackend error', e);
  }
};

export const deactivateCurrentDeviceAsync = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!accessToken || !deviceId) {
      console.log('[devices/deactivate] skip — thiếu token hoặc deviceId', {
        hasAccessToken: !!accessToken,
        hasDeviceId: !!deviceId,
      });
      return;
    }

    const url = `${API_URL}/api/devices/deactivate`;
    const body = { deviceId: String(deviceId) };
    console.log('[devices/deactivate] đang gửi', { url, body });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = { raw: text };
    }
    console.log('[devices/deactivate] phản hồi', {
      status: res.status,
      ok: res.ok,
      body: json,
    });
  } catch (e) {
    console.log('[notification] deactivateCurrentDeviceAsync error', e);
  }
};

export const registerForPushNotificationsAsync = async (options = {}) => {
  try {
    const before = await Notifications.getPermissionsAsync();
    console.log('[notification] permission before', before?.status);

    const req = await Notifications.requestPermissionsAsync();
    console.log('[notification] permission request result', req?.status);

    const status = req?.status;
    if (status !== 'granted') {
      console.log('[notification] permission not granted');
      return;
    }

    const projectIdRaw =
      Constants?.expoConfig?.extra?.eas?.projectId ||
      Constants?.easConfig?.projectId ||
      null;
    const projectId =
      projectIdRaw && projectIdRaw !== 'REPLACE_ME_WITH_EAS_PROJECT_ID' ? projectIdRaw : null;

    console.log('[notification] projectId', projectId);
    if (!projectId) {
      console.log(
        '[notification] missing projectId. Set expo.extra.eas.projectId in app.json (EAS Project UUID).'
      );
      return;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes?.data;

    console.log('[notification] expoPushToken', token || null);
    if (token) {
      await AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, token);
      await registerDeviceOnBackend(token, options);
    }
    await logAccessTokenNow();
  } catch (e) {
    console.log('[notification] register error', e);
  }
};