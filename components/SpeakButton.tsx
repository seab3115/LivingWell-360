import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

import { useColors } from "@/hooks/useColors";
import { speak } from "@/lib/speech";

interface Props {
  text: string;
  size?: number;
  accessibilityLabel?: string;
}

export function SpeakButton({ text, size = 22, accessibilityLabel }: Props) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => speak(text)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? "Read aloud"}
      hitSlop={10}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: c.muted,
          opacity: pressed ? 0.7 : 1,
          width: size + 18,
          height: size + 18,
          borderRadius: (size + 18) / 2,
        },
      ]}
    >
      <Ionicons name="volume-high" size={size} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: "center", justifyContent: "center" },
});
