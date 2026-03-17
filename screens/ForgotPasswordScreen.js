import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useFonts } from 'expo-font';
import { MadimiOne_400Regular } from '@expo-google-fonts/madimi-one';
import { z } from 'zod';
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

const resetSchema = z
  .object({
    emailOrUsername: z.string().min(1, 'Email hoặc tên đăng nhập không được để trống'),
    code: z.string().min(1, 'Mã OTP không được để trống'),
    newPassword: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Mật khẩu xác nhận không khớp',
  });

export default function ForgotPasswordScreen({ navigation }) {
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requestingCode, setRequestingCode] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [hasRequestedCode, setHasRequestedCode] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errors, setErrors] = useState({});

  const [fontsLoaded] = useFonts({
    MadimiOne_400Regular,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const handleRequestCode = async () => {
    if (!emailOrUsername || requestingCode) return;
    setRequestingCode(true);
    try {
      const payload = { emailOrUsername };
      const res = await fetch(`${API_URL}/api/authentication/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          'Không thể gửi mã OTP, vui lòng kiểm tra lại email hoặc tên đăng nhập';
        showToast(msg);
        return;
      }

      setHasRequestedCode(true);
      showToast('Đã gửi mã OTP, vui lòng kiểm tra email');
    } catch (e) {
      console.log('[forgot-password] error', e);
      showToast('Không thể gửi mã OTP, vui lòng thử lại');
    } finally {
      setRequestingCode(false);
    }
  };

  const handleResetPassword = async () => {
    if (resetting) return;

    const result = resetSchema.safeParse({
      emailOrUsername,
      code,
      newPassword,
      confirmPassword,
    });
    if (!result.success) {
      const fieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      showToast('Vui lòng kiểm tra lại thông tin');
      return;
    }
    setErrors({});

    setResetting(true);
    try {
      const payload = {
        emailOrUsername,
        code,
        newPassword,
        confirmPassword,
      };
      const res = await fetch(`${API_URL}/api/authentication/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          'Không thể đặt lại mật khẩu, vui lòng kiểm tra lại mã OTP và mật khẩu';
        showToast(msg);
        return;
      }

      showToast('Đặt lại mật khẩu thành công, vui lòng đăng nhập');
      setTimeout(() => {
        navigation.navigate('Login');
      }, 1200);
    } catch (e) {
      console.log('[reset-password] error', e);
      showToast('Không thể đặt lại mật khẩu, vui lòng thử lại');
    } finally {
      setResetting(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

  const canRequestCode = !!emailOrUsername && !requestingCode;
  const canReset =
    !!emailOrUsername && !!code && !!newPassword && !!confirmPassword && !resetting;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Toast
            message={toastMessage}
            visible={toastVisible}
            onHide={() => setToastVisible(false)}
          />

          <Text style={styles.logo}>BOOKFET</Text>
          <Text style={styles.title}>Quên mật khẩu</Text>
          <Text style={styles.subtitle}>
            Nhập email hoặc tên đăng nhập để nhận mã OTP, sau đó đặt lại mật khẩu mới.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email hoặc tên đăng nhập"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={emailOrUsername}
            onChangeText={(text) => {
              setEmailOrUsername(text);
              if (errors.emailOrUsername) {
                setErrors((prev) => ({ ...prev, emailOrUsername: undefined }));
              }
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {errors.emailOrUsername ? (
            <Text style={styles.errorText}>{errors.emailOrUsername}</Text>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !canRequestCode && styles.primaryButtonDisabled,
            ]}
            disabled={!canRequestCode}
            onPress={handleRequestCode}
          >
            <Text
              style={[
                styles.primaryButtonText,
                !canRequestCode && styles.primaryButtonTextDisabled,
              ]}
            >
              Gửi mã OTP
            </Text>
          </TouchableOpacity>

          {/* Section nhập OTP + mật khẩu mới */}
          {hasRequestedCode && (
            <>
              <View style={styles.sectionDivider} />

              <Text style={styles.sectionTitle}>Đặt lại mật khẩu</Text>

              <TextInput
                style={styles.input}
                placeholder="Mã OTP"
                placeholderTextColor={TEXT_PLACEHOLDER}
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  if (errors.code) {
                    setErrors((prev) => ({ ...prev, code: undefined }));
                  }
                }}
                keyboardType="default"
                autoCapitalize="none"
              />
              {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : null}

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Mật khẩu mới"
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    if (errors.newPassword) {
                      setErrors((prev) => ({ ...prev, newPassword: undefined }));
                    }
                  }}
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowNewPassword((v) => !v)}
                >
                  <Text style={styles.eyeIconText}>
                    {showNewPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.newPassword ? (
                <Text style={styles.errorText}>{errors.newPassword}</Text>
              ) : null}

              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Xác nhận mật khẩu mới"
                  placeholderTextColor={TEXT_PLACEHOLDER}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (errors.confirmPassword) {
                      setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }
                  }}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword((v) => !v)}
                >
                  <Text style={styles.eyeIconText}>
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.confirmPassword ? (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  !canReset && styles.primaryButtonDisabled,
                ]}
                disabled={!canReset}
                onPress={handleResetPassword}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !canReset && styles.primaryButtonTextDisabled,
                  ]}
                >
                  Xác nhận đặt lại mật khẩu
                </Text>
              </TouchableOpacity>
            </>
          )}

          <View style={styles.backRow}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.backText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logo: {
    fontSize: 40,
    fontFamily: 'MadimiOne_400Regular',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
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
  passwordContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  passwordInput: {
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingRight: 50,
    fontSize: 16,
    color: TEXT_PRIMARY,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  eyeIconText: {
    fontSize: 20,
  },
  primaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: BUTTON_DISABLED_BG,
  },
  primaryButtonText: {
    color: BUTTON_TEXT_WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButtonTextDisabled: {
    color: BUTTON_DISABLED_TEXT,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: -8,
    marginBottom: 8,
  },
  backRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  backText: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
});

