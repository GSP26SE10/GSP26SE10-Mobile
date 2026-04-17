import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken } from './auth';

export async function getStoredFullName() {
  try {
    const token = await getAccessToken();
    if (!token) return null;

    const raw = await AsyncStorage.getItem('userData');
    if (!raw) return null;
    const data = JSON.parse(raw);
    const name = (data?.fullName || '').trim();
    return name || null;
  } catch (e) {
    return null;
  }
}

export function buildGreeting(fullName) {
  const name = (fullName || '').trim();
  if (!name) return 'Xin chào!';
  return `Xin chào, ${name}!`;
}

