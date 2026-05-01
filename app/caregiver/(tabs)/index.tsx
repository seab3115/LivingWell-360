import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { HeaderBar } from "@/components/HeaderBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { buildLastNDays, DayStatus, formatHumanDate } from "@/lib/dayStatus";
import {
  DailySteps,
  FirestoreReminder,
  getDailyStepsSince,
  getFirestoreReminders,
  getRecentLogs,
  getReminderAcksSince,
  getUserProfile,
  linkCaregiverToResident,
  LogEntry,
  MoodValue,
  ReminderAck,
  UserProfile,
} from "@/lib/firestoreData";
import { formatTime } from "@/lib/reminders";

const DAYS = 7;

export default function CaregiverHome() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();

  const [resident, setResident] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reminders, setReminders] = useState<FirestoreReminder[]>([]);
  const [acks, setAcks] = useState<ReminderAck[]>([]);
  const [stepsList, setStepsList] = useState<DailySteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linkEmail, setLinkEmail] = useState("");
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    if (!profile.linkedResidentUid) {
      setResident(null);
      setLogs([]);
      setReminders([]);
      setAcks([]);
      setStepsList([]);
      return;
    }
    try {
      const [r, recentLogs, reminderList, ackList, steps] = await Promise.all([
        getUserProfile(profile.linkedResidentUid),
        getRecentLogs(profile.linkedResidentUid, DAYS),
        getFirestoreReminders(profile.linkedResidentUid),
        getReminderAcksSince(profile.linkedResidentUid, DAYS),
        getDailyStepsSince(profile.linkedResidentUid, DAYS),
      ]);
      setResident(r);
      setLogs(recentLogs);
      setReminders(reminderList);
      setAcks(ackList);
      setStepsList(steps);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load.";
      Alert.alert("Error", msg);
    }
  }, [profile]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleLink = async () => {
    if (!user || !linkEmail.trim()) return;
    setLinking(true);
    try {
      const uid = await linkCaregiverToResident(user.uid, linkEmail.trim());
      if (!uid) {
        Alert.alert(
          "Not found",
          "No resident is registered with that email yet. Ask them to sign up first.",
        );
      }
      await refreshProfile();
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not link.";
      Alert.alert("Error", msg);
    } finally {
      setLinking(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  const stepsByDate = new Map<string, number>();
  for (const s of stepsList) stepsByDate.set(s.dateKey, s.steps);

  const days: DayStatus[] = profile?.linkedResidentUid
    ? buildLastNDays({ days: DAYS, logs, reminders, acks, stepsByDate })
    : [];
  const today = days[0];

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
          greeting="Caregiver"
          name={profile?.displayName ?? ""}
          accountHref="/caregiver/account"
        />

        {!profile?.linkedResidentUid && (
          <Card style={{ marginTop: 20 }}>
            <View style={styles.cardHeader}>
              <Ionicons name="link" size={26} color={c.primary} />
              <Text style={[styles.cardTitle, { color: c.foreground }]}>Link a resident</Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: c.mutedForeground }]}>
              Enter the email of the resident you care for.
            </Text>
            <TextInput
              value={linkEmail}
              onChangeText={setLinkEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="resident@example.com"
              placeholderTextColor={c.mutedForeground}
              style={[
                styles.input,
                {
                  borderColor: c.border,
                  color: c.foreground,
                  borderRadius: c.radius,
                  backgroundColor: c.background,
                  marginTop: 12,
                },
              ]}
            />
            <PrimaryButton
              label="Link Resident"
              onPress={handleLink}
              loading={linking}
              style={{ marginTop: 16 }}
            />
          </Card>
        )}

        {profile?.linkedResidentUid && today && (
          <>
            <Card style={{ marginTop: 20 }}>
              <View style={styles.cardHeader}>
                <Ionicons name="person-circle" size={28} color={c.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: c.foreground }]}>
                    {resident?.displayName ?? "Resident"}
                  </Text>
                  <Text style={[styles.cardSubtitle, { color: c.mutedForeground }]}>
                    {resident?.email}
                  </Text>
                </View>
              </View>
            </Card>

            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Today&apos;s status
            </Text>

            <View style={styles.statusGrid}>
              <StatusCell
                icon={today.morningCheckIn === "done" ? "sunny" : "sunny-outline"}
                label="Morning"
                value={
                  today.morningCheckIn === "done"
                    ? "Checked in"
                    : today.morningCheckIn === "missed"
                      ? "Missed"
                      : "Pending"
                }
                tone={
                  today.morningCheckIn === "done"
                    ? "success"
                    : today.morningCheckIn === "missed"
                      ? "danger"
                      : "neutral"
                }
                c={c}
              />
              <StatusCell
                icon={today.eveningCheckIn === "done" ? "moon" : "moon-outline"}
                label="Evening"
                value={
                  today.eveningCheckIn === "done"
                    ? "Checked in"
                    : today.eveningCheckIn === "missed"
                      ? "Missed"
                      : "Pending"
                }
                tone={
                  today.eveningCheckIn === "done"
                    ? "success"
                    : today.eveningCheckIn === "missed"
                      ? "danger"
                      : "neutral"
                }
                c={c}
              />
              <StatusCell
                icon={moodIconFor(today.mood)}
                label="Mood"
                value={today.mood ? moodLabelFor(today.mood) : "—"}
                tone="neutral"
                c={c}
              />
              <StatusCell
                icon="footsteps"
                label="Steps"
                value={today.steps !== null ? today.steps.toLocaleString() : "—"}
                tone="neutral"
                c={c}
              />
            </View>

            <Text style={[styles.sectionTitle, { color: c.foreground }]}>Last 7 days</Text>

            {days.map((d) => (
              <DayCard key={d.dateKey} day={d} c={c} />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function DayCard({ day, c }: { day: DayStatus; c: ReturnType<typeof useColors> }) {
  const missedReminders = day.reminderResults.filter((r) => r.status === "missed");
  const doneReminders = day.reminderResults.filter((r) => r.status === "done");
  const pendingReminders = day.reminderResults.filter((r) => r.status === "pending");

  const hasIssue =
    day.morningCheckIn === "missed" ||
    day.eveningCheckIn === "missed" ||
    missedReminders.length > 0;

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={styles.dayHeaderRow}>
        <Text style={[styles.dateHeader, { color: c.foreground }]}>
          {formatHumanDate(day.dateKey)}
        </Text>
        {hasIssue ? (
          <View style={[styles.dayBadge, { backgroundColor: c.destructive }]}>
            <Ionicons name="warning" size={12} color={c.destructiveForeground} />
            <Text style={[styles.dayBadgeText, { color: c.destructiveForeground }]}>
              Attention
            </Text>
          </View>
        ) : (
          <View style={[styles.dayBadge, { backgroundColor: c.success }]}>
            <Ionicons name="checkmark" size={12} color={c.successForeground} />
            <Text style={[styles.dayBadgeText, { color: c.successForeground }]}>OK</Text>
          </View>
        )}
      </View>

      <View style={styles.dayStatusRow}>
        <DayChip
          label={`Morning ${pillSymbol(day.morningCheckIn)}`}
          status={day.morningCheckIn}
          c={c}
        />
        <DayChip
          label={`Evening ${pillSymbol(day.eveningCheckIn)}`}
          status={day.eveningCheckIn}
          c={c}
        />
      </View>

      <View style={styles.dayInfoRow}>
        <View style={styles.dayInfoCell}>
          <Ionicons name={moodIconFor(day.mood)} size={20} color={c.primary} />
          <Text style={[styles.dayInfoText, { color: c.foreground }]}>
            {day.mood ? moodLabelFor(day.mood) : "No mood"}
          </Text>
        </View>
        <View style={styles.dayInfoCell}>
          <Ionicons name="footsteps" size={20} color={c.primary} />
          <Text style={[styles.dayInfoText, { color: c.foreground }]}>
            {day.steps !== null ? `${day.steps.toLocaleString()} steps` : "No steps data"}
          </Text>
        </View>
        {day.memoryDone && (
          <View style={styles.dayInfoCell}>
            <Ionicons name="game-controller" size={20} color={c.primary} />
            <Text style={[styles.dayInfoText, { color: c.foreground }]}>Memory game ✓</Text>
          </View>
        )}
      </View>

      {day.reminderResults.length > 0 && (
        <View style={[styles.remindersBlock, { borderTopColor: c.border }]}>
          <Text style={[styles.remindersHeader, { color: c.mutedForeground }]}>
            Reminders: {doneReminders.length} done · {missedReminders.length} missed
            {pendingReminders.length > 0 ? ` · ${pendingReminders.length} pending` : ""}
          </Text>
          {missedReminders.map((r) => (
            <View key={r.reminderId} style={styles.reminderRowSmall}>
              <Ionicons name="close-circle" size={16} color={c.destructive} />
              <Text style={[styles.reminderTextSmall, { color: c.foreground }]}>
                Missed {r.kind === "medicine" ? "medicine" : "meal"}: {r.label} (
                {formatTime(r.hour, r.minute)})
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

function DayChip({
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
  return (
    <View style={[styles.dayChip, { backgroundColor: bg, borderRadius: 999 }]}>
      <Text style={[styles.dayChipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

function pillSymbol(s: "done" | "missed" | "pending"): string {
  if (s === "done") return "✓";
  if (s === "missed") return "✗";
  return "·";
}

type Tone = "success" | "danger" | "neutral";

function StatusCell({
  icon,
  label,
  value,
  tone,
  c,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  tone: Tone;
  c: ReturnType<typeof useColors>;
}) {
  const iconColor =
    tone === "success" ? c.success : tone === "danger" ? c.destructive : c.primary;
  return (
    <View
      style={[
        styles.statusCell,
        { backgroundColor: c.card, borderColor: c.border, borderRadius: c.radius },
      ]}
    >
      <Ionicons name={icon} size={28} color={iconColor} />
      <Text style={[styles.statusValue, { color: c.foreground }]}>{value}</Text>
      <Text style={[styles.statusLabel, { color: c.mutedForeground }]}>{label}</Text>
    </View>
  );
}

function moodIconFor(v: MoodValue | null): React.ComponentProps<typeof Ionicons>["name"] {
  if (v === "good") return "happy";
  if (v === "tired") return "bed";
  if (v === "notwell") return "sad";
  return "ellipse-outline";
}

function moodLabelFor(v: MoodValue): string {
  if (v === "good") return "Good";
  if (v === "tired") return "Tired";
  return "Not Well";
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 20 },
  cardSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, marginTop: 4 },
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: "Inter_500Medium",
    minHeight: 54,
  },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statusCell: {
    flexBasis: "48%",
    flexGrow: 1,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  statusValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 8,
  },
  statusLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    marginTop: 2,
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dateHeader: { fontFamily: "Inter_700Bold", fontSize: 17 },
  dayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dayBadgeText: { fontFamily: "Inter_700Bold", fontSize: 11, letterSpacing: 0.3 },
  dayStatusRow: { flexDirection: "row", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  dayChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayChipText: { fontFamily: "Inter_700Bold", fontSize: 12 },
  dayInfoRow: { gap: 6 },
  dayInfoCell: { flexDirection: "row", alignItems: "center", gap: 8 },
  dayInfoText: { fontFamily: "Inter_500Medium", fontSize: 14 },
  remindersBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 6,
  },
  remindersHeader: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  reminderRowSmall: { flexDirection: "row", alignItems: "center", gap: 6 },
  reminderTextSmall: { fontFamily: "Inter_500Medium", fontSize: 13, flex: 1 },
});
