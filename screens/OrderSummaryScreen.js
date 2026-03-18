import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../constants/api';
import { getAccessToken } from '../utils/auth';
import { getOrderParties, clearCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_PRIMARY, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const formatVnd = (value) => {
  const val = Number(value ?? 0);
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

const formatTimeRange = (startIso, endIso) => {
  if (!startIso || !endIso) return '';
  const start = new Date(startIso);
  const end = new Date(endIso);
  const time = (d) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const date = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  return `${time(start)} – ${time(end)} ${date(start)}`;
};

export default function OrderSummaryScreen({ navigation, route }) {
  const params = route?.params || {};
  const [orderParties, setOrderParties] = useState([]);
  const [partyDrafts, setPartyDrafts] = useState({});
  const [termsChecked, setTermsChecked] = useState(false);
  const [termsVisible, setTermsVisible] = useState(false);
  const [calendarPromptVisible, setCalendarPromptVisible] = useState(false);
  const [mapsPromptVisible, setMapsPromptVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [paymentSuccessVisible, setPaymentSuccessVisible] = useState(false);
  const timerRef = useRef(null);
  const paymentPollRef = useRef(null);

  useEffect(() => {
    (async () => {
      const parties = await getOrderParties();
      setOrderParties(parties);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const out = {};
        for (let i = 0; i < (orderParties || []).length; i++) {
          const raw = await AsyncStorage.getItem(`orderConfirmationDraft:${i}`);
          if (!raw) continue;
          const d = JSON.parse(raw);
          out[i] = d;
        }
        setPartyDrafts(out);
      } catch {
        setPartyDrafts({});
      }
    })();
  }, [orderParties]);

  const partiesPricing = useMemo(() => {
    return (orderParties || []).map((p, index) => {
      const items = p.items || [];
      const menuItems = items.filter((i) => i.type === 'menu');
      const serviceItems = items.filter((i) => i.type === 'service');
      // 1 party có thể có nhiều menu -> số lượng khách lấy theo MAX, không phải SUM
      const menuCount = Math.max(...menuItems.map((i) => Number(i.count ?? 0)), 1);
      const menuBaseSum = menuItems.reduce((sum, i) => sum + Number(i.basePrice ?? 0), 0);
      const serviceSum = serviceItems.reduce(
        (sum, i) => sum + Number(i.basePrice ?? 0) * Number(i.count ?? 0),
        0
      );
      const subTotal = menuBaseSum * menuCount + serviceSum;
      const hasMenu = !!menuItems.find((m) => m.menuId);
      return { index, partyId: p.partyId, items, menuItems, serviceItems, hasMenu, menuCount, menuBaseSum, serviceSum, subTotal };
    });
  }, [orderParties]);

  const subTotal = useMemo(
    () => partiesPricing.filter((p) => p.hasMenu).reduce((sum, p) => sum + Number(p.subTotal ?? 0), 0),
    [partiesPricing]
  );
  const vat = Math.round(subTotal * 0.1);
  const total = subTotal + vat;
  const deposit = Math.round(total * 0.5);
  const payLater = total - deposit;

  const locationText = [params.addressLine, params.ward, params.city].filter(Boolean).join(', ');
  const timeText = formatTimeRange(params.startTime, params.endTime);

  const saveQrToLibrary = async () => {
    try {
      if (!qrData?.qrUrl) return;
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        setToastMessage('Không có quyền truy cập thư viện ảnh');
        setToastVisible(true);
        return;
      }
      const fileUri = FileSystem.cacheDirectory + `bookfet-qr-${Date.now()}.png`;
      const download = await FileSystem.downloadAsync(qrData.qrUrl, fileUri);
      await MediaLibrary.saveToLibraryAsync(download.uri);
      setToastMessage('Đã lưu mã QR vào thư viện');
      setToastVisible(true);
    } catch (e) {
      console.log('[qr/save-library] error', e);
      setToastMessage('Lưu mã QR thất bại');
      setToastVisible(true);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (paymentPollRef.current) {
        clearInterval(paymentPollRef.current);
        paymentPollRef.current = null;
      }
    };
  }, []);

  const startCountdown = () => {
    setSecondsLeft(120);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    if (!qrVisible) return;
    if (secondsLeft !== 0) return;
    setToastMessage('Đặt cọc thất bại');
    setToastVisible(true);
    // test: tự về Home khi hết hạn
    const t = setTimeout(() => {
      setQrVisible(false);
      navigation.navigate('Home');
    }, 1200);
    return () => clearTimeout(t);
  }, [secondsLeft, qrVisible, navigation]);

  const mmss = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const createDepositQr = async (orderId, token) => {
    const url = `${API_URL}/api/payment/create-deposit-qr/${orderId}`;
    const headers = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const tryOnce = async (method) => {
      const res = await fetch(url, { method, headers });
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch (e) {
        json = { raw: text };
      }
      console.log(`[payment/create-deposit-qr] method ${method} status`, res.status);
      console.log(`[payment/create-deposit-qr] method ${method} raw`, text);
      console.log(`[payment/create-deposit-qr] method ${method} json`, json);
      return { res, json };
    };

    // Backend thường dùng POST cho "create"
    let out = await tryOnce('POST');
    if (out.res.status === 405) {
      out = await tryOnce('GET');
    }

    if (!out.res.ok || !out.json?.success) {
      throw new Error(out.json?.message || 'Failed to create QR');
    }
    return out.json?.data;
  };

  const startPaymentPolling = (orderId, token) => {
    if (!orderId) return;

    if (paymentPollRef.current) {
      clearInterval(paymentPollRef.current);
      paymentPollRef.current = null;
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const poll = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/payment?OrderId=${orderId}&page=1&pageSize=1`,
          { headers },
        );
        const json = await res.json();
        const payment = json?.items?.[0];
        // Backend đang trả paymentStatus dạng number (vd: 2), không phải chuỗi 'PAID'
        const isPaid =
          payment &&
          (payment.paymentStatus === 2 ||
            payment.paymentStatus === '2' ||
            payment.paymentStatus === 'PAID');
        if (isPaid) {
          if (paymentPollRef.current) {
            clearInterval(paymentPollRef.current);
            paymentPollRef.current = null;
          }
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setQrVisible(false);
          setPaymentSuccessVisible(true);
        // Clear cart on successful payment
        try {
          await clearCart();
        } catch (e) {
          console.log('[cart/clear] error', e);
        }
        }
      } catch (e) {
        console.log('[payment/poll] error', e);
      }
    };

    // Gọi ngay 1 lần, sau đó lặp lại
    poll();
    paymentPollRef.current = setInterval(poll, 2000);
  };

  const createOrder = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const token = await getAccessToken();
      const userDataRaw = await AsyncStorage.getItem('userData');
      const userData = userDataRaw ? JSON.parse(userDataRaw) : null;
      const customerId = userData?.userId ?? 0;

      const partiesAll = orderParties || [];
      const itemsPayload = [];
      for (let originalIndex = 0; originalIndex < partiesAll.length; originalIndex++) {
        const p = partiesAll[originalIndex];
        const partyItems = p.items || [];
        const menu = partyItems.find((i) => i.type === 'menu');
        const menuId = menu?.menuId ?? 0;
        if (!menuId) continue; // bỏ qua tiệc chưa chọn menu
        const menuCounts = partyItems.filter((i) => i.type === 'menu').map((i) => Number(i.count ?? 0));
        const numberOfGuests = Math.max(...menuCounts, 1);
        const services = partyItems
          .filter((i) => i.type === 'service')
          .map((s) => ({
            serviceId: s.serviceId ?? 0,
            quantity: Number(s.count ?? 0),
          }))
          .filter((s) => s.serviceId && s.quantity > 0);

        // Draft theo partyIndex
        const draftKey = `orderConfirmationDraft:${originalIndex}`;
        const rawDraft = await AsyncStorage.getItem(draftKey);
        const draft = rawDraft ? JSON.parse(rawDraft) : null;
        const address = [draft?.addressLine, draft?.wardName, draft?.cityName]
          .filter(Boolean)
          .join(', ');
        const startTime = draft?.startTime || params.startTime || null;
        const endTime = draft?.endTime || params.endTime || null;

        itemsPayload.push({
          menuId,
          partyCategoryId: 0,
          numberOfGuests,
          address: address || '',
          startTime,
          endTime,
          services,
        });
      }

      const payload = { customerId, items: itemsPayload };
      console.log('[order/create] payload', JSON.stringify(payload, null, 2));

      const res = await fetch(`${API_URL}/api/order/create`, {
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
      } catch (e) {
        json = { raw: text };
      }

      console.log('[order/create] status', res.status);
      console.log('[order/create] response', json);

      const orderId = json?.data;
      if (res.ok && json?.success && orderId) {
        setCreatedOrderId(orderId);
        const data = await createDepositQr(orderId, token);
        setQrData(data);
        setQrVisible(true);
        startCountdown();
        startPaymentPolling(orderId, token);
      }
    } catch (e) {
      console.log('[order/create] error', e);
    } finally {
      setCreating(false);
    }
  };

  const openGoogleCalendar = async () => {
    try {
      const startIso = params.startTime;
      const endIso = params.endTime;
      if (!startIso || !endIso) return;
      const start = new Date(startIso);
      const end = new Date(endIso);
      const toGCal = (d) =>
        d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
      const dates = `${toGCal(start)}/${toGCal(end)}`;
      const details = `Đặt tiệc${locationText ? `\\nĐịa điểm: ${locationText}` : ''}`;
      const url =
        `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent('Đặt tiệc')}` +
        `&dates=${encodeURIComponent(dates)}` +
        `&details=${encodeURIComponent(details)}` +
        (locationText ? `&location=${encodeURIComponent(locationText)}` : '');
      await Linking.openURL(url);
    } catch (e) {
      // ignore
    }
  };

  const openGoogleMaps = async () => {
    try {
      if (!locationText) return;
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`;
      await Linking.openURL(url);
    } catch (e) {
      // ignore
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
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tóm tắt đơn hàng</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryBlock}>
          {partiesPricing
            .filter((p) => p.hasMenu)
            .map((p, displayIdx, arr) => {
              const draft = partyDrafts[p.index] || {};
              const partyLocation = [draft.addressLine, draft.wardName, draft.cityName].filter(Boolean).join(', ');
              const partyTime = formatTimeRange(draft.startTime, draft.endTime);
              return (
                <View key={p.partyId || String(p.index)} style={styles.partySummarySection}>
                  {p.menuItems.map((m) => (
                    <View key={m.id} style={styles.summaryRow}>
                      <Text style={styles.summaryPrefix}>＋</Text>
                      <Text style={styles.summaryText} numberOfLines={2}>
                        <Text style={styles.summaryBold}>Menu:</Text> {m.name} x{p.menuCount}
                      </Text>
                    </View>
                  ))}

                  {p.serviceItems.map((s) => (
                    <View key={s.id} style={styles.summaryRow}>
                      <Text style={styles.summaryPrefix}>＋</Text>
                      <Text style={styles.summaryText} numberOfLines={2}>
                        <Text style={styles.summaryBold}>Dịch vụ:</Text> {s.name} x{s.count}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.summaryRow}>
                    <Ionicons name="time-outline" size={16} color={TEXT_SECONDARY} style={styles.iconLeft} />
                    <Text style={styles.summaryText}>
                      <Text style={styles.summaryBold}>Thời gian:</Text>{' '}
                      <Text style={styles.inlineLink} onPress={() => setCalendarPromptVisible(true)}>
                        {partyTime}
                      </Text>
                    </Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Ionicons name="location-outline" size={16} color={TEXT_SECONDARY} style={styles.iconLeft} />
                    <Text style={styles.summaryText}>
                      <Text style={styles.summaryBold}>Địa điểm:</Text>{' '}
                      <Text style={styles.inlineLink} onPress={() => setMapsPromptVisible(true)}>
                        {partyLocation}
                      </Text>
                    </Text>
                  </View>

                  {displayIdx !== arr.length - 1 && <View style={styles.partyDivider} />}
                </View>
              );
            })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Phương thức thanh toán cọc:</Text>
          <View style={styles.payRow}>
            <View style={styles.radioOuter}>
              <View style={styles.radioInner} />
            </View>
            <Text style={styles.payText}>Chuyển khoản ngân hàng</Text>
            <Image
              source={require('../assets/logo-vietqr.webp')}
              style={styles.vietqrLogo}
              contentFit="contain"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tổng tiền đơn</Text>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Tạm tính:</Text>
            <Text style={styles.lineValue}>{formatVnd(subTotal)}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Thuế VAT (10%):</Text>
            <Text style={styles.lineValue}>{formatVnd(vat)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.lineRow}>
            <Text style={styles.totalLabel}>Tổng tiền đơn:</Text>
            <Text style={styles.totalValue}>{formatVnd(total)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin đặt cọc</Text>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Đặt cọc (50%):</Text>
            <Text style={styles.lineValue}>{formatVnd(deposit)}</Text>
          </View>
          <View style={styles.lineRow}>
            <Text style={styles.lineLabel}>Thanh toán sau:</Text>
            <Text style={styles.lineValue}>{formatVnd(payLater)}</Text>
          </View>
        </View>

        <View style={styles.termsRow}>
          <TouchableOpacity
            style={[styles.checkbox, termsChecked && styles.checkboxChecked]}
            onPress={() => setTermsChecked((v) => !v)}
            activeOpacity={0.8}
          >
            {termsChecked && <Ionicons name="checkmark" size={16} color={BACKGROUND_WHITE} />}
          </TouchableOpacity>
          <Text style={styles.termsText}>
            Tôi đồng ý với các{' '}
            <Text
              style={styles.termsLink}
              onPress={() => setTermsVisible(true)}
            >
              điều khoản đặt tiệc
            </Text>
          </Text>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.depositButton, !termsChecked && styles.depositButtonDisabled]}
            activeOpacity={0.8}
            disabled={!termsChecked || creating}
            onPress={createOrder}
          >
            <Text style={styles.depositButtonText}>
              {creating ? 'Đang tạo đơn...' : `Thanh toán cọc ${formatVnd(deposit)}`}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* QR popup (cannot be dismissed) */}
      <Modal visible={qrVisible} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.qrOverlay}>
          <View style={styles.qrCard}>
            <Text style={styles.qrTitle}>Quét mã để thanh toán</Text>
            <Text style={styles.qrSubtitle}>
              Mã sẽ hết hạn sau <Text style={styles.qrTimer}>{mmss(secondsLeft)}</Text>
            </Text>

            {qrData?.qrUrl ? (
              <Image
                source={{ uri: qrData.qrUrl }}
                style={styles.qrImage}
                contentFit="contain"
                cachePolicy="none"
              />
            ) : (
              <View style={[styles.qrImage, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: TEXT_SECONDARY, fontWeight: '700' }}>Đang tạo QR...</Text>
              </View>
            )}

            <View style={styles.qrMeta}>
              <View style={styles.qrMetaRow}>
                <Text style={styles.qrMetaLabel}>Mã thanh toán</Text>
                <Text style={styles.qrMetaValue}>{qrData?.paymentCode || ''}</Text>
              </View>
              <View style={styles.qrMetaRow}>
                <Text style={styles.qrMetaLabel}>Số tiền</Text>
                <Text style={styles.qrMetaValue}>{formatVnd(qrData?.amount ?? deposit)}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.openBankButton}
              activeOpacity={0.85}
              onPress={saveQrToLibrary}
            >
              <Ionicons name="download-outline" size={18} color={BACKGROUND_WHITE} />
              <Text style={styles.openBankButtonText}>Lưu mã QR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Payment success modal */}
      <Modal
        visible={paymentSuccessVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setPaymentSuccessVisible(false);
          navigation.navigate('Orders', { initialTab: 'upcoming' });
        }}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={36} color={BACKGROUND_WHITE} />
            </View>
            <Text style={styles.successTitle}>Thanh toán thành công</Text>
            <Text style={styles.successSubtitle}>Cảm ơn bạn đã lựa chọn Bookfet</Text>

            <View style={styles.successInfo}>
              <View style={styles.successInfoRow}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={TEXT_SECONDARY}
                  style={styles.successInfoIcon}
                />
                <Text style={styles.successInfoLabel}>Thời gian</Text>
                <Text style={styles.successInfoValue}>{timeText}</Text>
              </View>
              <View style={styles.successInfoRow}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={TEXT_SECONDARY}
                  style={styles.successInfoIcon}
                />
                <Text style={styles.successInfoLabel}>Địa điểm</Text>
                <Text style={styles.successInfoValue}>{locationText}</Text>
              </View>
              <View style={styles.successInfoRow}>
                <Ionicons
                  name="card-outline"
                  size={18}
                  color={TEXT_SECONDARY}
                  style={styles.successInfoIcon}
                />
                <Text style={styles.successInfoLabel}>Đã cọc</Text>
                <Text style={styles.successInfoValue}>
                  {formatVnd(qrData?.amount ?? deposit)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.successButton}
              activeOpacity={0.85}
              onPress={() => {
                setPaymentSuccessVisible(false);
                navigation.navigate('Orders', { initialTab: 'upcoming' });
              }}
            >
              <Text style={styles.successButtonText}>Xem đơn hàng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={termsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTermsVisible(false)}
      >
        <View style={styles.termsOverlay}>
          <View style={styles.termsCard}>
            <Text style={styles.termsTitle}>Điều khoản đặt tiệc</Text>
            <Text style={styles.termsBody}>
              Sau khi thanh toán tiền cọc, đơn đặt tiệc được xác nhận. Nếu hủy tiệc trước 1 ngày,
              tiền cọc sẽ không được hoàn lại. Trường hợp đổi ngày sớm hơn thời hạn trên có thể được
              hỗ trợ tùy tình trạng sẵn sàng.
              {'\n\n'}Tôi đã đọc và chấp nhận các quy định.
            </Text>
            <TouchableOpacity
              style={styles.termsAgree}
              onPress={() => setTermsVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.termsAgreeText}>Đồng ý</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Prompt add to Google Calendar */}
      <Modal
        visible={calendarPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCalendarPromptVisible(false)}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Thêm vào Google Calendar?</Text>
            <Text style={styles.promptBody}>
              Bạn có muốn thêm sự kiện này vào lịch Google không?
            </Text>
            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={[styles.promptBtn, styles.promptBtnSecondary]}
                onPress={() => setCalendarPromptVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.promptBtnSecondaryText}>Không</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promptBtn, styles.promptBtnPrimary]}
                onPress={async () => {
                  setCalendarPromptVisible(false);
                  await openGoogleCalendar();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.promptBtnPrimaryText}>Có</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Prompt open Google Maps */}
      <Modal
        visible={mapsPromptVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMapsPromptVisible(false)}
      >
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Mở Google Maps?</Text>
            <Text style={styles.promptBody}>
              Bạn có muốn kiểm tra lại địa điểm trên Google Maps không?
            </Text>
            <View style={styles.promptButtons}>
              <TouchableOpacity
                style={[styles.promptBtn, styles.promptBtnSecondary]}
                onPress={() => setMapsPromptVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.promptBtnSecondaryText}>Không</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.promptBtn, styles.promptBtnPrimary]}
                onPress={async () => {
                  setMapsPromptVisible(false);
                  await openGoogleMaps();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.promptBtnPrimaryText}>Có</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND_WHITE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: TEXT_PRIMARY },
  headerRight: { width: 44 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  summaryBlock: {
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    marginBottom: 12,
  },
  partySummarySection: {
    marginTop: 6,
  },
  partyDivider: {
    height: 2,
    backgroundColor: '#E6E0EB',
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 2,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 6 },
  summaryPrefix: { width: 18, color: TEXT_SECONDARY, fontWeight: '900', marginRight: 6 },
  iconLeft: { width: 18, marginRight: 6, marginTop: 2 },
  summaryText: { flex: 1, color: TEXT_PRIMARY, fontSize: 14, lineHeight: 20 },
  summaryBold: { fontWeight: '800' },
  inlineLink: {
    fontWeight: '600',
    textDecorationLine: 'underline',
    color: TEXT_PRIMARY,
  },
  section: {
    backgroundColor: BACKGROUND_WHITE,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 10 },
  payRow: { flexDirection: 'row', alignItems: 'center' },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: TEXT_PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: TEXT_PRIMARY },
  payText: { flex: 1, fontSize: 14, color: TEXT_PRIMARY, fontWeight: '600' },
  vietqrLogo: { width: 62, height: 22 },
  lineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  lineLabel: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '600' },
  lineValue: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '700' },
  totalLabel: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '900' },
  totalValue: { fontSize: 14, color: TEXT_PRIMARY, fontWeight: '900' },
  termsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginTop: 2 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER_LIGHT,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BACKGROUND_WHITE,
  },
  checkboxChecked: { backgroundColor: PRIMARY_COLOR, borderColor: PRIMARY_COLOR },
  termsText: { flex: 1, fontSize: 13, color: TEXT_SECONDARY, fontWeight: '600' },
  termsLink: { color: TEXT_PRIMARY, fontWeight: '700', textDecorationLine: 'underline' },
  bottomSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKGROUND_WHITE,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  depositButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  depositButtonDisabled: { opacity: 0.5 },
  depositButtonText: { color: BACKGROUND_WHITE, fontSize: 14, fontWeight: '800' },
  divider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginVertical: 8,
  },
  termsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 16 },
  termsCard: { backgroundColor: '#FFF7EC', borderRadius: 16, padding: 18 },
  termsTitle: { fontSize: 18, fontWeight: '900', color: TEXT_PRIMARY, textAlign: 'center', marginBottom: 10 },
  termsBody: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18, marginBottom: 14 },
  termsAgree: {
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsAgreeText: { color: BACKGROUND_WHITE, fontWeight: '900' },
  promptOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: 16 },
  promptCard: { backgroundColor: BACKGROUND_WHITE, borderRadius: 16, padding: 16 },
  promptTitle: { fontSize: 16, fontWeight: '900', color: TEXT_PRIMARY, marginBottom: 8, textAlign: 'center' },
  promptBody: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 18, marginBottom: 14, textAlign: 'center' },
  promptButtons: { flexDirection: 'row', gap: 10 },
  promptBtn: { flex: 1, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  promptBtnSecondary: { backgroundColor: '#F5F5F5' },
  promptBtnPrimary: { backgroundColor: PRIMARY_COLOR },
  promptBtnSecondaryText: { fontWeight: '800', color: TEXT_PRIMARY },
  promptBtnPrimaryText: { fontWeight: '900', color: BACKGROUND_WHITE },
  qrOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', paddingHorizontal: 16 },
  qrCard: { backgroundColor: BACKGROUND_WHITE, borderRadius: 16, padding: 16 },
  qrTitle: { fontSize: 18, fontWeight: '900', color: TEXT_PRIMARY, textAlign: 'center' },
  qrSubtitle: { marginTop: 8, fontSize: 13, color: TEXT_SECONDARY, textAlign: 'center', fontWeight: '600' },
  qrTimer: { color: PRIMARY_COLOR, fontWeight: '900' },
  qrImage: { width: '100%', height: 260, marginTop: 12, backgroundColor: '#F7F7F7', borderRadius: 12 },
  qrMeta: { marginTop: 12, borderTopWidth: 1, borderTopColor: BORDER_LIGHT, paddingTop: 12 },
  qrMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  qrMetaLabel: { fontSize: 13, color: TEXT_SECONDARY, fontWeight: '700' },
  qrMetaValue: { fontSize: 13, color: TEXT_PRIMARY, fontWeight: '900' },
  openBankButton: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  openBankButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 14,
    fontWeight: '900',
  },
  qrHint: { marginTop: 10, fontSize: 12, color: TEXT_SECONDARY, textAlign: 'center' },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCard: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: BACKGROUND_WHITE,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    alignItems: 'center',
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#2ecc71',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  successSubtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 20,
  },
  successInfo: {
    width: '100%',
    marginTop: 4,
    marginBottom: 24,
  },
  successInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  successInfoIcon: {
    marginRight: 8,
  },
  successInfoLabel: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    width: 80,
  },
  successInfoValue: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontWeight: '600',
    textAlign: 'right',
  },
  successButton: {
    marginTop: 8,
    width: '100%',
    height: 50,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 16,
    fontWeight: '800',
  },
});

