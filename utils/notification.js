import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import API_URL from '../constants/api';

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
  if (!t && !screen && !channel) return true;
  return false;
}

/**
 * Chỉ khách hàng (USER) xử lý tap → Chat. STAFF / GROUP_LEADER không có chat trên app.
 */
export async function isCustomerUserForChatPushAsync() {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return false;
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return false;
    const user = JSON.parse(raw);
    const role = String(user?.roleName ?? 'USER').trim();
    if (role === 'STAFF' || role === 'GROUP_LEADER') return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Tap notification → mở Chat (chỉ USER đã đăng nhập; không inject nội dung — ChatScreen tải từ API).
 * @param {() => { navigate: (name: string, params?: object) => void }} getNavigation
 * @returns {{ remove: () => void, flushInitialResponse: () => Promise<void> }}
 */
export function attachChatNotificationNavigation(getNavigation) {
  const openChatFromNotification = async () => {
    try {
      if (!(await isCustomerUserForChatPushAsync())) return;
      const nav = typeof getNavigation === 'function' ? getNavigation() : null;
      if (nav?.navigate) {
        nav.navigate('Chat', { fromPushNotification: true });
      }
    } catch (_) {}
  };

  const onResponse = (response) => {
    try {
      const data = response?.notification?.request?.content?.data ?? {};
      if (!isChatPushNotificationData(data)) return;
      void openChatFromNotification();
    } catch (_) {}
  };

  const sub = Notifications.addNotificationResponseReceivedListener(onResponse);

  const flushInitialResponse = async () => {
    try {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (!last?.notification) return;
      const data = last.notification.request?.content?.data ?? {};
      if (!isChatPushNotificationData(data)) return;
      await openChatFromNotification();
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

const registerDeviceOnBackend = async (expoPushToken) => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    const rawUser = await AsyncStorage.getItem('userData');
    const user = rawUser ? JSON.parse(rawUser) : null;
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

export const registerForPushNotificationsAsync = async () => {
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
      await registerDeviceOnBackend(token);
    }
    await logAccessTokenNow();
  } catch (e) {
    console.log('[notification] register error', e);
  }
};