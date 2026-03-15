import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getAccessToken } from "./utils/auth";
import { logAccessTokenNow, registerForPushNotificationsAsync } from "./utils/notification";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import ServiceScreen from "./screens/ServiceScreen";
import OrdersScreen from "./screens/OrdersScreen";
import OrderConfirmationScreen from "./screens/OrderConfirmationScreen";
import OrderSummaryScreen from "./screens/OrderSummaryScreen";
import ContactScreen from "./screens/ContactScreen";
import AccountScreen from "./screens/AccountScreen";
import MenuListScreen from "./screens/MenuListScreen";
import MenuDetailScreen from "./screens/MenuDetailScreen";
import ServiceDetailScreen from "./screens/ServiceDetailScreen";
import ChatScreen from "./screens/ChatScreen";
import TransactionHistoryScreen from "./screens/TransactionHistoryScreen";
import StaffHomeScreen from "./screens/StaffHomeScreen";
import StaffOrderHistoryScreen from "./screens/StaffOrderHistoryScreen";
import StaffCalendarScreen from "./screens/StaffCalendarScreen";
import StaffAccountScreen from "./screens/StaffAccountScreen";
import LeaderHomeScreen from "./screens/LeaderHomeScreen";
import LeaderOrderHistoryScreen from "./screens/LeaderOrderHistoryScreen";
import LeaderCalendarScreen from "./screens/LeaderCalendarScreen";
import LeaderAccountScreen from "./screens/LeaderAccountScreen";
import StaffOrderDetailScreen from "./screens/StaffOrderDetailScreen";
import StaffOrderDetailHistoryScreen from "./screens/StaffOrderDetailHistoryScreen";
import LeaderOrderDetailHistoryScreen from "./screens/LeaderOrderDetailHistoryScreen";
import LeaderOrderDetailScreen from "./screens/LeaderOrderDetailScreen";
import OrderDetail from "./screens/OrderDetail";

const PROTECTED_TABS = ['Orders', 'Contact', 'Account'];
const queryClient = new QueryClient();

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("Home");
  const [screenParams, setScreenParams] = useState({});
  const [screenHistory, setScreenHistory] = useState([{ name: "Home", params: {} }]);

  useEffect(() => {
    logAccessTokenNow();
    registerForPushNotificationsAsync();
  }, []);

  const navigation = {
    navigate: (screenName, params) => {
      if (PROTECTED_TABS.includes(screenName)) {
        getAccessToken().then((token) => {
          if (!token) {
            const nextParams = { returnScreen: screenName, returnParams: null, fromAuthRequired: true, ...(params || {}) };
            setScreenParams(nextParams);
            setScreenHistory((prev) => [...prev, { name: 'Login', params: nextParams }]);
            setCurrentScreen('Login');
            return;
          }
          const nextParams = params || {};
          setScreenParams(nextParams);
          setScreenHistory((prev) => [...prev, { name: screenName, params: nextParams }]);
          setCurrentScreen(screenName);
        });
        return;
      }
      const nextParams = params || {};
      setScreenParams(nextParams);
      setScreenHistory((prev) => [...prev, { name: screenName, params: nextParams }]);
      setCurrentScreen(screenName);
    },
    goBack: () => {
      if (screenHistory.length > 1) {
        const newHistory = [...screenHistory];
        newHistory.pop(); // Remove current screen
        const previousEntry = newHistory[newHistory.length - 1];
        setScreenHistory(newHistory);
        setCurrentScreen(previousEntry.name);
        setScreenParams(previousEntry.params || {});
      }
    },
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "Login":
        return <LoginScreen navigation={navigation} route={{ params: screenParams }} />;
      case "Register":
        return <RegisterScreen navigation={navigation} />;
      case "Home":
        return <HomeScreen navigation={navigation} route={{ params: screenParams }} />;
      case "Search":
        return <ServiceScreen navigation={navigation} />;
      case "Orders":
        return <OrdersScreen navigation={navigation} route={{ params: screenParams }} />;
      case "OrderConfirmation":
        return <OrderConfirmationScreen navigation={navigation} route={{ params: screenParams }} />;
      case "OrderSummary":
        return <OrderSummaryScreen navigation={navigation} route={{ params: screenParams }} />;
      case "Contact":
        return <ContactScreen navigation={navigation} />;
      case "Account":
        return <AccountScreen navigation={navigation} />;
      case "MenuList":
        return <MenuListScreen navigation={navigation} route={{ params: screenParams }} />;
      case "MenuDetail":
        return <MenuDetailScreen navigation={navigation} route={{ params: screenParams }} />;
      case "ServiceDetail":
        return <ServiceDetailScreen navigation={navigation} route={{ params: screenParams }} />;
      case "Chat":
        return <ChatScreen navigation={navigation} />;
      case "TransactionHistory":
        return <TransactionHistoryScreen navigation={navigation} />;
      case "StaffHome":
        return <StaffHomeScreen navigation={navigation} />;
      case "StaffOrderHistory":
        return <StaffOrderHistoryScreen navigation={navigation} />;
      case "StaffCalendar":
        return <StaffCalendarScreen navigation={navigation} />;
      case "StaffAccount":
        return <StaffAccountScreen navigation={navigation} />;
      case "LeaderHome":
        return <LeaderHomeScreen navigation={navigation} />;
      case "LeaderOrderHistory":
        return <LeaderOrderHistoryScreen navigation={navigation} />;
      case "LeaderCalendar":
        return <LeaderCalendarScreen navigation={navigation} />;
      case "LeaderAccount":
        return <LeaderAccountScreen navigation={navigation} />;
      case "LeaderOrderDetail":
        return <LeaderOrderDetailScreen navigation={navigation} route={{ params: screenParams }} />;
      case "StaffOrderDetail":
        return <StaffOrderDetailScreen navigation={navigation} route={{ params: screenParams }} />;
      case "StaffOrderDetailHistory":
        return <StaffOrderDetailHistoryScreen navigation={navigation} route={{ params: screenParams }} />;
      case "LeaderOrderDetailHistory":
        return <LeaderOrderDetailHistoryScreen navigation={navigation} route={{ params: screenParams }} />;
      case "OrderDetail":
        return <OrderDetail navigation={navigation} route={{ params: screenParams }} />;
      default:
        return <LoginScreen navigation={navigation} />;
    }
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        {renderScreen()}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
