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

const { width, height } = Dimensions.get('window');

// Sample menu detail data - in a real app, this would come from props or API
const getMenuDetail = (menuId, buffetType) => {
  const baseImageUrl = 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg';
  
  // Sample menu items based on buffet type
  let menuItems = [];
  if (buffetType === 'Buffet Bò') {
    menuItems = [
      'Ba chỉ bò Mỹ',
      'Bắp bò Mỹ',
      'Nạc vai bò Mỹ',
      'Gầu bò Mỹ',
      'Thăn bò Mỹ',
      'Gân bò',
      'Bò viên',
      'Cải thảo',
      'Rau muống',
      'Nấm kim châm',
    ];
  } else if (buffetType === 'Buffet Hải sản') {
    menuItems = [
      'Tôm sú',
      'Cua biển',
      'Mực tươi',
      'Cá hồi',
      'Bạch tuộc',
      'Nghêu',
      'Sò điệp',
      'Rong biển',
      'Rau câu',
      'Nấm đông cô',
    ];
  } else {
    menuItems = [
      'Đậu phụ chiên',
      'Chả chay',
      'Nấm đông cô',
      'Rau củ tươi',
      'Bún gạo',
      'Miến chay',
      'Tàu hủ',
      'Rau muống',
      'Cải thảo',
      'Nấm kim châm',
    ];
  }

  return {
    id: menuId || 1,
    name: buffetType === 'Buffet Bò' 
      ? 'Buffet Lẩu Bò Mỹ'
      : buffetType === 'Buffet Hải sản'
      ? 'Buffet Lẩu Hải Sản Tươi'
      : 'Buffet Lẩu Chay Thập Cẩm',
    images: [baseImageUrl, baseImageUrl, baseImageUrl], // 3 images for carousel
    menuItems: menuItems,
    rating: 4.9,
    reviewCount: '1.8k',
    price: '229.000₫',
    aiSummary: buffetType === 'Buffet Bò'
      ? 'Thịt bò tươi, mềm, dễ nhúng lẩu; ba chỉ và gầu bò được yêu thích nhất. Rau và nấm tươi, giúp bữa ăn cân bằng. Menu đa dạng, dễ ăn, phù hợp đi nhóm và gia đình.'
      : buffetType === 'Buffet Hải sản'
      ? 'Hải sản tươi ngon, đa dạng các loại tôm cua cá. Chế biến cẩn thận, giữ được độ tươi ngon. Rau và nấm bổ sung cân bằng dinh dưỡng. Phù hợp cho những người yêu thích hải sản.'
      : 'Món chay đa dạng, tươi ngon, chế biến công phu. Đậu phụ và nấm là điểm nhấn của menu. Rau củ tươi, giàu dinh dưỡng. Phù hợp cho người ăn chay và những ai muốn thưởng thức món chay thanh đạm.',
  };
};

export default function MenuDetailScreen({ navigation, route }) {
  const menuId = route?.params?.menuId || 1;
  const buffetType = route?.params?.buffetType || 'Buffet Bò';
  const menuDetail = getMenuDetail(menuId, buffetType);
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [isFullscreenVisible, setIsFullscreenVisible] = useState(false);
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
    console.log('Choose menu:', menuDetail);
  };

  // Render menu items in 2 columns
  const renderMenuItems = () => {
    const items = [];
    for (let i = 0; i < menuDetail.menuItems.length; i += 2) {
      items.push(
        <View key={i} style={styles.menuItemRow}>
          <View style={styles.menuItemColumn}>
            <Text style={styles.menuItemNumber}>{i + 1}.</Text>
            <Text style={styles.menuItemText}>{menuDetail.menuItems[i]}</Text>
          </View>
          {i + 1 < menuDetail.menuItems.length && (
            <View style={styles.menuItemColumn}>
              <Text style={styles.menuItemNumber}>{i + 2}.</Text>
              <Text style={styles.menuItemText}>{menuDetail.menuItems[i + 1]}</Text>
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
        </View>

        {/* Menu Title */}
        <Text style={styles.menuTitle}>{menuDetail.name}</Text>

        {/* Menu Items List */}
        <View style={styles.menuItemsContainer}>
          {renderMenuItems()}
        </View>

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
          <Text style={styles.aiSummaryTitle}>AI tóm tắt đánh giá</Text>
          <Text style={styles.aiSummaryText}>{menuDetail.aiSummary}</Text>
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Text style={styles.price}>{menuDetail.price}</Text>
        <TouchableOpacity
          style={styles.chooseButton}
          onPress={handleChooseMenu}
          activeOpacity={0.8}
        >
          <Text style={styles.chooseButtonText}>Chọn Menu</Text>
        </TouchableOpacity>
      </View>

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
