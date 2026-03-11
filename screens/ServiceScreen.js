import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import API_URL from '../constants/api';
import { requireAuth } from '../utils/auth';
import { addServiceToCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';

const { width } = Dimensions.get('window');

let serviceDataCache = {
  services: null,
  fetched: false,
};

const formatPrice = (price) => {
  if (price == null) return '';
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

export default function ServiceScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const loadServices = async (forceRefresh = false) => {
    if (!forceRefresh && serviceDataCache.fetched && serviceDataCache.services) {
      setServices(serviceDataCache.services);
      return;
    }

    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const res = await fetch(`${API_URL}/api/Service?page=1&pageSize=20`);
      const json = await res.json();
      const items = json?.items || [];

      const mapped = items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        description: item.description,
        basePrice: item.basePrice,
        status: item.status,
        image: item.img ? `${API_URL}${item.img}` : null,
      }));

      setServices(mapped);
      serviceDataCache = {
        services: mapped,
        fetched: true,
      };
    } catch (error) {
      console.error('Failed to fetch services', error);
    } finally {
      if (forceRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadServices(false);
  }, []);

  const handleAddService = async (service) => {
    const ok = await requireAuth(navigation, {
      returnScreen: 'ServiceDetail',
      returnParams: { service },
    });
    if (!ok) return;
    await addServiceToCart(service);
    showToast('Đã thêm vào giỏ hàng');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={TEXT_SECONDARY} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm dịch vụ..."
            placeholderTextColor={TEXT_SECONDARY}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Ionicons name="options" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Services List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadServices(true)}
          />
        }
      >
        {isLoading &&
          [1, 2, 3].map((i) => (
            <View key={`skeleton-${i}`} style={[styles.serviceCard, { opacity: 0.6 }]}>
              <View style={[styles.serviceImage, { backgroundColor: '#E5E5E5' }]} />
              <View style={styles.serviceInfo}>
                <View style={{ height: 16, width: '70%', backgroundColor: '#E5E5E5', borderRadius: 4, marginBottom: 8 }} />
                <View style={{ height: 14, width: 80, backgroundColor: '#E5E5E5', borderRadius: 4 }} />
              </View>
            </View>
          ))}
        {!isLoading &&
          services.map((service) => (
          <TouchableOpacity
            key={service.serviceId}
            style={styles.serviceCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ServiceDetail', { service })}
          >
            {service.image ? (
              <Image
                source={{ uri: service.image }}
                style={styles.serviceImage}
                contentFit="cover"
                cachePolicy="disk"
                transition={150}
              />
            ) : (
              <View style={[styles.serviceImage, { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={32} color={TEXT_SECONDARY} />
              </View>
            )}
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.serviceName}</Text>
              <Text style={styles.servicePrice}>{formatPrice(service.basePrice)}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddService(service)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNavigation activeTab="Search" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_PRIMARY,
    padding: 0,
  },
  filterButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textDecorationLine: 'underline',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TEXT_PRIMARY,
    backgroundColor: BACKGROUND_WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
