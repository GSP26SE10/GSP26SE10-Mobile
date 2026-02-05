import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useFonts } from 'expo-font';
import { MadimiOne_400Regular } from '@expo-google-fonts/madimi-one';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import Toast from '../components/Toast';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY } from '../constants/colors';

const { width } = Dimensions.get('window');

export default function ContactScreen({ navigation }) {
  const [fontsLoaded] = useFonts({
    MadimiOne_400Regular,
  });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const handleChatPress = () => {
    navigation.navigate('Chat');
  };

  const handleCopy = async (text, label) => {
    await Clipboard.setStringAsync(text);
    setToastMessage(`Đã sao chép ${label}`);
    setToastVisible(true);
  };

  const handleEmailPress = () => {
    handleCopy('bookfet@gmail.com', 'email');
  };

  const handlePhonePress = () => {
    handleCopy('0123456789', 'số điện thoại');
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Toast
        message={toastMessage}
        visible={toastVisible}
        onHide={() => setToastVisible(false)}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Liên lạc với chúng tôi</Text>
        </View>

        {/* Central Graphic */}
        <View style={styles.graphicContainer}>
          <View style={styles.graphicCircle}>
            {/* Main bowl image placeholder */}
            <View style={styles.mainBowl}>
              <Image
                source={{ uri: 'https://scontent.fsgn16-1.fna.fbcdn.net/v/t39.30808-6/548570477_1189728099855961_5240077253445441952_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Lqp7XKTpjhEQ7kNvwGmL7JP&_nc_oc=AdlFm094dgSxWykFEBHlV5urvU6TtYvqvBW6vGbcWA82Mvri8OXfcl2mq02l7coDg9n7jaq7KjGdKQ3oAFYMnzGc&_nc_zt=23&_nc_ht=scontent.fsgn16-1.fna&_nc_gid=QckBobUcEcuU-15xcs2WdA&oh=00_AfuoPMLP6B9c7ArmiRL3hG_mzjPAZa_aRe3Yl5zro9aGxw&oe=698954C8' }}
                style={styles.bowlImage}
                resizeMode="cover"
              />
            </View>
            
            {/* Small dish images around the circle */}
            {[1, 2, 3, 4].map((index) => (
              <View
                key={index}
                style={[
                  styles.smallDish,
                  {
                    transform: [
                      { rotate: `${(index - 1) * 90}deg` },
                      { translateX: 120 },
                      { rotate: `${-(index - 1) * 90}deg` },
                    ],
                  },
                ]}
              >
                <Image
                  source={{ uri: 'https://scontent.fsgn16-1.fna.fbcdn.net/v/t39.30808-6/548570477_1189728099855961_5240077253445441952_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Lqp7XKTpjhEQ7kNvwGmL7JP&_nc_oc=AdlFm094dgSxWykFEBHlV5urvU6TtYvqvBW6vGbcWA82Mvri8OXfcl2mq02l7coDg9n7jaq7KjGdKQ3oAFYMnzGc&_nc_zt=23&_nc_ht=scontent.fsgn16-1.fna&_nc_gid=QckBobUcEcuU-15xcs2WdA&oh=00_AfuoPMLP6B9c7ArmiRL3hG_mzjPAZa_aRe3Yl5zro9aGxw&oe=698954C8' }}
                  style={styles.smallDishImage}
                  resizeMode="cover"
                />
              </View>
            ))}
          </View>
        </View>

        {/* Brand Name */}
        <Text style={styles.brandName}>BOOKFET</Text>

        {/* Contact Methods */}
        <View style={styles.contactMethods}>
          <TouchableOpacity
            style={styles.contactItem}
            onPress={handleChatPress}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={24} color={TEXT_PRIMARY} />
            <Text style={styles.contactText}>Chat với chủ cửa hàng</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={handleEmailPress}
            activeOpacity={0.7}
          >
            <Ionicons name="mail-outline" size={24} color={TEXT_PRIMARY} />
            <Text style={styles.contactText}>bookfet@gmail.com</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.contactItem}
            onPress={handlePhonePress}
            activeOpacity={0.7}
          >
            <Ionicons name="call-outline" size={24} color={TEXT_PRIMARY} />
            <Text style={styles.contactText}>0123456789</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomNavigation activeTab="Contact" onTabPress={(tab) => navigation.navigate(tab)} />
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
    alignItems: 'center',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 32,
    width: '100%',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  graphicContainer: {
    width: width,
    height: 280,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  graphicCircle: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mainBowl: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  bowlImage: {
    width: '100%',
    height: '100%',
  },
  smallDish: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
  },
  smallDishImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 48,
    fontFamily: 'MadimiOne_400Regular',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    marginBottom: 40,
    width: '100%',
  },
  contactMethods: {
    width: '100%',
    paddingHorizontal: 40,
    gap: 24,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  contactText: {
    fontSize: 24,
    color: TEXT_PRIMARY,
    textDecorationLine: 'underline',
  },
});
