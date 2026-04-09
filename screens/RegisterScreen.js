import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
import { Ionicons } from '@expo/vector-icons';
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
import cities from '../constants/city.json';

function normalizeValue(value) {
  return String(value ?? '').trim();
}

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [houseAddress, setHouseAddress] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [wardCode, setWardCode] = useState('');
  const [pickerType, setPickerType] = useState('city');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
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

  const selectedCity = useMemo(
    () => cities.find((city) => city.code === cityCode) ?? null,
    [cityCode],
  );
  const wardOptions = selectedCity?.wards ?? [];
  const selectedWard = useMemo(
    () => wardOptions.find((ward) => ward.code === wardCode) ?? null,
    [wardOptions, wardCode],
  );
  const composedAddress = useMemo(() => {
    const parts = [normalizeValue(houseAddress), selectedWard?.name, selectedCity?.name].filter(Boolean);
    return parts.join(', ');
  }, [houseAddress, selectedWard?.name, selectedCity?.name]);

  const pickerData = useMemo(() => {
    const source = pickerType === 'city' ? cities : wardOptions;
    const search = normalizeValue(pickerSearch).toLowerCase();
    if (!search) return source;

    return source.filter((item) => {
      const name = String(item?.name ?? '').toLowerCase();
      const fullName = String(item?.fullName ?? '').toLowerCase();
      return name.includes(search) || fullName.includes(search);
    });
  }, [pickerType, pickerSearch, wardOptions]);

  const isFormValid =
    normalizeValue(fullName).length > 0 &&
    normalizeValue(userName).length > 0 &&
    normalizeValue(email).length > 0 &&
    normalizeValue(phone).length > 0 &&
    normalizeValue(houseAddress).length > 0 &&
    cityCode.length > 0 &&
    wardCode.length > 0 &&
    password.length > 0 &&
    confirmPassword.length > 0;

  const registerSchema = z
    .object({
      fullName: z
        .string()
        .trim()
        .refine((value) => value.split(/\s+/).filter(Boolean).length >= 2, {
          message: 'Họ và tên phải có ít nhất 2 chữ',
        }),
      userName: z
        .string()
        .trim()
        .min(3, 'Tên đăng nhập tối thiểu 3 ký tự')
        .regex(/^\S+$/, 'Tên đăng nhập không được chứa khoảng trắng'),
      email: z
        .string()
        .trim()
        .email('Email không hợp lệ')
        .refine((value) => value.includes('@'), {
          message: 'Email phải chứa ký tự @',
        }),
      phone: z.string().trim().regex(/^0\d{9}$/, 'Số điện thoại phải gồm 10 số và bắt đầu bằng 0'),
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

  const openPicker = (type) => {
    if (type === 'ward' && !cityCode) {
      showToast('Vui lòng chọn tỉnh/thành trước');
      return;
    }
    setPickerType(type);
    setPickerSearch('');
    setPickerVisible(true);
  };

  const handleSelectOption = (option) => {
    if (pickerType === 'city') {
      const nextCityCode = option?.code ?? '';
      setCityCode(nextCityCode);
      if (nextCityCode !== cityCode) {
        setWardCode('');
      }
      if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
      if (errors.cityCode) setErrors((prev) => ({ ...prev, cityCode: undefined }));
    } else {
      setWardCode(option?.code ?? '');
      if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
      if (errors.wardCode) setErrors((prev) => ({ ...prev, wardCode: undefined }));
    }
    setPickerVisible(false);
  };

  const renderPickerItem = ({ item }) => (
    <TouchableOpacity style={styles.pickerItem} onPress={() => handleSelectOption(item)} activeOpacity={0.7}>
      <Text style={styles.pickerItemText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const handleRegister = async () => {
    if (!isFormValid) return;
    if (password !== confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp');
      return;
    }
    if (!cityCode || !wardCode || !normalizeValue(houseAddress)) {
      setErrors((prev) => ({
        ...prev,
        cityCode: !cityCode ? 'Vui lòng chọn tỉnh/thành' : prev.cityCode,
        wardCode: !wardCode ? 'Vui lòng chọn phường/xã' : prev.wardCode,
        address: !normalizeValue(houseAddress) ? 'Vui lòng nhập địa chỉ cụ thể' : prev.address,
      }));
      showToast('Vui lòng nhập đầy đủ địa chỉ');
      return;
    }

    const finalAddress = normalizeValue(composedAddress);
    const normalizedFullName = normalizeValue(fullName);
    const normalizedUserName = normalizeValue(userName);
    const normalizedEmail = normalizeValue(email);
    const normalizedPhone = normalizeValue(phone);

    const result = registerSchema.safeParse({
      fullName: normalizedFullName,
      userName: normalizedUserName,
      email: normalizedEmail,
      phone: normalizedPhone,
      address: finalAddress,
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
        userName: normalizedUserName,
        password,
        fullName: normalizedFullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        address: finalAddress,
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

          <View style={styles.row}>
            <View style={styles.col}>
              <TextInput
                style={[styles.input, styles.inputCompact]}
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
              {errors.userName ? <Text style={styles.errorTextInline}>{errors.userName}</Text> : null}
            </View>

            <View style={styles.col}>
              <TextInput
                style={[styles.input, styles.inputCompact]}
                placeholder="Số điện thoại"
                placeholderTextColor={TEXT_PLACEHOLDER}
                value={phone}
                onChangeText={(text) => {
                  setPhone(text);
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                keyboardType="phone-pad"
              />
              {errors.phone ? <Text style={styles.errorTextInline}>{errors.phone}</Text> : null}
            </View>
          </View>

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

          {/* Address Input */}
          <TextInput
            style={styles.input}
            placeholder="Địa chỉ (số nhà, tên đường...)"
            placeholderTextColor={TEXT_PLACEHOLDER}
            value={houseAddress}
            onChangeText={(text) => {
              setHouseAddress(text);
              if (errors.address) setErrors((prev) => ({ ...prev, address: undefined }));
            }}
            autoCapitalize="sentences"
          />
          {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}

          <View style={styles.row}>
            <View style={styles.col}>
              <TouchableOpacity
                style={[styles.selectBox, styles.inputCompact]}
                onPress={() => openPicker('city')}
                activeOpacity={0.7}
              >
                <Text style={selectedCity?.name ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                  {selectedCity?.name || 'Tỉnh/Thành'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={TEXT_SECONDARY} />
              </TouchableOpacity>
              {errors.cityCode ? <Text style={styles.errorTextInline}>{errors.cityCode}</Text> : null}
            </View>

            <View style={styles.col}>
              <TouchableOpacity
                style={[styles.selectBox, styles.inputCompact]}
                onPress={() => openPicker('ward')}
                activeOpacity={0.7}
              >
                <Text style={selectedWard?.name ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
                  {selectedWard?.name || 'Phường/Xã'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={TEXT_SECONDARY} />
              </TouchableOpacity>
              {errors.wardCode ? <Text style={styles.errorTextInline}>{errors.wardCode}</Text> : null}
            </View>
          </View>

          <View style={styles.previewBox}>
            <Text style={styles.previewLabel}>Địa chỉ đầy đủ</Text>
            <Text style={styles.previewValue}>{composedAddress || 'Chưa có địa chỉ'}</Text>
          </View>

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
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={TEXT_SECONDARY}
              />
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
              <Ionicons
                name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={TEXT_SECONDARY}
              />
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

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>{pickerType === 'city' ? 'Chọn Tỉnh/Thành' : 'Chọn Phường/Xã'}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={pickerType === 'city' ? 'Tìm tỉnh/thành...' : 'Tìm phường/xã...'}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoCapitalize="none"
            />
            <FlatList
              data={pickerData}
              keyExtractor={(item) => item.code}
              renderItem={renderPickerItem}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Không tìm thấy dữ liệu phù hợp</Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingVertical: 28,
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
  },
  inputCompact: {
    marginBottom: 8,
  },
  selectBox: {
    backgroundColor: INPUT_BACKGROUND,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingHorizontal: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  selectText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  selectPlaceholder: {
    color: TEXT_PLACEHOLDER,
    fontSize: 16,
  },
  previewBox: {
    marginTop: -6,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    backgroundColor: '#FFF9F2',
  },
  previewLabel: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  previewValue: {
    fontSize: 15,
    color: TEXT_PRIMARY,
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
  errorTextInline: {
    fontSize: 12,
    color: '#FF3B30',
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  modalContent: {
    maxHeight: '70%',
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: INPUT_BACKGROUND,
    color: TEXT_PRIMARY,
  },
  pickerItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  pickerItemText: {
    fontSize: 15,
    color: TEXT_PRIMARY,
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
});
