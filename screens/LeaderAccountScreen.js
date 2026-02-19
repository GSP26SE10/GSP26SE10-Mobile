import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNavigationStaff from '../components/BottomNavigationStaff';
import { TEXT_PRIMARY, BACKGROUND_WHITE } from '../constants/colors';

export default function LeaderAccountScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.content}>
        <Text style={styles.text}>Tài khoản của Leader</Text>
      </View>
      <BottomNavigationStaff activeTab="LeaderAccount" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
});
