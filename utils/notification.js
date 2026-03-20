import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import API_URL from '../constants/api';

// Hiển thị thông báo cả khi app đang mở (foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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