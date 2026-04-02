import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { requireAuth } from '../utils/auth';
import { addMenuToCart } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';
import API_URL from '../constants/api';

const { width, height } = Dimensions.get('window');

let similarMenusCacheByCategory = {};

const SkeletonBox = ({ style }) => (
  <View style={[{ backgroundColor: '#E5E5E5' }, style]} />
);

const getMenuDetail = () => {
  const baseImageUrl =
    'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg';

  return {
    images: [baseImageUrl, baseImageUrl, baseImageUrl],
  };
};

const formatRating = (rating) => {
  if (rating == null) return '';
  const numericRating = Number(rating);
  return Number.isFinite(numericRating) ? numericRating.toFixed(1) : String(rating);
};

const formatReviewCount = (count) => {
  if (count == null) return '';
  return String(count);
};

export default function MenuDetailScreen({ navigation, route }) {
  const menuId = route?.params?.menuId || 1;
  const menuCategoryId = route?.params?.menuCategoryId;
  const buffetType = route?.params?.buffetType || 'Buffet Bò';
  const fromStaff = route?.params?.fromStaff || false;
  const readOnly = route?.params?.readOnly === true;
  const menuNameFromParams = route?.params?.menuName;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [dishes, setDishes] = useState([]);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [isLoadingMenuInfo, setIsLoadingMenuInfo] = useState(false);
  const [menuInfo, setMenuInfo] = useState(null);
  const [similarMenus, setSimilarMenus] = useState([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const baseDetail = getMenuDetail();
  const menuDetail = {
    ...baseDetail,
    images: Array.isArray(menuInfo?.imgUrl)
      ? menuInfo.imgUrl
      : menuInfo?.imgUrl
        ? [menuInfo.imgUrl]
        : baseDetail.images,
    averageRating: menuInfo?.averageRating ?? null,
    totalReviews: menuInfo?.totalReviews ?? null,
  };
  const aiSummaryText =
    typeof menuInfo?.aisMenuSummary === 'string' ? menuInfo.aisMenuSummary.trim() : '';
  const hasAiSummary = aiSummaryText.length > 0;
  const flatListRef = useRef(null);
  const fullscreenFlatListRef = useRef(null);
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const handleImageScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setCurrentImageIndex(index);
  };

  const handleFullscreenImageScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setFullscreenImageIndex(index);
  };

  const openFullscreen = (index) => {
    setFullscreenImageIndex(index);
    setIsFullscreenVisible(true);
  };

  const closeFullscreen = () => {
    setIsFullscreenVisible(false);
  };

  useEffect(() => {
    if (isFullscreenVisible && fullscreenFlatListRef.current) {
      setTimeout(() => {
        fullscreenFlatListRef.current?.scrollToIndex({
          index: fullscreenImageIndex,
          animated: false,
        });
      }, 100);
    }
  }, [isFullscreenVisible, fullscreenImageIndex]);

  const handleChooseMenu = async () => {
    if (isLoadingMenuInfo || !menuInfo) {
      showToast('Vui lòng đợi tải menu xong');
      return;
    }
    const ok = await requireAuth(navigation, {
      returnScreen: 'MenuDetail',
      returnParams: { menuId, menuCategoryId, buffetType, fromStaff },
    });
    if (!ok) return;
    const menu = menuInfo;
    const result = await addMenuToCart({
      ...menu,
      menuCategoryId: menuCategoryId ?? null,
      buffetType: buffetType ?? null,
    });
    if (!result.success && result.reason === 'DUPLICATE_MENU') {
      showToast('Mỗi tiệc chỉ được chọn 1 menu');
      return;
    }
    showToast('Đã thêm vào giỏ hàng');
  };

  const handleChatMenu = async () => {
    const ok = await requireAuth(navigation, {
      returnScreen: 'MenuDetail',
      returnParams: { menuId, menuCategoryId, buffetType, fromStaff, menuName: menuNameFromParams },
    });
    if (!ok) return;

    navigation.navigate('Chat', {
      menuId: Number(menuId),
      fromMenuDetail: true,
    });
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
      return `${price.toLocaleString('vi-VN')} đ`;
    }
  };

  useEffect(() => {
    const fetchDishes = async () => {
      try {
        setIsLoadingDishes(true);
        const res = await fetch(
          `${API_URL}/api/menu-dish?MenuId=${menuId}&page=1&pageSize=10`,
        );
        const json = await res.json();
        setDishes(json?.items || []);
      } catch (error) {
        console.error('Failed to fetch menu dishes', error);
      } finally {
        setIsLoadingDishes(false);
      }
    };

    fetchDishes();
  }, [menuId]);

  useEffect(() => {
    const fetchMenuInfo = async () => {
      if (!menuCategoryId) return;

      try {
        setIsLoadingMenuInfo(true);
        const res = await fetch(
          `${API_URL}/api/menu?MenuId=${menuId}&MenuCategoryId=${menuCategoryId}&page=1&pageSize=1`,
        );
        const json = await res.json();
        const first = json?.items?.[0];
        if (first) {
          setMenuInfo(first);
        }
      } catch (error) {
        console.error('Failed to fetch menu info', error);
      } finally {
        setIsLoadingMenuInfo(false);
      }
    };

    fetchMenuInfo();
  }, [menuId, menuCategoryId]);

  useEffect(() => {
    const fetchSimilarMenus = async (force = false) => {
      if (!menuCategoryId) {
        setSimilarMenus([]);
        return;
      }

      const cached = similarMenusCacheByCategory[menuCategoryId];
      if (!force && cached?.fetched && Array.isArray(cached.items)) {
        setSimilarMenus(cached.items.filter((m) => m?.menuId !== menuId));
        return;
      }

      try {
        setIsLoadingSimilar(true);
        const res = await fetch(
          `${API_URL}/api/menu?MenuCategoryId=${menuCategoryId}&page=1&pageSize=20`,
        );
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];
        similarMenusCacheByCategory[menuCategoryId] = { items, fetched: true };
        setSimilarMenus(items.filter((m) => m?.menuId !== menuId));
      } catch (e) {
        setSimilarMenus([]);
      } finally {
        setIsLoadingSimilar(false);
      }
    };

    fetchSimilarMenus(false);
  }, [menuCategoryId, menuId]);

  // Render dishes in 2 columns
  const renderDishes = () => {
    const names = dishes.map((d) => d.dishName);
    if (!names.length) return null;

    const items = [];
    for (let i = 0; i < names.length; i += 2) {
      items.push(
        <View key={i} style={styles.menuItemRow}>
          <View style={styles.menuItemColumn}>
            <Text style={styles.menuItemNumber}>{i + 1}.</Text>
            <Text style={styles.menuItemText}>{names[i]}</Text>
          </View>
          {i + 1 < names.length && (
            <View style={styles.menuItemColumn}>
              <Text style={styles.menuItemNumber}>{i + 2}.</Text>
              <Text style={styles.menuItemText}>{names[i + 1]}</Text>
            </View>
          )}
        </View>
      );
    }
    return items;
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
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết menu</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Carousel */}
        <View style={styles.imageCarouselContainer}>
          {isLoadingMenuInfo ? (
            <View style={styles.imageWrapper}>
              <SkeletonBox style={{ width: width - 40, height: 300, borderRadius: 20 }} />
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={menuDetail.images}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleImageScroll}
                scrollEventThrottle={16}
                keyExtractor={(item, index) => `image-${index}`}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    style={styles.imageWrapper}
                    activeOpacity={1}
                    onPress={() => openFullscreen(index)}
                  >
                    <Image
                      source={{ uri: item }}
                      style={styles.carouselImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}
                getItemLayout={(data, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
              />
              {/* Carousel Indicators */}
              <View style={styles.indicators}>
                {menuDetail.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.indicator,
                      index === currentImageIndex && styles.indicatorActive,
                    ]}
                  />
                ))}
              </View>
            </>
          )}
        </View>

        {/* Menu title: từ API hoặc params (staff/leader không có menuCategoryId nên dùng params) */}
        {isLoadingMenuInfo && !menuNameFromParams ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 }}>
            <SkeletonBox style={{ width: 220, height: 28, borderRadius: 6 }} />
          </View>
        ) : (
          (menuInfo?.menuName ?? menuNameFromParams) != null && (
            <Text style={styles.menuTitle}>
              {menuInfo?.menuName ?? menuNameFromParams}
            </Text>
          )
        )}

        {/* Dish List */}
        {isLoadingDishes ? (
          <View style={styles.menuItemsContainer}>
            {[1, 2, 3].map((row) => (
              <View style={styles.menuItemRow} key={`dish-skeleton-${row}`}>
                <View style={styles.menuItemColumn}>
                  <SkeletonBox style={{ width: 24, height: 18, borderRadius: 4 }} />
                  <View style={{ width: 8 }} />
                  <SkeletonBox
                    style={{ width: width / 2 - 60, height: 18, borderRadius: 4 }}
                  />
                </View>
                <View style={styles.menuItemColumn}>
                  <SkeletonBox style={{ width: 24, height: 18, borderRadius: 4 }} />
                  <View style={{ width: 8 }} />
                  <SkeletonBox
                    style={{ width: width / 2 - 60, height: 18, borderRadius: 4 }}
                  />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.menuItemsContainer}>{renderDishes()}</View>
        )}

        {/* Rating Section */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingRow}>
            {menuDetail.averageRating != null && menuDetail.totalReviews != null ? (
              <View style={styles.ratingLeft}>
                <Ionicons name="star" size={20} color="#FFD700" />
                <Text style={styles.ratingText}>{formatRating(menuDetail.averageRating)}</Text>
                <Text style={styles.reviewCount}>
                  {formatReviewCount(menuDetail.totalReviews)} lượt đánh giá
                </Text>
              </View>
            ) : (
              <Text style={styles.noReviewText}>Chưa có đánh giá nào</Text>
            )}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Feedback', { menuId })}
            >
              <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>

          {/* AI Summary */}
          {isLoadingMenuInfo ? (
            <View>
              <SkeletonBox style={{ width: 160, height: 20, borderRadius: 4 }} />
              <View style={{ height: 8 }} />
              <SkeletonBox style={{ width: '100%', height: 14, borderRadius: 4 }} />
              <View style={{ height: 6 }} />
              <SkeletonBox style={{ width: '95%', height: 14, borderRadius: 4 }} />
              <View style={{ height: 6 }} />
              <SkeletonBox style={{ width: '80%', height: 14, borderRadius: 4 }} />
            </View>
          ) : hasAiSummary ? (
            <>
              <Text style={styles.aiSummaryTitle}>AI tóm tắt đánh giá</Text>
              <Text style={styles.aiSummaryText}>{aiSummaryText}</Text>
            </>
          ) : null}
        </View>

        {/* Similar Menus */}
        {false && !!menuCategoryId && (
          <View style={styles.similarSection}>
            <Text style={styles.similarTitle}>Menu tương tự</Text>
            {isLoadingSimilar ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {[1, 2, 3].map((i) => (
                  <View key={`similar-skel-${i}`} style={styles.similarCard}>
                    <SkeletonBox style={styles.similarImage} />
                    <View style={{ height: 10 }} />
                    <SkeletonBox style={{ width: 110, height: 14, borderRadius: 4 }} />
                    <View style={{ height: 6 }} />
                    <SkeletonBox style={{ width: 70, height: 12, borderRadius: 4 }} />
                  </View>
                ))}
              </ScrollView>
            ) : similarMenus.length === 0 ? (
              <Text style={styles.similarEmpty}>Chưa có menu tương tự</Text>
            ) : (
              <FlatList
                data={similarMenus}
                keyExtractor={(item) => String(item.menuId)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.similarList}
                renderItem={({ item }) => {
                  const imgUrl = Array.isArray(item?.imgUrl) ? item.imgUrl[0] : item?.imgUrl;
                  return (
                    <TouchableOpacity
                      style={styles.similarCard}
                      activeOpacity={0.85}
                      onPress={() =>
                        navigation.navigate('MenuDetail', {
                          menuId: item.menuId,
                          menuCategoryId,
                          buffetType,
                          fromStaff,
                          menuName: item.menuName,
                        })
                      }
                    >
                      {imgUrl ? (
                        <Image source={{ uri: imgUrl }} style={styles.similarImage} resizeMode="cover" />
                      ) : (
                        <View style={[styles.similarImage, styles.similarImagePlaceholder]}>
                          <Ionicons name="image-outline" size={18} color={TEXT_SECONDARY} />
                        </View>
                      )}
                      <Text style={styles.similarName} numberOfLines={2}>
                        {item.menuName || 'Menu'}
                      </Text>
                      <Text style={styles.similarPrice} numberOfLines={1}>
                        {item.basePrice != null ? formatPrice(item.basePrice) : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar (ẩn với staff) */}
      {!fromStaff && !readOnly && (
        <View style={styles.bottomBar}>
          {isLoadingMenuInfo ? (
            <SkeletonBox style={{ width: 120, height: 24, borderRadius: 6 }} />
          ) : (
            <Text style={styles.price}>
              {menuInfo?.basePrice != null ? formatPrice(menuInfo.basePrice) : ''}
            </Text>
          )}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleChatMenu}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={PRIMARY_COLOR} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.chooseButton,
                (isLoadingMenuInfo || !menuInfo) && styles.chooseButtonDisabled,
              ]}
              onPress={handleChooseMenu}
              disabled={isLoadingMenuInfo || !menuInfo}
              activeOpacity={0.8}
            >
              <Text style={styles.chooseButtonText}>Chọn Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Fullscreen Image Modal */}
      <Modal
        visible={isFullscreenVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeFullscreen}
      >
        <View style={styles.fullscreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeFullscreen}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={32} color={BACKGROUND_WHITE} />
          </TouchableOpacity>
          
          <FlatList
            ref={fullscreenFlatListRef}
            data={menuDetail.images}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleFullscreenImageScroll}
            scrollEventThrottle={16}
            keyExtractor={(item, index) => `fullscreen-image-${index}`}
            onScrollToIndexFailed={(info) => {
              // Fallback if scroll fails
              setTimeout(() => {
                fullscreenFlatListRef.current?.scrollToIndex({
                  index: info.index,
                  animated: false,
                });
              }, 100);
            }}
            renderItem={({ item }) => (
              <View style={styles.fullscreenImageWrapper}>
                <Image
                  source={{ uri: item }}
                  style={styles.fullscreenImage}
                  resizeMode="contain"
                />
              </View>
            )}
            getItemLayout={(data, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
          />

          {/* Fullscreen Indicators */}
          <View style={styles.fullscreenIndicators}>
            {menuDetail.images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.fullscreenIndicator,
                  index === fullscreenImageIndex && styles.fullscreenIndicatorActive,
                ]}
              />
            ))}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  imageCarouselContainer: {
    width: width,
    height: 320,
    position: 'relative',
  },
  imageWrapper: {
    width: width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  carouselImage: {
    width: width - 40,
    height: 300,
    borderRadius: 20,
  },
  indicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D0D0D0',
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: PRIMARY_COLOR,
    width: 24,
  },
  menuTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  menuItemsContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  menuItemRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  menuItemColumn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemNumber: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    marginRight: 8,
    minWidth: 24,
  },
  menuItemText: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    flex: 1,
  },
  ratingSection: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginLeft: 6,
    marginRight: 8,
  },
  reviewCount: {
    fontSize: 14,
    color: TEXT_SECONDARY,
  },
  noReviewText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    fontWeight: '600',
  },
  aiSummaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  aiSummaryText: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 22,
  },
  similarSection: {
    marginTop: 6,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  similarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 10,
  },
  similarEmpty: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  similarList: {
    paddingRight: 8,
  },
  similarCard: {
    width: 150,
    marginRight: 12,
    backgroundColor: '#F7F7F7',
    borderRadius: 16,
    padding: 10,
  },
  similarImage: {
    width: '100%',
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
  },
  similarImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarName: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  similarPrice: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 34,
    backgroundColor: BACKGROUND_WHITE,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  chooseButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  chooseButtonDisabled: {
    opacity: 0.6,
  },
  chooseButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    borderColor: PRIMARY_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: BACKGROUND_WHITE,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImageWrapper: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: width,
    height: height,
  },
  fullscreenIndicators: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    marginHorizontal: 4,
  },
  fullscreenIndicatorActive: {
    backgroundColor: BACKGROUND_WHITE,
    width: 24,
  },
  headerRight: {
    width: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
});
