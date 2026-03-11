import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
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

