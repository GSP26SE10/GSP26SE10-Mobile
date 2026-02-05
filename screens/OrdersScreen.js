import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const { width } = Dimensions.get('window');

const TABS = [
  { id: 'cart', label: 'Giỏ hàng' },
  { id: 'upcoming', label: 'Sắp tới' },
  { id: 'ongoing', label: 'Đang diễn ra' },
  { id: 'completed', label: 'Hoàn thành' },
];

// Mock cart data
const getCartItems = () => {
  const baseImageUrl = 'https://scontent.fsgn16-1.fna.fbcdn.net/v/t39.30808-6/548570477_1189728099855961_5240077253445441952_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Lqp7XKTpjhEQ7kNvwGmL7JP&_nc_oc=AdlFm094dgSxWykFEBHlV5urvU6TtYvqvBW6vGbcWA82Mvri8OXfcl2mq02l7coDg9n7jaq7KjGdKQ3oAFYMnzGc&_nc_zt=23&_nc_ht=scontent.fsgn16-1.fna&_nc_gid=QckBobUcEcuU-15xcs2WdA&oh=00_AfuoPMLP6B9c7ArmiRL3hG_mzjPAZa_aRe3Yl5zro9aGxw&oe=698954C8';
  const decorationImageUrl = 'https://toniparty.vn/wp-content/uploads/2023/10/Set-trang-tri-sinh-nhat-tone-hong-trang-2.jpg';
  
  return [
    {
      id: 1,
      name: 'Buffet Lẩu Bò Mỹ',
      quantity: '10 MÓN',
      price: '229.000₫',
      image: baseImageUrl,
      count: 10,
    },
    {
      id: 2,
      name: 'Trang trí sinh nhật',
      price: '199.000₫',
      image: decorationImageUrl,
      count: 1,
    },
  ];
};

// Mock data for other tabs
const getUpcomingOrders = () => [];
const getOngoingOrders = () => [];
const getCompletedOrders = () => [];

export default function OrdersScreen({ navigation }) {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const flatListRef = useRef(null);
  const tabScrollRef = useRef(null);
  const tabLayouts = useRef({});
  const tabScrollPosition = useRef(0);

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

  const handleQuantityChange = (itemId, delta) => {
    // TODO: Implement quantity change logic
    console.log('Change quantity:', itemId, delta);
  };

  const handleRemoveItem = (itemId) => {
    // TODO: Implement remove item logic
    console.log('Remove item:', itemId);
  };

  const renderCartItem = ({ item }) => (
    <View style={styles.orderCard}>
      <Image
        source={{ uri: item.image }}
        style={styles.orderImage}
        resizeMode="cover"
      />
      <View style={styles.orderInfo}>
        <Text style={styles.orderName}>{item.name}</Text>
        {item.quantity && (
          <Text style={styles.orderQuantity}>{item.quantity}</Text>
        )}
        <Text style={styles.orderPrice}>{item.price}</Text>
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
    const cartItems = getCartItems();
    
    return (
      <View style={styles.tabContent}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {cartItems.map((item) => (
            <View key={item.id} style={styles.orderCard}>
              <View style={styles.orderCardTop}>
                <Image
                  source={{ uri: item.image }}
                  style={styles.orderImage}
                  resizeMode="cover"
                />
                <View style={styles.orderInfo}>
                  <Text style={styles.orderName} numberOfLines={2}>{item.name}</Text>
                  {item.quantity && (
                    <Text style={styles.orderQuantity} numberOfLines={1}>{item.quantity}</Text>
                  )}
                  <Text style={styles.orderPrice} numberOfLines={1}>{item.price}</Text>
                </View>
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
          ))}
        </ScrollView>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.addPartyButton} activeOpacity={0.7}>
            <Text style={styles.addPartyText}>Thêm tiệc</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.continueButton} activeOpacity={0.7}>
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
    fontSize: 16,
    color: TEXT_SECONDARY,
  },
});
