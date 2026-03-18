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
import AsyncStorage from '@react-native-async-storage/async-storage';
import API_URL from '../constants/api';
import { getOrderParties, addParty, setActivePartyByIndex, updateCartItemQuantity, removeCartItem } from '../utils/cartStorage';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const { width } = Dimensions.get('window');

// Status: 1 = Sắp tới, 5 = Đang diễn ra, 6 = Thanh toán, 7 = Hoàn thành, 8 = Bị từ chối, 9 = Khách hủy
const ORDER_STATUS = {
  UPCOMING: 1,
  APPROVED: 2,
  REJECTED: 3,
  PREPARING: 4,
  ONGOING: 5,
  BILLING: 6,
  COMPLETED: 7,
  CANCELLED: 8,
};

let ordersCacheByTab = {};

const TABS = [
  { id: 'cart', label: 'Giỏ hàng' },
  { id: 'upcoming', label: 'Sắp tới', status: ORDER_STATUS.UPCOMING || ORDER_STATUS.APPROVED || ORDER_STATUS.PREPARING },
  { id: 'ongoing', label: 'Đang diễn ra', status: ORDER_STATUS.ONGOING },
  { id: 'completed', label: 'Hoàn thành', status: ORDER_STATUS.COMPLETED },
  { id: 'cancelled', label: 'Bị hủy', statuses: [ORDER_STATUS.REJECTED, ORDER_STATUS.CANCELLED] },
];

const getTabKey = (index) => TABS[index]?.id ?? 'cart';

