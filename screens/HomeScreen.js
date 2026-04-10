import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import Toast from '../components/Toast';
import API_URL from '../constants/api';
import { buildGreeting, getStoredFullName } from '../utils/greeting';
import { getAccessToken } from '../utils/auth';
import {
  getNotificationUnreadCount,
  refreshNotificationUnreadCount,
  subscribeNotificationUnreadChange,
} from '../utils/notificationUnread';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR } from '../constants/colors';

const { width } = Dimensions.get('window');

let homeDataCache = {
  categories: null,
  menusByCategory: null,
  fetched: false,
};

const SkeletonBox = ({ style }) => (
  <View style={[{ backgroundColor: '#E5E5E5' }, style]} />
);

export default function HomeScreen({ navigation, route }) {
  const [categories, setCategories] = useState([]);
  const [menusByCategory, setMenusByCategory] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [greetingText, setGreetingText] = useState('Xin chào!');
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const refreshUnreadBadge = useCallback(async () => {
    try {
      const count = await refreshNotificationUnreadCount();
      setUnreadNotifications(count);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getNotificationUnreadCount()
      .then((count) => {
        if (mounted) setUnreadNotifications(Number(count) || 0);
      })
      .catch(() => {
        if (mounted) setUnreadNotifications(0);
      });

    const unsubscribe = subscribeNotificationUnreadChange((nextCount) => {
      if (!mounted) return;
      setUnreadNotifications(Number(nextCount) || 0);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const fetchData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }

      if (!forceRefresh && homeDataCache.fetched) {
        setCategories(homeDataCache.categories || []);
        setMenusByCategory(homeDataCache.menusByCategory || {});
        return;
      }

      const [categoryRes, menuRes] = await Promise.all([
        fetch(`${API_URL}/api/menu-category?page=1&pageSize=10`),
        fetch(`${API_URL}/api/menu?page=1&pageSize=100`),
      ]);

      const categoryJson = await categoryRes.json();
      const menuJson = await menuRes.json();

      const fetchedCategories = categoryJson?.items || [];
      const fetchedMenus = menuJson?.items || [];

      const groupedMenus = fetchedCategories.reduce((acc, category) => {
        const menusForCategory = fetchedMenus.filter(
          (menu) => menu.menuCategoryName === category.menuCategoryName
        );
        acc[category.menuCategoryName] = menusForCategory;
        return acc;
      }, {});

      setCategories(fetchedCategories);
      setMenusByCategory(groupedMenus);

      homeDataCache = {
        categories: fetchedCategories,
        menusByCategory: groupedMenus,
        fetched: true,
      };
    } catch (error) {
      console.error('Failed to fetch home data', error);
    } finally {
      if (forceRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  useEffect(() => {
    refreshUnreadBadge();
  }, [refreshUnreadBadge]);

  useEffect(() => {
    (async () => {
      const fullName = await getStoredFullName();
      setGreetingText(buildGreeting(fullName));
    })();
  }, []);

  useEffect(() => {
    if (route?.params?.fromLogout) {
      setToastMessage('Đăng xuất thành công');
      setToastVisible(true);
      // Clear flag so it won't show again when navigating back
      if (typeof navigation?.replace === 'function') {
        setTimeout(() => navigation.replace('Home', {}), 0);
      }
    }
  }, [route?.params?.fromLogout, navigation]);

  const formatPrice = (price) => {
    if (price == null) return '';

    try {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(price);
    } catch (e) {
      return `${price.toLocaleString('vi-VN')} đ`;
    }
  };

  const handleAiSuggestionPress = async () => {
    const token = await getAccessToken();
    if (!token) {
      setToastMessage('Tính năng này chỉ hỗ trợ khi đăng nhập');
      setToastVisible(true);
      return;
    }
    navigation.navigate('AiSuggestion');
  };

  const handleNotificationPress = async () => {
    const token = await getAccessToken();
    if (!token) {
      setToastMessage('Vui lòng đăng nhập để xem thông báo');
      setToastVisible(true);
      return;
    }
    navigation.navigate('CustomerNotification');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              // luôn gọi lại API khi pull to refresh
              fetchData(true);
            }}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.greeting}>{greetingText}</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.bellButton}
                onPress={handleNotificationPress}
                activeOpacity={0.8}
              >
                <Ionicons name="notifications-outline" size={22} color={TEXT_PRIMARY} />
              </TouchableOpacity>
              {unreadNotifications > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.headerBottomRow}>
            <Text style={styles.tagline}>Thưởng thức buffet đa dạng tại Bookfet!</Text>
            <TouchableOpacity
              style={styles.aiButton}
              onPress={handleAiSuggestionPress}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles-outline" size={16} color={BACKGROUND_WHITE} />
              <Text style={styles.aiButtonText}>AI</Text>
            </TouchableOpacity>
          </View>
        </View>

        {isLoading &&
          [1, 2].map((sectionIdx) => (
            <View style={styles.section} key={`skeleton-${sectionIdx}`}>
              <View style={styles.sectionHeader}>
                <SkeletonBox style={{ width: 140, height: 24, borderRadius: 6 }} />
                <SkeletonBox style={{ width: 80, height: 18, borderRadius: 6 }} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.horizontalScroll}
              >
                {[1, 2, 3].map((idx) => (
                  <View style={styles.imageCard} key={`card-skeleton-${sectionIdx}-${idx}`}>
                    <SkeletonBox style={{ width: '100%', height: 170, borderRadius: 16 }} />
                    <View style={styles.cardInfo}>
                      <SkeletonBox style={{ width: '80%', height: 16, borderRadius: 4 }} />
                      <View style={{ height: 6 }} />
                      <SkeletonBox style={{ width: 100, height: 14, borderRadius: 4 }} />
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ))}

        {!isLoading &&
          categories.map((category) => {
            const menusForCategory = menusByCategory[category.menuCategoryName] || [];

            if (!menusForCategory.length) {
              return null;
            }

            return (
              <View style={styles.section} key={category.menuCategoryId}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>{category.menuCategoryName}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate('MenuList', {
                        buffetType: category.menuCategoryName,
                        menuCategoryId: category.menuCategoryId,
                      })
                    }
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seeMore}>Xem thêm</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.horizontalScroll}
                >
                  {menusForCategory.map((menu) => (
                    <TouchableOpacity
                      key={menu.menuId}
                      style={styles.imageCard}
                      onPress={() =>
                        navigation.navigate('MenuDetail', {
                          menuId: menu.menuId,
                          buffetType: category.menuCategoryName,
                          menuCategoryId: category.menuCategoryId,
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: Array.isArray(menu.imgUrl) ? menu.imgUrl[0] : menu.imgUrl }}
                        style={styles.cardImage}
                        contentFit="cover"
                        cachePolicy="disk"
                        transition={0}
                      />
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {menu.menuName}
                        </Text>
                        <Text style={styles.cardPrice}>{formatPrice(menu.basePrice)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            );
          })}
      </ScrollView>
      
      <BottomNavigation activeTab="Home" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerActions: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    marginBottom: 8,
  },
  aiButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 12,
    fontWeight: '700',
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  bellBadgeText: {
    color: BACKGROUND_WHITE,
    fontSize: 10,
    fontWeight: '800',
  },
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tagline: {
    flex: 1,
    fontSize: 14,
    color: TEXT_PRIMARY,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  seeMore: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  horizontalScroll: {
    paddingLeft: 20,
  },
  imageCard: {
    width: width * 0.7,
    height: 230,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: BACKGROUND_WHITE,
  },
  cardImage: {
    width: '100%',
    height: 170,
    borderRadius: 16,
  },
  cardInfo: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: BACKGROUND_WHITE,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '500',
    color: PRIMARY_COLOR,
  },
});
