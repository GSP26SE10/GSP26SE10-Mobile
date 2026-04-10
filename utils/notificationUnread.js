import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from './auth';
import { fetchUnreadNotificationsCount } from './notificationsApi';

const NOTIFICATION_UNREAD_KEY_PREFIX = 'notificationUnreadCount';
const LEGACY_NOTIFICATION_UNREAD_KEY = 'notificationUnreadCount';

const notificationUnreadListeners = new Set();

function normalizeCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.floor(n);
}

async function getCurrentUserId() {
  try {
    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.userId ?? null;
  } catch {
    return null;
  }
}

async function getUnreadKey() {
  const userId = await getCurrentUserId();
  return userId ? `${NOTIFICATION_UNREAD_KEY_PREFIX}:${userId}` : LEGACY_NOTIFICATION_UNREAD_KEY;
}

async function readStoredUnreadCount() {
  try {
    const key = await getUnreadKey();
    const raw = await AsyncStorage.getItem(key);
    if (raw != null) return normalizeCount(raw);

    if (key !== LEGACY_NOTIFICATION_UNREAD_KEY) {
      const legacy = await AsyncStorage.getItem(LEGACY_NOTIFICATION_UNREAD_KEY);
      return normalizeCount(legacy);
    }
  } catch {
    // ignore
  }
  return 0;
}

function notifyUnreadChange(count) {
  notificationUnreadListeners.forEach((listener) => {
    try {
      listener(count);
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeNotificationUnreadChange(listener) {
  if (typeof listener !== 'function') return () => {};
  notificationUnreadListeners.add(listener);
  return () => notificationUnreadListeners.delete(listener);
}

export async function getNotificationUnreadCount() {
  return readStoredUnreadCount();
}

export async function setNotificationUnreadCount(nextCount) {
  const normalized = normalizeCount(nextCount);
  const key = await getUnreadKey();

  try {
    await AsyncStorage.setItem(key, String(normalized));
    if (key !== LEGACY_NOTIFICATION_UNREAD_KEY) {
      await AsyncStorage.removeItem(LEGACY_NOTIFICATION_UNREAD_KEY);
    }
  } catch {
    // ignore storage failures
  }

  notifyUnreadChange(normalized);
  return normalized;
}

export async function incrementNotificationUnreadCount(step = 1) {
  const current = await readStoredUnreadCount();
  const increase = normalizeCount(step);
  return setNotificationUnreadCount(current + increase);
}

export async function decrementNotificationUnreadCount(step = 1) {
  const current = await readStoredUnreadCount();
  const decrease = normalizeCount(step);
  return setNotificationUnreadCount(Math.max(0, current - decrease));
}

export async function refreshNotificationUnreadCount(token) {
  const authToken = token || (await getAccessToken());
  if (!authToken) {
    return setNotificationUnreadCount(0);
  }
  const count = await fetchUnreadNotificationsCount(authToken);
  return setNotificationUnreadCount(count);
}

export async function clearNotificationUnreadOnLogout() {
  try {
    const userId = await getCurrentUserId();
    const keys = [LEGACY_NOTIFICATION_UNREAD_KEY];
    if (userId != null) {
      keys.push(`${NOTIFICATION_UNREAD_KEY_PREFIX}:${userId}`);
    }
    await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }

  notifyUnreadChange(0);
}