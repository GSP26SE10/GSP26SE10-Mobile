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

const { width } = Dimensions.get('window');
const NAV_BAR_PADDING = 16 * 2; // paddingHorizontal của container
const NAV_BAR_INNER_PADDING = 8 * 2; // paddingHorizontal của navBar
const NAV_BAR_WIDTH = width - NAV_BAR_PADDING;
const TAB_WIDTH = NAV_BAR_WIDTH / 5;

const tabs = [
  { key: 'Home', label: 'Trang chủ', icon: 'home-outline', iconActive: 'home' },
  { key: 'Search', label: 'Tìm dịch vụ', icon: 'search-outline', iconActive: 'search' },
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

  const handleNavBarLayout = (event) => {
    const { width } = event.nativeEvent.layout;
    if (width > 0) {
      setNavBarWidth(width);
    }
  };

  React.useEffect(() => {
    if (navBarWidth <= 0) return;
    
    const activeIndex = tabs.findIndex(tab => tab.key === activeTab);
    if (activeIndex === -1) return;
    
    const activeTabData = tabs[activeIndex];
    const finalWidth = calculateActiveTabWidth(activeTabData?.label, navBarWidth);
    
    // Tính vị trí dựa trên layout thực tế của các tabs
    // Tất cả inactive tabs có width = INACTIVE_TAB_WIDTH
    // Active tab có width = finalWidth
    // Tính tổng width cần thiết và spacing
    const totalInactiveWidth = INACTIVE_TAB_WIDTH * 4;
    const totalWidthNeeded = totalInactiveWidth + finalWidth;
    const remainingSpace = navBarWidth - totalWidthNeeded - 8; // Trừ padding (4 mỗi bên)
    const spacing = Math.max(0, remainingSpace / 5); // Chia đều khoảng trống, đảm bảo >= 0
    
    // Tính position: các tab trước active tab
    let position = 0;
    for (let i = 0; i < activeIndex; i++) {
      position += INACTIVE_TAB_WIDTH + spacing;
    }
    
    // Set giá trị ban đầu ngay lập tức để tránh flash
    slideAnim.setValue(position + 2); // Giảm từ 4 xuống 2 để match với left của activeBackground
    widthAnim.setValue(finalWidth);
    
    // Delay nhỏ để đảm bảo layout đã render xong
    const timeoutId = setTimeout(() => {
      // Animation mượt với spring effect để tạo hiệu ứng "phình to ra"
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: position + 2, // Giảm từ 4 xuống 2 để match với left của activeBackground
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
    }, 10);
    
    return () => clearTimeout(timeoutId);
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
                <Ionicons
                  name={isActive ? tab.iconActive : tab.icon}
                  size={24}
                  style={[styles.icon, isActive && styles.iconActive]}
                />
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
    left: 2, // Dịch sang trái từ 4 xuống 2 để bao trọn text
    height: '88%', // Tăng từ 85% lên 88% để bao trọn text tốt hơn
    backgroundColor: '#000000',
    borderRadius: 25,
    bottom: '30%', // Giảm từ 5% xuống 3% để xuống dưới hơn và bao trọn text
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
