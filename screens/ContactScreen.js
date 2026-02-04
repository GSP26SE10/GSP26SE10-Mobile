import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE } from '../constants/colors';

export default function ContactScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Liên lạc</Text>
      <BottomNavigation activeTab="Contact" onTabPress={(tab) => navigation.navigate(tab)} />
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
