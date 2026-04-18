import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import API_URL from '../constants/api';
import { getAccessToken } from './auth';
import { incrementChatUnreadCount, resetChatUnreadCount } from './chatUnread';
import { incrementNotificationUnreadCount } from './notificationUnread';

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
  const type = Number(data?.type ?? data?.Type ?? data?.notificationType ?? data?.NotificationType ?? NaN);
  if (type === 3) return true;
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
 * Tap push:
 * - type = 3 (Message) -> Chat
 * - các type còn lại -> CustomerNotification
 */
async function openScreenFromPushNotificationAsync(getNavigation, data) {
  try {
    const token = await getAccessToken();
    if (!token) return;
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return;
    const nav = typeof getNavigation === 'function' ? getNavigation() : null;
    if (!nav?.navigate) return;

    if (isChatPushNotificationData(data)) {
      await resetChatUnreadCount();
      nav.navigate('Chat', { fromPushNotification: true });
      return;
    }
    nav.navigate('CustomerNotification', { fromPushNotification: true });
  } catch (_) {}
}

/**
 * Foreground push -> tăng counter realtime cho chat/bell.
 * @param {() => string} getCurrentScreen
 */
export function attachChatUnreadNotificationCounter(getCurrentScreen) {
  const onReceived = (notification) => {
    try {
      const data = notification?.request?.content?.data ?? {};
      const isChat = isChatPushNotificationData(data);
      const currentScreen =
        typeof getCurrentScreen === 'function' ? String(getCurrentScreen() ?? '') : '';
      if (isChat) {
        if (currentScreen === 'Chat') return;
        void incrementChatUnreadCount(1);
        return;
      }
      void incrementNotificationUnreadCount(1);
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
    const accessToken = await getAccessToken();
    console.log('[notification] accessToken', accessToken);
  } catch (e) {
    console.log('[notification] accessToken read error', e);
  }
};

const DEVICE_ID_KEY = 'deviceId';
const EXPO_PUSH_TOKEN_KEY = 'expoPushToken';
const FCM_PUSH_TOKEN_KEY = 'fcmPushToken';
const NOTIFICATION_ENABLED_KEY = 'notificationEnabled';

export const getNotificationEnabledSettingAsync = async () => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
    if (raw == null) return true;
    return raw === 'true';
  } catch (_) {
    return true;
  }
};

export const setNotificationEnabledSettingAsync = async (enabled) => {
  try {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, enabled ? 'true' : 'false');
  } catch (_) {}
};

const getOrCreateDeviceId = async () => {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const newId = `device-${Platform.OS}-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
  return newId;
};

const registerDeviceOnBackend = async (tokens = {}, options = {}) => {
  try {
    const expoPushToken =
      typeof tokens?.expoPushToken === 'string' ? String(tokens.expoPushToken).trim() : '';
    const fcmToken = typeof tokens?.fcmToken === 'string' ? String(tokens.fcmToken).trim() : '';
    const normalizedToken = expoPushToken || fcmToken;
    const hasPushToken = Boolean(normalizedToken);

    const providedToken = typeof options?.accessToken === 'string' ? options.accessToken : null;
    const providedUser = options?.userData && typeof options.userData === 'object' ? options.userData : null;

    const storedToken = await getAccessToken();
    const rawUser = await AsyncStorage.getItem('userData');
    const storedUser = rawUser ? JSON.parse(rawUser) : null;

    const accessToken = String(providedToken || storedToken || '').trim();
    const user = providedUser || storedUser;
    const userId = user?.userId ?? null;
    if (!accessToken || !userId || !hasPushToken) {
      console.log('[devices/register] skip — thiếu dữ liệu', {
        hasAccessToken: !!accessToken,
        userId: userId ?? null,
        hasPushToken: !!normalizedToken,
      });
      return false;
    }

    const deviceId = await getOrCreateDeviceId();
    const payload = {
      userId: Number(userId),
      expoPushToken: String(normalizedToken),
      deviceId: String(deviceId),
      platform: Platform.OS,
      isActive: true,
    };
    const url = `${API_URL}/api/devices/register`;
    console.log('[devices/register] đang gửi', {
      url,
      body: {
        ...payload,
        expoPushToken: `${String(normalizedToken).slice(0, 24)}…`,
      },
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
    return res.ok;
  } catch (e) {
    console.log('[notification] registerDeviceOnBackend error', e);
    return false;
  }
};

export const deactivateCurrentDeviceAsync = async () => {
  try {
    const accessToken = await getAccessToken();
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

    if (Platform.OS === 'android') {
      const tokenRes = await Notifications.getDevicePushTokenAsync();
      const token =
        typeof tokenRes?.data === 'string'
          ? tokenRes.data
          : tokenRes?.data != null
            ? String(tokenRes.data)
            : null;

      console.log('[notification] android fcmToken', token || null);
      if (token) {
        await AsyncStorage.setItem(FCM_PUSH_TOKEN_KEY, token);
        await registerDeviceOnBackend({ fcmToken: token }, options);
      }
      await logAccessTokenNow();
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
      await registerDeviceOnBackend({ expoPushToken: token }, options);
    }
    await logAccessTokenNow();
  } catch (e) {
    console.log('[notification] register error', e);
  }
};

export const activateCurrentDeviceAsync = async (options = {}) => {
  try {
    const providedToken = typeof options?.accessToken === 'string' ? options.accessToken : null;
    const providedUser = options?.userData && typeof options.userData === 'object' ? options.userData : null;

    const storedToken = await getAccessToken();
    const rawUser = await AsyncStorage.getItem('userData');
    const storedUser = rawUser ? JSON.parse(rawUser) : null;

    const accessToken = String(providedToken || storedToken || '').trim();
    const user = providedUser || storedUser;
    const userId = user?.userId ?? null;
    if (!accessToken || !userId) {
      console.log('[devices/activate] skip — thiếu accessToken hoặc userId', {
        hasAccessToken: !!accessToken,
        userId: userId ?? null,
      });
      return false;
    }

    if (Platform.OS === 'android') {
      let fcmToken = await AsyncStorage.getItem(FCM_PUSH_TOKEN_KEY);
      if (!fcmToken) {
        await registerForPushNotificationsAsync({ accessToken, userData: user });
        fcmToken = await AsyncStorage.getItem(FCM_PUSH_TOKEN_KEY);
      }
      if (!fcmToken) {
        console.log('[devices/activate] skip — thiếu fcmToken');
        return false;
      }
      return await registerDeviceOnBackend({ fcmToken }, { accessToken, userData: user });
    }

    let expoPushToken = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
    if (!expoPushToken) {
      await registerForPushNotificationsAsync({ accessToken, userData: user });
      expoPushToken = await AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY);
    }
    if (!expoPushToken) {
      console.log('[devices/activate] skip — thiếu expoPushToken');
      return false;
    }
    return await registerDeviceOnBackend({ expoPushToken }, { accessToken, userData: user });
  } catch (e) {
    console.log('[notification] activateCurrentDeviceAsync error', e);
    return false;
  }
};