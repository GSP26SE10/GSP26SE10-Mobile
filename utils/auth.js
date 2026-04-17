import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'accessToken';
const USER_DATA_KEY = 'userData';

function decodeBase64Url(input) {
  try {
    const normalized = String(input || '')
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    if (typeof globalThis?.atob === 'function') {
      return globalThis.atob(padded);
    }
    return null;
  } catch {
    return null;
  }
}

function parseJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  const decoded = decodeBase64Url(parts[1]);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = parseJwtPayload(token);
  const exp = Number(payload?.exp);
  if (!Number.isFinite(exp) || exp <= 0) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  const safetyWindowSeconds = 15;
  return exp <= now + safetyWindowSeconds;
}

export async function clearAuthSession() {
  try {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_DATA_KEY]);
  } catch (e) {
    // ignore
  }
}

/**
 * Lấy accessToken từ storage (null nếu chưa đăng nhập).
 */
export async function getAccessToken() {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    if (isTokenExpired(token)) {
      await clearAuthSession();
      return null;
    }
    return token;
  } catch (e) {
    return null;
  }
}

/**
 * Kiểm tra đã đăng nhập chưa. Nếu chưa thì navigate sang Login và trả về false.
 * @param {object} navigation - navigation object (navigate, goBack)
 * @param {object} options - { returnScreen, returnParams } để sau khi đăng nhập quay lại màn/params đó
 * @returns {Promise<boolean>} true nếu có token, false nếu đã chuyển sang Login
 */
export async function requireAuth(navigation, options = {}) {
  const token = await getAccessToken();
  // Đã đăng nhập chỉ khi có token + có userId (tránh trạng thái lệch sau logout)
  let hasUserId = false;
  try {
    const raw = await AsyncStorage.getItem(USER_DATA_KEY);
    const user = raw ? JSON.parse(raw) : null;
    hasUserId = !!user?.userId;
  } catch (e) {
    hasUserId = false;
  }

  if (token && hasUserId) return true;
  navigation.navigate('Login', {
    returnScreen: options.returnScreen || null,
    returnParams: options.returnParams || null,
    fromAuthRequired: true,
  });
  return false;
}
