import { Stack } from "expo-router";
import React from "react";

export default function ResidentLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="memory-game" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
