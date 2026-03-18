import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { requireAuth } from '../utils/auth';
import { addServiceToCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import API_URL from '../constants/api';
import { TEXT_PRIMARY, TEXT_SECONDARY, BACKGROUND_WHITE, PRIMARY_COLOR } from '../constants/colors';

const { width } = Dimensions.get('window');

let otherServicesCache = { fetched: false, items: null };

const formatPrice = (price) => {
  if (price == null) return '0₫';
  try {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  } catch (e) {
    return `${Number(price).toLocaleString('vi-VN')} đ`;
  }
};

const getServiceDetailMeta = () => ({
  rating: 4.8,
  reviewCount: '1.2k',
  aiSummary:
    'Dịch vụ được đánh giá cao về chất lượng và sự chuyên nghiệp. Thời gian thi công nhanh, phù hợp nhiều loại sự kiện và dễ phối hợp với thực đơn.',
});

/** Chuẩn hóa service từ route: API shape (serviceId, serviceName, basePrice, description, image/img) */
const normalizeService = (serviceFromRoute) => {
  const s = serviceFromRoute || {};
  return {
    serviceId: s.serviceId ?? s.id,
    serviceName: s.serviceName ?? s.name ?? 'Dịch vụ',
    basePrice: s.basePrice ?? (typeof s.price === 'number' ? s.price : null),
    priceFormatted: s.priceFormatted ?? (typeof s.price === 'string' ? s.price : formatPrice(s.basePrice ?? s.price)),
    description: s.description ?? 'Nội dung chi tiết sẽ được tư vấn thêm khi đặt dịch vụ.',
    image: s.image ?? (s.img ? `${API_URL}${s.img}` : null),
  };
};

export default function ServiceDetailScreen({ navigation, route }) {
  const raw = route?.params?.service;
  const service = normalizeService(raw);
  const priceText = service.priceFormatted || formatPrice(service.basePrice);
  const imageUri = service.image;
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [otherServices, setOtherServices] = useState([]);
  const [loadingOther, setLoadingOther] = useState(false);

  const meta = useMemo(() => getServiceDetailMeta(), []);

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleChooseService = async () => {
    if (!service?.serviceId || service?.basePrice == null) {
      showToast('Vui lòng đợi tải dịch vụ xong');
      return;
    }
    const ok = await requireAuth(navigation, {
      returnScreen: 'ServiceDetail',
      returnParams: { service: raw },
    });
    if (!ok) return;
    await addServiceToCart(service);
    showToast('Đã thêm vào giỏ hàng');
  };

  useEffect(() => {
    const load = async (force = false) => {
      try {
        if (!force && otherServicesCache.fetched && Array.isArray(otherServicesCache.items)) {
          setOtherServices(
            otherServicesCache.items.filter((s) => s?.serviceId !== service.serviceId),
          );
          return;
        }
        setLoadingOther(true);
        const res = await fetch(`${API_URL}/api/Service?page=1&pageSize=50`);
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        const mapped = items.map((item) => ({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          description: item.description,
          basePrice: item.basePrice,
          status: item.status,
          image: item.img ? `${API_URL}${item.img}` : null,
        }));
        otherServicesCache = { fetched: true, items: mapped };
        setOtherServices(mapped.filter((s) => s?.serviceId !== service.serviceId));
      } catch (e) {
        setOtherServices([]);
      } finally {
        setLoadingOther(false);
      }
    };
    load(false);
  }, [service.serviceId]);

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'right', 'bottom', 'left']}
      {...swipeBack.panHandlers}
    >
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
        <Text style={styles.headerTitle}>Chi tiết dịch vụ</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageWrapper}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.mainImage}
              contentFit="cover"
              cachePolicy="disk"
              transition={150}
            />
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color={TEXT_SECONDARY} />
            </View>
          )}
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.serviceTitle}>{service.serviceName}</Text>
          <Text style={styles.servicePrice}>{priceText}</Text>
          <Text style={styles.serviceDescription}>{service.description}</Text>
        </View>

        {/* Rating + AI summary */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingRow}>
            <View style={styles.ratingLeft}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.ratingText}>{meta.rating}</Text>
              <Text style={styles.reviewCount}>{meta.reviewCount} đánh giá</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Feedback', { serviceId: service?.serviceId })}
            >
              <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
          <Text style={styles.aiSummaryTitle}>AI tóm tắt đánh giá</Text>
          <Text style={styles.aiSummaryText}>{meta.aiSummary}</Text>
        </View>

        {/* Other services */}
        <View style={styles.otherSection}>
          <Text style={styles.otherTitle}>Các dịch vụ khác</Text>
          {loadingOther ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[1, 2, 3].map((i) => (
                <View key={`other-skel-${i}`} style={styles.otherCard}>
                  <View style={[styles.otherImage, { backgroundColor: '#E5E5E5' }]} />
                  <View style={{ height: 10 }} />
                  <View style={{ width: 110, height: 14, backgroundColor: '#E5E5E5', borderRadius: 4 }} />
                  <View style={{ height: 6 }} />
                  <View style={{ width: 70, height: 12, backgroundColor: '#E5E5E5', borderRadius: 4 }} />
                </View>
              ))}
            </ScrollView>
          ) : otherServices.length === 0 ? (
            <Text style={styles.otherEmpty}>Chưa có dịch vụ khác</Text>
          ) : (
            <FlatList
              data={otherServices}
              keyExtractor={(item) => String(item.serviceId)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.otherList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.otherCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('ServiceDetail', {
                      service: item,
                    })
                  }
                >
                  {item.image ? (
                    <Image
                      source={{ uri: item.image }}
                      style={styles.otherImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      transition={150}
                    />
                  ) : (
                    <View style={[styles.otherImage, styles.imagePlaceholder]}>
                      <Ionicons name="image-outline" size={22} color={TEXT_SECONDARY} />
                    </View>
                  )}
                  <Text style={styles.otherName} numberOfLines={2}>
                    {item.serviceName || 'Dịch vụ'}
                  </Text>
                  <Text style={styles.otherPrice} numberOfLines={1}>
                    {item.basePrice != null ? formatPrice(item.basePrice) : ''}
                  </Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBarSafe}>
        <View style={styles.bottomBar}>
          <Text style={styles.bottomPrice}>{priceText}</Text>
          <TouchableOpacity
            style={styles.chooseButton}
            onPress={handleChooseService}
            activeOpacity={0.8}
          >
            <Text style={styles.chooseButtonText}>Chọn dịch vụ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 80,
  },
  imageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mainImage: {
    width: width - 40,
    height: (width - 40) * 0.56,
    backgroundColor: '#E0E0E0',
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoSection: {
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginBottom: 12,
  },
  serviceDescription: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  ratingSection: {
    marginTop: 14,
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ratingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  reviewCount: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  aiSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  aiSummaryText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  otherSection: {
    marginTop: 14,
  },
  otherTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  otherEmpty: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  otherList: {
    paddingRight: 8,
  },
  otherCard: {
    width: 150,
    marginRight: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 10,
  },
  otherImage: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
  },
  otherName: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  otherPrice: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  bottomBarSafe: {
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
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bottomPrice: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  chooseButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
  },
  chooseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BACKGROUND_WHITE,
  },
});

