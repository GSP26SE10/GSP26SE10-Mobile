import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { TEXT_PRIMARY, TEXT_SECONDARY, BACKGROUND_WHITE, PRIMARY_COLOR } from '../constants/colors';

const { width } = Dimensions.get('window');

const buildServiceDetail = (serviceFromRoute) => {
  const fallbackImage =
    'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg';

  const base = serviceFromRoute || {};
  const descriptionMap = {
    'Trang trí sinh nhật':
      'Gói trang trí sinh nhật đầy đủ backdrop, bóng bay, bàn gallery và phụ kiện. Phù hợp cho tiệc tại nhà, quán cà phê hoặc nhà hàng, tông màu có thể điều chỉnh theo chủ đề.',
    'Thuê dàn karaoke':
      'Dàn karaoke chất lượng cao, micro không dây, loa công suất lớn, hỗ trợ kết nối TV/Projector. Đội ngũ kỹ thuật hỗ trợ setup và bảo trì trong suốt buổi tiệc.',
    'Thuê 10 bộ bàn ghế':
      'Bộ bàn ghế gọn gàng, sạch sẽ, phù hợp cho tiệc gia đình và sự kiện nhỏ. Giá đã bao gồm phí vận chuyển nội thành và sắp xếp theo layout mong muốn.',
  };

  const name = base.name || 'Dịch vụ sự kiện';

  return {
    id: base.id || 1,
    name,
    price: base.price || '0₫',
    image: base.image || fallbackImage,
    description: descriptionMap[name] || 'Dịch vụ hỗ trợ cho buổi tiệc của bạn diễn ra trọn vẹn và chuyên nghiệp hơn. Nội dung chi tiết sẽ được tư vấn thêm khi đặt dịch vụ.',
  };
};

export default function ServiceDetailScreen({ navigation, route }) {
  const serviceFromRoute = route?.params?.service;
  const service = buildServiceDetail(serviceFromRoute);
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const handleChooseService = () => {
    // TODO: thực hiện logic chọn dịch vụ
    console.log('Chọn dịch vụ:', service);
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'right', 'bottom', 'left']}
      {...swipeBack.panHandlers}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết dịch vụ</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: service.image }}
            style={styles.mainImage}
            resizeMode="cover"
          />
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.serviceTitle}>{service.name}</Text>
          <Text style={styles.servicePrice}>{service.price}</Text>
          <Text style={styles.serviceDescription}>{service.description}</Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomBarSafe}>
        <View style={styles.bottomBar}>
          <Text style={styles.bottomPrice}>{service.price}</Text>
          <TouchableOpacity
            style={styles.chooseButton}
            onPress={handleChooseService}
            activeOpacity={0.8}
          >
            <Text style={styles.chooseButtonText}>Chọn dịch vụ</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  headerRight: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 80,
  },
  imageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  mainImage: {
    width: width - 40,
    height: (width - 40) * 0.56,
    backgroundColor: '#E0E0E0',
  },
  infoSection: {
    borderRadius: 16,
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: PRIMARY_COLOR,
    marginBottom: 12,
  },
  serviceDescription: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
  },
  bottomBarSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BACKGROUND_WHITE,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  bottomPrice: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  chooseButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
  },
  chooseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: BACKGROUND_WHITE,
  },
});

