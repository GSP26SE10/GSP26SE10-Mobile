import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import API_URL from '../constants/api';
import { requireAuth } from '../utils/auth';
import { addServiceToCart, addDishToCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';

const { width } = Dimensions.get('window');
const TABS = ['Dịch vụ', 'Món lẻ'];

let serviceDataCache = { services: null, fetched: false };
let dishDataCache = { dishes: null, fetched: false };
let lastActiveTab = 0;

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
  const [activeTab, setActiveTab] = useState(lastActiveTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  useEffect(() => {
    Animated.spring(tabIndicatorAnim, {
      toValue: activeTab,
      useNativeDriver: true,
      tension: 68,
      friction: 10,
    }).start();
  }, [activeTab]);

  const loadServices = async (forceRefresh = false) => {
    if (!forceRefresh && serviceDataCache.fetched && serviceDataCache.services) {
      setServices(serviceDataCache.services);
      return;
    }
    try {
      if (forceRefresh) setRefreshing(true);
      else setIsLoadingServices(true);

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
      serviceDataCache = { services: mapped, fetched: true };
    } catch (error) {
      console.error('Failed to fetch services', error);
    } finally {
      if (forceRefresh) setRefreshing(false);
      else setIsLoadingServices(false);
    }
  };

  const loadDishes = async (forceRefresh = false) => {
    if (!forceRefresh && dishDataCache.fetched && dishDataCache.dishes) {
      setDishes(dishDataCache.dishes);
      return;
    }
    try {
      if (forceRefresh) setRefreshing(true);
      else setIsLoadingDishes(true);

      const res = await fetch(`${API_URL}/api/dish?page=1&pageSize=10`);
      const json = await res.json();
      const items = json?.items || [];
      const mapped = items.map((item) => ({
        dishId: item.dishId,
        dishName: item.dishName,
        description: item.description,
        price: item.price,
        status: item.status,
        note: item.note,
        image: item.img || null,
        dishCategoryId: item.dishCategoryId,
        dishCategoryName: item.dishCategoryName,
      }));
      setDishes(mapped);
      dishDataCache = { dishes: mapped, fetched: true };
    } catch (error) {
      console.error('Failed to fetch dishes', error);
    } finally {
      if (forceRefresh) setRefreshing(false);
      else setIsLoadingDishes(false);
    }
  };

  useEffect(() => {
    loadServices(false);
    loadDishes(false);
  }, []);

  const handleRefresh = () => {
    if (activeTab === 0) loadServices(true);
    else loadDishes(true);
  };

  const handleAddService = async (service) => {
    const ok = await requireAuth(navigation, {
      returnScreen: 'ServiceDetail',
      returnParams: { service },
    });
    if (!ok) return;
    await addServiceToCart(service);
    showToast('Đã thêm vào giỏ hàng');
  };

  const handleAddDish = async (dish) => {
    const ok = await requireAuth(navigation, {
      returnScreen: 'DishDetail',
      returnParams: { dish },
    });
    if (!ok) return;
    const result = await addDishToCart(dish);
    if (!result.success && result.reason === 'NO_MENU') {
      showToast('Vui lòng chọn menu trước!');
      return;
    }
    showToast('Đã thêm vào giỏ hàng');
  };

  const isLoading = activeTab === 0 ? isLoadingServices : isLoadingDishes;

  const filteredServices = services.filter((s) => {
    if (!searchQuery.trim()) return true;
    return s.serviceName?.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const filteredDishes = dishes.filter((d) => {
    if (!searchQuery.trim()) return true;
    return d.dishName?.toLowerCase().includes(searchQuery.trim().toLowerCase());
  });

  const indicatorTranslateX = tabIndicatorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (width - 40) / 2],
  });

  const renderSkeletons = () =>
    [1, 2, 3].map((i) => (
      <View key={`skeleton-${i}`} style={[styles.serviceCard, { opacity: 0.6 }]}>
        <View style={[styles.serviceImage, { backgroundColor: '#E5E5E5' }]} />
        <View style={styles.serviceInfo}>
          <View style={{ height: 16, width: '70%', backgroundColor: '#E5E5E5', borderRadius: 4, marginBottom: 8 }} />
          <View style={{ height: 14, width: 80, backgroundColor: '#E5E5E5', borderRadius: 4 }} />
        </View>
      </View>
    ));

  const renderServiceList = () => {
    if (isLoadingServices) return renderSkeletons();
    return filteredServices.map((service) => (
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
    ));
  };

  const renderDishList = () => {
    if (isLoadingDishes) return renderSkeletons();
    return filteredDishes.map((dish) => (
      <TouchableOpacity
        key={dish.dishId}
        style={styles.serviceCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('DishDetail', { dish })}
      >
        {dish.image ? (
          <Image
            source={{ uri: dish.image }}
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
          <Text style={styles.serviceName}>{dish.dishName}</Text>
          <Text style={styles.servicePrice}>{formatPrice(dish.price)}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => handleAddDish(dish)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={20} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      </TouchableOpacity>
    ));
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
            placeholder={activeTab === 0 ? 'Tìm dịch vụ...' : 'Tìm món lẻ...'}
            placeholderTextColor={TEXT_SECONDARY}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Ionicons name="options" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <Animated.View
            style={[
              styles.tabIndicator,
              { transform: [{ translateX: indicatorTranslateX }] },
            ]}
          />
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={styles.tabItem}
              activeOpacity={0.7}
              onPress={() => { setActiveTab(index); lastActiveTab = index; }}
            >
              <Text style={[styles.tabText, activeTab === index && styles.tabTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content List */}
      <ScrollView
        key={`tab-${activeTab}`}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {activeTab === 0 ? renderServiceList() : renderDishList()}
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
    paddingBottom: 12,
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
  tabContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 4,
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: (width - 40 - 8) / 2,
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 10,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  tabTextActive: {
    color: BACKGROUND_WHITE,
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
    shadowOffset: { width: 0, height: 1 },
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
