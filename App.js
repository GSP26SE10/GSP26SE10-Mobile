import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreen from "./screens/HomeScreen";
import SearchScreen from "./screens/SearchScreen";
import OrdersScreen from "./screens/OrdersScreen";
import ContactScreen from "./screens/ContactScreen";
import AccountScreen from "./screens/AccountScreen";

export default function App() {
  const [currentScreen, setCurrentScreen] = useState("Login");

  const navigation = {
    navigate: (screenName) => {
      setCurrentScreen(screenName);
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
        return <SearchScreen navigation={navigation} />;
      case "Orders":
        return <OrdersScreen navigation={navigation} />;
      case "Contact":
        return <ContactScreen navigation={navigation} />;
      case "Account":
        return <AccountScreen navigation={navigation} />;
      default:
        return <LoginScreen navigation={navigation} />;
    }
  };

  return (
    <>
      <StatusBar style="auto" />
      {renderScreen()}
    </>
  );
}
