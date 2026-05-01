import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { HeaderBar } from "@/components/HeaderBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SpeakButton } from "@/components/SpeakButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { buildDayStatus, formatHumanDate } from "@/lib/dayStatus";
import {
  ackReminder,
  addLogEntry,
  dateKeyFor,
  getReminderAcksSince,
  getTodayLogs,
  LogEntry,
  MoodValue,
  ReminderAck,
  setDailySteps,
} from "@/lib/firestoreData";
import { formatTime, getReminders, Reminder } from "@/lib/reminders";
import { speak } from "@/lib/speech";
import { getTodaySteps, StepResult, subscribeToSteps } from "@/lib/steps";

const MOOD_OPTIONS: {
  value: MoodValue;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: keyof ReturnType<typeof useColors>;
}[] = [
  { value: "good", label: "Good", icon: "happy", color: "moodGood" },
  { value: "tired", label: "Tired", icon: "bed", color: "moodTired" },
  { value: "notwell", label: "Not Well", icon: "sad", color: "moodNotWell" },
];

export default function ResidentHome() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [acks, setAcks] = useState<ReminderAck[]>([]);
  const [steps, setSteps] = useState<StepResult>({ available: false, steps: null });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!user) return;
    try {
      const [today, reminderList, ackList, stepResult] = await Promise.all([
        getTodayLogs(user.uid),
        getReminders(user.uid),
        getReminderAcksSince(user.uid, 1),
        getTodaySteps(),
      ]);
      setLogs(today);
      setReminders(reminderList);
      setAcks(ackList);
      setSteps(stepResult);
      // Sync steps to Firestore so the caregiver can see them
      if (stepResult.steps !== null) {
        setDailySteps(user.uid, stepResult.steps).catch(() => undefined);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load.";
      Alert.alert("Error", msg);
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll]),
  );

  // Android: watchStepCount subscription (date-range getStepCountAsync not supported on Android)
  useEffect(() => {
    if (Platform.OS !== "android" || !user) return () => undefined;
    const unsub = subscribeToSteps((liveSteps) => {
      setSteps({ available: true, steps: liveSteps });
      setDailySteps(user.uid, liveSteps).catch(() => undefined);
    });
    return unsub;
  }, [user]);

  const today = buildDayStatus({
    dateKey: dateKeyFor(new Date()),
    logs,
    reminders,
    acks,
    steps: steps.steps,
    now: new Date(),
  });

  const morningDone = today.morningCheckIn === "done";
  const eveningDone = today.eveningCheckIn === "done";
  const moodToday = logs.find((l) => l.type === "mood");

  const handleCheckIn = async () => {
    if (!user) return;
    if (morningDone && eveningDone) return;
    setSubmitting("checkin");
    try {
      await addLogEntry(user.uid, "checkin", "ok");
      const hr = new Date().getHours();
      speak(
        hr < 12
          ? "Thank you. Your morning check-in has been saved."
          : "Thank you. Your evening check-in has been saved.",
      );
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(null);
    }
  };

  const handleMood = async (mood: MoodValue) => {
    if (!user) return;
    setSubmitting(`mood-${mood}`);
    try {
      await addLogEntry(user.uid, "mood", mood);
      speak(
        mood === "good"
          ? "Wonderful! Glad to hear you're feeling good."
          : mood === "tired"
            ? "Got it, you're feeling tired. Take a rest."
            : "Sorry to hear you're not well. Your caregiver will be notified.",
      );
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(null);
    }
  };

  const handleAck = async (reminderId: string) => {
    if (!user) return;
    setSubmitting(`ack-${reminderId}`);
    try {
      await ackReminder(user.uid, reminderId);
      await loadAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(null);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const canCheckInNow = !(morningDone && eveningDone);
  const checkInLabel = !canCheckInNow
    ? "All check-ins done!"
    : !morningDone && new Date().getHours() < 12
      ? "I'm OK (morning)"
      : !eveningDone && new Date().getHours() >= 12
        ? "I'm OK (evening)"
        : "I'm OK";

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
        }
      >
        <HeaderBar
          greeting="Hello,"
          name={profile?.displayName ?? "Friend"}
          accountHref="/resident/account"
        />

        {/* Steps */}
        <Card style={{ marginTop: 20 }}>
          <View style={styles.cardHeader}>
            <Ionicons name="footsteps" size={28} color={c.primary} />
            <Text style={[styles.cardTitle, { color: c.foreground }]}>
              {formatHumanDate(today.dateKey)}&apos;s steps
            </Text>
          </View>
          <View style={styles.stepsRow}>
            <Text style={[styles.stepsNumber, { color: c.primary }]}>
              {steps.steps !== null ? steps.steps.toLocaleString() : "—"}
            </Text>
            <Text style={[styles.stepsLabel, { color: c.mutedForeground }]}>steps</Text>
          </View>
          {!steps.available && (
            <Text style={[styles.cardSubtitle, { color: c.mutedForeground }]}>
              {steps.message
                ? steps.message
                : Platform.OS === "android"
                  ? "Walk around and your steps will appear here."
                  : "Step counting not available."}
            </Text>
          )}
        </Card>

        {/* Check-in */}
        <Card style={{ marginTop: 16 }}>
          <View style={styles.cardHeader}>
            <Ionicons name="checkmark-circle" size={28} color={c.success} />
            <Text style={[styles.cardTitle, { color: c.foreground, flex: 1 }]}>I&apos;m OK</Text>
            <SpeakButton
              text="Tap I'm OK to let your caregiver know you're doing well. Try to check in once in the morning and once in the evening."
              accessibilityLabel="Read check-in instructions aloud"
            />
          </View>
          <View style={styles.checkinPills}>
            <CheckInPill label="Morning" status={today.morningCheckIn} c={c} />
            <CheckInPill label="Evening" status={today.eveningCheckIn} c={c} />
          </View>
          <PrimaryButton
            label={checkInLabel}
            onPress={handleCheckIn}
            disabled={!canCheckInNow}
            loading={submitting === "checkin"}
            variant="success"
            style={{ marginTop: 16 }}
          />
        </Card>

        {/* Mood */}
        <Card style={{ marginTop: 16 }}>
          <View style={styles.cardHeader}>
            <Ionicons name="heart" size={28} color={c.primary} />
            <Text style={[styles.cardTitle, { color: c.foreground, flex: 1 }]}>
              How do you feel?
            </Text>
            <SpeakButton
              text="How do you feel today? Tap Good, Tired, or Not Well to tell us."
              accessibilityLabel="Read mood question aloud"
            />
          </View>
          {moodToday && (
            <Text style={[styles.cardSubtitle, { color: c.mutedForeground }]}>
              You&apos;re feeling: {labelForMood(moodToday.value as MoodValue)}
            </Text>
          )}
          <View style={styles.moodRow}>
            {MOOD_OPTIONS.map((m) => {
              const isSelected = moodToday?.value === m.value;
              const moodColor = c[m.color] as string;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => handleMood(m.value)}
                  disabled={submitting !== null}
                  style={({ pressed }) => [
                    styles.moodCard,
                    {
                      borderRadius: c.radius,
                      borderColor: isSelected ? moodColor : c.border,
                      backgroundColor: isSelected ? moodColor : c.card,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={36}
                    color={isSelected ? "#ffffff" : moodColor}
                  />
                  <Text
                    style={[
                      styles.moodLabel,
                      { color: isSelected ? "#ffffff" : c.foreground },
                    ]}
                  >
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>

        {/* Today's reminders */}
        {today.reminderResults.length > 0 && (
          <Card style={{ marginTop: 16 }}>
            <View style={styles.cardHeader}>
              <Ionicons name="alarm" size={28} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.foreground, flex: 1 }]}>
                Today&apos;s reminders
              </Text>
            </View>
            <View style={{ marginTop: 12, gap: 10 }}>
              {today.reminderResults.map((r) => (
                <View
                  key={r.reminderId}
                  style={[
                    styles.todayReminderRow,
                    {
                      borderColor: c.border,
                      borderRadius: c.radius,
                      backgroundColor:
                        r.status === "done"
                          ? c.secondary
                          : r.status === "missed"
                            ? "#fee2e2"
                            : c.card,
                    },
                  ]}
                >
                  <Ionicons
                    name={r.kind === "medicine" ? "medkit" : "restaurant"}
                    size={22}
                    color={c.primary}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.reminderLabel, { color: c.foreground }]} numberOfLines={1}>
                      {r.label}
                    </Text>
                    <Text style={[styles.reminderTime, { color: c.mutedForeground }]}>
                      {formatTime(r.hour, r.minute)}
                    </Text>
                  </View>
                  {r.status === "done" ? (
                    <View style={[styles.statusChip, { backgroundColor: c.success }]}>
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={styles.statusChipText}>Done</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleAck(r.reminderId)}
                      disabled={submitting !== null}
                      style={({ pressed }) => [
                        styles.doneBtn,
                        {
                          backgroundColor: c.primary,
                          borderRadius: c.radius,
                          opacity: pressed ? 0.85 : 1,
                        },
                      ]}
                    >
                      {submitting === `ack-${r.reminderId}` ? (
                        <ActivityIndicator size="small" color={c.primaryForeground} />
                      ) : (
                        <Text style={[styles.doneBtnText, { color: c.primaryForeground }]}>
                          Done
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* Memory game */}
        <Pressable
          onPress={() => router.push("/resident/memory-game")}
          style={({ pressed }) => [
            styles.gameCard,
            {
              backgroundColor: c.primary,
              borderRadius: c.radius,
              opacity: pressed ? 0.9 : 1,
              marginTop: 16,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.gameTitle, { color: c.primaryForeground }]}>
              Memory Game
            </Text>
            <Text style={[styles.gameSubtitle, { color: c.primaryForeground }]}>
              A new puzzle every week
            </Text>
          </View>
          <Ionicons name="game-controller" size={56} color={c.primaryForeground} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

function CheckInPill({
  label,
  status,
  c,
}: {
  label: string;
  status: "done" | "missed" | "pending";
  c: ReturnType<typeof useColors>;
}) {
  const bg =
    status === "done" ? c.success : status === "missed" ? c.destructive : c.muted;
  const fg =
    status === "done"
      ? c.successForeground
      : status === "missed"
        ? c.destructiveForeground
        : c.foreground;
  const icon: React.ComponentProps<typeof Ionicons>["name"] =
    status === "done" ? "checkmark-circle" : status === "missed" ? "close-circle" : "time";
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderRadius: 999 }]}>
      <Ionicons name={icon} size={16} color={fg} />
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function labelForMood(v: MoodValue): string {
  if (v === "good") return "Good";
  if (v === "tired") return "Tired";
  return "Not Well";
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 22 },
  cardSubtitle: { fontFamily: "Inter_400Regular", fontSize: 16, marginTop: 8 },
  stepsRow: { flexDirection: "row", alignItems: "baseline", marginTop: 12 },
  stepsNumber: { fontFamily: "Inter_700Bold", fontSize: 56, letterSpacing: -1 },
  stepsLabel: { fontFamily: "Inter_500Medium", fontSize: 20, marginLeft: 10 },
  checkinPills: { flexDirection: "row", gap: 8, marginTop: 12 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  moodRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  moodCard: {
    flex: 1,
    borderWidth: 2,
    padding: 16,
    alignItems: "center",
    minHeight: 110,
    justifyContent: "center",
  },
  moodLabel: { fontFamily: "Inter_700Bold", fontSize: 16, marginTop: 8 },
  todayReminderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  reminderLabel: { fontFamily: "Inter_700Bold", fontSize: 16 },
  reminderTime: { fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 2 },
  doneBtn: { paddingHorizontal: 18, paddingVertical: 10, minWidth: 70, alignItems: "center" },
  doneBtnText: { fontFamily: "Inter_700Bold", fontSize: 14 },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusChipText: { fontFamily: "Inter_700Bold", fontSize: 12, color: "#fff" },
  gameCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 24,
    minHeight: 120,
  },
  gameTitle: { fontFamily: "Inter_700Bold", fontSize: 24 },
  gameSubtitle: { fontFamily: "Inter_500Medium", fontSize: 16, marginTop: 4, opacity: 0.9 },
});
