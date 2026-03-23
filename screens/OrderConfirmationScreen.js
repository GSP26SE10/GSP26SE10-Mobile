import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrderParties, setActivePartyByIndex } from '../utils/cartStorage';
import API_URL from '../constants/api';
import { getAccessToken } from '../utils/auth';
import {
  getMinPartyDateKeyVietnam,
  getMinPartyDateObject,
  isPartyStartAtLeastTwoDaysFromTodayVietnam,
  toVietnamDateKey,
} from '../utils/vietnamPartyDate';
import { BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const CITIES = require('../constants/city.json');

const formatMoney = (priceFormatted, basePrice, count = 1) => {
  if (priceFormatted) return priceFormatted;
  const val = Number(basePrice ?? 0) * Number(count ?? 1);
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(val);
  } catch (e) {
    return `${val.toLocaleString('vi-VN')} đ`;
  }
};

const formatDate = (d) =>
  d?.toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' }) || '';

const formatTime = (d) =>
  d?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) || '';

const combineDateAndTime = (datePart, timePart) => {
  const d = new Date(datePart);
  d.setHours(timePart.getHours(), timePart.getMinutes(), 0, 0);
  return d;
};

const clampNotPast = (d) => {
  const now = new Date();
  return d.getTime() < now.getTime() ? now : d;
};

