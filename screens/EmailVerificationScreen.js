import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFonts } from 'expo-font';
import { MadimiOne_400Regular } from '@expo-google-fonts/madimi-one';
import {
  PRIMARY_COLOR,
  BACKGROUND_WHITE,
  INPUT_BACKGROUND,
  BUTTON_DISABLED_BG,
  BUTTON_DISABLED_TEXT,
  BUTTON_TEXT_WHITE,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_PLACEHOLDER,
  BORDER_LIGHT,
} from '../constants/colors';
import API_URL from '../constants/api';
import Toast from '../components/Toast';

const RESEND_SECONDS = 120;

export default function EmailVerificationScreen({ navigation, route }) {
  const initialEmail = route?.params?.email || '';
  const [email] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [fontsLoaded] = useFonts({
    MadimiOne_400Regular,
  });

  useEffect(() => {
    let timer = null;
    if (secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [secondsLeft]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const handleVerify = async () => {
    if (!email || !code || submitting) return;
    setSubmitting(true);
    try {
      const payload = { email, code };
      const res = await fetch(`${API_URL}/api/authentication/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (!res.ok || json?.success === false) {
        const msg =
          json?.message ||
          (res.status >= 400 && res.status < 500
            ? 'Mã xác nhận không đúng, vui lòng thử lại'
            : 'Có lỗi xảy ra, vui lòng thử lại');
        showToast(msg);
        return;
      }

      showToast('Đăng ký thành công, vui lòng đăng nhập');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1200);
    } catch (e) {
      console.log('[verify-email] error', e);
      showToast('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email || secondsLeft > 0 || resending) return;
    setResending(true);
    try {
      const payload = { email };
      const res = await fetch(`${API_URL}/api/authentication/resend-verification-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { raw: text };
      }

      if (!res.ok || json?.success === false) {
        const msg =
          json?.message ||
          'Không thể gửi lại mã, vui lòng thử lại';
        showToast(msg);
        return;
      }

      showToast('Đã gửi lại mã xác nhận');
      setSecondsLeft(RESEND_SECONDS);
    } catch (e) {
      console.log('[resend-code] error', e);
      showToast('Không thể gửi lại mã, vui lòng thử lại');
    } finally {
      setResending(false);
    }
  };

  const formatSeconds = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!fontsLoaded) {
    return null;
  }

  const canVerify = !!code && !!email && !submitting;
  const canResend = secondsLeft === 0 && !resending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.content}>
          <Toast
            message={toastMessage}
            visible={toastVisible}
            onHide={() => setToastVisible(false)}
          />

          <Text style={styles.logo}>BOOKFET</Text>
          <Text style={styles.title}>Xác nhận email</Text>
          <Text style={styles.subtitle}>
            Chúng tôi đã gửi mã xác nhận đến địa chỉ email của bạn.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
            placeholder="Email"
            placeholderTextColor={TEXT_PLACEHOLDER}
          />

          <Text style={styles.label}>Mã xác nhận</Text>
          <TextInput
            style={styles.input}
            placeholder="Nhập mã OTP"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={code}
            onChangeText={setCode}
            keyboardType="default"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[
              styles.verifyButton,
              !canVerify && styles.verifyButtonDisabled,
            ]}
            disabled={!canVerify}
            onPress={handleVerify}
          >
            <Text
              style={[
                styles.verifyButtonText,
                !canVerify && styles.verifyButtonTextDisabled,
              ]}
            >
              Xác nhận
            </Text>
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendText}>
              Không nhận được mã?
            </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={!canResend}
            >
              <Text
                style={[
                  styles.resendLink,
                  !canResend && styles.resendLinkDisabled,
                ]}
              >
                Gửi lại {secondsLeft > 0 ? `(${formatSeconds(secondsLeft)})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logo: {
    fontSize: 36,
    fontFamily: 'MadimiOne_400Regular',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  input: {
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    marginBottom: 16,
  },
  inputDisabled: {
    color: TEXT_SECONDARY,
  },
  verifyButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  verifyButtonDisabled: {
    backgroundColor: BUTTON_DISABLED_BG,
  },
  verifyButtonText: {
    color: BUTTON_TEXT_WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButtonTextDisabled: {
    color: BUTTON_DISABLED_TEXT,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  resendLink: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
    marginLeft: 4,
  },
  resendLinkDisabled: {
    color: BUTTON_DISABLED_TEXT,
  },
});

