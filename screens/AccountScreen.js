import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE } from '../constants/colors';

export default function AccountScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Tài khoản</Text>
      <BottomNavigation activeTab="Account" onTabPress={(tab) => navigation.navigate(tab)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
});