export default function OrderConfirmationScreen({ navigation, route }) {
  const [orderParties, setOrderParties] = useState([]);
  const [partyIndex, setPartyIndex] = useState(Number(route?.params?.partyIndex ?? 0));
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const [eventDate, setEventDate] = useState(() => getMinPartyDateObject());
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    d.setHours(d.getHours() + 1);
    return d;
  });
  const [endTime, setEndTime] = useState(() => {
    const d = new Date();
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    d.setHours(d.getHours() + 3);
    return d;
  });

  const [addressLine, setAddressLine] = useState('');
  const [selectedCity, setSelectedCity] = useState(() => {
    const hcm = CITIES.find((c) => c.fullName === 'Thành phố Hồ Chí Minh') || CITIES[0];
    return hcm || null;
  });
  const [selectedWard, setSelectedWard] = useState(() => {
    const hcm = CITIES.find((c) => c.fullName === 'Thành phố Hồ Chí Minh') || CITIES[0];
    return hcm?.wards?.[0] || null;
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [iosPickerVisible, setIosPickerVisible] = useState(false);
  const [iosPickerType, setIosPickerType] = useState('date'); // 'date' | 'start' | 'end'

  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [selectMode, setSelectMode] = useState('city'); // 'city' | 'ward'
  const [searchQuery, setSearchQuery] = useState('');
  const [partyCategories, setPartyCategories] = useState([]);
  const [partyCategoryId, setPartyCategoryId] = useState(null);
  const [partyCategoryModalVisible, setPartyCategoryModalVisible] = useState(false);
  const [loadingPartyCategories, setLoadingPartyCategories] = useState(false);
  const [partyCategoryImageErrorMap, setPartyCategoryImageErrorMap] = useState({});
  const currentParty = (orderParties || [])[partyIndex] || (orderParties || [])[0] || null;
  const cartItems = currentParty?.items || [];

  useEffect(() => {
    // sync active party để các thao tác add-to-cart sau này rơi đúng tiệc đang xem
    if (!orderParties.length) return;
    const idx = Math.max(0, Math.min(partyIndex, orderParties.length - 1));
    setActivePartyByIndex(idx).catch(() => {});
  }, [partyIndex, orderParties.length]);


  const DRAFT_KEY = (idx) => `orderConfirmationDraft:${idx}`;

  useEffect(() => {
    (async () => {
      const parties = await getOrderParties();
      setOrderParties(parties);
    })();
  }, []);

  // Load draft (để back về vẫn giữ địa chỉ & lựa chọn)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY(partyIndex));
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (draft?.addressLine != null) setAddressLine(String(draft.addressLine));

        if (draft?.eventDate) setEventDate(new Date(draft.eventDate));
        if (draft?.startTime) setStartTime(new Date(draft.startTime));
        if (draft?.endTime) setEndTime(new Date(draft.endTime));

        if (draft?.cityCode) {
          const city = CITIES.find((c) => c.code === draft.cityCode);
          if (city) {
            setSelectedCity(city);
            if (draft?.wardCode) {
              const ward = (city.wards || []).find((w) => w.code === draft.wardCode);
              if (ward) setSelectedWard(ward);
            }
          }
        }
        setPartyCategoryId(
          draft?.partyCategoryId != null ? Number(draft.partyCategoryId) : null
        );
      } catch (e) {
        // ignore
      }
    })();
  }, [partyIndex]);

  // Save draft (debounced) whenever user changes fields
  useEffect(() => {
    const t = setTimeout(() => {
      const draft = {
        addressLine,
        eventDate: eventDate?.toISOString?.() || null,
        startTime: startTime?.toISOString?.() || null,
        endTime: endTime?.toISOString?.() || null,
        cityCode: selectedCity?.code || null,
        wardCode: selectedWard?.code || null,
        cityName: selectedCity?.fullName || '',
        wardName: selectedWard?.name || '',
        partyCategoryId: partyCategoryId != null ? Number(partyCategoryId) : null,
      };
      AsyncStorage.setItem(DRAFT_KEY(partyIndex), JSON.stringify(draft)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [addressLine, eventDate, startTime, endTime, selectedCity, selectedWard, partyCategoryId]);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub?.remove?.();
      hideSub?.remove?.();
    };
  }, []);

  const minPartyDateObj = useMemo(() => getMinPartyDateObject(), []);

  // Đồng bộ: ngày tổ chức theo lịch VN phải >= hôm nay (VN) + 2 ngày; end > start.
  useEffect(() => {
    const now = new Date();
    const minKey = getMinPartyDateKeyVietnam(now);
    const eventKey = toVietnamDateKey(eventDate);

    if (eventKey < minKey) {
      setEventDate(getMinPartyDateObject(now));
      return;
    }

    const nextStart = combineDateAndTime(eventDate, startTime);
    const safeStart = nextStart.getTime() < now.getTime() ? clampNotPast(nextStart) : nextStart;

    let safeEnd = combineDateAndTime(eventDate, endTime);
    if (safeEnd.getTime() <= safeStart.getTime()) {
      safeEnd = new Date(safeStart);
      safeEnd.setHours(safeEnd.getHours() + 2);
    }

    const startT = safeStart.getTime();
    const endT = safeEnd.getTime();

    if (startT !== startTime.getTime()) {
      setStartTime(safeStart);
      return;
    }
    if (endT !== endTime.getTime()) {
      setEndTime(safeEnd);
    }
  }, [
    eventDate.getTime(),
    startTime.getTime(),
    endTime.getTime(),
  ]);

  useEffect(() => {
    // Khi đổi thành phố thì reset ward về phần tử đầu (nếu ward hiện tại không thuộc city mới)
    if (!selectedCity) return;
    const wards = selectedCity.wards || [];
    if (!wards.length) {
      setSelectedWard(null);
      return;
    }
    if (!selectedWard || !wards.some((w) => w.code === selectedWard.code)) {
      setSelectedWard(wards[0]);
    }
  }, [selectedCity]);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, i) => sum + (i.count || 0), 0),
    [cartItems]
  );

  const openPicker = (type) => {
    if (Platform.OS === 'ios') {
      setIosPickerType(type);
      setIosPickerVisible(true);
      return;
    }
    if (type === 'date') setShowDatePicker(true);
    if (type === 'start') setShowStartPicker(true);
    if (type === 'end') setShowEndPicker(true);
  };

  const menuCount = useMemo(() => {
    // 1 party có thể có nhiều menu -> số lượng khách lấy theo MAX, không phải SUM
    const counts = (cartItems || []).filter((i) => i.type === 'menu').map((i) => Number(i.count || 0));
    const max = Math.max(...counts, 1);
    return max;
  }, [cartItems]);

  const openSelectCity = () => {
    setSelectMode('city');
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const openSelectWard = () => {
    setSelectMode('ward');
    setSearchQuery('');
    setSelectModalVisible(true);
  };

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return CITIES;
    return CITIES.filter((c) => {
      const name = `${c.name} ${c.fullName}`.toLowerCase();
      return name.includes(q);
    });
  }, [searchQuery]);

  const filteredWards = useMemo(() => {
    const wards = selectedCity?.wards || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return wards;
    return wards.filter((w) => `${w.name} ${w.fullName}`.toLowerCase().includes(q));
  }, [selectedCity, searchQuery]);

  const saveDraftNow = async () => {
    try {
      const draft = {
        addressLine,
        eventDate: eventDate?.toISOString?.() || null,
        startTime: startTime?.toISOString?.() || null,
        endTime: endTime?.toISOString?.() || null,
        cityCode: selectedCity?.code || null,
        wardCode: selectedWard?.code || null,
        cityName: selectedCity?.fullName || '',
        wardName: selectedWard?.name || '',
        partyCategoryId: partyCategoryId != null ? Number(partyCategoryId) : null,
      };
      await AsyncStorage.setItem(DRAFT_KEY(partyIndex), JSON.stringify(draft));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPartyCategories(true);
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/api/party-category?page=1&pageSize=10`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const json = await res.json().catch(() => null);
        const items = Array.isArray(json?.items) ? json.items : [];
        const activeOnly = items.filter((it) => Number(it?.status) === 1);
        if (!cancelled) setPartyCategories(activeOnly);
      } catch (_) {
        if (!cancelled) setPartyCategories([]);
      } finally {
        if (!cancelled) setLoadingPartyCategories(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPartyCategory = useMemo(
    () =>
      partyCategories.find(
        (c) => Number(c?.partyCategoryId) === Number(partyCategoryId)
      ) || null,
    [partyCategories, partyCategoryId]
  );

  const resolveCategoryImageUri = (imageUrl) => {
    if (!imageUrl || typeof imageUrl !== 'string') return null;
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;
    return `${API_URL}${imageUrl}`;
  };

  const partyStartCombined = useMemo(
    () => combineDateAndTime(eventDate, startTime),
    [eventDate, startTime],
  );
  const partyStartMeetsLeadDays = useMemo(
    () => isPartyStartAtLeastTwoDaysFromTodayVietnam(partyStartCombined),
    [partyStartCombined],
  );

  const canContinue =
    addressLine.trim().length > 0 && partyCategoryId != null && partyStartMeetsLeadDays;
  const isMultiParty = orderParties.length > 1;
  const isLastParty = partyIndex >= orderParties.length - 1;
  const continueLabel = isMultiParty && !isLastParty ? 'Tiếp theo' : 'Tiếp tục';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Đặt tiệc</Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Party dots indicator */}
          {orderParties.length > 1 && (
            <View style={styles.dotsRow}>
              {orderParties.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.dot, idx === partyIndex && styles.dotActive]}
                  onPress={() => setPartyIndex(idx)}
                  activeOpacity={0.8}
                />
              ))}
            </View>
          )}

          {/* Cart preview */}
          <View style={styles.section}>
            {cartItems.map((item) => (
              <View key={item.id} style={styles.cartRow}>
                <View style={styles.cartImageWrap}>
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.cartImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.cartImage, styles.imagePlaceholder]}>
                      <Ionicons name="image-outline" size={24} color={TEXT_SECONDARY} />
                    </View>
                  )}
                </View>
                <View style={styles.cartInfo}>
                  <Text style={styles.cartName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.cartMeta}>{item.type === 'menu' ? 'Menu' : item.type === 'dish' ? 'Món lẻ' : 'Dịch vụ'}</Text>
                  <Text style={styles.cartPrice}>{formatMoney(item.priceFormatted, item.basePrice, item.count)}</Text>
                </View>
                {(item.type === 'service' || item.type === 'dish') && (
                  <View style={styles.serviceQtyWrap}>
                    <Text style={styles.serviceQtyText}>x{item.count}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          {/* Event time */}
          <View style={styles.section}>
            <View style={styles.formRowVertical}>
              <Text style={styles.fieldLabel}>Loại tiệc</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput]}
                activeOpacity={0.7}
                onPress={() => setPartyCategoryModalVisible(true)}
              >
                <Text style={styles.selectText}>
                  {selectedPartyCategory?.partyCategoryName || 'Chọn loại tiệc'}
                </Text>
                <Ionicons name="chevron-down" size={18} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.guestRow}>
              <Text style={styles.guestLabel}>Số lượng khách:</Text>
              <Text style={styles.guestValue}>{menuCount}</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.rowItem, { marginRight: 6 }]}>
                <Text style={styles.fieldLabel}>Ngày tổ chức</Text>
                <TouchableOpacity
                  style={[styles.input, styles.selectInput]}
                  onPress={() => openPicker('date')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectText}>{formatDate(eventDate)}</Text>
                </TouchableOpacity>
                <Text style={styles.fieldHint}>
                  Ngày tổ chức phải cách hôm nay ít nhất 2 ngày.
                </Text>
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.rowItem, { marginRight: 6 }]}>
                <Text style={styles.fieldLabel}>Giờ bắt đầu</Text>
                <TouchableOpacity
                  style={[styles.input, styles.selectInput]}
                  onPress={() => openPicker('start')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectText}>{formatTime(startTime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.rowItem, { marginLeft: 6 }]}>
                <Text style={styles.fieldLabel}>Giờ kết thúc</Text>
                <TouchableOpacity
                  style={[styles.input, styles.selectInput]}
                  onPress={() => openPicker('end')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectText}>{formatTime(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={styles.section}>
            <View style={styles.formRowVertical}>
              <Text style={styles.fieldLabel}>Địa điểm</Text>
              <TextInput
                value={addressLine}
                onChangeText={setAddressLine}
                placeholder="Nhập địa chỉ (vd: 16 Nguyễn Trãi)"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.rowItem, { marginRight: 6 }]}>
                <Text style={styles.fieldLabel}>Tỉnh/Thành phố</Text>
                <TouchableOpacity
                  style={[styles.input, styles.selectInput]}
                  onPress={openSelectCity}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectText}>{selectedCity?.fullName || 'Chọn tỉnh/thành phố'}</Text>
                  <Ionicons name="chevron-down" size={18} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              </View>
              <View style={[styles.rowItem, { marginLeft: 6 }]}>
                <Text style={styles.fieldLabel}>Phường/Xã</Text>
                <TouchableOpacity
                  style={[styles.input, styles.selectInput]}
                  onPress={openSelectWard}
                  activeOpacity={0.7}
                  disabled={!selectedCity}
                >
                  <Text style={styles.selectText}>
                    {selectedWard?.name || 'Chọn phường/xã'}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Spacer để không bị che bởi bottom bar; khi mở bàn phím thì giảm để tránh khoảng trắng thừa */}
          <View style={{ height: keyboardVisible ? 16 : 140 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          
          <TouchableOpacity
            style={[styles.primaryButton, !canContinue && styles.primaryButtonDisabled]}
            activeOpacity={0.8}
            disabled={!canContinue}
            onPress={async () => {
              await saveDraftNow();
              if (isMultiParty && !isLastParty) {
                setPartyIndex((p) => Math.min(p + 1, orderParties.length - 1));
                return;
              }
              navigation.navigate('OrderSummary', {
                // giữ params hiện tại cho backward compatibility (summary sẽ đọc draft từng party từ AsyncStorage)
                eventDate: eventDate?.toISOString?.() || null,
                startTime: startTime?.toISOString?.() || null,
                endTime: endTime?.toISOString?.() || null,
                addressLine,
                city: selectedCity?.fullName || '',
                ward: selectedWard?.name || '',
                menuCount,
                partyCategoryId: partyCategoryId != null ? Number(partyCategoryId) : null,
              });
            }}
          >
            <Text style={styles.primaryButtonText}>{continueLabel}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {showDatePicker && (
        <DateTimePicker
          value={eventDate}
          mode="date"
          display="default"
          minimumDate={minPartyDateObj}
          onChange={(e, selected) => {
            setShowDatePicker(false);
            if (selected) {
              const minKey = getMinPartyDateKeyVietnam();
              const selKey = toVietnamDateKey(selected);
              setEventDate(selKey < minKey ? getMinPartyDateObject() : selected);
            }
          }}
        />
      )}

      {showStartPicker && (
        <DateTimePicker
          value={startTime}
          mode="time"
          is24Hour
          display="default"
          onChange={(e, selected) => {
            setShowStartPicker(false);
            if (selected) setStartTime(selected);
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endTime}
          mode="time"
          is24Hour
          display="default"
          onChange={(e, selected) => {
            setShowEndPicker(false);
            if (selected) setEndTime(selected);
          }}
        />
      )}

      {/* iOS inline picker in modal to avoid layout break */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosPickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIosPickerVisible(false)}
        >
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {iosPickerType === 'date'
                    ? 'Chọn ngày'
                    : iosPickerType === 'start'
                      ? 'Chọn giờ bắt đầu'
                      : 'Chọn giờ kết thúc'}
                </Text>
                <TouchableOpacity
                  onPress={() => setIosPickerVisible(false)}
                  style={styles.pickerDone}
                  activeOpacity={0.8}
                >
                  <Text style={styles.pickerDoneText}>Xong</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={
                  iosPickerType === 'date'
                    ? eventDate
                    : iosPickerType === 'start'
                      ? startTime
                      : endTime
                }
                mode={iosPickerType === 'date' ? 'date' : 'time'}
                display="spinner"
                is24Hour
                minimumDate={iosPickerType === 'date' ? minPartyDateObj : undefined}
                onChange={(e, selected) => {
                  if (!selected) return;
                  const now = new Date();
                  if (iosPickerType === 'date') {
                    const minKey = getMinPartyDateKeyVietnam(now);
                    const selKey = toVietnamDateKey(selected);
                    setEventDate(selKey < minKey ? getMinPartyDateObject(now) : selected);
                    return;
                  }
                  if (iosPickerType === 'start') {
                    const next = combineDateAndTime(eventDate, selected);
                    const safe = next.getTime() < now.getTime() ? clampNotPast(next) : next;
                    setStartTime(safe);
                    return;
                  }
                  if (iosPickerType === 'end') {
                    const next = combineDateAndTime(eventDate, selected);
                    let safe = next.getTime() < now.getTime() ? clampNotPast(next) : next;
                    if (safe.getTime() <= startTime.getTime()) {
                      safe = new Date(startTime);
                      safe.setHours(safe.getHours() + 2);
                    }
                    setEndTime(safe);
                  }
                }}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}

      <Modal
        visible={selectModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalKav}
            >
              <TouchableWithoutFeedback onPress={() => {}} accessible={false}>
                <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectMode === 'city' ? 'Chọn thành phố' : 'Chọn quận/phường'}
              </Text>
              <TouchableOpacity onPress={() => setSelectModalVisible(false)} style={styles.modalClose} activeOpacity={0.7}>
                <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={TEXT_SECONDARY} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm kiếm..."
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.searchInput}
              />
            </View>

            <ScrollView
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {(selectMode === 'city' ? filteredCities : filteredWards).map((item) => {
                const key = item.code;
                const label = selectMode === 'city' ? item.fullName : item.name;
                const isSelected =
                  selectMode === 'city'
                    ? selectedCity?.code === item.code
                    : selectedWard?.code === item.code;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.optionRow, isSelected && styles.optionRowActive]}
                    activeOpacity={0.7}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (selectMode === 'city') {
                        setSelectedCity(item);
                        setSelectedWard(item?.wards?.[0] || null);
                      } else {
                        setSelectedWard(item);
                      }
                      setSelectModalVisible(false);
                    }}
                  >
                    <Text style={[styles.optionText, isSelected && styles.optionTextActive]} numberOfLines={2}>
                      {label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={PRIMARY_COLOR} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={partyCategoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPartyCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn loại tiệc</Text>
              <TouchableOpacity
                onPress={() => setPartyCategoryModalVisible(false)}
                style={styles.modalClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
              </TouchableOpacity>
            </View>

            {loadingPartyCategories ? (
              <Text style={styles.partyCategoryHint}>Đang tải loại tiệc...</Text>
            ) : partyCategories.length === 0 ? (
              <Text style={styles.partyCategoryHint}>Không có loại tiệc khả dụng.</Text>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {partyCategories.map((item) => {
                  const id = Number(item?.partyCategoryId);
                  const isSelected = Number(partyCategoryId) === id;
                  const imageUri = resolveCategoryImageUri(item?.imageUrl);
                  const imageError = partyCategoryImageErrorMap[id] === true;
                  return (
                    <TouchableOpacity
                      key={String(id)}
                      style={[styles.partyCategoryRow, isSelected && styles.optionRowActive]}
                      activeOpacity={0.75}
                      onPress={() => {
                        setPartyCategoryId(id);
                        setPartyCategoryModalVisible(false);
                      }}
                    >
                      <View style={styles.partyCategoryImageWrap}>
                        {imageUri && !imageError ? (
                          <Image
                            source={{ uri: imageUri }}
                            style={styles.partyCategoryImage}
                            contentFit="cover"
                            onError={() =>
                              setPartyCategoryImageErrorMap((prev) => ({ ...prev, [id]: true }))
                            }
                          />
                        ) : (
                          <View style={[styles.partyCategoryImage, styles.imagePlaceholder]}>
                            <Ionicons name="image-outline" size={18} color={TEXT_SECONDARY} />
                          </View>
                        )}
                      </View>
                      <View style={styles.partyCategoryInfo}>
                        <Text style={styles.partyCategoryName} numberOfLines={1}>
                          {item?.partyCategoryName || '—'}
                        </Text>
                        <Text style={styles.partyCategoryDesc} numberOfLines={2}>
                          {item?.description || '—'}
                        </Text>
                      </View>
                      {isSelected ? (
                        <Ionicons name="checkmark-circle" size={20} color={PRIMARY_COLOR} />
                      ) : (
                        <Ionicons name="ellipse-outline" size={20} color={TEXT_SECONDARY} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerRight: {
    width: 44,
  },
  kav: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D9D9D9',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY_COLOR,
  },
  section: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  cartImageWrap: {
    width: 74,
    height: 74,
    borderRadius: 14,
    overflow: 'hidden',
    marginRight: 12,
  },
  cartImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E0E0E0',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartInfo: {
    flex: 1,
    paddingRight: 10,
  },
  cartName: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  cartMeta: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  cartPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  serviceQtyWrap: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    minWidth: 36,
  },
  serviceQtyText: {
    fontSize: 14,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },
  guestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    marginBottom: 6,
  },
  guestLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  guestValue: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  formRowVertical: {
    paddingVertical: 10,
  },
  row: {
    flexDirection: 'row',
    marginTop: 6,
  },
  rowItem: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  fieldHint: {
    marginTop: 6,
    fontSize: 11,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    lineHeight: 15,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginRight: 10,
  },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: BACKGROUND_WHITE,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    paddingHorizontal: 14,
    fontSize: 14,
    color: TEXT_PRIMARY,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalKav: {
    flex: 1,
    justifyContent: 'center',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  pickerCard: {
    backgroundColor: BACKGROUND_WHITE,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingBottom: 18,
    paddingHorizontal: 14,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  pickerDone: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  pickerDoneText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  iosPicker: {
    height: 240,
  },
  modalCard: {
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 16,
    padding: 14,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#FAFAFA',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: TEXT_PRIMARY,
    padding: 0,
  },
  modalList: {
    marginTop: 10,
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowActive: {
    backgroundColor: 'rgba(255,128,0,0.08)',
  },
  optionText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    marginRight: 10,
  },
  optionTextActive: {
    color: PRIMARY_COLOR,
  },
  partyCategoryHint: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    paddingVertical: 12,
  },
  partyCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    marginBottom: 8,
    backgroundColor: BACKGROUND_WHITE,
  },
  partyCategoryImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 10,
  },
  partyCategoryImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ECECEC',
  },
  partyCategoryInfo: {
    flex: 1,
    paddingRight: 8,
  },
  partyCategoryName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  partyCategoryDesc: {
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  bottomSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKGROUND_WHITE,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  bottomLeft: {
    flex: 1,
  },
  bottomHint: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  primaryButton: {
    flex: 1.1,
    height: 52,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 16,
    fontWeight: '700',
  },
});

