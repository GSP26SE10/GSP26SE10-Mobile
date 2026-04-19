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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import API_URL from '../constants/api';
import { requireAuth } from '../utils/auth';
import { addServiceToCart, addDishToCart, getCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';

const { width } = Dimensions.get('window');
const TABS = ['Dịch vụ', 'Món lẻ'];

let serviceDataCache = { services: null, fetched: false };
let dishDataCache = { byKey: {} };
let dishCategoryDataCache = { categories: null, fetched: false };
let menuDishMapCache = { byMenuId: null, fetched: false };
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

const resolveImageUri = (img) => {
  if (!img || typeof img !== 'string') return null;
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  return `${API_URL}${img}`;
};

export default function ServiceScreen({ navigation, route }) {
  const [activeTab, setActiveTab] = useState(lastActiveTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState([]);
  const [dishes, setDishes] = useState([]);
  const [dishCategories, setDishCategories] = useState([]);
  const [selectedDishCategoryId, setSelectedDishCategoryId] = useState(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [isLoadingDishCategories, setIsLoadingDishCategories] = useState(false);
  const [isLoadingMoreDishes, setIsLoadingMoreDishes] = useState(false);
  const [dishPage, setDishPage] = useState(1);
  const [dishTotalPages, setDishTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [excludedDishIds, setExcludedDishIds] = useState(() => new Set());

  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
  const loadingMoreLockRef = useRef(false);
  const dishesRef = useRef([]);

  useEffect(() => {
    dishesRef.current = dishes;
  }, [dishes]);

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

  useEffect(() => {
    const requestedTab = Number(route?.params?.initialTab);
    if (requestedTab === 0 || requestedTab === 1) {
      setActiveTab(requestedTab);
      lastActiveTab = requestedTab;
    }
  }, [route?.params?.initialTab]);

  useEffect(() => {
    if (activeTab !== 1) return;
    refreshDishFilterContext(false);
  }, [activeTab]);

  const loadServices = async (forceRefresh = false) => {
    if (!forceRefresh && serviceDataCache.fetched && serviceDataCache.services) {
      setServices(serviceDataCache.services);
      return;
    }
    try {
      if (forceRefresh) setRefreshing(true);
      else setIsLoadingServices(true);

      const res = await fetch(`${API_URL}/api/Service?Status=1&page=1&pageSize=20`);
      const json = await res.json();
      const items = json?.items || [];
      const mapped = items.map((item) => ({
        serviceId: item.serviceId,
        serviceName: item.serviceName,
        description: item.description,
        basePrice: item.basePrice,
        status: item.status,
        image: resolveImageUri(item.img),
        averageRating: item.averageRating ?? null,
        totalReviews: item.totalReviews ?? null,
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

  const getDishCacheKey = (dishCategoryId) =>
    dishCategoryId != null ? `category:${dishCategoryId}` : 'all';

  const buildDishApiUrl = (page, dishCategoryId) => {
    const qs = new URLSearchParams();
    qs.append('Status', '1');
    if (dishCategoryId != null) qs.append('DishCategoryId', String(dishCategoryId));
    qs.append('page', String(page));
    qs.append('pageSize', dishCategoryId != null ? '100' : '10');
    return `${API_URL}/api/dish?${qs.toString()}`;
  };

  const mergeDishList = (prev, next) => {
    const byId = new Map();
    [...prev, ...next].forEach((item) => {
      const id = Number(item?.dishId ?? 0);
      if (!id) return;
      byId.set(id, item);
    });
    return Array.from(byId.values());
  };

  const loadDishes = async ({
    forceRefresh = false,
    page = 1,
    append = false,
    dishCategoryId = selectedDishCategoryId,
  } = {}) => {
    const cacheKey = getDishCacheKey(dishCategoryId);
    const cached = dishDataCache.byKey?.[cacheKey];
    if (!forceRefresh && page === 1 && !append && cached?.items) {
      setDishes(cached.items);
      setDishPage(cached.page ?? 1);
      setDishTotalPages(cached.totalPages ?? 1);
      return;
    }

    try {
      if (append) setIsLoadingMoreDishes(true);
      else if (forceRefresh) setRefreshing(true);
      else setIsLoadingDishes(true);

      const res = await fetch(buildDishApiUrl(page, dishCategoryId));
      const json = await res.json();
      const items = json?.items || [];
      const totalPages = Number(json?.totalPages ?? 1);
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

      const nextDishes = append ? mergeDishList(dishesRef.current, mapped) : mapped;
      setDishes(nextDishes);
      setDishPage(page);
      setDishTotalPages(totalPages);
      dishDataCache.byKey[cacheKey] = {
        items: nextDishes,
        page,
        totalPages,
      };
    } catch (error) {
      console.error('Failed to fetch dishes', error);
    } finally {
      if (append) setIsLoadingMoreDishes(false);
      else if (forceRefresh) setRefreshing(false);
      else setIsLoadingDishes(false);
    }
  };

  const loadDishCategories = async (forceRefresh = false) => {
    if (!forceRefresh && dishCategoryDataCache.fetched && dishCategoryDataCache.categories) {
      setDishCategories(dishCategoryDataCache.categories);
      return;
    }
    try {
      setIsLoadingDishCategories(true);
      const res = await fetch(`${API_URL}/api/dish-category?page=1&pageSize=10`);
      const json = await res.json();
      const items = Array.isArray(json?.items) ? json.items : [];
      const mapped = items
        .map((item) => ({
          dishCategoryId: item?.dishCategoryId ?? item?.id ?? null,
          dishCategoryName: item?.dishCategoryName ?? item?.name ?? item?.categoryName ?? '',
        }))
        .filter((item) => item.dishCategoryId != null && item.dishCategoryName);
      setDishCategories(mapped);
      dishCategoryDataCache = { categories: mapped, fetched: true };
    } catch (error) {
      console.error('Failed to fetch dish categories', error);
      setDishCategories([]);
    } finally {
      setIsLoadingDishCategories(false);
    }
  };

  const loadMoreDishes = async () => {
    if (loadingMoreLockRef.current) return;
    if (isLoadingDishes || isLoadingMoreDishes) return;
    if (dishPage >= dishTotalPages) return;
    loadingMoreLockRef.current = true;
    try {
      await loadDishes({ page: dishPage + 1, append: true, dishCategoryId: selectedDishCategoryId });
    } finally {
      loadingMoreLockRef.current = false;
    }
  };

  const loadMenuDishMap = async (forceRefresh = false) => {
    if (!forceRefresh && menuDishMapCache.fetched && menuDishMapCache.byMenuId) {
      return menuDishMapCache.byMenuId;
    }
    const byMenuId = {};
    let page = 1;
    let totalPages = 1;
    try {
      do {
        const res = await fetch(`${API_URL}/api/menu-dish?page=${page}&pageSize=100`);
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        totalPages = Number(json?.totalPages ?? 1);
        items.forEach((it) => {
          const menuId = Number(it?.menuId ?? 0);
          const dishId = Number(it?.dishId ?? 0);
          if (!menuId || !dishId) return;
          if (!byMenuId[menuId]) byMenuId[menuId] = new Set();
          byMenuId[menuId].add(dishId);
        });
        page += 1;
      } while (page <= totalPages);
    } catch (error) {
      console.error('Failed to fetch menu dishes', error);
    }
    menuDishMapCache = { byMenuId, fetched: true };
    return byMenuId;
  };

  const refreshDishFilterContext = async (forceRefresh = false) => {
    const items = await getCart();
    const selectedMenu = (items || []).find((i) => i.type === 'menu' && Number(i.menuId) > 0);
    const selectedMenuId = Number(selectedMenu?.menuId ?? 0);
    if (!selectedMenuId) {
      setActiveMenuId(null);
      setExcludedDishIds(new Set());
      return;
    }
    const byMenuId = await loadMenuDishMap(forceRefresh);
    setActiveMenuId(selectedMenuId);
    setExcludedDishIds(new Set(byMenuId?.[selectedMenuId] ?? []));
  };

  useEffect(() => {
    (async () => {
      await Promise.all([loadServices(false), loadDishes({ forceRefresh: false }), loadDishCategories(false)]);
      await refreshDishFilterContext(false);
    })();
  }, []);

  useEffect(() => {
    if (activeTab !== 1) return;
    loadDishes({ forceRefresh: false, page: 1, append: false, dishCategoryId: selectedDishCategoryId });
  }, [activeTab, selectedDishCategoryId]);

  const handleRefresh = () => {
    if (activeTab === 0) {
      loadServices(true);
      return;
    }
    (async () => {
      await Promise.all([
        loadDishes({ forceRefresh: true, page: 1, append: false, dishCategoryId: selectedDishCategoryId }),
        loadDishCategories(true),
      ]);
      await refreshDishFilterContext(true);
    })();
  };

  const handleAddService = async (service) => {
    const ok = await requireAuth(navigation, {
      returnScreen: 'ServiceDetail',
      returnParams: { service },
    });
    if (!ok) return;
    const result = await addServiceToCart(service);
    if (!result?.success && result?.reason === 'NO_MENU') {
      showToast('Vui lòng chọn menu trước!');
      return;
    }
    showToast('Đã thêm vào giỏ hàng');
  };

  const handleAddDish = async (dish) => {
    if (!activeMenuId) {
      showToast('Vui lòng chọn menu trước!');
      return;
    }
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
    if (activeMenuId && excludedDishIds.has(Number(d?.dishId ?? 0))) return false;
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
    if (filteredDishes.length === 0) {
      return (
        <View style={styles.emptyStateWrap}>
          <Text style={styles.emptyStateText}>
            {activeMenuId ? 'Không còn món lẻ ngoài menu đã chọn' : 'Không tìm thấy món lẻ phù hợp'}
          </Text>
        </View>
      );
    }
    return (
      <>
        {filteredDishes.map((dish) => (
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
              {dish.dishCategoryName ? (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>{dish.dishCategoryName}</Text>
                </View>
              ) : null}
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
        ))}
        {isLoadingMoreDishes ? (
          <Text style={styles.loadingMoreText}>Đang tải thêm món lẻ...</Text>
        ) : null}
      </>
    );
  };

  const selectedCategoryName =
    selectedDishCategoryId == null
      ? 'Tất cả'
      : dishCategories.find((c) => Number(c.dishCategoryId) === Number(selectedDishCategoryId))
          ?.dishCategoryName || 'Danh mục';

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
          {activeTab === 1 ? (
            <TouchableOpacity
              style={[styles.filterButton, selectedDishCategoryId != null && styles.filterButtonActive]}
              activeOpacity={0.7}
              onPress={() => {
                setShowCategoryFilter((prev) => !prev);
                if (!dishCategoryDataCache.fetched) loadDishCategories(false);
              }}
            >
              <Ionicons name="options" size={20} color={selectedDishCategoryId != null ? BACKGROUND_WHITE : TEXT_PRIMARY} />
            </TouchableOpacity>
          ) : null}
        </View>
        {activeTab === 1 && showCategoryFilter ? (
          <View style={styles.filterPanel}>
            <Text style={styles.filterPanelTitle}>Lọc theo danh mục món lẻ</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipList}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  selectedDishCategoryId == null && styles.filterChipActive,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setSelectedDishCategoryId(null);
                  setShowCategoryFilter(false);
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedDishCategoryId == null && styles.filterChipTextActive,
                  ]}
                >
                  Tất cả
                </Text>
              </TouchableOpacity>

              {dishCategories.map((category) => {
                const isActive = Number(selectedDishCategoryId) === Number(category.dishCategoryId);
                return (
                  <TouchableOpacity
                    key={String(category.dishCategoryId)}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setSelectedDishCategoryId(Number(category.dishCategoryId));
                      setShowCategoryFilter(false);
                    }}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {category.dishCategoryName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {isLoadingDishCategories ? (
              <Text style={styles.filterLoadingText}>Đang tải danh mục...</Text>
            ) : null}
          
          </View>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEventThrottle={16}
          onScroll={({ nativeEvent }) => {
            if (activeTab !== 1) return;
            const paddingToBottom = 140;
            const isNearBottom =
              nativeEvent.layoutMeasurement.height + nativeEvent.contentOffset.y >=
              nativeEvent.contentSize.height - paddingToBottom;
            if (isNearBottom) loadMoreDishes();
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {activeTab === 0 ? renderServiceList() : renderDishList()}
        </ScrollView>
      </KeyboardAvoidingView>

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
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFEFEF',
  },
  filterButtonActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterPanel: {
    marginTop: 10,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 10,
  },
  filterPanelTitle: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterChipList: {
    paddingRight: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ECECEC',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  filterChipTextActive: {
    color: BACKGROUND_WHITE,
  },
  filterLoadingText: {
    marginTop: 8,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  filterSelectedText: {
    marginTop: 8,
    fontSize: 12,
    color: TEXT_SECONDARY,
  },
  tabContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  keyboardWrap: {
    flex: 1,
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
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFE6B3',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FF8C00',
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
  emptyStateWrap: {
    paddingTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingMoreText: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 13,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    fontWeight: '600',
  },
});
