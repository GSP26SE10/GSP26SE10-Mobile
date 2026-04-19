import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncAppIconBadgeCount } from './appIconBadge';

const CHAT_UNREAD_KEY_PREFIX = 'chatUnreadCount';
const LEGACY_CHAT_UNREAD_KEY = 'chatUnreadCount';

const chatUnreadListeners = new Set();

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
  return userId ? `${CHAT_UNREAD_KEY_PREFIX}:${userId}` : LEGACY_CHAT_UNREAD_KEY;
}

function notifyUnreadChange(count) {
  chatUnreadListeners.forEach((listener) => {
    try {
      listener(count);
    } catch {
      // ignore listener errors
    }
  });
}

async function readStoredUnreadCount() {
  try {
    const key = await getUnreadKey();
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

export function subscribeChatUnreadChange(listener) {
  if (typeof listener !== 'function') return () => {};
  chatUnreadListeners.add(listener);
  return () => chatUnreadListeners.delete(listener);
}

export async function refreshChatUnreadCount() {
  const count = await readStoredUnreadCount();
  await syncAppIconBadgeCount();
  notifyUnreadChange(count);
  return count;
}

export async function getChatUnreadCount() {
  return readStoredUnreadCount();
}

export async function setChatUnreadCount(nextCount) {
  const normalized = normalizeCount(nextCount);
  const key = await getUnreadKey();

  try {
    await AsyncStorage.setItem(key, String(normalized));
    if (key !== LEGACY_CHAT_UNREAD_KEY) {
      await AsyncStorage.removeItem(LEGACY_CHAT_UNREAD_KEY);
    }
  } catch {
    // ignore storage failures
  }

  await syncAppIconBadgeCount();
  notifyUnreadChange(normalized);
  return normalized;
}

export async function incrementChatUnreadCount(step = 1) {
  const current = await readStoredUnreadCount();
  const increase = normalizeCount(step);
  return setChatUnreadCount(current + increase);
}

export async function resetChatUnreadCount() {
  return setChatUnreadCount(0);
}

export async function clearChatUnreadOnLogout() {
  try {
    const userId = await getCurrentUserId();
    const keys = [LEGACY_CHAT_UNREAD_KEY];
    if (userId != null) {
      keys.push(`${CHAT_UNREAD_KEY_PREFIX}:${userId}`);
    }
    await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }

  await syncAppIconBadgeCount();
  notifyUnreadChange(0);
}
