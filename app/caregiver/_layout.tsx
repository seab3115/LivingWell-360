import { Stack } from "expo-router";
import React from "react";

export default function CaregiverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
