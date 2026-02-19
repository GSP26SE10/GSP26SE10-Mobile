import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import ServiceScreen from "./screens/ServiceScreen";
import OrdersScreen from "./screens/OrdersScreen";
import ContactScreen from "./screens/ContactScreen";
import AccountScreen from "./screens/AccountScreen";
import MenuListScreen from "./screens/MenuListScreen";
import MenuDetailScreen from "./screens/MenuDetailScreen";
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

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("Login");
  const [screenParams, setScreenParams] = useState({});
  const [screenHistory, setScreenHistory] = useState(["Login"]);

  const navigation = {
    navigate: (screenName, params) => {
      setScreenParams(params || {});
      setScreenHistory((prev) => [...prev, screenName]);
      setCurrentScreen(screenName);
    },
    goBack: () => {
      if (screenHistory.length > 1) {
        const newHistory = [...screenHistory];
        newHistory.pop(); // Remove current screen
        const previousScreen = newHistory[newHistory.length - 1];
        setScreenHistory(newHistory);
        setCurrentScreen(previousScreen);
      }
    },
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case "Login":
        return <LoginScreen navigation={navigation} />;
      case "Register":
        return <RegisterScreen navigation={navigation} />;
      case "Home":
        return <HomeScreen navigation={navigation} />;
      case "Search":
        return <ServiceScreen navigation={navigation} />;
      case "Orders":
        return <OrdersScreen navigation={navigation} />;
      case "Contact":
        return <ContactScreen navigation={navigation} />;
      case "Account":
        return <AccountScreen navigation={navigation} />;
      case "MenuList":
        return <MenuListScreen navigation={navigation} route={{ params: screenParams }} />;
      case "MenuDetail":
        return <MenuDetailScreen navigation={navigation} route={{ params: screenParams }} />;
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
      default:
        return <LoginScreen navigation={navigation} />;
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {renderScreen()}
    </SafeAreaProvider>
  );
}
