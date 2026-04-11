import React, { useEffect, useRef, useState } from 'react';
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
const OTP_LENGTH = 6;

export default function EmailVerificationScreen({ navigation, route }) {
  const initialEmail = route?.params?.email || '';
  const [email] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const otpInputRef = useRef(null);

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

  const translateApiMessage = (rawMessage) => {
    const message = String(rawMessage || '').trim();
    if (!message) return '';

    const normalized = message.toLowerCase();

    if (normalized.includes('code has expired') || normalized.includes('does not exist')) {
      return 'Mã xác thực đã hết hạn hoặc không tồn tại. Vui lòng đăng ký lại hoặc yêu cầu mã mới.';
    }
    if (normalized.includes('invalid code') || normalized.includes('wrong code')) {
      return 'Mã xác nhận không đúng, vui lòng thử lại.';
    }
    if (normalized.includes('email is already') || normalized.includes('already verified')) {
      return 'Email này đã được xác thực trước đó.';
    }
    if (normalized.includes('user not found')) {
      return 'Không tìm thấy tài khoản tương ứng với email này.';
    }
    if (normalized.includes('too many requests')) {
      return 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
    }
    if (normalized.includes('failed to send') || normalized.includes('send email')) {
      return 'Không thể gửi email xác nhận lúc này. Vui lòng thử lại sau.';
    }

    return message;
  };

  const getApiErrorMessage = (json, fallback) => {
    const rawMessage =
      (typeof json?.message === 'string' && json.message.trim()) ||
      (typeof json?.Message === 'string' && json.Message.trim()) ||
      (typeof json?.error === 'string' && json.error.trim()) ||
      (typeof json?.Error === 'string' && json.Error.trim()) ||
      '';

    const translated = translateApiMessage(rawMessage);
    return translated || fallback;
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

      const isSuccess = json?.success ?? json?.Success;
      if (!res.ok || isSuccess === false) {
        const msg = getApiErrorMessage(
          json,
          res.status >= 400 && res.status < 500
            ? 'Mã xác nhận không đúng, vui lòng thử lại'
            : 'Có lỗi xảy ra, vui lòng thử lại',
        );
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

      const isSuccess = json?.success ?? json?.Success;
      if (!res.ok || isSuccess === false) {
        const msg = getApiErrorMessage(json, 'Không thể gửi lại mã, vui lòng thử lại');
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

  const handleCodeChange = (value) => {
    const normalized = String(value ?? '')
      .replace(/[^0-9a-zA-Z]/g, '')
      .toUpperCase()
      .slice(0, OTP_LENGTH);
    setCode(normalized);
  };

  const canVerify = code.length === OTP_LENGTH && !!email && !submitting;
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
          <TouchableOpacity
            style={styles.otpBoxesRow}
            activeOpacity={1}
            onPress={() => otpInputRef.current?.focus?.()}
          >
            {Array.from({ length: OTP_LENGTH }).map((_, idx) => {
              const char = code[idx] || '';
              const isActive = idx === Math.min(code.length, OTP_LENGTH - 1);
              return (
                <View
                  key={`verify-otp-box-${idx}`}
                  style={[styles.otpBox, isActive && styles.otpBoxActive]}
                >
                  <Text style={styles.otpBoxText}>{char}</Text>
                </View>
              );
            })}
          </TouchableOpacity>
          <TextInput
            ref={otpInputRef}
            style={styles.hiddenOtpInput}
            placeholder="Nhập mã OTP"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={code}
            onChangeText={handleCodeChange}
            keyboardType="default"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={OTP_LENGTH}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
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
  hiddenOtpInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  otpBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: INPUT_BACKGROUND,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxActive: {
    borderColor: PRIMARY_COLOR,
  },
  otpBoxText: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    textTransform: 'uppercase',
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