export default function OrdersScreen({ navigation, route }) {
  const initialTabKey = route?.params?.initialTab || 'cart';
  const initialIndex = TABS.findIndex((t) => t.id === initialTabKey);
  const [activeTabIndex, setActiveTabIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [orderParties, setOrderParties] = useState([]);
  const [ordersByTab, setOrdersByTab] = useState({
    upcoming: [],
    ongoing: [],
    completed: [],
    cancelled: [],
  });
  const [pageByTab, setPageByTab] = useState({ upcoming: 1, ongoing: 1, completed: 1, cancelled: 1 });
  const [totalPagesByTab, setTotalPagesByTab] = useState({ upcoming: 1, ongoing: 1, completed: 1, cancelled: 1 });
  const [loadingByTab, setLoadingByTab] = useState({ upcoming: false, ongoing: false, completed: false, cancelled: false });
  const [refreshingByTab, setRefreshingByTab] = useState({ upcoming: false, ongoing: false, completed: false, cancelled: false });
  const [customerId, setCustomerId] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const flatListRef = useRef(null);
  const tabScrollRef = useRef(null);
  const tabLayouts = useRef({});
  const tabScrollPosition = useRef(0);
  const initialIndexRef = useRef(initialIndex >= 0 ? initialIndex : 0);

  const loadCart = useCallback(async () => {
    const parties = await getOrderParties();
    setOrderParties(parties);
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Khi quay lại màn Orders (từ MenuDetail/ServiceDetail sau khi thêm), reload giỏ
  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', loadCart);
    return () => unsubscribe?.();
  }, [navigation, loadCart]);

  // Load userId for orders
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('userData');
        if (!raw) return;
        const user = JSON.parse(raw);
        if (user?.userId) {
          setCustomerId(user.userId);
        }
      } catch (e) {
        console.error('Failed to load userData for orders', e);
      }
    })();
  }, []);

  // Scroll content to initial tab once on mount (for cases like initialTab="upcoming")
  useEffect(() => {
    const idx = initialIndexRef.current;
    if (flatListRef.current && idx > 0 && idx < TABS.length) {
      flatListRef.current.scrollToIndex({ index: idx, animated: false });
    }
  }, []);

  const formatVnd = (price) => {
    if (price == null) return '';
    const val = Number(price ?? 0);
    try {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0,
      }).format(val);
    } catch (e) {
      return `${val.toLocaleString('vi-VN')} đ`;
    }
  };

  const formatDateShort = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const fetchOrdersForTab = useCallback(
    async (tabKey, page = 1, append = false) => {
      if (!customerId || tabKey === 'cart') return;
      const tab = TABS.find((t) => t.id === tabKey);
      if (!tab?.status && !tab?.statuses) return;

      const isLoading = loadingByTab[tabKey];
      if (isLoading) return;

      try {
        if (page === 1 && !append) {
          setRefreshingByTab((prev) => ({ ...prev, [tabKey]: true }));
        } else {
          setLoadingByTab((prev) => ({ ...prev, [tabKey]: true }));
        }

        let items = [];
        let totalPages = 1;

        if (tab.statuses) {
          const [res1, res2] = await Promise.all(
            tab.statuses.map((status) =>
              fetch(`${API_URL}/api/order?CustomerId=${customerId}&Status=${status}&page=${page}&pageSize=10`),
            ),
          );
          const json1 = await res1.json();
          const json2 = await res2.json();
          const list1 = Array.isArray(json1?.items) ? json1.items : [];
          const list2 = Array.isArray(json2?.items) ? json2.items : [];
          items = append ? [...ordersByTab[tabKey], ...list1, ...list2] : [...list1, ...list2];
          totalPages = Math.max(json1?.totalPages ?? 1, json2?.totalPages ?? 1);
        } else {
          const res = await fetch(
            `${API_URL}/api/order?CustomerId=${customerId}&Status=${tab.status}&page=${page}&pageSize=10`,
          );
          const json = await res.json();
          const list = Array.isArray(json?.items) ? json.items : [];
          items = append ? [...ordersByTab[tabKey], ...list] : list;
          totalPages = json?.totalPages ?? 1;
        }

        setOrdersByTab((prev) => ({ ...prev, [tabKey]: items }));
        setPageByTab((prev) => ({ ...prev, [tabKey]: page }));
        setTotalPagesByTab((prev) => ({ ...prev, [tabKey]: totalPages }));
        ordersCacheByTab[tabKey] = { customerId, items, page, totalPages };
      } catch (e) {
        console.error('Failed to load orders', tabKey, e);
      } finally {
        setLoadingByTab((prev) => ({ ...prev, [tabKey]: false }));
        setRefreshingByTab((prev) => ({ ...prev, [tabKey]: false }));
      }
    },
    [customerId, loadingByTab, ordersByTab],
  );

  useEffect(() => {
    if (!customerId) return;
    ['upcoming', 'ongoing', 'completed', 'cancelled'].forEach((tabKey) => {
      const cached = ordersCacheByTab[tabKey];
      if (cached && cached.customerId === customerId) {
        setOrdersByTab((prev) => ({ ...prev, [tabKey]: cached.items || [] }));
        setPageByTab((prev) => ({ ...prev, [tabKey]: cached.page || 1 }));
        setTotalPagesByTab((prev) => ({ ...prev, [tabKey]: cached.totalPages || 1 }));
      } else {
        fetchOrdersForTab(tabKey, 1, false);
      }
    });
  }, [customerId]);

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

  const showToast = (message) => {
    setToastMessage(message);
    setToastVisible(true);
  };

  const handleQuantityChange = async (partyIndex, item, delta) => {
    if (!item) return;
    const party = (orderParties || [])[partyIndex];
    const partyItems = Array.isArray(party?.items) ? party.items : [];
    const menuItems = partyItems.filter((i) => i.type === 'menu');
    const dishItems = partyItems.filter((i) => i.type === 'dish');
    const isMenu = item.type === 'menu';
    const isDish = item.type === 'dish';

    if (isDish) {
      showToast('Số lượng món lẻ tự động theo menu');
      return;
    }

    if (isMenu) {
      const currentMax = Math.max(...menuItems.map((m) => Number(m.count ?? 0)), 1);
      const target = Math.max(currentMax + delta, 1);
      const realDelta = target - currentMax;
      if (realDelta === 0) return;

      await setActivePartyByIndex(partyIndex);
      for (const m of menuItems) {
        await updateCartItemQuantity(m.id, realDelta);
      }
      const newMenuCount = target;
      for (const d of dishItems) {
        const dishDelta = newMenuCount - Number(d.count ?? 0);
        if (dishDelta !== 0) {
          await updateCartItemQuantity(d.id, dishDelta);
        }
      }
      const parties = await getOrderParties();
      setOrderParties(parties);
      return;
    }

    await setActivePartyByIndex(partyIndex);
    await updateCartItemQuantity(item.id, delta);
    const parties = await getOrderParties();
    setOrderParties(parties);
  };

  const handleRemoveItem = async (partyIndex, itemId) => {
    await setActivePartyByIndex(partyIndex);
    await removeCartItem(itemId);
    const parties = await getOrderParties();
    setOrderParties(parties);
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
    if (item.type === 'dish') {
      navigation.navigate('DishDetail', {
        dish: {
          dishId: item.dishId,
          dishName: item.name,
          price: item.basePrice,
          image: item.image,
        },
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

  const renderCartContent = () => {
    const partiesWithItems = (orderParties || []).filter((p) => (p.items || []).length > 0);
    if (partiesWithItems.length === 0) {
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
          {partiesWithItems.map((party, partyIndex) => (
            <View key={party.partyId || String(partyIndex)} style={styles.partySection}>
              {(party.items || []).map((item) => (
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
                      <View
                        style={[
                          styles.orderImage,
                          { backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center' },
                        ]}
                      >
                        <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
                      </View>
                    )}
                    <View style={styles.orderInfo}>
                      <Text style={styles.orderName} numberOfLines={2}>
                        {item.name}
                      </Text>
                      <Text style={styles.orderPrice} numberOfLines={1}>
                        {item.priceFormatted}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.quantityContainer}>
                    {item.count > 1 ? (
                      <>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleQuantityChange(partyIndex, item, -1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quantityButtonText}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.count}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleQuantityChange(partyIndex, item, 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => handleRemoveItem(partyIndex, item.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={20} color="#FF0000" />
                        </TouchableOpacity>
                        <Text style={styles.quantityText}>{item.count}</Text>
                        <TouchableOpacity
                          style={styles.quantityButton}
                          onPress={() => handleQuantityChange(partyIndex, item, 1)}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.quantityButtonText}>+</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              ))}
              {partyIndex !== partiesWithItems.length - 1 && <View style={styles.partyDivider} />}
            </View>
          ))}
        </ScrollView>
        
        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.addPartyButton}
            activeOpacity={0.7}
            onPress={async () => {
              await addParty(); // tạo party mới ngay sau party hiện tại và set active
              const parties = await getOrderParties();
              setOrderParties(parties);
              navigation.navigate('Home'); // về Home để chọn menu cho tiệc mới
            }}
          >
            <Text style={styles.addPartyText}>Thêm tiệc</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.continueButton,
              !partiesWithItems.some((p) => (p.items || []).some((i) => i.type === 'menu')) && styles.continueButtonDisabled,
            ]}
            activeOpacity={0.7}
            onPress={() => {
              const hasMenu = partiesWithItems.some((p) => (p.items || []).some((i) => i.type === 'menu'));
              if (!hasMenu) {
                showToast('Vui lòng chọn ít nhất 1 menu để tiếp tục');
                return;
              }
              navigation.navigate('OrderConfirmation');
            }}
          >
            <Text style={styles.continueText}>Tiếp tục</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getOrderCardData = (order) => {
    const first = order?.orderDetails?.[0];
    const menuSnapshot = first?.menuSnapshot;
    const imgUrl = menuSnapshot?.imgUrl;
    const imageUri = Array.isArray(imgUrl) ? imgUrl[0] : imgUrl;
    return {
      imageUri,
      menuName: first?.menuName ?? menuSnapshot?.menuName ?? `#${order?.orderId}`,
      numberOfGuests: first?.numberOfGuests ?? 0,
      startTime: first?.startTime,
      address: first?.address ?? '',
      totalPrice: order?.totalPrice,
    };
  };

  const renderEmptyTab = (message) => (
    <View style={styles.tabContent}>
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{message}</Text>
      </View>
    </View>
  );

  const renderOrderCard = (order, sourceTab) => {
    const card = getOrderCardData(order);
    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate('OrderDetail', {
            orderId: order.orderId,
            sourceTab,
          })
        }
      >
        <View style={styles.orderCardTop}>
          {card.imageUri ? (
            <ExpoImage
              source={{ uri: card.imageUri }}
              style={styles.orderImage}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.orderImage, styles.orderImagePlaceholder]}>
              <Ionicons name="image-outline" size={28} color={TEXT_SECONDARY} />
            </View>
          )}
          <View style={styles.orderInfo}>
            <Text style={styles.orderName} numberOfLines={2}>
              Tiệc {card.menuName}
            </Text>
            <Text style={styles.orderQuantity}>
              {card.numberOfGuests} người - {formatDateShort(card.startTime)}
            </Text>
            <Text style={styles.orderAddress} numberOfLines={2}>
              {card.address}
            </Text>
            <Text style={styles.orderPrice}>{formatVnd(card.totalPrice)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOrdersList = (tabKey, emptyMessage) => {
    const orders = ordersByTab[tabKey] ?? [];
    const loading = loadingByTab[tabKey];
    const refreshing = refreshingByTab[tabKey];
    const page = pageByTab[tabKey] ?? 1;
    const totalPages = totalPagesByTab[tabKey] ?? 1;
    return (
      <View style={styles.tabContent}>
        <FlatList
          data={orders}
          keyExtractor={(order) => String(order.orderId)}
          contentContainerStyle={styles.scrollContent}
          renderItem={({ item: order }) => renderOrderCard(order, tabKey)}
          onEndReached={() => {
            if (!loading && page < totalPages) {
              fetchOrdersForTab(tabKey, page + 1, true);
            }
          }}
          onEndReachedThreshold={0.2}
          refreshing={refreshing}
          onRefresh={() => fetchOrdersForTab(tabKey, 1, false)}
          ListEmptyComponent={
            !loading && !refreshing ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : null
          }
        />
      </View>
    );
  };

  const renderTabContent = ({ item, index }) => {
    switch (index) {
      case 0:
        return renderCartContent();
      case 1:
        return renderOrdersList('upcoming', 'Chưa có đơn hàng sắp tới');
      case 2:
        return renderOrdersList('ongoing', 'Chưa có đơn hàng đang diễn ra');
      case 3:
        return renderOrdersList('completed', 'Chưa có đơn hàng hoàn thành');
      case 4:
        return renderOrdersList('cancelled', 'Chưa có đơn hàng bị hủy');
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
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
  orderImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 4,
  },
  orderAddress: {
    fontSize: 13,
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
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueText: {
    fontSize: 16,
    fontWeight: '600',
    color: BACKGROUND_WHITE,
  },
  partySection: {
    marginBottom: 12,
  },
  partyDivider: {
    height: 2,
    backgroundColor: '#E6E0EB',
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 2,
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
