import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { BUTTON_TEXT_WHITE } from '../constants/colors';
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
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const tabs = [
  { key: 'Home', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'Search', label: 'Khám phá', icon: 'search-outline', iconActive: 'search' },
  { key: 'Orders', label: 'Đơn hàng', icon: 'bag-outline', iconActive: 'bag' },
  { key: 'Contact', label: 'Liên lạc', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
  { key: 'Account', label: 'Tài khoản', icon: 'person-outline', iconActive: 'person' },
];

const EDGE_GAP = 6;
const ACTIVE_SIDE_PADDING = 16;
const MIN_INACTIVE_WIDTH = 42;
const MAX_INACTIVE_WIDTH = 56;
const ACTIVE_MIN_WIDTH = 88;
const CURVE = Easing.bezier(0.22, 1, 0.36, 1);

const calculateActiveTabWidth = (label) => {
  const textWidth = label ? label.length * 6.8 : 64;
  const iconWidth = 24;
  const marginBetween = 5;
  const activeTabWidth = iconWidth + marginBetween + textWidth + (ACTIVE_SIDE_PADDING * 2);
  return Math.max(ACTIVE_MIN_WIDTH, activeTabWidth);
};

const buildTabLayout = (activeIndex, activeLabel, navBarWidth, totalTabs) => {
  if (navBarWidth <= 0 || activeIndex < 0 || totalTabs <= 1) {
    return null;
  }

  const desiredActiveWidth = calculateActiveTabWidth(activeLabel);
  const maxActiveWidth = navBarWidth - (MIN_INACTIVE_WIDTH * (totalTabs - 1));
  const minActiveWidth = navBarWidth - (MAX_INACTIVE_WIDTH * (totalTabs - 1));

  let activeWidth = Math.min(desiredActiveWidth, maxActiveWidth);
  activeWidth = Math.max(ACTIVE_MIN_WIDTH, Math.max(minActiveWidth, activeWidth));

  let inactiveWidth = (navBarWidth - activeWidth) / (totalTabs - 1);
  inactiveWidth = Math.max(MIN_INACTIVE_WIDTH, Math.min(MAX_INACTIVE_WIDTH, inactiveWidth));
  activeWidth = navBarWidth - (inactiveWidth * (totalTabs - 1));

  const widths = Array(totalTabs).fill(inactiveWidth);
  widths[activeIndex] = activeWidth;

  const leftOffset = widths.slice(0, activeIndex).reduce((sum, item) => sum + item, 0) + EDGE_GAP;
  const indicatorWidth = Math.max(0, activeWidth - (EDGE_GAP * 2));

  return {
    widths,
    leftOffset,
    indicatorWidth,
  };
};

function TabButton({ tab, isActive, widthValue, onPress, cartBadgeCount, chatBadgeCount, activeTab }) {
  const progress = useSharedValue(isActive ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(isActive ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, progress]);

  const inactiveIconOpacityStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  const activeIconOpacityStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const iconMoveStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + (progress.value * 0.06) },
      { translateY: -progress.value },
    ],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    maxWidth: 130 * progress.value,
    transform: [{ translateX: -4 * (1 - progress.value) }],
  }));

  return (
    <AnimatedTouchableOpacity
      layout={LinearTransition.duration(260).easing(CURVE)}
      style={[styles.tab, { width: widthValue }]}
      onPress={() => onPress(tab.key)}
      activeOpacity={0.75}
    >
      <Animated.View style={iconMoveStyle}>
        <View style={styles.iconBadgeWrap}>
          <View style={styles.iconStack}>
            <Animated.View style={[styles.iconLayer, inactiveIconOpacityStyle]}>
              <Ionicons
                name={tab.icon}
                size={24}
                style={styles.icon}
              />
            </Animated.View>
            <Animated.View style={[styles.iconLayer, activeIconOpacityStyle]}>
              <Ionicons
                name={tab.iconActive}
                size={24}
                style={[styles.icon, styles.iconActive]}
              />
            </Animated.View>
          </View>

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
      </Animated.View>

      <Animated.Text
        style={[styles.label, labelStyle]}
        numberOfLines={1}
        ellipsizeMode="tail"
        allowFontScaling={false}
      >
        {tab.label}
      </Animated.Text>
    </AnimatedTouchableOpacity>
  );
}

