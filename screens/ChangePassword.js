import React, { useMemo, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
	BACKGROUND_WHITE,
	BORDER_LIGHT,
	INPUT_BACKGROUND,
	PRIMARY_COLOR,
	TEXT_PRIMARY,
	TEXT_SECONDARY,
	TEXT_PLACEHOLDER,
} from '../constants/colors';
import Toast from '../components/Toast';
import API_URL from '../constants/api';
import { getAccessToken } from '../utils/auth';

export default function ChangePasswordScreen({ navigation }) {
	const [oldPassword, setOldPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmNewPassword, setConfirmNewPassword] = useState('');
	const [otpCode, setOtpCode] = useState('');

	const [otpStep, setOtpStep] = useState(false);
	const [sendingOtp, setSendingOtp] = useState(false);
	const [verifyingOtp, setVerifyingOtp] = useState(false);

	const [showOldPassword, setShowOldPassword] = useState(false);
	const [showNewPassword, setShowNewPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	const [toastVisible, setToastVisible] = useState(false);
	const [toastMessage, setToastMessage] = useState('');

	const canSendOtp = useMemo(() => {
		const oldPwd = String(oldPassword || '').trim();
		const newPwd = String(newPassword || '').trim();
		const confirmPwd = String(confirmNewPassword || '').trim();
		return (
			oldPwd.length > 0 &&
			newPwd.length >= 6 &&
			confirmPwd.length > 0 &&
			newPwd === confirmPwd &&
			newPwd !== oldPwd
		);
	}, [oldPassword, newPassword, confirmNewPassword]);
	const canVerifyOtp = useMemo(() => String(otpCode || '').trim().length > 0, [otpCode]);

	const showToast = (message) => {
		setToastMessage(message);
		setToastVisible(true);
	};

	const handleSendOtp = async () => {
		if (sendingOtp) return;

		const oldPwd = String(oldPassword || '').trim();
		const newPwd = String(newPassword || '').trim();
		const confirmPwd = String(confirmNewPassword || '').trim();

		if (!oldPwd || !newPwd || !confirmPwd) {
			showToast('Vui lòng nhập đầy đủ thông tin mật khẩu');
			return;
		}

		if (newPwd.length < 6) {
			showToast('Mật khẩu mới tối thiểu 6 ký tự');
			return;
		}

		if (newPwd !== confirmPwd) {
			showToast('Mật khẩu mới và xác nhận mật khẩu phải giống nhau');
			return;
		}

		setSendingOtp(true);
		try {
			const token = await getAccessToken();
			const payload = {
				oldPassword: oldPwd,
				newPassword: newPwd,
				confirmNewPassword: confirmPwd,
			};

			const res = await fetch(`${API_URL}/api/user/change-password/send-otp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify(payload),
			});

			const text = await res.text();
			let json = null;
			try {
				json = text ? JSON.parse(text) : null;
			} catch {
				json = null;
			}

			if (json?.success === false && json?.message === 'Old password is incorrect.') {
				showToast('Sai mật khẩu cũ');
				return;
			}

			if (!res.ok || json?.success === false) {
				showToast(json?.message || 'Không thể gửi OTP, vui lòng thử lại');
				return;
			}

			if (json?.success === true && json?.data === true) {
				setOtpStep(true);
				showToast('Mã OTP đã được gửi tới email của bạn');
				return;
			}

			showToast('Không thể gửi OTP, vui lòng thử lại');
		} catch (error) {
			console.error('Failed to send password OTP', error);
			showToast('Có lỗi xảy ra, vui lòng thử lại');
		} finally {
			setSendingOtp(false);
		}
	};

	const handleVerifyOtp = async () => {
		if (verifyingOtp) return;

		const code = String(otpCode || '').trim();
		if (!code) {
			showToast('Vui lòng nhập mã OTP');
			return;
		}

		setVerifyingOtp(true);
		try {
			const token = await getAccessToken();
			const res = await fetch(`${API_URL}/api/user/change-password/verify-otp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ code }),
			});

			const text = await res.text();
			let json = null;
			try {
				json = text ? JSON.parse(text) : null;
			} catch {
				json = null;
			}

			if (!res.ok || json?.success === false) {
				showToast(json?.message || 'Mã OTP không hợp lệ hoặc đã hết hạn');
				return;
			}

			showToast('Đổi mật khẩu thành công');
			setTimeout(() => {
				navigation.goBack();
			}, 500);
		} catch (error) {
			console.error('Failed to verify password OTP', error);
			showToast('Có lỗi xảy ra, vui lòng thử lại');
		} finally {
			setVerifyingOtp(false);
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
			<Toast message={toastMessage} visible={toastVisible} onHide={() => setToastVisible(false)} />

			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
					<Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Đổi mật khẩu</Text>
				<View style={styles.backButton} />
			</View>

			<KeyboardAvoidingView
				style={styles.keyboardContainer}
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
			>
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
					{!otpStep ? (
						<>
							<Text style={styles.sectionHint}>Nhập mật khẩu cũ và mật khẩu mới để nhận mã OTP. Mật khẩu phải có ít nhất 6 ký tự</Text>

							<View style={styles.formGroup}>
								<Text style={styles.label}>Mật khẩu cũ</Text>
								<View style={styles.passwordRow}>
									<TextInput
										style={styles.passwordInput}
										value={oldPassword}
										onChangeText={setOldPassword}
										secureTextEntry={!showOldPassword}
										placeholder="Nhập mật khẩu cũ"
										placeholderTextColor={TEXT_PLACEHOLDER}
									/>
									<TouchableOpacity onPress={() => setShowOldPassword((prev) => !prev)}>
										<Ionicons
											name={showOldPassword ? 'eye-off-outline' : 'eye-outline'}
											size={22}
											color={TEXT_SECONDARY}
										/>
									</TouchableOpacity>
								</View>
							</View>

							<View style={styles.formGroup}>
								<Text style={styles.label}>Mật khẩu mới</Text>
								<View style={styles.passwordRow}>
									<TextInput
										style={styles.passwordInput}
										value={newPassword}
										onChangeText={setNewPassword}
										secureTextEntry={!showNewPassword}
										placeholder="Nhập mật khẩu mới"
										placeholderTextColor={TEXT_PLACEHOLDER}
									/>
									<TouchableOpacity onPress={() => setShowNewPassword((prev) => !prev)}>
										<Ionicons
											name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
											size={22}
											color={TEXT_SECONDARY}
										/>
									</TouchableOpacity>
								</View>
							</View>

							<View style={styles.formGroup}>
								<Text style={styles.label}>Xác nhận mật khẩu mới</Text>
								<View style={styles.passwordRow}>
									<TextInput
										style={styles.passwordInput}
										value={confirmNewPassword}
										onChangeText={setConfirmNewPassword}
										secureTextEntry={!showConfirmPassword}
										placeholder="Nhập lại mật khẩu mới"
										placeholderTextColor={TEXT_PLACEHOLDER}
									/>
									<TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)}>
										<Ionicons
											name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
											size={22}
											color={TEXT_SECONDARY}
										/>
									</TouchableOpacity>
								</View>
							</View>

							<TouchableOpacity
								style={[
									styles.primaryButton,
									(!canSendOtp || sendingOtp) && styles.primaryButtonDisabled,
								]}
								onPress={handleSendOtp}
								activeOpacity={0.8}
								disabled={!canSendOtp || sendingOtp}
							>
								{sendingOtp ? (
									<ActivityIndicator color={BACKGROUND_WHITE} />
								) : (
									<Text style={styles.primaryButtonText}>Gửi OTP</Text>
								)}
							</TouchableOpacity>
						</>
					) : (
						<>
							<Text style={styles.sectionHint}>Nhập mã OTP đã gửi về email để hoàn tất đổi mật khẩu</Text>

							<View style={styles.formGroup}>
								<Text style={styles.label}>Mã OTP</Text>
								<TextInput
									style={styles.input}
									value={otpCode}
									onChangeText={setOtpCode}
									placeholder="Nhập mã OTP"
									placeholderTextColor={TEXT_PLACEHOLDER}
									keyboardType="number-pad"
								/>
							</View>

							<TouchableOpacity
								style={[
									styles.primaryButton,
									(!canVerifyOtp || verifyingOtp) && styles.primaryButtonDisabled,
								]}
								onPress={handleVerifyOtp}
								activeOpacity={0.8}
								disabled={!canVerifyOtp || verifyingOtp}
							>
								{verifyingOtp ? (
									<ActivityIndicator color={BACKGROUND_WHITE} />
								) : (
									<Text style={styles.primaryButtonText}>Xác nhận OTP</Text>
								)}
							</TouchableOpacity>
						</>
					)}
				</ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: BACKGROUND_WHITE,
	},
	header: {
		height: 56,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 12,
		borderBottomWidth: 1,
		borderBottomColor: BORDER_LIGHT,
	},
	backButton: {
		width: 36,
		height: 36,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: TEXT_PRIMARY,
	},
	keyboardContainer: {
		flex: 1,
	},
	content: {
		paddingHorizontal: 20,
		paddingVertical: 24,
	},
	sectionHint: {
		color: TEXT_SECONDARY,
		fontSize: 14,
		marginBottom: 18,
		lineHeight: 20,
	},
	formGroup: {
		marginBottom: 14,
	},
	label: {
		fontSize: 14,
		color: TEXT_SECONDARY,
		marginBottom: 8,
	},
	input: {
		height: 48,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 14,
		backgroundColor: INPUT_BACKGROUND,
		color: TEXT_PRIMARY,
		fontSize: 15,
	},
	passwordRow: {
		height: 48,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 14,
		backgroundColor: INPUT_BACKGROUND,
		flexDirection: 'row',
		alignItems: 'center',
	},
	passwordInput: {
		flex: 1,
		color: TEXT_PRIMARY,
		fontSize: 15,
	},
	primaryButton: {
		marginTop: 10,
		height: 50,
		borderRadius: 12,
		backgroundColor: PRIMARY_COLOR,
		alignItems: 'center',
		justifyContent: 'center',
	},
	primaryButtonDisabled: {
		opacity: 0.7,
	},
	primaryButtonText: {
		color: BACKGROUND_WHITE,
		fontSize: 16,
		fontWeight: '700',
	},
});
