import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { requireAuth } from '../utils/auth';
import { addMenuToCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';
import API_URL from '../constants/api';

const { width } = Dimensions.get('window');

// Cache theo menuCategoryId (mỗi danh mục một cache riêng)
const menuListCache = {};

const SkeletonBox = ({ style }) => (
  <View style={[{ backgroundColor: '#E5E5E5' }, style]} />
);

export default function MenuListScreen({ navigation, route }) {
  const buffetType = route?.params?.buffetType || 'Danh sách menu';
  const menuCategoryId = route?.params?.menuCategoryId;
  const [menuItems, setMenuItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const fetchMenus = async (forceRefresh = false) => {
    if (!menuCategoryId) return;

    const cached = menuListCache[menuCategoryId];
    if (!forceRefresh && cached?.fetched && cached?.items) {
      setMenuItems(cached.items);
      return;
    }

    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }

      const res = await fetch(
        `${API_URL}/api/menu?MenuCategoryId=${menuCategoryId}&page=1&pageSize=100`,
      );
      const json = await res.json();
      const items = json?.items || [];
      setMenuItems(items);
      menuListCache[menuCategoryId] = { items, fetched: true };
    } catch (error) {
      console.error('Failed to fetch menu list', error);
    } finally {
      if (forceRefresh) {
        setRefreshing(false);
      } else {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchMenus(false);
  }, [menuCategoryId]);

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

  const swipeBack = useSwipeBack(() => navigation.navigate('Home'));

  const handleAddToCart = async (item) => {
    const ok = await requireAuth(navigation, {
      returnScreen: 'MenuList',
      returnParams: { buffetType, menuCategoryId },
    });
    if (!ok) return;
    const result = await addMenuToCart({
      ...item,
      menuCategoryId: menuCategoryId ?? null,
      buffetType: buffetType ?? null,
    });
    if (!result.success && result.reason === 'DUPLICATE_MENU') {
      showToast('Mỗi tiệc chỉ được chọn 1 menu');
      return;
    }
    showToast('Đã thêm vào giỏ hàng');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{buffetType}</Text>
      </View>

      {/* Menu List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMenus(true)}
          />
        }
      >
        {isLoading &&
          [1, 2, 3].map((idx) => (
            <View style={styles.menuCard} key={`skeleton-${idx}`}>
              <SkeletonBox style={{ width: 100, height: 100, borderRadius: 16 }} />
              <View style={styles.menuInfo}>
                <SkeletonBox style={{ width: '80%', height: 18, borderRadius: 4 }} />
                <View style={{ height: 8 }} />
                <SkeletonBox style={{ width: 80, height: 16, borderRadius: 4 }} />
              </View>
              <View style={styles.addButton} />
            </View>
          ))}

        {!isLoading &&
          menuItems.map((item) => (
            <TouchableOpacity
              key={item.menuId}
              style={styles.menuCard}
              onPress={() =>
                navigation.navigate('MenuDetail', {
                  menuId: item.menuId,
                  buffetType: buffetType,
                  menuCategoryId,
                })
              }
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: Array.isArray(item.imgUrl) ? item.imgUrl[0] : item.imgUrl }}
                style={styles.menuImage}
                contentFit="cover"
                cachePolicy="disk"
                transition={150}
              />
              <View style={styles.menuInfo}>
                <Text style={styles.menuName}>{item.menuName}</Text>
                <Text style={styles.menuPrice}>{formatPrice(item.basePrice)}</Text>
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={24} color={BACKGROUND_WHITE} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
    paddingTop: 16,
  },
  menuCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  menuImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  menuName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  menuQuantity: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  menuPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