export default function BottomNavigation({ activeTab, onTabPress }) {
  const insets = useSafeAreaInsets();
  const [navBarWidth, setNavBarWidth] = React.useState(0);
  const [cartBadgeCount, setCartBadgeCount] = React.useState(0);
  const [chatBadgeCount, setChatBadgeCount] = React.useState(0);

  const indicatorLeft = useSharedValue(0);
  const indicatorWidth = useSharedValue(70);
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
    const { width: nextWidth } = event.nativeEvent.layout;
    if (nextWidth > 0) {
      setNavBarWidth(nextWidth);
    }
  };

  const activeIndex = React.useMemo(
    () => tabs.findIndex((tab) => tab.key === activeTab),
    [activeTab]
  );

  const tabLayout = React.useMemo(
    () => buildTabLayout(activeIndex, tabs[activeIndex]?.label, navBarWidth, tabs.length),
    [activeIndex, navBarWidth]
  );

  const tabWidths = React.useMemo(() => {
    if (tabLayout) {
      return tabLayout.widths;
    }

    if (navBarWidth > 0) {
      return tabs.map(() => navBarWidth / tabs.length);
    }

    return tabs.map(() => 0);
  }, [tabLayout, navBarWidth]);

  React.useEffect(() => {
    if (!tabLayout) return;

    if (!initializedRef.current) {
      indicatorLeft.value = tabLayout.leftOffset;
      indicatorWidth.value = tabLayout.indicatorWidth;
      initializedRef.current = true;
      return;
    }

    indicatorLeft.value = withTiming(tabLayout.leftOffset, {
      duration: 260,
      easing: CURVE,
    });

    indicatorWidth.value = withTiming(tabLayout.indicatorWidth, {
      duration: 260,
      easing: CURVE,
    });
  }, [tabLayout, indicatorLeft, indicatorWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    left: indicatorLeft.value,
    width: indicatorWidth.value,
  }));

  const containerPaddingBottom =
    Platform.OS === 'android' ? Math.max(20, insets.bottom + 8) : 20;

  return (
    <View style={[styles.container, { paddingBottom: containerPaddingBottom }]}>
      <BlurView intensity={16} tint="light" style={styles.blurContainer}>
        <View style={styles.navBar} onLayout={handleNavBarLayout}>
          <Animated.View style={[styles.activeBackground, indicatorStyle]} />

          {tabs.map((tab, tabIndex) => (
            <TabButton
              key={tab.key}
              tab={tab}
              isActive={activeTab === tab.key}
              widthValue={tabWidths[tabIndex]}
              onPress={onTabPress}
              cartBadgeCount={cartBadgeCount}
              chatBadgeCount={chatBadgeCount}
              activeTab={activeTab}
            />
          ))}
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
    borderRadius: 32,
    overflow: 'hidden',
    width: '100%',
    maxWidth: width - 32,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 10,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(49, 55, 67, 0.32)',
    borderRadius: 26,
    paddingVertical: 6,
    paddingHorizontal: 6,
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    overflow: 'hidden',
  },
  activeBackground: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    backgroundColor: 'rgba(255,255,255,0.32)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#FFFFFF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    zIndex: 1,
    overflow: 'hidden',
  },
  iconBadgeWrap: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconStack: {
    width: 24,
    height: 24,
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
    color: 'rgba(255,255,255,0.92)',
  },
  iconActive: {
    color: BUTTON_TEXT_WHITE,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 3,
  },
  label: {
    fontSize: 12,
    color: BUTTON_TEXT_WHITE,
    marginLeft: 5,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: {
      width: 0,
      height: 1,
    },
    textShadowRadius: 3,
    includeFontPadding: false,
    textAlignVertical: 'center',
    flexShrink: 1,
  },
});
