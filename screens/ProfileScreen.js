import React, { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	FlatList,
	Image,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
	BACKGROUND_WHITE,
	BORDER_LIGHT,
	INPUT_BACKGROUND,
	PRIMARY_COLOR,
	TEXT_PRIMARY,
	TEXT_SECONDARY,
} from '../constants/colors';
import API_URL from '../constants/api';
import { getAccessToken } from '../utils/auth';
import Toast from '../components/Toast';
import cities from '../constants/city.json';

const EMPTY_FORM = {
	fullName: '',
	email: '',
	phone: '',
	houseAddress: '',
	cityCode: '',
	wardCode: '',
};

function normalizeValue(value) {
	return String(value ?? '').trim();
}

function normalizeAvatarUri(rawAvatar) {
	const uri = normalizeValue(rawAvatar);
	if (!uri) return null;
	if (
		uri.startsWith('http://') ||
		uri.startsWith('https://') ||
		uri.startsWith('file://') ||
		uri.startsWith('content://') ||
		uri.startsWith('data:image/')
	) {
		return uri;
	}
	return null;
}

function guessMimeTypeFromUri(uri) {
	const lower = String(uri ?? '').toLowerCase();
	if (lower.endsWith('.png')) return 'image/png';
	if (lower.endsWith('.webp')) return 'image/webp';
	if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
	if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
	return 'image/jpeg';
}

function getFileNameFromUri(uri, fallback = '') {
	const raw = String(uri ?? '');
	const cleaned = raw.split('?')[0];
	const last = cleaned.split('/').filter(Boolean).pop();
	if (last) return last;
	return fallback || `avatar-${Date.now()}.jpg`;
}

function splitAddress(rawAddress) {
	const normalizedAddress = normalizeValue(rawAddress);
	if (!normalizedAddress) return { houseAddress: '', cityCode: '', wardCode: '' };

	const parts = normalizedAddress
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	if (parts.length < 3) {
		return { houseAddress: normalizedAddress, cityCode: '', wardCode: '' };
	}

	const cityName = parts[parts.length - 1];
	const wardName = parts[parts.length - 2];
	const houseAddress = parts.slice(0, -2).join(', ');

	const selectedCity = cities.find((city) => city.name === cityName || city.fullName === cityName);
	const selectedWard = selectedCity?.wards?.find(
		(ward) => ward.name === wardName || ward.fullName === wardName,
	);

	return {
		houseAddress,
		cityCode: selectedCity?.code ?? '',
		wardCode: selectedWard?.code ?? '',
	};
}

