import React, { useState, useEffect } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
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

export default function LoginScreen({ navigation, route }) {
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

  useEffect(() => {
    if (route?.params?.fromAuthRequired) {
      showToast('Bạn cần phải đăng nhập');
    }
  }, [route?.params?.fromAuthRequired]);

  const parseCallbackUrl = (url) => {
    const params = {};
    const parsePart = (str) => {
      if (!str) return;
      str.split('&').forEach((pair) => {
        const eq = pair.indexOf('=');
        const key = eq >= 0 ? decodeURIComponent(pair.slice(0, eq).replace(/\+/g, ' ')) : '';
        const value = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) : '';
        if (key) params[key] = value;
      });
    };
    const qStart = url.indexOf('?');
    const hStart = url.indexOf('#');
    if (qStart !== -1) parsePart(url.substring(qStart + 1, hStart !== -1 ? hStart : undefined));
    if (hStart !== -1) parsePart(url.substring(hStart + 1));
    return params;
  };

  const handleGoogleLogin = async () => {
    const authUrl = `${API_URL}/api/authentication/google-login?redirect=myapp://auth/callback`;
    const redirectUrl = 'myapp://auth/callback';
    try {
      setLoading(true);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      setLoading(false);
      if (result.type === 'success' && result.url) {
        console.log('[Google Login] callback URL:', result.url);
        const params = parseCallbackUrl(result.url);
        console.log('[Google Login] parsed params:', JSON.stringify(params, null, 2));
        const accessToken = params.accessToken || params.token;
        if (!accessToken) {
          showToast('Đăng nhập Google thất bại. Không nhận được token.');
          setLoading(false);
          return;
        }
        await AsyncStorage.setItem('accessToken', accessToken);
        const roleName = params.roleName || 'USER';
        let userData = {
          userId: params.userId != null ? Number(params.userId) : params.userId,
          userName: params.userName,
          fullName: params.fullName,
          email: params.email,
          phone: params.phone,
          address: params.address,
          status: params.status || 'ACTIVE',
          roleName,
        };
        try {
          const userId = userData.userId != null ? userData.userId : params.userId;
          if (userId != null) {
            const profileRes = await fetch(
              `${API_URL}/api/user?UserId=${userId}&page=1&pageSize=1`,
              { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            console.log('[Google Login] profile API status:', profileRes.status, 'userId:', userId);
          if (profileRes.ok) {
            const profileJson = await profileRes.json();
            console.log('[Google Login] profile API response:', JSON.stringify(profileJson, null, 2));
            const items = Array.isArray(profileJson?.items) ? profileJson.items : [];
            const profile = items[0] ?? profileJson;
            if (profile && (profile.fullName || profile.email)) {
              userData = {
                userId: profile.userId ?? userData.userId,
                userName: profile.userName ?? userData.userName,
                fullName: profile.fullName ?? userData.fullName,
                email: profile.email ?? userData.email,
                phone: profile.phone ?? userData.phone,
                address: profile.address ?? userData.address,
                status: profile.status ?? userData.status,
                roleName: profile.roleName ?? roleName,
              };
            }
          } else {
            const errText = await profileRes.text();
            console.log('[Google Login] profile API error:', profileRes.status, errText);
          }
          }
        } catch (e) {
          console.warn('Could not fetch user profile after Google login', e);
        }
        console.log('[Google Login] userData saved:', JSON.stringify(userData, null, 2));
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        showToast('Đăng nhập thành công');
        const returnScreen = route?.params?.returnScreen;
        const returnParams = route?.params?.returnParams;
        if (roleName === 'USER') {
          // Nếu vào từ auth-required thì replace để back không quay về Login
          const target = returnScreen || 'Home';
          if (route?.params?.fromAuthRequired) navigation.replace(target, returnParams || undefined);
          else navigation.navigate(target, returnParams || undefined);
        } else if (roleName === 'STAFF') {
          if (route?.params?.fromAuthRequired) navigation.replace('StaffHome');
          else navigation.navigate('StaffHome');
        } else if (roleName === 'GROUP_LEADER') {
          if (route?.params?.fromAuthRequired) navigation.replace('LeaderHome');
          else navigation.navigate('LeaderHome');
        } else {
          const target = returnScreen || 'Home';
          if (route?.params?.fromAuthRequired) navigation.replace(target, returnParams || undefined);
          else navigation.navigate(target, returnParams || undefined);
        }
      } else if (result.type === 'dismissed') {
        setLoading(false);
        showToast('Đã hủy đăng nhập Google');
      }
    } catch (error) {
      setLoading(false);
      console.error('Google login error:', error);
      showToast('Không thể mở trang đăng nhập Google.');
    }
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
        const returnScreen = route?.params?.returnScreen;
        const returnParams = route?.params?.returnParams;
        setTimeout(() => {
          if (userData.roleName === 'USER') {
            const target = returnScreen || 'Home';
            if (route?.params?.fromAuthRequired) navigation.replace(target, returnParams || undefined);
            else navigation.navigate(target, returnParams || undefined);
          } else if (userData.roleName === 'STAFF') {
            if (route?.params?.fromAuthRequired) navigation.replace('StaffHome');
            else navigation.navigate('StaffHome');
          } else if (userData.roleName === 'GROUP_LEADER') {
            if (route?.params?.fromAuthRequired) navigation.replace('LeaderHome');
            else navigation.navigate('LeaderHome');
          } else {
            showToast('Role không được hỗ trợ');
          }
        }, 500);
      } else {
        // Xử lý lỗi từ API (map theo HTTP status)
        const rawMsg = (result?.message || result?.error || '').toString();
        if (response.status === 401) {
          showToast('Email/Tên đăng nhập hoặc mật khẩu không đúng');
        } else if (response.status === 403) {
          showToast('Bạn không có quyền truy cập. Vui lòng đăng nhập lại');
        } else if (response.status >= 500) {
          showToast('Hệ thống đang bận, vui lòng thử lại sau');
        } else if (rawMsg.includes('Email/Username or password is invalid')) {
          showToast('Email/Tên đăng nhập hoặc mật khẩu không đúng');
        } else {
          showToast(rawMsg || 'Đăng nhập thất bại. Vui lòng thử lại.');
        }
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
        <View style={styles.header}>
          {route?.params?.fromLogout ? (
            <View style={styles.backButton} />
          ) : (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          )}
          <View style={styles.backButton} />
        </View>
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
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => navigation.navigate('ForgotPassword')}
            activeOpacity={0.8}
          >
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

          {/* Google Login Button */}
          <TouchableOpacity
            style={styles.googleButton}
            onPress={handleGoogleLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.googleButtonText}>Đăng nhập bằng Google</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
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
  googleButton: {
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
  },
  googleButtonText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontWeight: '600',
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
