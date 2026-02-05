import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

// Mock transaction data
const transactions = [
  {
    id: 1,
    name: 'Tiệc Buffet Lẩu Bò Mỹ',
    payments: [
      {
        type: 'deposit',
        label: 'Đặt cọc 50%',
        amount: '1.368.950₫',
        time: '09:00 05/01/2026',
      },
      {
        type: 'remaining',
        label: 'Thanh toán còn lại',
        amount: '1.368.950₫',
        time: '12:00 10/01/2026',
      },
    ],
  },
  {
    id: 2,
    name: 'Tiệc Buffet Chay',
    payments: [
      {
        type: 'deposit',
        label: 'Đặt cọc 50%',
        amount: '999.000₫',
        time: '10:00 06/01/2026',
      },
      {
        type: 'remaining',
        label: 'Thanh toán còn lại',
        amount: '999.000₫',
        time: '14:00 11/01/2026',
      },
    ],
  },
];

export default function TransactionHistoryScreen({ navigation }) {
  const [expandedItems, setExpandedItems] = useState({});
  const animationsRef = React.useRef({});
  const swipeBack = useSwipeBack(() => navigation.goBack());

  const getAnimation = (itemId) => {
    if (!animationsRef.current[itemId]) {
      animationsRef.current[itemId] = new Animated.Value(0);
    }
    return animationsRef.current[itemId];
  };

  const toggleItem = (itemId) => {
    const isExpanded = expandedItems[itemId];
    setExpandedItems({
      ...expandedItems,
      [itemId]: !isExpanded,
    });

    const animation = getAnimation(itemId);
    Animated.timing(animation, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const renderTransactionItem = (transaction) => {
    const isExpanded = expandedItems[transaction.id];
    const animation = getAnimation(transaction.id);

    const maxHeight = animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, transaction.payments.length * 80],
    });

    const rotate = animation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '90deg'],
    });

    return (
      <View key={transaction.id} style={styles.transactionItem}>
        <TouchableOpacity
          style={styles.transactionHeader}
          onPress={() => toggleItem(transaction.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.transactionName}>{transaction.name}</Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
          </Animated.View>
        </TouchableOpacity>
        <View style={styles.transactionDivider} />
        
        <Animated.View style={{ maxHeight, overflow: 'hidden' }}>
          {transaction.payments.map((payment, index) => (
            <View key={index} style={styles.paymentItem}>
              <View style={styles.paymentHeader}>
                <Text style={styles.paymentLabel}>$ {payment.label}</Text>
              </View>
              <View style={styles.paymentDetails}>
                <Text style={styles.paymentText}>
                  Số tiền: {payment.amount} - Thời gian: {payment.time}
                </Text>
              </View>
              {index < transaction.payments.length - 1 && (
                <View style={styles.paymentDivider} />
              )}
            </View>
          ))}
        </Animated.View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']} {...swipeBack.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử giao dịch</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Transaction List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {transactions.map((transaction) => renderTransactionItem(transaction))}
      </ScrollView>

      <BottomNavigation activeTab="Account" onTabPress={(tab) => navigation.navigate(tab)} />
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
    borderBottomWidth: 1,
    borderBottomColor: BORDER_LIGHT,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  transactionItem: {
    paddingHorizontal: 20,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  transactionName: {
    fontSize: 16,
    color: TEXT_PRIMARY,
    fontWeight: '500',
  },
  transactionDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
  },
  paymentItem: {
    paddingLeft: 20,
    paddingVertical: 12,
  },
  paymentHeader: {
    marginBottom: 4,
  },
  paymentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  paymentDetails: {
    marginTop: 4,
  },
  paymentText: {
    fontSize: 13,
    color: TEXT_SECONDARY,
  },
  paymentDivider: {
    height: 1,
    backgroundColor: BORDER_LIGHT,
    marginTop: 12,
    marginLeft: -20,
  },
});
