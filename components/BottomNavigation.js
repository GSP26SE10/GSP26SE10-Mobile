import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { PRIMARY_COLOR, TEXT_PRIMARY, BUTTON_TEXT_WHITE } from '../constants/colors';
import { getOrderParties, subscribeOrderPartiesChange } from '../utils/cartStorage';
import { getChatUnreadCount, subscribeChatUnreadChange } from '../utils/chatUnread';

function countCartItems(parties) {
  if (!Array.isArray(parties)) return 0;
  return parties.reduce((acc, party) => {
    const items = party?.items;
    if (!Array.isArray(items)) return acc;
    return (
      acc +
      items.reduce((sum, item) => sum + Math.max(0, Number(item?.count) || 0), 0)
    );
  }, 0);
}

const { width } = Dimensions.get('window');
const NAV_BAR_PADDING = 16 * 2; // paddingHorizontal của container
const NAV_BAR_INNER_PADDING = 8 * 2; // paddingHorizontal của navBar
const NAV_BAR_WIDTH = width - NAV_BAR_PADDING;
const TAB_WIDTH = NAV_BAR_WIDTH / 5;

const tabs = [
  { key: 'Home', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'Search', label: 'Khám phá', icon: 'search-outline', iconActive: 'search' },
  { key: 'Orders', label: 'Đơn hàng', icon: 'bag-outline', iconActive: 'bag' },
  { key: 'Contact', label: 'Liên lạc', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { key: 'Account', label: 'Tài khoản', icon: 'person-outline', iconActive: 'person' },
];

// Helper function để tính toán width của active tab
const calculateActiveTabWidth = (label, navBarWidth) => {
  const textWidth = label ? label.length * 7.2 : 70; // Tăng từ 7 lên 7.2 để đủ chỗ cho text
  const iconWidth = 24;
  const marginBetween = 5;
  const paddingHorizontal = 16; // Tăng từ 14 lên 16 để bao trọn text tốt hơn
  const activeTabWidth = iconWidth + marginBetween + textWidth + (paddingHorizontal * 2);
  const minWidth = 50;
  const maxWidth = navBarWidth * 0.4; // Tăng từ 38% lên 40% để đủ chỗ cho text dài
  return Math.max(minWidth, Math.min(activeTabWidth, maxWidth));
};

// Width của inactive tab (chỉ icon) - giảm để vừa đủ 5 tab
const INACTIVE_TAB_WIDTH = 50;

export default function BottomNavigation({ activeTab, onTabPress }) {
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const widthAnim = React.useRef(new Animated.Value(INACTIVE_TAB_WIDTH)).current;
  const [navBarWidth, setNavBarWidth] = React.useState(0);
  const [cartBadgeCount, setCartBadgeCount] = React.useState(0);
  const [chatBadgeCount, setChatBadgeCount] = React.useState(0);
  const initializedRef = React.useRef(false);

  const refreshCartBadge = React.useCallback(async () => {
    try {
      const parties = await getOrderParties();
      setCartBadgeCount(countCartItems(parties));
    } catch {
      setCartBadgeCount(0);
    }
  }, []);

  React.useEffect(() => {
    refreshCartBadge();
    return subscribeOrderPartiesChange(refreshCartBadge);
  }, [refreshCartBadge]);

  const refreshChatBadge = React.useCallback(async () => {
    try {
      const unread = await getChatUnreadCount();
      setChatBadgeCount(unread);
    } catch {
      setChatBadgeCount(0);
    }
  }, []);

  React.useEffect(() => {
    refreshChatBadge();
    return subscribeChatUnreadChange((nextCount) => {
      setChatBadgeCount(Number(nextCount) || 0);
    });
  }, [refreshChatBadge]);

  const handleNavBarLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setNavBarWidth(width);
    }
  };

  React.useEffect(() => {
    if (navBarWidth <= 0) return;

    const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
    if (activeIndex === -1) return;

    const activeTabData = tabs[activeIndex];
    const finalWidth = calculateActiveTabWidth(activeTabData?.label, navBarWidth);

    // Tính spacing và vị trí tuyệt đối của tab active
    const totalInactiveWidth = INACTIVE_TAB_WIDTH * 4;
    const totalWidthNeeded = totalInactiveWidth + finalWidth;
    const remainingSpace = navBarWidth - totalWidthNeeded - 8;
    const spacing = Math.max(0, remainingSpace / 5);

    let position = 0;
    for (let i = 0; i < activeIndex; i++) {
      position += INACTIVE_TAB_WIDTH + spacing;
    }

    const targetX = position + 2;

    // Lần đầu: set thẳng vị trí, không animate (tránh nhảy từ A)
    if (!initializedRef.current) {
      slideAnim.setValue(targetX);
      widthAnim.setValue(finalWidth);
      initializedRef.current = true;
      return;
    }

    // Các lần sau: animate từ vị trí hiện tại sang vị trí mới
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: targetX,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }),
      Animated.spring(widthAnim, {
        toValue: finalWidth,
        useNativeDriver: false,
        tension: 65,
        friction: 8,
      }),
    ]).start();
  }, [activeTab, navBarWidth]);

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="light" style={styles.blurContainer}>
        <View style={styles.navBar} onLayout={handleNavBarLayout}>
          {/* Animated background for active tab */}
          <Animated.View
              style={[
                styles.activeBackground,
                {
                  width: widthAnim,
                  transform: [{ translateX: slideAnim }],
                },
              ]}
          />
          
          {/* Tab buttons */}
          {tabs.map((tab, index) => {
            const isActive = activeTab === tab.key;
            
            // Tính width cho từng tab
            let tabWidth = INACTIVE_TAB_WIDTH;
            if (isActive && navBarWidth > 0) {
              tabWidth = calculateActiveTabWidth(tab.label, navBarWidth);
            }
            
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.tab,
                  { width: tabWidth },
                ]}
                onPress={() => onTabPress(tab.key)}
                activeOpacity={0.7}
              >
                <View style={styles.iconBadgeWrap}>
                  <Ionicons
                    name={isActive ? tab.iconActive : tab.icon}
                    size={24}
                    style={[styles.icon, isActive && styles.iconActive]}
                  />
                  {tab.key === 'Orders' && activeTab !== 'Orders' && cartBadgeCount > 0 ? (
                    <View style={styles.cartBadge} pointerEvents="none">
                      <Text style={styles.cartBadgeText} allowFontScaling={false}>
                        {cartBadgeCount > 99 ? '99+' : String(cartBadgeCount)}
                      </Text>
                    </View>
                  ) : null}
                  {tab.key === 'Contact' && activeTab !== 'Contact' && chatBadgeCount > 0 ? (
                    <View style={styles.cartBadge} pointerEvents="none">
                      <Text style={styles.cartBadgeText} allowFontScaling={false}>
                        {chatBadgeCount > 99 ? '99+' : String(chatBadgeCount)}
                      </Text>
                    </View>
                  ) : null}
                </View>
                {isActive && (
                  <Text 
                    style={styles.label} 
                    numberOfLines={1} 
                    ellipsizeMode="tail"
                    allowFontScaling={false}
                  >
                    {tab.label}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  blurContainer: {
    borderRadius: 30,
    overflow: 'hidden',
    width: '100%',
    maxWidth: width - 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: 'transparent', // Đổi từ rgba(255, 255, 255, 0.3) sang transparent
    borderRadius: 30,
    paddingVertical: 10,
    paddingHorizontal: 4,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    borderWidth: 0, // Bỏ border vì background đã trong suốt
    borderColor: 'transparent',
  },
  activeBackground: {
    position: 'absolute',
    left: -5, // Dịch sang trái từ 4 xuống 2 để bao trọn text
    top: 11,
    right: 15,
    bottom: 11,
    backgroundColor: '#000000',
    borderRadius: 25,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8, // Giảm từ 12 xuống 8 để tiết kiệm không gian
    zIndex: 1,
    minWidth: 0,
  },
  iconBadgeWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: BUTTON_TEXT_WHITE,
  },
  cartBadgeText: {
    color: BUTTON_TEXT_WHITE,
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
  icon: {
    color: TEXT_PRIMARY,
  },
  iconActive: {
    color: BUTTON_TEXT_WHITE,
  },
  label: {
    fontSize: 12, // Giảm từ 13 xuống 12 để tiết kiệm không gian
    color: BUTTON_TEXT_WHITE,
    marginLeft: 5, // Giảm từ 6 xuống 5
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink: 0,
  },
});
