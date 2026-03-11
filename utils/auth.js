import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'accessToken';

/**
 * Lấy accessToken từ storage (null nếu chưa đăng nhập).
 */
export async function getAccessToken() {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
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
  if (token) return true;
  navigation.navigate('Login', {
    returnScreen: options.returnScreen || null,
    returnParams: options.returnParams || null,
    fromAuthRequired: true,
  });
  return false;
}
