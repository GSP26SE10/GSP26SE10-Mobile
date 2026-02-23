import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';

const { width } = Dimensions.get('window');

// Sample menu data - in a real app, this would come from props or API
const getMenuItems = (buffetType) => {
  const baseImageUrl = 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg';
  
  // Return 5 items for each buffet type
  return [
    {
      id: 1,
      name: `Buffet Lẩu ${buffetType === 'Buffet Bò' ? 'Bò Mỹ' : buffetType === 'Buffet Hải sản' ? 'Hải Sản Tươi' : 'Chay Thập Cẩm'}`,
      quantity: '10 MÓN',
      price: '229.000₫',
      image: baseImageUrl,
    },
    {
      id: 2,
      name: `Buffet ${buffetType === 'Buffet Bò' ? 'Bò Wagyu' : buffetType === 'Buffet Hải sản' ? 'Hải Sản Cao Cấp' : 'Chay Đặc Biệt'}`,
      quantity: '15 MÓN',
      price: '399.000₫',
      image: baseImageUrl,
    },
    {
      id: 3,
      name: `Buffet ${buffetType === 'Buffet Bò' ? 'Bò Nhật Bản' : buffetType === 'Buffet Hải sản' ? 'Hải Sản Nhật' : 'Chay Nhật Bản'}`,
      quantity: '12 MÓN',
      price: '329.000₫',
      image: baseImageUrl,
    },
    {
      id: 4,
      name: `Buffet ${buffetType === 'Buffet Bò' ? 'Bò Premium' : buffetType === 'Buffet Hải sản' ? 'Hải Sản Premium' : 'Chay Premium'}`,
      quantity: '18 MÓN',
      price: '499.000₫',
      image: baseImageUrl,
    },
    {
      id: 5,
      name: `Buffet ${buffetType === 'Buffet Bò' ? 'Bò Thượng Hạng' : buffetType === 'Buffet Hải sản' ? 'Hải Sản Thượng Hạng' : 'Chay Thượng Hạng'}`,
      quantity: '20 MÓN',
      price: '599.000₫',
      image: baseImageUrl,
    },
  ];
};

export default function MenuListScreen({ navigation, route }) {
  const buffetType = route?.params?.buffetType || 'Buffet Bò';
  const menuItems = getMenuItems(buffetType);
  const swipeBack = useSwipeBack(() => navigation.navigate('Home'));

  const handleAddToCart = (item) => {
    // TODO: Implement add to cart functionality
    console.log('Add to cart:', item);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{buffetType}</Text>
      </View>

      {/* Menu List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() => navigation.navigate('MenuDetail', { menuId: item.id, buffetType: buffetType })}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: item.image }}
              style={styles.menuImage}
              resizeMode="cover"
            />
            <View style={styles.menuInfo}>
              <Text style={styles.menuName}>{item.name}</Text>
              <Text style={styles.menuQuantity}>{item.quantity}</Text>
              <Text style={styles.menuPrice}>{item.price}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={(e) => {
                e.stopPropagation();
                handleAddToCart(item);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={24} color={BACKGROUND_WHITE} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <BottomNavigation activeTab="Home" onTabPress={(tab) => navigation.navigate(tab)} />
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
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
    paddingTop: 16,
  },
  menuCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  menuImage: {
    width: 100,
    height: 100,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  menuName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  menuQuantity: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  menuPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textDecorationLine: 'underline',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
