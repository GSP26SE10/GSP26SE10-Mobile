import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { requireAuth } from '../utils/auth';
import { addDishToCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import API_URL from '../constants/api';
import { TEXT_PRIMARY, TEXT_SECONDARY, BACKGROUND_WHITE, PRIMARY_COLOR } from '../constants/colors';

const { width } = Dimensions.get('window');

let otherDishesCache = { fetched: false, items: null };

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

const normalizeDish = (dishFromRoute) => {
  const d = dishFromRoute || {};
  return {
    dishId: d.dishId ?? d.id,
    dishName: d.dishName ?? d.name ?? 'Món ăn',
    price: d.price ?? null,
    priceFormatted: d.priceFormatted ?? formatPrice(d.price),
    description: d.description ?? 'Nội dung chi tiết sẽ được cập nhật.',
    note: d.note ?? '',
    image: d.image ?? d.img ?? null,
    dishCategoryId: d.dishCategoryId ?? null,
    dishCategoryName: d.dishCategoryName ?? '',
  };
};

export default function DishDetailScreen({ navigation, route }) {
  const raw = route?.params?.dish;
  const dish = normalizeDish(raw);
  const priceText = dish.priceFormatted || formatPrice(dish.price);
  const imageUri = dish.image;
  const swipeBack = useSwipeBack(() => navigation.goBack());
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [otherDishes, setOtherDishes] = useState([]);
  const [loadingOther, setLoadingOther] = useState(false);

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleChooseDish = async () => {
    if (!dish?.dishId || dish?.price == null) {
      showToast('Vui lòng đợi tải món ăn xong');
      return;
    }
    const ok = await requireAuth(navigation, {
      returnScreen: 'DishDetail',
      returnParams: { dish: raw },
    });
    if (!ok) return;
    const result = await addDishToCart(dish);
    if (!result.success && result.reason === 'NO_MENU') {
      showToast('Vui lòng chọn menu trước!');
      return;
    }
    showToast('Đã thêm vào giỏ hàng');
  };

  useEffect(() => {
    const load = async (force = false) => {
      try {
        if (!force && otherDishesCache.fetched && Array.isArray(otherDishesCache.items)) {
          setOtherDishes(
            otherDishesCache.items.filter((d) => d?.dishId !== dish.dishId),
          );
          return;
        }
        setLoadingOther(true);
        const res = await fetch(`${API_URL}/api/dish?page=1&pageSize=50`);
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
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
        otherDishesCache = { fetched: true, items: mapped };
        setOtherDishes(mapped.filter((d) => d?.dishId !== dish.dishId));
      } catch (e) {
        setOtherDishes([]);
      } finally {
        setLoadingOther(false);
      }
    };
    load(false);
  }, [dish.dishId]);

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
        <Text style={styles.headerTitle}>Chi tiết món ăn</Text>
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
          <Text style={styles.dishTitle}>{dish.dishName}</Text>
          <Text style={styles.dishPrice}>{priceText}</Text>
          {dish.dishCategoryName ? (
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{dish.dishCategoryName}</Text>
            </View>
          ) : null}
          <Text style={styles.dishDescription}>{dish.description}</Text>
          {dish.note ? <Text style={styles.dishNote}>{dish.note}</Text> : null}
        </View>

        {/* Other dishes */}
        <View style={styles.otherSection}>
          <Text style={styles.otherTitle}>Các món khác</Text>
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
          ) : otherDishes.length === 0 ? (
            <Text style={styles.otherEmpty}>Chưa có món khác</Text>
          ) : (
            <FlatList
              data={otherDishes}
              keyExtractor={(item) => String(item.dishId)}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.otherList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.otherCard}
                  activeOpacity={0.85}
                  onPress={() =>
                    navigation.navigate('DishDetail', { dish: item })
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
                    {item.dishName || 'Món ăn'}
                  </Text>
                  <Text style={styles.otherPrice} numberOfLines={1}>
                    {item.price != null ? formatPrice(item.price) : ''}
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
            onPress={handleChooseDish}
            activeOpacity={0.8}
          >
            <Text style={styles.chooseButtonText}>Thêm vào giỏ</Text>
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
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mainImage: {
    width: width - 40,
    height: 300,
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
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
  dishTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  dishPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginBottom: 12,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  dishDescription: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  dishNote: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    marginTop: 8,
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