export default function ProfileScreen({ navigation }) {
	const [user, setUser] = useState(null);
	const [originalUser, setOriginalUser] = useState(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [form, setForm] = useState(EMPTY_FORM);

	const [pickerType, setPickerType] = useState('city');
	const [pickerVisible, setPickerVisible] = useState(false);
	const [pickerSearch, setPickerSearch] = useState('');

	const [toastVisible, setToastVisible] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [avatarUpload, setAvatarUpload] = useState(null);

	const cityOptions = cities;
	const selectedCity = useMemo(
		() => cityOptions.find((city) => city.code === form.cityCode) ?? null,
		[cityOptions, form.cityCode],
	);
	const wardOptions = selectedCity?.wards ?? [];
	const selectedWard = useMemo(
		() => wardOptions.find((ward) => ward.code === form.wardCode) ?? null,
		[wardOptions, form.wardCode],
	);
	const avatarUri = useMemo(() => {
		if (avatarUpload?.uri) return avatarUpload.uri;
		return normalizeAvatarUri(user?.avatar ?? user?.avatarUrl ?? user?.image);
	}, [user, avatarUpload]);

	const showToast = (message) => {
		setToastMessage(message);
		setToastVisible(true);
	};

	const buildFormFromUser = (userData) => {
		const addressParts = splitAddress(userData?.address);
		return {
			fullName: userData?.fullName ?? '',
			email: userData?.email ?? '',
			phone: userData?.phone ?? '',
			houseAddress: addressParts.houseAddress,
			cityCode: addressParts.cityCode,
			wardCode: addressParts.wardCode,
		};
	};

	const normalizedOriginalForm = useMemo(
		() => buildFormFromUser(originalUser),
		[originalUser],
	);
	const hasProfileChanges = useMemo(() => {
		return (
			normalizeValue(form.fullName) !== normalizeValue(normalizedOriginalForm.fullName) ||
			normalizeValue(form.phone) !== normalizeValue(normalizedOriginalForm.phone) ||
			normalizeValue(form.houseAddress) !== normalizeValue(normalizedOriginalForm.houseAddress) ||
			normalizeValue(form.cityCode) !== normalizeValue(normalizedOriginalForm.cityCode) ||
			normalizeValue(form.wardCode) !== normalizeValue(normalizedOriginalForm.wardCode) ||
			!!avatarUpload?.uri
		);
	}, [form, normalizedOriginalForm, avatarUpload]);
	const isProfileSaveEnabled = useMemo(() => {
		const fullName = normalizeValue(form.fullName);
		const phone = normalizeValue(form.phone);
		const houseAddress = normalizeValue(form.houseAddress);
		const hasAddressInputs = form.cityCode || form.wardCode || houseAddress;
		const addressIsComplete = !hasAddressInputs || (form.cityCode && form.wardCode && houseAddress);
		return isEditing && hasProfileChanges && !!fullName && !!phone && addressIsComplete;
	}, [form, hasProfileChanges, isEditing, normalizedOriginalForm]);

	useEffect(() => {
		const loadUser = async () => {
			try {
				const raw = await AsyncStorage.getItem('userData');
				const storedUser = raw ? JSON.parse(raw) : null;
				setUser(storedUser);
				setOriginalUser(storedUser);
				setForm(buildFormFromUser(storedUser));
			} catch (error) {
				console.error('Failed to load profile data', error);
				showToast('Không thể tải thông tin người dùng');
			} finally {
				setLoading(false);
			}
		};

		loadUser();
	}, []);

	const onChangeField = (key, value) => {
		setForm((prev) => ({ ...prev, [key]: value }));
	};

	const composedAddress = useMemo(() => {
		const parts = [normalizeValue(form.houseAddress), selectedWard?.name, selectedCity?.name].filter(Boolean);
		return parts.join(', ');
	}, [form.houseAddress, selectedWard?.name, selectedCity?.name]);

	const openPicker = (type) => {
		if (!isEditing) return;
		if (type === 'ward' && !form.cityCode) {
			showToast('Vui lòng chọn tỉnh/thành trước');
			return;
		}
		setPickerType(type);
		setPickerSearch('');
		setPickerVisible(true);
	};

	const handlePickAvatar = async () => {
		if (!isEditing || saving) return;
		try {
			const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
			if (!permission?.granted) {
				showToast('Vui lòng cấp quyền truy cập ảnh để đổi avatar');
				return;
			}

			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsMultipleSelection: false,
				quality: 0.8,
			});

			if (result?.canceled) return;
			const asset = Array.isArray(result?.assets) ? result.assets[0] : null;
			if (!asset?.uri) return;

			setAvatarUpload({
				uri: asset.uri,
				type: asset.mimeType || guessMimeTypeFromUri(asset.uri),
				name: asset.fileName || getFileNameFromUri(asset.uri),
			});
		} catch (error) {
			console.error('Failed to pick avatar', error);
			showToast('Không thể chọn ảnh avatar');
		}
	};

	const handleSelectOption = (option) => {
		if (pickerType === 'city') {
			const nextCityCode = option?.code ?? '';
			setForm((prev) => ({
				...prev,
				cityCode: nextCityCode,
				wardCode: prev.cityCode === nextCityCode ? prev.wardCode : '',
			}));
		} else {
			setForm((prev) => ({ ...prev, wardCode: option?.code ?? '' }));
		}
		setPickerVisible(false);
	};

	const pickerData = useMemo(() => {
		const source = pickerType === 'city' ? cityOptions : wardOptions;
		const search = normalizeValue(pickerSearch).toLowerCase();
		if (!search) return source;

		return source.filter((item) => {
			const name = String(item?.name ?? '').toLowerCase();
			const fullName = String(item?.fullName ?? '').toLowerCase();
			return name.includes(search) || fullName.includes(search);
		});
	}, [pickerType, cityOptions, wardOptions, pickerSearch]);

	const handleSave = async () => {
		if (saving) return;

		if (!user?.userId) {
			showToast('Không tìm thấy thông tin người dùng');
			return;
		}

		const fullName = normalizeValue(form.fullName);
		const email = normalizeValue(originalUser?.email);
		const phone = normalizeValue(form.phone);
		const houseAddress = normalizeValue(form.houseAddress);

		if (!fullName || !phone) {
			showToast('Vui lòng nhập đầy đủ họ tên và số điện thoại');
			return;
		}

		const phonePattern = /^0\d{9,10}$/;
		if (!phonePattern.test(phone)) {
			showToast('Số điện thoại không hợp lệ (bắt đầu bằng 0, 10-11 số)');
			return;
		}

		if ((form.cityCode || form.wardCode || houseAddress) && (!form.cityCode || !form.wardCode || !houseAddress)) {
			showToast('Địa chỉ cần đủ số nhà, phường/xã và tỉnh/thành');
			return;
		}

		if (!hasProfileChanges) {
			showToast('Chưa có thay đổi để cập nhật');
			return;
		}

		const nextAddress = normalizeValue(composedAddress);
		const formData = new FormData();
		formData.append('FullName', fullName);
		formData.append('Email', email);
		formData.append('Address', nextAddress);
		formData.append('Phone', phone);
		formData.append('Status', '1');
		if (avatarUpload?.uri) {
			formData.append('AvatarFile', {
				uri: avatarUpload.uri,
				type: avatarUpload.type || guessMimeTypeFromUri(avatarUpload.uri),
				name: avatarUpload.name || getFileNameFromUri(avatarUpload.uri),
			});
		}

		setSaving(true);
		try {
			const token = await getAccessToken();
			const putUrl = `${API_URL}/api/user/${user.userId}`;
			console.log('[Profile] PUT request', {
				url: putUrl,
				payload: {
					FullName: fullName,
					Email: email,
					Address: nextAddress,
					Phone: phone,
					Status: 1,
					hasAvatarFile: !!avatarUpload?.uri,
				},
			});

			const res = await fetch(putUrl, {
				method: 'PUT',
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: formData,
			});

			const text = await res.text();
			let json = null;
			try {
				json = text ? JSON.parse(text) : null;
			} catch {
				json = null;
			}

			console.log('[Profile] PUT response', {
				status: res.status,
				ok: res.ok,
				data: json ?? text,
			});

			if (!res.ok || json?.success === false) {
				const message = json?.message || 'Cập nhật thất bại, vui lòng thử lại';
				showToast(message);
				return;
			}

			const serverUser =
				(json && typeof json === 'object' && (json.data || json.item || json.user)) ||
				null;
			const nextUser = {
				...user,
				fullName,
				email,
				phone,
				address: nextAddress,
				status: 1,
				...(avatarUpload?.uri
					? {
						avatar: avatarUpload.uri,
						avatarUrl: avatarUpload.uri,
						image: avatarUpload.uri,
					}
					: {}),
				...(serverUser && typeof serverUser === 'object' ? serverUser : {}),
			};
			setUser(nextUser);
			setOriginalUser(nextUser);
			setAvatarUpload(null);
			setIsEditing(false);
			await AsyncStorage.setItem('userData', JSON.stringify(nextUser));
			showToast('Cập nhật thông tin thành công');
		} catch (error) {
			console.error('Failed to update profile', error);
			showToast('Có lỗi xảy ra khi cập nhật thông tin');
		} finally {
			setSaving(false);
		}
	};

	const handleToggleEdit = () => {
		if (isEditing) {
			setForm(buildFormFromUser(originalUser));
			setAvatarUpload(null);
			setIsEditing(false);
			return;
		}
		setIsEditing(true);
	};

	const renderPickerItem = ({ item }) => (
		<TouchableOpacity style={styles.pickerItem} onPress={() => handleSelectOption(item)} activeOpacity={0.7}>
			<Text style={styles.pickerItemText}>{item.name}</Text>
		</TouchableOpacity>
	);

	if (loading) {
		return (
			<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
				<View style={styles.centerContent}>
					<ActivityIndicator size="large" color={PRIMARY_COLOR} />
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
			<Toast message={toastMessage} visible={toastVisible} onHide={() => setToastVisible(false)} />

			<View style={styles.header}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} activeOpacity={0.7}>
					<Ionicons name="arrow-back" size={22} color={TEXT_PRIMARY} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>Thông tin cá nhân</Text>
				<TouchableOpacity onPress={handleToggleEdit} style={styles.iconButton} activeOpacity={0.7}>
					<Ionicons name={isEditing ? 'close' : 'create-outline'} size={22} color={TEXT_PRIMARY} />
				</TouchableOpacity>
			</View>

			<ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
				<View style={styles.avatarContainer}>
					<View style={styles.avatarCircle}>
						{avatarUri ? (
							<Image source={{ uri: avatarUri }} style={styles.avatarImage} resizeMode="cover" />
						) : (
							<Ionicons name="person" size={42} color={TEXT_SECONDARY} />
						)}
					</View>
					{isEditing ? (
						<TouchableOpacity style={styles.changeAvatarButton} onPress={handlePickAvatar} activeOpacity={0.8}>
							<Ionicons name="camera-outline" size={14} color={PRIMARY_COLOR} />
							<Text style={styles.changeAvatarButtonText}>Đổi ảnh</Text>
						</TouchableOpacity>
					) : null}
					<Text style={styles.avatarName}>{normalizeValue(user?.fullName) || 'Khách hàng'}</Text>
				</View>

				<View style={styles.emailSection}>
					<Text style={styles.label}>Email</Text>
					<View style={styles.readonlyBox}>
						<Text style={styles.readonlyText}>{normalizeValue(originalUser?.email) || 'Chưa có email'}</Text>
					</View>
				</View>

				<View style={styles.formGroup}>
					<Text style={styles.label}>Họ và tên</Text>
					<TextInput
						style={[styles.input, !isEditing && styles.inputDisabled]}
						value={form.fullName}
						onChangeText={(text) => onChangeField('fullName', text)}
						editable={isEditing}
						placeholder="Nhập họ và tên"
					/>
				</View>

				<View style={styles.formGroup}>
					<Text style={styles.label}>Số điện thoại</Text>
					<TextInput
						style={[styles.input, !isEditing && styles.inputDisabled]}
						value={form.phone}
						onChangeText={(text) => onChangeField('phone', text)}
						editable={isEditing}
						keyboardType="phone-pad"
						placeholder="Nhập số điện thoại"
					/>
				</View>

				<View style={styles.formGroup}>
					<Text style={styles.label}>Địa chỉ nhà</Text>
					<TextInput
						style={[styles.input, !isEditing && styles.inputDisabled]}
						value={form.houseAddress}
						onChangeText={(text) => onChangeField('houseAddress', text)}
						editable={isEditing}
						placeholder="Ví dụ: 12 Nguyễn Trãi"
					/>
				</View>

				<View style={styles.formGroup}>
					<Text style={styles.label}>Tỉnh/Thành</Text>
					<TouchableOpacity
						style={[styles.selectBox, !isEditing && styles.inputDisabled]}
						onPress={() => openPicker('city')}
						activeOpacity={0.7}
					>
						<Text style={selectedCity?.name ? styles.selectText : styles.selectPlaceholder}>
							{selectedCity?.name || 'Chọn tỉnh/thành'}
						</Text>
						<Ionicons name="chevron-down" size={20} color={TEXT_SECONDARY} />
					</TouchableOpacity>
				</View>

				<View style={styles.formGroup}>
					<Text style={styles.label}>Phường/Xã</Text>
					<TouchableOpacity
						style={[styles.selectBox, !isEditing && styles.inputDisabled]}
						onPress={() => openPicker('ward')}
						activeOpacity={0.7}
					>
						<Text style={selectedWard?.name ? styles.selectText : styles.selectPlaceholder}>
							{selectedWard?.name || 'Chọn phường/xã'}
						</Text>
						<Ionicons name="chevron-down" size={20} color={TEXT_SECONDARY} />
					</TouchableOpacity>
				</View>

				<View style={styles.previewBox}>
					<Text style={styles.previewLabel}>Địa chỉ đầy đủ</Text>
					<Text style={styles.previewValue}>{composedAddress || 'Chưa có địa chỉ'}</Text>
				</View>

				{isEditing ? (
					<TouchableOpacity
						style={[
							styles.saveButton,
							(!isProfileSaveEnabled || saving) && styles.saveButtonDisabled,
						]}
						onPress={handleSave}
						activeOpacity={0.8}
						disabled={!isProfileSaveEnabled || saving}
					>
						{saving ? (
							<ActivityIndicator color={BACKGROUND_WHITE} />
						) : (
							<Text style={styles.saveButtonText}>Lưu thay đổi</Text>
						)}
					</TouchableOpacity>
				) : null}
			</ScrollView>

			<Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
				<TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPickerVisible(false)}>
					<View style={styles.modalContent} onStartShouldSetResponder={() => true}>
						<Text style={styles.modalTitle}>{pickerType === 'city' ? 'Chọn tỉnh/thành' : 'Chọn phường/xã'}</Text>
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
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: BACKGROUND_WHITE,
	},
	centerContent: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
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
	headerTitle: {
		fontSize: 18,
		fontWeight: '700',
		color: TEXT_PRIMARY,
	},
	iconButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollView: {
		flex: 1,
	},
	content: {
		paddingHorizontal: 20,
		paddingVertical: 20,
		paddingBottom: 40,
	},
	emailSection: {
		marginBottom: 18,
		padding: 12,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 10,
		backgroundColor: '#FFF9F2',
	},
	readonlyBox: {
		height: 44,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 12,
		justifyContent: 'center',
		backgroundColor: '#F3F3F3',
	},
	readonlyText: {
		fontSize: 15,
		color: TEXT_PRIMARY,
	},
	avatarContainer: {
		alignItems: 'center',
		marginBottom: 20,
	},
	avatarCircle: {
		width: 84,
		height: 84,
		borderRadius: 42,
		backgroundColor: '#EFEFEF',
		alignItems: 'center',
		justifyContent: 'center',
		overflow: 'hidden',
		marginBottom: 10,
	},
	avatarImage: {
		width: '100%',
		height: '100%',
	},
	avatarName: {
		fontSize: 18,
		fontWeight: '700',
		color: TEXT_PRIMARY,
	},
	changeAvatarButton: {
		marginBottom: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 999,
		borderWidth: 1,
		borderColor: PRIMARY_COLOR,
		backgroundColor: '#FFF7F1',
		flexDirection: 'row',
		alignItems: 'center',
		columnGap: 6,
	},
	changeAvatarButtonText: {
		fontSize: 13,
		fontWeight: '700',
		color: PRIMARY_COLOR,
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
		backgroundColor: INPUT_BACKGROUND,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 14,
		height: 48,
		color: TEXT_PRIMARY,
		fontSize: 15,
	},
	inputDisabled: {
		opacity: 0.65,
	},
	selectBox: {
		backgroundColor: INPUT_BACKGROUND,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 10,
		paddingHorizontal: 14,
		height: 48,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	selectText: {
		color: TEXT_PRIMARY,
		fontSize: 15,
	},
	selectPlaceholder: {
		color: TEXT_SECONDARY,
		fontSize: 15,
	},
	previewBox: {
		marginTop: 4,
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
	saveButton: {
		marginTop: 22,
		backgroundColor: PRIMARY_COLOR,
		borderRadius: 12,
		height: 50,
		alignItems: 'center',
		justifyContent: 'center',
	},
	saveButtonDisabled: {
		opacity: 0.7,
	},
	saveButtonText: {
		color: BACKGROUND_WHITE,
		fontSize: 16,
		fontWeight: '700',
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
