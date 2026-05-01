import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  addLogEntry,
} from "@/lib/firestoreData";
import { buildDeck, getCurrentWeekGame, MemoryCard } from "@/lib/memoryGame";

export default function MemoryGameScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const week = useMemo(() => getCurrentWeekGame(), []);
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(week.pairs));
  const [flippedIds, setFlippedIds] = useState<number[]>([]);
  const [moves, setMoves] = useState<number>(0);
  const [matched, setMatched] = useState<number>(0);
  const [completed, setCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (matched === week.pairs.length && !completed) {
      setCompleted(true);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      if (user) {
        addLogEntry(user.uid, "memory", `completed:${moves}`).catch(() => {});
      }
    }
  }, [matched, week.pairs.length, completed, user, moves]);

  const handleFlip = (id: number) => {
    if (flippedIds.length === 2) return;
    const card = cards.find((card) => card.id === id);
    if (!card || card.flipped || card.matched) return;

    const next = cards.map((card) => (card.id === id ? { ...card, flipped: true } : card));
    setCards(next);

    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }

    const newFlipped = [...flippedIds, id];
    setFlippedIds(newFlipped);

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newFlipped;
      const cardA = next.find((card) => card.id === a);
      const cardB = next.find((card) => card.id === b);
      if (cardA && cardB && cardA.icon === cardB.icon) {
        setTimeout(() => {
          setCards((current) =>
            current.map((card) =>
              card.id === a || card.id === b
                ? { ...card, matched: true }
                : card,
            ),
          );
          setMatched((m) => m + 1);
          setFlippedIds([]);
        }, 600);
      } else {
        setTimeout(() => {
          setCards((current) =>
            current.map((card) =>
              card.id === a || card.id === b
                ? { ...card, flipped: false }
                : card,
            ),
          );
          setFlippedIds([]);
        }, 1000);
      }
    }
  };

  const restart = () => {
    setCards(buildDeck(week.pairs));
    setFlippedIds([]);
    setMoves(0);
    setMatched(0);
    setCompleted(false);
  };

  const cellSize = 100;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: c.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { backgroundColor: c.muted, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="chevron-back" size={26} color={c.foreground} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.foreground }]}>Memory Game</Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            This week: {week.title}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statBadge, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
          <Text style={[styles.statLabel, { color: c.secondaryForeground }]}>Moves</Text>
          <Text style={[styles.statValue, { color: c.secondaryForeground }]}>{moves}</Text>
        </View>
        <View style={[styles.statBadge, { backgroundColor: c.secondary, borderRadius: c.radius }]}>
          <Text style={[styles.statLabel, { color: c.secondaryForeground }]}>Pairs</Text>
          <Text style={[styles.statValue, { color: c.secondaryForeground }]}>
            {matched}/{week.pairs.length}
          </Text>
        </View>
      </View>

      <View style={styles.gridWrap}>
        <View style={styles.grid}>
          {cards.map((card) => (
            <Pressable
              key={card.id}
              onPress={() => handleFlip(card.id)}
              style={({ pressed }) => [
                styles.cell,
                {
                  width: cellSize,
                  height: cellSize,
                  borderRadius: c.radius,
                  backgroundColor: card.matched
                    ? c.success
                    : card.flipped
                      ? c.primary
                      : c.card,
                  borderColor: card.matched
                    ? c.success
                    : card.flipped
                      ? c.primary
                      : c.border,
                  opacity: pressed && !card.flipped && !card.matched ? 0.85 : 1,
                },
              ]}
            >
              {card.flipped || card.matched ? (
                <Ionicons name={card.icon} size={48} color="#ffffff" />
              ) : (
                <Ionicons name="help" size={36} color={c.mutedForeground} />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {completed && (
        <View style={[styles.winCard, { backgroundColor: c.success, borderRadius: c.radius }]}>
          <Ionicons name="trophy" size={32} color="#ffffff" />
          <Text style={styles.winText}>You did it in {moves} moves!</Text>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <PrimaryButton label="Play Again" onPress={restart} variant="secondary" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 22 },
  subtitle: { fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  statBadge: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 13 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, marginTop: 2 },
  gridWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    maxWidth: 340,
  },
  cell: {
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  winCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    padding: 16,
  },
  winText: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#ffffff" },
  footer: { paddingHorizontal: 20, paddingTop: 16 },
});
