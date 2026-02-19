import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PRIMARY_COLOR, TEXT_PRIMARY, BUTTON_TEXT_WHITE } from '../constants/colors';

const { width } = Dimensions.get('window');
const NAV_BAR_PADDING = 16 * 2;
const NAV_BAR_INNER_PADDING = 8 * 2;
const NAV_BAR_WIDTH = width - NAV_BAR_PADDING;
const TAB_WIDTH = NAV_BAR_WIDTH / 4;

const staffTabs = [
  { key: 'StaffHome', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'StaffOrderHistory', label: 'Lịch sử đơn hàng', icon: 'pie-chart-outline', iconActive: 'pie-chart' },
  { key: 'StaffCalendar', label: 'Lịch', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'StaffAccount', label: 'Tài khoản', icon: 'person-outline', iconActive: 'person' },
];

const leaderTabs = [
  { key: 'LeaderHome', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'LeaderOrderHistory', label: 'Lịch sử đơn hàng', icon: 'pie-chart-outline', iconActive: 'pie-chart' },
  { key: 'LeaderCalendar', label: 'Lịch', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'LeaderAccount', label: 'Tài khoản', icon: 'person-outline', iconActive: 'person' },
];

const calculateActiveTabWidth = (label, navBarWidth) => {
  const textWidth = label ? label.length * 7.5 : 70; // Tăng từ 7.2 lên 7.5 để đủ chỗ cho text dài
  const iconWidth = 24;
  const marginBetween = 5;
  const paddingHorizontal = 18; // Tăng từ 16 lên 18 để có thêm padding
  const activeTabWidth = iconWidth + marginBetween + textWidth + (paddingHorizontal * 2);
  const minWidth = 50;
  const maxWidth = navBarWidth * 0.45; // Tăng từ 0.4 lên 0.45 để cho phép tab rộng hơn
  return Math.max(minWidth, Math.min(activeTabWidth, maxWidth));
};

const INACTIVE_TAB_WIDTH = 50;

export default function BottomNavigationStaff({ activeTab, onTabPress }) {
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const widthAnim = React.useRef(new Animated.Value(INACTIVE_TAB_WIDTH)).current;
  const [navBarWidth, setNavBarWidth] = React.useState(0);

  // Determine which tabs to use based on activeTab
  const tabs = activeTab.startsWith('Leader') ? leaderTabs : staffTabs;

  const handleNavBarLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setNavBarWidth(width);
    }
  };

  React.useEffect(() => {
    const activeIndex = tabs.findIndex((tab) => tab.key === activeTab);
    if (activeIndex === -1 || navBarWidth === 0) return;

    const activeTabWidth = calculateActiveTabWidth(
      tabs[activeIndex].label,
      navBarWidth
    );

    const totalInactiveWidth = INACTIVE_TAB_WIDTH * (tabs.length - 1);
    const totalActiveWidth = activeTabWidth;
    const totalWidth = totalInactiveWidth + totalActiveWidth;
    const availableSpace = navBarWidth - totalWidth;
    const spacing = availableSpace / (tabs.length - 1);

    let position = 0;
    for (let i = 0; i < activeIndex; i++) {
      position += INACTIVE_TAB_WIDTH + spacing;
    }
    // Dịch sang trái một chút (để viền đen dịch sang phải) cho tab có text dài
    if (tabs[activeIndex].label.length > 10) {
      position = Math.max(0, position - 4); // Dịch sang trái 4px
    }

    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: position,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
      Animated.spring(widthAnim, {
        toValue: activeTabWidth,
        useNativeDriver: false,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, [activeTab, navBarWidth]);

  return (
    <View style={styles.container}>
      <View
        style={styles.navBar}
        onLayout={handleNavBarLayout}
      >
        <Animated.View
          style={[
            styles.activeBackground,
            {
              left: slideAnim,
              width: widthAnim,
            },
          ]}
        />
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => onTabPress(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={24}
                color={isActive ? BUTTON_TEXT_WHITE : TEXT_PRIMARY}
              />
              {isActive && (
                <Text style={styles.label}>{tab.label}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  navBar: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderRadius: 25,
    paddingHorizontal: 8,
    paddingVertical: 8,
    position: 'relative',
    width: '100%',
    justifyContent: 'space-between',
  },
  activeBackground: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    backgroundColor: '#000000',
    borderRadius: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: INACTIVE_TAB_WIDTH,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: BUTTON_TEXT_WHITE,
    marginLeft: 5,
  },
});
