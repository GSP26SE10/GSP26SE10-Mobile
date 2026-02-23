import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR } from '../constants/colors';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Greeting */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Xin chào, Nguyễn Văn A!</Text>
          <Text style={styles.tagline}>Thưởng thức buffet đa dạng tại Bookfet!</Text>
        </View>

        {/* Buffet Bò Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Buffet Bò</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MenuList', { buffetType: 'Buffet Bò' })}
              activeOpacity={0.7}
            >
              <Text style={styles.seeMore}>Xem thêm</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {[1, 2, 3, 4, 5].map((index) => (
              <TouchableOpacity
                key={index}
                style={styles.imageCard}
                onPress={() => navigation.navigate('MenuDetail', { menuId: index, buffetType: 'Buffet Bò' })}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg' }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Buffet Hải sản Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Buffet Hải sản</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MenuList', { buffetType: 'Buffet Hải sản' })}
              activeOpacity={0.7}
            >
              <Text style={styles.seeMore}>Xem thêm</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {[1, 2, 3, 4, 5].map((index) => (
              <TouchableOpacity
                key={index}
                style={styles.imageCard}
                onPress={() => navigation.navigate('MenuDetail', { menuId: index, buffetType: 'Buffet Hải sản' })}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg' }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Buffet Chay Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Buffet Chay</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('MenuList', { buffetType: 'Buffet Chay' })}
              activeOpacity={0.7}
            >
              <Text style={styles.seeMore}>Xem thêm</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
            {[1, 2, 3, 4, 5].map((index) => (
              <TouchableOpacity
                key={index}
                style={styles.imageCard}
                onPress={() => navigation.navigate('MenuDetail', { menuId: index, buffetType: 'Buffet Chay' })}
                activeOpacity={0.8}
              >
                <Image
                  source={{ uri: 'https://aeonmall-review-rikkei.cdn.vccloud.vn/public/wp/16/editors/S2BaLrALzwD1UT9Jk8uJoEGpB7mWCs5OrlCteIPx.jpg' }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
  },
  seeMore: {
    fontSize: 14,
    color: PRIMARY_COLOR,
    fontWeight: '600',
  },
  horizontalScroll: {
    paddingLeft: 20,
  },
  imageCard: {
    width: width * 0.7,
    height: 200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
});
