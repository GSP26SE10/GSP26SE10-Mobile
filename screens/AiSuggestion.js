import React, { useEffect, useMemo, useState } from 'react';
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Modal,
	Platform,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from '../components/Toast';
import API_URL from '../constants/api';
import {
	BACKGROUND_WHITE,
	BORDER_LIGHT,
	INPUT_BACKGROUND,
	PRIMARY_COLOR,
	TEXT_PLACEHOLDER,
	TEXT_PRIMARY,
	TEXT_SECONDARY,
} from '../constants/colors';
import { getAccessToken } from '../utils/auth';

const splitDishText = (value) =>
	String(value || '')
		.split(/[\n,]/)
		.map((item) => item.trim())
		.filter(Boolean);

const formatVnd = (value) => {
	if (value == null) return '';
	try {
		return new Intl.NumberFormat('vi-VN', {
			style: 'currency',
			currency: 'VND',
			maximumFractionDigits: 0,
		}).format(value);
	} catch {
		return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
	}
};

const formatDate = (date) => {
	if (!date) return '';
	return date.toLocaleDateString('vi-VN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});
};

const startOfDay = (date) => {
	const normalized = new Date(date);
	normalized.setHours(0, 0, 0, 0);
	return normalized;
};

const AI_SUGGESTION_HISTORY_KEY = 'aiSuggestionHistory';
const AI_SUGGESTION_HISTORY_LIMIT = 10;
let aiSuggestionHistoryCache = null;

export default function AiSuggestionScreen({ navigation }) {
	const [numberOfGuests, setNumberOfGuests] = useState('');
	const [budget, setBudget] = useState('');
	const [eventDate, setEventDate] = useState(new Date());
	const [favoriteDishes, setFavoriteDishes] = useState('');
	const [allergyDishes, setAllergyDishes] = useState('');
	const [partyCategories, setPartyCategories] = useState([]);
	const [selectedCategoryId, setSelectedCategoryId] = useState(null);
	const [showCategoryOptions, setShowCategoryOptions] = useState(false);
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [screenState, setScreenState] = useState('form');
	const [suggestionData, setSuggestionData] = useState(null);
	const [suggestionHistory, setSuggestionHistory] = useState([]);
	const [isResultModalVisible, setIsResultModalVisible] = useState(false);
	const [toastVisible, setToastVisible] = useState(false);
	const [toastMessage, setToastMessage] = useState('');

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`${API_URL}/api/party-category?page=1&pageSize=10`);
				const json = await res.json().catch(() => null);
				const categories = Array.isArray(json?.items) ? json.items : [];
				if (cancelled) return;
				setPartyCategories(categories);
				if (categories.length > 0) {
					setSelectedCategoryId(categories[0].partyCategoryId);
				}
			} catch (error) {
				if (!cancelled) {
					setToastMessage('Không tải được loại tiệc, vui lòng thử lại');
					setToastVisible(true);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				if (Array.isArray(aiSuggestionHistoryCache)) {
					if (!cancelled) setSuggestionHistory(aiSuggestionHistoryCache);
					return;
				}

				const raw = await AsyncStorage.getItem(AI_SUGGESTION_HISTORY_KEY);
				const parsed = raw ? JSON.parse(raw) : [];
				const safeHistory = Array.isArray(parsed) ? parsed : [];
				aiSuggestionHistoryCache = safeHistory;
				if (!cancelled) setSuggestionHistory(safeHistory);
			} catch (error) {
				if (!cancelled) setSuggestionHistory([]);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const selectedCategory = useMemo(
		() =>
			partyCategories.find(
				(category) => Number(category.partyCategoryId) === Number(selectedCategoryId)
			) || null,
		[partyCategories, selectedCategoryId]
	);

	const normalizedToday = useMemo(() => startOfDay(new Date()), []);
	const isPastEventDate = useMemo(
		() => startOfDay(eventDate).getTime() < normalizedToday.getTime(),
		[eventDate, normalizedToday]
	);

	const isFormValid = useMemo(() => {
		const guests = Number(String(numberOfGuests).trim());
		const budgetValue = Number(String(budget).trim());

		return (
			String(numberOfGuests || '').trim().length > 0 &&
			String(budget || '').trim().length > 0 &&
			String(favoriteDishes || '').trim().length > 0 &&
			String(allergyDishes || '').trim().length > 0 &&
			Number.isFinite(guests) &&
			guests > 0 &&
			Number.isFinite(budgetValue) &&
			budgetValue > 0 &&
			!!selectedCategoryId &&
			!isPastEventDate
		);
	}, [numberOfGuests, budget, favoriteDishes, allergyDishes, selectedCategoryId, isPastEventDate]);

	const resetToForm = () => {
		setScreenState('form');
		setSuggestionData(null);
		setIsResultModalVisible(false);
		setIsSubmitting(false);
	};

	const handleViewMenuDetail = () => {
		if (!suggestionData?.menuId) {
			setToastMessage('Không có menu để xem chi tiết');
			setToastVisible(true);
			return;
		}

		setIsResultModalVisible(false);
		navigation.navigate('MenuDetail', {
			menuId: suggestionData.menuId,
			menuName: suggestionData.menuName,
			buffetType: 'AI gợi ý',
			fromAiSuggestion: true,
		});
	};

	const saveHistory = async (nextHistory) => {
		aiSuggestionHistoryCache = nextHistory;
		setSuggestionHistory(nextHistory);
		try {
			await AsyncStorage.setItem(AI_SUGGESTION_HISTORY_KEY, JSON.stringify(nextHistory));
		} catch (error) {
			console.log('[AI Suggestion] Save history error:', error?.message || error);
		}
	};

	const handleOpenHistoryDetail = (item) => {
		setSuggestionData(item);
		setIsResultModalVisible(true);
	};

	const handleSubmit = async () => {
		if (isSubmitting) return;

		const guests = Number(String(numberOfGuests).trim());
		const budgetValue = Number(String(budget).trim());
		const favoriteText = String(favoriteDishes || '').trim();
		const allergyText = String(allergyDishes || '').trim();

		if (!String(numberOfGuests || '').trim() || !String(budget || '').trim() || !favoriteText || !allergyText) {
			setToastMessage('Vui lòng nhập đầy đủ thông tin');
			setToastVisible(true);
			return;
		}

		if (!Number.isFinite(guests) || guests <= 0) {
			setToastMessage('Vui lòng nhập số khách hợp lệ');
			setToastVisible(true);
			return;
		}

		if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
			setToastMessage('Vui lòng nhập ngân sách hợp lệ');
			setToastVisible(true);
			return;
		}

		if (!selectedCategoryId) {
			setToastMessage('Vui lòng chọn loại tiệc');
			setToastVisible(true);
			return;
		}

		if (isPastEventDate) {
			setToastMessage('Ngày sự kiện không được ở trong quá khứ');
			setToastVisible(true);
			return;
		}

		const payload = {
			numberOfGuests: guests,
			budget: budgetValue,
			partyCategoryId: Number(selectedCategoryId),
			eventDate: eventDate.toISOString(),
			favoriteDishes: splitDishText(favoriteText),
			allergyDishes: splitDishText(allergyText),
		};

		console.log('[AI Suggestion] Submit payload:', payload);

		setIsSubmitting(true);
		setScreenState('thinking');

		try {
			const token = await getAccessToken();
			const res = await fetch(`${API_URL}/api/menu-suggestion/ai-suggest`, {
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

			if (!res.ok || json?.success === false) {
				throw new Error(json?.message || 'Không lấy được gợi ý từ AI');
			}

			console.log('[AI Suggestion] API response:', json);

			const latestSuggestion = json?.data || null;
			setSuggestionData(latestSuggestion);
			if (latestSuggestion) {
				const historyItem = {
					menuId: latestSuggestion.menuId,
					menuName: latestSuggestion.menuName,
					imgUrl: latestSuggestion.imgUrl,
					basePrice: latestSuggestion.basePrice,
					reason: latestSuggestion.reason,
					title: latestSuggestion.title,
					createdAt: new Date().toISOString(),
				};

				const currentHistory = Array.isArray(aiSuggestionHistoryCache)
					? aiSuggestionHistoryCache
					: suggestionHistory;
				const merged = [historyItem, ...(Array.isArray(currentHistory) ? currentHistory : [])];
				const deduplicated = merged.filter(
					(item, index, arr) =>
						index ===
						arr.findIndex(
							(compare) =>
								Number(compare.menuId) === Number(item.menuId) && compare.reason === item.reason
						)
				);
				const limitedHistory = deduplicated.slice(0, AI_SUGGESTION_HISTORY_LIMIT);
				await saveHistory(limitedHistory);
			}
			setScreenState('form');
			setIsResultModalVisible(true);
		} catch (error) {
			console.log('[AI Suggestion] API error:', error?.message || error);
			setScreenState('error');
			setToastMessage(error?.message || 'Có lỗi xảy ra, vui lòng thử lại');
			setToastVisible(true);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
			<Toast
				message={toastMessage}
				visible={toastVisible}
				onHide={() => setToastVisible(false)}
			/>

			<View style={styles.header}>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					style={styles.backButton}
					activeOpacity={0.75}
				>
					<Ionicons name="chevron-back" size={26} color={TEXT_PRIMARY} />
				</TouchableOpacity>
				<Text style={styles.headerTitle}>AI gợi ý món</Text>
				<View style={styles.backButton} />
			</View>

			{screenState === 'form' && (
				<KeyboardAvoidingView
					style={styles.keyboardWrap}
					behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				>
					<ScrollView
						style={styles.scrollView}
						contentContainerStyle={styles.content}
						keyboardShouldPersistTaps="handled"
					>
						<Text style={styles.sectionHint}>
							Nhập thông tin để AI đưa ra đề xuất phù hợp.
						</Text>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Số khách</Text>
							<TextInput
								style={styles.input}
								value={numberOfGuests}
								onChangeText={setNumberOfGuests}
								keyboardType="number-pad"
								placeholder="Ví dụ: 50"
								placeholderTextColor={TEXT_PLACEHOLDER}
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Ngân sách (VNĐ)</Text>
							<TextInput
								style={styles.input}
								value={budget}
								onChangeText={setBudget}
								keyboardType="number-pad"
								placeholder="Ví dụ: 500000"
								placeholderTextColor={TEXT_PLACEHOLDER}
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Loại tiệc</Text>
							<TouchableOpacity
								style={styles.selectBox}
								activeOpacity={0.75}
								onPress={() => setShowCategoryOptions((prev) => !prev)}
							>
								<Text
									style={[
										styles.selectText,
										!selectedCategory?.partyCategoryName && styles.selectTextPlaceholder,
									]}
								>
									{selectedCategory?.partyCategoryName || 'Chọn loại tiệc'}
								</Text>
								<Ionicons
									name={showCategoryOptions ? 'chevron-up' : 'chevron-down'}
									size={18}
									color={TEXT_SECONDARY}
								/>
							</TouchableOpacity>

							{showCategoryOptions && (
								<View style={styles.dropdownWrap}>
									{partyCategories.map((item) => {
										const isSelected = Number(item.partyCategoryId) === Number(selectedCategoryId);
										return (
											<TouchableOpacity
												key={item.partyCategoryId}
												style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
												activeOpacity={0.8}
												onPress={() => {
													setSelectedCategoryId(item.partyCategoryId);
													setShowCategoryOptions(false);
												}}
											>
												<Text style={[styles.dropdownText, isSelected && styles.dropdownTextSelected]}>
													{item.partyCategoryName}
												</Text>
											</TouchableOpacity>
										);
									})}
								</View>
							)}
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Ngày diễn ra sự kiện</Text>
							<TouchableOpacity
								style={styles.selectBox}
								activeOpacity={0.75}
								onPress={() => {
									setShowCategoryOptions(false);
									setShowDatePicker(true);
								}}
							>
								<Text style={styles.selectText}>{formatDate(eventDate)}</Text>
								<Ionicons name="calendar-outline" size={18} color={TEXT_SECONDARY} />
							</TouchableOpacity>
							{isPastEventDate && (
								<Text style={styles.fieldError}>Ngày sự kiện không được ở trong quá khứ</Text>
							)}
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Món ưa thích</Text>
							<TextInput
								style={[styles.input, styles.multilineInput]}
								value={favoriteDishes}
								onChangeText={setFavoriteDishes}
								placeholder="Ví dụ: thịt bò, nước cam"
								placeholderTextColor={TEXT_PLACEHOLDER}
								multiline
							/>
						</View>

						<View style={styles.formGroup}>
							<Text style={styles.label}>Món dị ứng</Text>
							<TextInput
								style={[styles.input, styles.multilineInput]}
								value={allergyDishes}
								onChangeText={setAllergyDishes}
								placeholder="Ví dụ: đậu phộng"
								placeholderTextColor={TEXT_PLACEHOLDER}
								multiline
							/>
						</View>

						<TouchableOpacity
							style={[
								styles.submitButton,
								(isSubmitting || !isFormValid) && styles.submitButtonDisabled,
							]}
							activeOpacity={0.82}
							onPress={handleSubmit}
							disabled={isSubmitting || !isFormValid}
						>
							<Text style={styles.submitButtonText}>Gửi AI gợi ý</Text>
						</TouchableOpacity>

						<View style={styles.historySection}>
							<Text style={styles.historyTitle}>Lịch sử gợi ý</Text>
							{suggestionHistory.length === 0 ? (
								<Text style={styles.historyEmptyText}>Chưa có lịch sử gợi ý nào</Text>
							) : (
								suggestionHistory.map((item, index) => (
									<TouchableOpacity
										key={`${item.menuId || 'menu'}-${item.createdAt || index}`}
										style={styles.historyCard}
										activeOpacity={0.85}
										onPress={() => handleOpenHistoryDetail(item)}
									>
										{!!item.imgUrl ? (
											<Image
												source={{ uri: item.imgUrl }}
												style={styles.historyImage}
												contentFit="cover"
												cachePolicy="disk"
											/>
										) : (
											<View style={[styles.historyImage, styles.historyImagePlaceholder]}>
												<Ionicons name="image-outline" size={18} color={TEXT_SECONDARY} />
											</View>
										)}
										<View style={styles.historyInfo}>
											<Text style={styles.historyMenuName} numberOfLines={1}>
												{item.menuName || item.title || 'Menu đề xuất'}
											</Text>
											<Text style={styles.historyPrice}>{formatVnd(item.basePrice)}</Text>
											<Text style={styles.historyReason} numberOfLines={2}>
												{item.reason || 'Không có lý do chi tiết'}
											</Text>
										</View>
									</TouchableOpacity>
								))
							)}
						</View>
					</ScrollView>
				</KeyboardAvoidingView>
			)}

			{screenState === 'thinking' && (
				<View style={styles.stateWrap}>
					<View style={styles.thinkingBubble}>
						<ActivityIndicator size="small" color={PRIMARY_COLOR} />
						<Text style={styles.thinkingTitle}>AI đang trả lời...</Text>
						<Text style={styles.thinkingDesc}>
							Hệ thống đang phân tích nhu cầu của bạn để chọn combo phù hợp.
						</Text>
					</View>
				</View>
			)}

			{screenState === 'error' && (
				<View style={styles.stateWrap}>
					<View style={styles.errorCard}>
						<Ionicons name="alert-circle-outline" size={28} color="#D23A3A" />
						<Text style={styles.errorTitle}>Không thể lấy gợi ý AI</Text>
						<Text style={styles.errorDesc}>Vui lòng kiểm tra thông tin rồi thử lại.</Text>
						<TouchableOpacity style={styles.secondaryButton} activeOpacity={0.82} onPress={resetToForm}>
							<Text style={styles.secondaryButtonText}>Thử lại</Text>
						</TouchableOpacity>
					</View>
				</View>
			)}

			<Modal
				visible={isResultModalVisible && !!suggestionData}
				transparent
				animationType="fade"
				onRequestClose={() => setIsResultModalVisible(false)}
			>
				<View style={styles.resultModalBackdrop}>
					<View style={styles.resultModalCard}>
						<View style={styles.resultBadge}>
							<Ionicons name="sparkles" size={16} color={PRIMARY_COLOR} />
							<Text style={styles.resultBadgeText}>AI đã gợi ý xong</Text>
						</View>

						{!!suggestionData?.imgUrl && (
							<Image
								source={{ uri: suggestionData.imgUrl }}
								style={styles.resultImage}
								contentFit="cover"
								cachePolicy="disk"
							/>
						)}

						<Text style={styles.resultTitle}>
							{suggestionData?.menuName || suggestionData?.title || 'Menu đề xuất'}
						</Text>
						<Text style={styles.resultPrice}>{formatVnd(suggestionData?.basePrice)}</Text>
						{!!suggestionData?.reason && <Text style={styles.resultReason}>{suggestionData.reason}</Text>}

						<View style={styles.resultButtonsRow}>
							<TouchableOpacity
								style={styles.modalCloseButton}
								activeOpacity={0.82}
								onPress={() => setIsResultModalVisible(false)}
							>
								<Text style={styles.modalCloseButtonText}>Đóng</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={styles.modalViewDetailButton}
								activeOpacity={0.82}
								onPress={handleViewMenuDetail}
							>
								<Text style={styles.modalViewDetailButtonText}>Xem chi tiết</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

			{showDatePicker && (
				<View style={styles.pickerOverlay}>
					<View style={styles.pickerCard}>
						<DateTimePicker
							value={eventDate}
							mode="date"
							display={Platform.OS === 'ios' ? 'inline' : 'default'}
							minimumDate={normalizedToday}
							onChange={(event, selectedDate) => {
								if (event?.type === 'dismissed') {
									setShowDatePicker(false);
									return;
								}

								if (selectedDate) {
									setEventDate(selectedDate);
									setShowDatePicker(false);
								}
							}}
						/>
					</View>
				</View>
			)}
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
		justifyContent: 'center',
		alignItems: 'center',
	},
	headerTitle: {
		flex: 1,
		textAlign: 'center',
		fontSize: 18,
		fontWeight: '800',
		color: TEXT_PRIMARY,
	},
	keyboardWrap: {
		flex: 1,
	},
	scrollView: {
		flex: 1,
	},
	content: {
		paddingHorizontal: 16,
		paddingVertical: 14,
		paddingBottom: 28,
	},
	sectionHint: {
		fontSize: 13,
		color: TEXT_SECONDARY,
		marginBottom: 14,
		lineHeight: 19,
	},
	formGroup: {
		marginBottom: 14,
	},
	label: {
		fontSize: 14,
		fontWeight: '700',
		color: TEXT_PRIMARY,
		marginBottom: 8,
	},
	input: {
		height: 48,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		backgroundColor: INPUT_BACKGROUND,
		paddingHorizontal: 12,
		fontSize: 14,
		color: TEXT_PRIMARY,
	},
	multilineInput: {
		minHeight: 88,
		height: 88,
		textAlignVertical: 'top',
		paddingTop: 12,
	},
	selectBox: {
		minHeight: 48,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		backgroundColor: INPUT_BACKGROUND,
		paddingHorizontal: 12,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	selectText: {
		fontSize: 14,
		color: TEXT_PRIMARY,
		flex: 1,
		marginRight: 8,
	},
	selectTextPlaceholder: {
		color: TEXT_PLACEHOLDER,
	},
	dropdownWrap: {
		marginTop: 8,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: BACKGROUND_WHITE,
	},
	dropdownItem: {
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderBottomWidth: 1,
		borderBottomColor: '#F2F2F2',
	},
	dropdownItemSelected: {
		backgroundColor: '#FDF1E9',
	},
	dropdownText: {
		fontSize: 14,
		color: TEXT_PRIMARY,
	},
	dropdownTextSelected: {
		color: PRIMARY_COLOR,
		fontWeight: '700',
	},
	submitButton: {
		marginTop: 6,
		height: 48,
		borderRadius: 12,
		backgroundColor: PRIMARY_COLOR,
		alignItems: 'center',
		justifyContent: 'center',
	},
	submitButtonDisabled: {
		backgroundColor: '#D9D9D9',
	},
	submitButtonText: {
		fontSize: 15,
		fontWeight: '700',
		color: BACKGROUND_WHITE,
	},
	historySection: {
		marginTop: 18,
	},
	historyTitle: {
		fontSize: 16,
		fontWeight: '800',
		color: TEXT_PRIMARY,
		marginBottom: 10,
	},
	historyEmptyText: {
		fontSize: 13,
		color: TEXT_SECONDARY,
		fontStyle: 'italic',
	},
	historyCard: {
		flexDirection: 'row',
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 12,
		padding: 10,
		marginBottom: 10,
		backgroundColor: BACKGROUND_WHITE,
	},
	historyImage: {
		width: 68,
		height: 68,
		borderRadius: 10,
		backgroundColor: '#F0F0F0',
	},
	historyImagePlaceholder: {
		justifyContent: 'center',
		alignItems: 'center',
	},
	historyInfo: {
		flex: 1,
		marginLeft: 10,
	},
	historyMenuName: {
		fontSize: 14,
		fontWeight: '800',
		color: TEXT_PRIMARY,
		marginBottom: 2,
	},
	historyPrice: {
		fontSize: 13,
		fontWeight: '700',
		color: PRIMARY_COLOR,
		marginBottom: 4,
	},
	historyReason: {
		fontSize: 12,
		lineHeight: 17,
		color: TEXT_SECONDARY,
	},
	fieldError: {
		marginTop: 6,
		fontSize: 12,
		color: '#D23A3A',
		fontWeight: '600',
	},
	pickerOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.2)',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 16,
	},
	pickerCard: {
		width: '100%',
		borderRadius: 14,
		backgroundColor: BACKGROUND_WHITE,
		padding: 8,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
	},
	stateWrap: {
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 16,
	},
	thinkingBubble: {
		width: '100%',
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		borderRadius: 16,
		backgroundColor: '#FFF7F1',
		paddingHorizontal: 16,
		paddingVertical: 18,
		alignItems: 'center',
	},
	thinkingTitle: {
		marginTop: 10,
		fontSize: 16,
		fontWeight: '800',
		color: TEXT_PRIMARY,
	},
	thinkingDesc: {
		marginTop: 8,
		fontSize: 13,
		lineHeight: 19,
		textAlign: 'center',
		color: TEXT_SECONDARY,
	},
	resultModalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'center',
		alignItems: 'center',
		paddingHorizontal: 16,
	},
	resultModalCard: {
		width: '100%',
		maxWidth: 420,
		borderRadius: 16,
		padding: 14,
		backgroundColor: BACKGROUND_WHITE,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
	},
	resultBadge: {
		flexDirection: 'row',
		alignItems: 'center',
		alignSelf: 'flex-start',
		borderRadius: 20,
		paddingHorizontal: 10,
		paddingVertical: 6,
		backgroundColor: '#FDF1E9',
		marginBottom: 12,
		gap: 6,
	},
	resultBadgeText: {
		fontSize: 12,
		fontWeight: '700',
		color: PRIMARY_COLOR,
	},
	resultImage: {
		width: '100%',
		height: 220,
		borderRadius: 16,
		backgroundColor: '#F0F0F0',
		marginBottom: 12,
	},
	resultTitle: {
		fontSize: 18,
		fontWeight: '800',
		color: TEXT_PRIMARY,
		marginBottom: 10,
		lineHeight: 26,
	},
	resultPrice: {
		fontSize: 16,
		fontWeight: '700',
		color: PRIMARY_COLOR,
		marginBottom: 10,
	},
	resultReason: {
		fontSize: 14,
		lineHeight: 22,
		color: TEXT_PRIMARY,
		marginBottom: 14,
	},
	resultButtonsRow: {
		flexDirection: 'row',
		gap: 10,
	},
	modalCloseButton: {
		flex: 1,
		height: 44,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: BORDER_LIGHT,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: '#F5F5F5',
	},
	modalCloseButtonText: {
		fontSize: 14,
		fontWeight: '700',
		color: TEXT_PRIMARY,
	},
	modalViewDetailButton: {
		flex: 1,
		height: 44,
		borderRadius: 12,
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: PRIMARY_COLOR,
	},
	modalViewDetailButtonText: {
		fontSize: 14,
		fontWeight: '700',
		color: BACKGROUND_WHITE,
	},
	secondaryButton: {
		height: 44,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: PRIMARY_COLOR,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 14,
	},
	secondaryButtonText: {
		fontSize: 14,
		fontWeight: '700',
		color: PRIMARY_COLOR,
	},
	errorCard: {
		width: '100%',
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#F1D2D2',
		backgroundColor: '#FFF8F8',
		padding: 16,
		alignItems: 'center',
	},
	errorTitle: {
		marginTop: 8,
		fontSize: 16,
		fontWeight: '800',
		color: TEXT_PRIMARY,
	},
	errorDesc: {
		marginTop: 6,
		marginBottom: 14,
		fontSize: 13,
		color: TEXT_SECONDARY,
		textAlign: 'center',
	},
});
