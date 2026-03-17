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

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errors, setErrors] = useState({});

  const [fontsLoaded] = useFonts({
    MadimiOne_400Regular,
  });

  const isFormValid =
    fullName.length > 0 &&
    userName.length > 0 &&
    email.length > 0 &&
    phone.length > 0 &&
    address.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  const registerSchema = z
    .object({
      fullName: z.string().min(1, 'Họ và tên không được để trống'),
      userName: z.string().min(3, 'Tên đăng nhập tối thiểu 3 ký tự'),
      email: z.string().email('Email không hợp lệ'),
      phone: z
        .string()
        .min(9, 'Số điện thoại không hợp lệ')
        .max(20, 'Số điện thoại không hợp lệ'),
      address: z.string().min(5, 'Địa chỉ quá ngắn'),
      password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      path: ['confirmPassword'],
      message: 'Mật khẩu xác nhận không khớp',
    });

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  const handleRegister = async () => {
    if (!isFormValid) return;
    if (password !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp');
      return;
    }
    const result = registerSchema.safeParse({
      fullName,
      userName,
      email,
      phone,
      address,
      password,
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

    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        userName,
        password,
        fullName,
        email,
        phone,
        address,
      };

      const res = await fetch(`${API_URL}/api/authentication/register`, {
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
            ? 'Đăng ký không thành công, vui lòng kiểm tra lại thông tin'
            : 'Có lỗi xảy ra, vui lòng thử lại');
        showToast(msg);
        return;
      }

      // Điều hướng sang màn hình xác nhận email, giữ lại email
      navigation.navigate('EmailVerification', { email });
    } catch (e) {
      console.log('[register] error', e);
      showToast('Có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  if (!fontsLoaded) {
    return null;
  }

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
          {/* Logo */}
          <Text style={styles.logo}>BOOKFET</Text>

          {/* Title */}
          <Text style={styles.title}>Đăng ký</Text>

          {/* Full Name Input */}
          <TextInput
            style={styles.input}
            placeholder="Họ và tên"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }));
            }}
            autoCapitalize="words"
          />
          {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}

          {/* Username Input */}
          <TextInput
            style={styles.input}
            placeholder="Tên đăng nhập"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={userName}
            onChangeText={(text) => {
              setUserName(text);
              if (errors.userName) setErrors((prev) => ({ ...prev, userName: undefined }));
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.userName ? <Text style={styles.errorText}>{errors.userName}</Text> : null}

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

          {/* Phone Input */}
          <TextInput
            style={styles.input}
            placeholder="Số điện thoại"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
            }}
            keyboardType="phone-pad"
          />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          {/* Address Input */}
          <TextInput
            style={styles.input}
            placeholder="Địa chỉ"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
            }}
            autoCapitalize="sentences"
          />
          {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}

          {/* Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mật khẩu"
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Text style={styles.eyeIconText}>
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Xác nhận mật khẩu"
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (errors.confirmPassword)
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }}
              secureTextEntry={!showConfirmPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              <Text style={styles.eyeIconText}>
                {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
              </Text>
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          {errors.confirmPassword ? (
            <Text style={styles.errorText}>{errors.confirmPassword}</Text>
          ) : null}

          {/* Register Button */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              !isFormValid && styles.registerButtonDisabled,
              submitting && styles.registerButtonDisabled,
            ]}
            disabled={!isFormValid || submitting}
            onPress={handleRegister}
          >
            <Text
              style={[
                styles.registerButtonText,
                !isFormValid && styles.registerButtonTextDisabled,
              ]}
            >
              Đăng ký
            </Text>
          </TouchableOpacity>

          {/* Login Link */}
          <View style={styles.loginContainer}>
            <Text style={styles.loginText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Đăng nhập</Text>
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
    fontSize: 48,
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
    marginBottom: 32,
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
  registerButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  registerButtonDisabled: {
    backgroundColor: BUTTON_DISABLED_BG,
  },
  registerButtonText: {
    color: BUTTON_TEXT_WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  registerButtonTextDisabled: {
    color: BUTTON_DISABLED_TEXT,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  loginLink: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#FF3B30',
    marginTop: -8,
    marginBottom: 8,
  },
});
