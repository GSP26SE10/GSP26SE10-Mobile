import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import BottomNavigation from '../components/BottomNavigation';
import { getCart, updateCartItemQuantity, removeCartItem } from '../utils/cartStorage';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const { width } = Dimensions.get('window');

const TABS = [
  { id: 'cart', label: 'Giỏ hàng' },
  { id: 'upcoming', label: 'Sắp tới' },
  { id: 'ongoing', label: 'Đang diễn ra' },
  { id: 'completed', label: 'Hoàn thành' },
];

export default function OrdersScreen({ navigation }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [cartItems, setCartItems] = useState([]);
  const flatListRef = useRef(null);
  const tabScrollRef = useRef(null);
  const tabLayouts = useRef({});
  const tabScrollPosition = useRef(0);

  const loadCart = useCallback(async () => {
    const items = await getCart();
    setCartItems(items);
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Khi quay lại màn Orders (từ MenuDetail/ServiceDetail sau khi thêm), reload giỏ
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', loadCart);
    return () => unsubscribe?.();
  }, [navigation, loadCart]);

  const handleTabPress = (index) => {
    setActiveTabIndex(index);
    flatListRef.current?.scrollToIndex({ index, animated: true });
  };

  const handleContentScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    if (index !== activeTabIndex) {
      setActiveTabIndex(index);
    }
  };

  // Auto-scroll tab bar when active tab changes
  useEffect(() => {
    if (tabScrollRef.current && tabLayouts.current[activeTabIndex]) {
      setTimeout(() => {
        const tabLayout = tabLayouts.current[activeTabIndex];
        if (!tabLayout) return;
        
        const tabX = tabLayout.x; // Relative to ScrollView content (includes padding)
        const tabWidth = tabLayout.width;
        const padding = 20;
        const screenWidth = width;
        
        let scrollToX = 0;
        
        // For first tab, always scroll to start
        if (activeTabIndex === 0) {
          scrollToX = 0;
        } else {
          // For other tabs, scroll to make them visible
          // tabX is relative to content start (with padding), so we scroll to show the tab
          scrollToX = Math.max(0, tabX - padding);
        }
        
        tabScrollRef.current.scrollTo({
          x: scrollToX,
          animated: true,
        });
        tabScrollPosition.current = scrollToX;
      }, 150);
    }
  }, [activeTabIndex]);

  const handleQuantityChange = async (itemId, delta) => {
    const next = await updateCartItemQuantity(itemId, delta);
    setCartItems(next);
  };

  const handleRemoveItem = async (itemId) => {
    const next = await removeCartItem(itemId);
    setCartItems(next);
  };

  const openCartItemDetail = (item) => {
    if (!item) return;
    if (item.type === 'menu') {
      navigation.navigate('MenuDetail', {
        menuId: item.menuId,
        menuCategoryId: item.menuCategoryId || undefined,
        buffetType: item.buffetType || item.name || 'Menu',
      });
      return;
    }
    if (item.type === 'service') {
      navigation.navigate('ServiceDetail', {
        service: {
          serviceId: item.serviceId,
          serviceName: item.name,
          basePrice: item.basePrice,
          image: item.image,
        },
      });
    }
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.orderCard}>
      {item.image ? (
        <ExpoImage
          source={{ uri: item.image }}
          style={styles.orderImage}
          contentFit="cover"
          cachePolicy="disk"
        />
      ) : (
        <View style={[styles.orderImage, { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' }]}>
          <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
        </View>
      )}
      <View style={styles.orderInfo}>
        <Text style={styles.orderName}>{item.name}</Text>
        {item.quantity && (
          <Text style={styles.orderQuantity}>{item.quantity}</Text>
        )}
        <Text style={styles.orderPrice}>{item.priceFormatted}</Text>
      </View>
      <View style={styles.quantityContainer}>
        {item.count > 1 ? (
          <>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, -1)}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>-</Text>
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.count}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleRemoveItem(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={20} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            <Text style={styles.quantityText}>{item.count}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange(item.id, 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.quantityButtonText}>+</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  const renderCartContent = () => {
    if (cartItems.length === 0) {
      return (
        <View style={styles.tabContent}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Giỏ hàng trống</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {cartItems.map((item) => (
            <View key={item.id} style={styles.orderCard}>
              <TouchableOpacity
                style={styles.orderCardTop}
                onPress={() => openCartItemDetail(item)}
                activeOpacity={0.8}
              >
                {item.image ? (
                  <ExpoImage
                    source={{ uri: item.image }}
                    style={styles.orderImage}
                    contentFit="cover"
                    cachePolicy="disk"
                  />
                ) : (
                  <View style={[styles.orderImage, { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
                  </View>
                )}
                <View style={styles.orderInfo}>
                  <Text style={styles.orderName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.orderPrice} numberOfLines={1}>{item.priceFormatted}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.quantityContainer}>
                {item.count > 1 ? (
                  <>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(item.id, -1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.count}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(item.id, 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleRemoveItem(item.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color="#FF0000" />
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.count}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => handleQuantityChange(item.id, 1)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.addPartyButton} activeOpacity={0.7}>
            <Text style={styles.addPartyText}>Thêm tiệc</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.continueButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('OrderConfirmation')}
          >
            <Text style={styles.continueText}>Tiếp tục</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyTab = (message) => (
    <View style={styles.tabContent}>
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{message}</Text>
      </View>
    </View>
  );

  const renderTabContent = ({ item, index }) => {
    switch (index) {
      case 0:
        return renderCartContent();
      case 1:
        return renderEmptyTab('Chưa có đơn hàng sắp tới');
      case 2:
        return renderEmptyTab('Chưa có đơn hàng đang diễn ra');
      case 3:
        return renderEmptyTab('Chưa có đơn hàng hoàn thành');
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
          onScroll={(event) => {
            tabScrollPosition.current = event.nativeEvent.contentOffset.x;
          }}
          scrollEventThrottle={16}
        >
          {TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => handleTabPress(index)}
              activeOpacity={0.7}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                tabLayouts.current[index] = { x, width };
              }}
            >
              <Text
                style={[
                  styles.tabLabel,
                  activeTabIndex === index && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
              {activeTabIndex === index && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Swipeable Content */}
      <FlatList
        ref={flatListRef}
        data={TABS}
        renderItem={renderTabContent}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleContentScroll}
        scrollEventThrottle={16}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 100);
        }}
      />

      <BottomNavigation activeTab="Orders" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  tabContainer: {
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
    paddingTop: 12,
  },
  tabScrollContent: {
    paddingHorizontal: 20,
    paddingRight: 40,
  },
  tab: {
    marginRight: 32,
    paddingBottom: 12,
    paddingTop: 4,
    position: 'relative',
    minWidth: 80,
  },
  tabLabel: {
    fontSize: 16,
    color: TEXT_SECONDARY,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: PRIMARY_COLOR,
    fontWeight: 'bold',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 1,
  },
  tabContent: {
    width: width,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
    paddingTop: 16,
  },
  orderCard: {
    backgroundColor: BACKGROUND_WHITE,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  orderInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-start',
    paddingRight: 8,
  },
  orderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  orderQuantity: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: PRIMARY_COLOR,
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  deleteButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 100,
    gap: 12,
  },
  addPartyButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addPartyText: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  continueButton: {
    flex: 1,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: BACKGROUND_WHITE,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: 20,
    paddingBottom: 200,
    color: TEXT_SECONDARY,
  },
});
