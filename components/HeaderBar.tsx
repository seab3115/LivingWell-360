import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  greeting: string;
  name: string;
  accountHref: string;
}

export function HeaderBar({ greeting, name, accountHref }: Props) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.greeting, { color: c.mutedForeground }]}>{greeting}</Text>
        <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push(accountHref as never)}
        accessibilityLabel="Open account"
        style={({ pressed }) => [
          styles.iconBtn,
          { backgroundColor: c.muted, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="person-circle-outline" size={28} color={c.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  greeting: { fontFamily: "Inter_500Medium", fontSize: 16 },
  name: { fontFamily: "Inter_700Bold", fontSize: 26, letterSpacing: -0.5 },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
});
