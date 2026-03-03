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
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';
import API_URL from '../constants/api';

const { width, height } = Dimensions.get('window');

const SkeletonBox = ({ style }) => (
  <View style={[{ backgroundColor: '#E5E5E5' }, style]} />
);

const getMenuDetail = () => {
  const baseImageUrl =
    'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg';

  return {
    images: [baseImageUrl, baseImageUrl, baseImageUrl],
    rating: 4.9,
    reviewCount: '1.8k',
    aiSummary:
      'Menu đa dạng, nguyên liệu tươi, phù hợp đi nhóm và gia đình. Rau và nấm giúp cân bằng dinh dưỡng, các món chính được ưa chuộng bởi hương vị đậm đà.',
  };
};

export default function MenuDetailScreen({ navigation, route }) {
  const menuId = route?.params?.menuId || 1;
  const menuCategoryId = route?.params?.menuCategoryId;
  const buffetType = route?.params?.buffetType || 'Buffet Bò';
  const fromStaff = route?.params?.fromStaff || false;

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
  const [dishes, setDishes] = useState([]);
  const [isLoadingDishes, setIsLoadingDishes] = useState(false);
  const [isLoadingMenuInfo, setIsLoadingMenuInfo] = useState(false);
  const [menuInfo, setMenuInfo] = useState(null);

  const baseDetail = getMenuDetail();
  const menuDetail = {
    ...baseDetail,
    images: menuInfo?.imgUrl ? [menuInfo.imgUrl] : baseDetail.images,
  };
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

  const handleChooseMenu = () => {
    // TODO: Implement choose menu functionality
    console.log('Choose menu:', menuInfo || menuDetail);
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
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

        {/* Menu title */}
        {isLoadingMenuInfo ? (
          <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 }}>
            <SkeletonBox style={{ width: 220, height: 28, borderRadius: 6 }} />
          </View>
        ) : (
          menuInfo && <Text style={styles.menuTitle}>{menuInfo.menuName}</Text>
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
            <View style={styles.ratingLeft}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.ratingText}>{menuDetail.rating}</Text>
              <Text style={styles.reviewCount}>{menuDetail.reviewCount} đánh giá</Text>
            </View>
            <TouchableOpacity activeOpacity={0.7}>
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
          ) : (
            <>
              <Text style={styles.aiSummaryTitle}>AI tóm tắt đánh giá</Text>
              <Text style={styles.aiSummaryText}>{menuDetail.aiSummary}</Text>
            </>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Bar (ẩn với staff) */}
      {!fromStaff && (
        <View style={styles.bottomBar}>
          {isLoadingMenuInfo ? (
            <SkeletonBox style={{ width: 120, height: 24, borderRadius: 6 }} />
          ) : (
            <Text style={styles.price}>
              {menuInfo?.basePrice != null ? formatPrice(menuInfo.basePrice) : ''}
            </Text>
          )}
          <TouchableOpacity
            style={styles.chooseButton}
            onPress={handleChooseMenu}
            activeOpacity={0.8}
          >
            <Text style={styles.chooseButtonText}>Chọn Menu</Text>
          </TouchableOpacity>
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
  chooseButtonText: {
    color: BACKGROUND_WHITE,
    fontSize: 16,
    fontWeight: '600',
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
});
