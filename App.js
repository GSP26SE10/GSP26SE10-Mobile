import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import React, { useState } from "react";
import { Button } from "react-native";

export default function App() {
  const [count, setCount] = React.useState(0);
  return (
    <View style={styles.container}>
      <Text style={{ marginBottom: 20 }}>You pressed {count} times</Text>
      <Button style={{ marginBottom: 20 }} title="Press me" onPress={() => setCount(count + 1)} />
      <Button title="Reset" onPress={() => setCount(0)} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
