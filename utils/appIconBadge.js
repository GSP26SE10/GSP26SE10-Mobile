import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

const CHAT_UNREAD_KEY_PREFIX = 'chatUnreadCount';
const LEGACY_CHAT_UNREAD_KEY = 'chatUnreadCount';
const NOTIFICATION_UNREAD_KEY_PREFIX = 'notificationUnreadCount';
const LEGACY_NOTIFICATION_UNREAD_KEY = 'notificationUnreadCount';
const PARTIES_KEY_PREFIX = 'orderParties';

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

async function readChatUnreadCount(userId) {
  try {
    const key = userId ? `${CHAT_UNREAD_KEY_PREFIX}:${userId}` : LEGACY_CHAT_UNREAD_KEY;
    const raw = await AsyncStorage.getItem(key);
    if (raw != null) return normalizeCount(raw);
    if (key !== LEGACY_CHAT_UNREAD_KEY) {
      const legacy = await AsyncStorage.getItem(LEGACY_CHAT_UNREAD_KEY);
      return normalizeCount(legacy);
    }
  } catch {
    // ignore
  }
  return 0;
}

async function readNotificationUnreadCount(userId) {
  try {
    const key = userId ? `${NOTIFICATION_UNREAD_KEY_PREFIX}:${userId}` : LEGACY_NOTIFICATION_UNREAD_KEY;
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

function countCartItems(parties) {
  if (!Array.isArray(parties)) return 0;
  return parties.reduce((total, party) => {
    const items = Array.isArray(party?.items) ? party.items : [];
    return (
      total +
      items.reduce((sum, item) => sum + Math.max(0, Number(item?.count) || 0), 0)
    );
  }, 0);
}

async function readCartItemCount(userId) {
  try {
    const key = userId ? `${PARTIES_KEY_PREFIX}:${userId}` : PARTIES_KEY_PREFIX;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return countCartItems(parsed);
  } catch {
    return 0;
  }
}

export async function syncAppIconBadgeCount() {
  try {
    const userId = await getCurrentUserId();
    const [cartCount, notificationCount, chatCount] = await Promise.all([
      readCartItemCount(userId),
      readNotificationUnreadCount(userId),
      readChatUnreadCount(userId),
    ]);
    const total = normalizeCount(cartCount) + normalizeCount(notificationCount) + normalizeCount(chatCount);
    await Notifications.setBadgeCountAsync(total);
    return total;
  } catch {
    return 0;
  }
}

export async function clearAppIconBadgeCount() {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Android launcher may ignore badge.
  }
}
