import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Animated,
  Easing,
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
const ORBIT_RADIUS = 102;

export default function ContactScreen({ navigation }) {
  const [fontsLoaded] = useFonts({
    MadimiOne_400Regular,
  });
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const spinAnim = useRef(new Animated.Value(0)).current;

  const spin = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [spinAnim],
  );
  const spinReverse = useMemo(
    () =>
      spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['360deg', '0deg'],
      }),
    [spinAnim],
  );

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      spinAnim.setValue(0);
    };
  }, [spinAnim]);

  const satellites = useMemo(
    () => [
      { id: 's1', src: require('../assets/sub1.jpg'), angle: 0 },
      { id: 's2', src: require('../assets/sub2.jpg'), angle: 120 },
      { id: 's3', src: require('../assets/sub3.jpg'), angle: 240 },
    ],
    [],
  );

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
            {/* Orbiting satellites */}
            <Animated.View style={[styles.orbitLayer, { transform: [{ rotate: spin }] }]}>
              {satellites.map((s) => (
                <Animated.View
                  key={s.id}
                  style={[
                    styles.smallDish,
                    {
                      transform: [
                        { rotate: `${s.angle}deg` },
                        { translateX: ORBIT_RADIUS },
                        { rotate: spinReverse },
                      ],
                    },
                  ]}
                >
                  <Image source={s.src} style={styles.smallDishImage} resizeMode="cover" />
                </Animated.View>
              ))}
            </Animated.View>

            {/* Main image */}
            <View style={styles.mainBowl}>
              <Image source={require('../assets/main.png')} style={styles.bowlImage} resizeMode="contain" />
            </View>
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
            <Text style={styles.contactChatText}>Chat với chủ cửa hàng</Text>
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
  orbitLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainBowl: {
    width: 130,
    height: 130,
    borderRadius: 75,
    overflow: 'hidden',
    backgroundColor: BACKGROUND_WHITE,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  bowlImage: {
    width: '100%',
    height: '100%',
  },
  smallDish: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    backgroundColor: BACKGROUND_WHITE,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.95)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 7,
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
    contactChatText: {
    fontSize: 24,
    color: TEXT_PRIMARY
  },
});
