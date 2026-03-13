import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const logAccessTokenNow = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    console.log('[notification] accessToken', accessToken);
  } catch (e) {
    console.log('[notification] accessToken read error', e);
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
    await logAccessTokenNow();
  } catch (e) {
    console.log('[notification] register error', e);
  }
};