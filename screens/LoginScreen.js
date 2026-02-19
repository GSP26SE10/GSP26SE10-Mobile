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
  ActivityIndicator,
} from 'react-native';
import { useFonts } from 'expo-font';
import { MadimiOne_400Regular } from '@expo-google-fonts/madimi-one';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../constants/api';
import Toast from '../components/Toast';
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

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [fontsLoaded] = useFonts({
    MadimiOne_400Regular,
  });

  const isFormValid = email.length > 0 && password.length > 0 && !loading;

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleLogin = async () => {
    if (!isFormValid) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/authentication/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userNameOrEmail: email.trim(),
          password: password,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const userData = result.data;

        // Kiểm tra status
        if (userData.status !== 'ACTIVE') {
          showToast('Tài khoản của bạn đã bị khóa');
          setLoading(false);
          return;
        }

        // Lưu thông tin vào AsyncStorage
        try {
          await AsyncStorage.setItem('accessToken', userData.accessToken);
          await AsyncStorage.setItem('userData', JSON.stringify({
            userId: userData.userId,
            userName: userData.userName,
            fullName: userData.fullName,
            email: userData.email,
            phone: userData.phone,
            address: userData.address,
            status: userData.status,
            roleName: userData.roleName,
          }));
        } catch (storageError) {
          console.error('Storage error:', storageError);
          showToast('Lỗi khi lưu thông tin đăng nhập');
          setLoading(false);
          return;
        }

        // Đăng nhập thành công - Navigate theo role
        showToast('Đăng nhập thành công');
        setTimeout(() => {
          if (userData.roleName === 'USER') {
            navigation.navigate('Home');
          } else if (userData.roleName === 'STAFF') {
            navigation.navigate('StaffHome');
          } else if (userData.roleName === 'GROUP_LEADER') {
            navigation.navigate('LeaderHome');
          } else {
            showToast('Role không được hỗ trợ');
          }
        }, 500);
      } else {
        // Xử lý lỗi từ API
        const errorMessage = result.message || result.error || 'Đăng nhập thất bại. Vui lòng thử lại.';
        showToast(errorMessage);
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      showToast('Không thể kết nối đến server. Vui lòng kiểm tra kết nối mạng.');
      setLoading(false);
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
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Logo */}
          <Text style={styles.logo}>BOOKFET</Text>

          {/* Title */}
          <Text style={styles.title}>Đăng nhập</Text>

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Mật khẩu"
              placeholderTextColor={TEXT_PLACEHOLDER}
              value={password}
              onChangeText={setPassword}
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

          {/* Forgot Password Link */}
          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Quên mật khẩu</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              !isFormValid && styles.loginButtonDisabled,
            ]}
            disabled={!isFormValid}
            onPress={handleLogin}
          >
            {loading ? (
              <ActivityIndicator color={BUTTON_TEXT_WHITE} />
            ) : (
              <Text
                style={[
                  styles.loginButtonText,
                  !isFormValid && styles.loginButtonTextDisabled,
                ]}
              >
                Đăng nhập
              </Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <View style={styles.registerContainer}>
            <Text style={styles.registerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Đăng ký</Text>
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: PRIMARY_COLOR,
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  loginButtonDisabled: {
    backgroundColor: BUTTON_DISABLED_BG,
  },
  loginButtonText: {
    color: BUTTON_TEXT_WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  loginButtonTextDisabled: {
    color: BUTTON_DISABLED_TEXT,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  registerLink: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
});
