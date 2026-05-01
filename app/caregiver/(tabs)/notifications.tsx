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
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { HeaderBar } from "@/components/HeaderBar";
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
  LogEntry,
  ReminderAck,
} from "@/lib/firestoreData";
import { formatTime } from "@/lib/reminders";

const DAYS = 7;

interface AlertItem {
  id: string;
  date: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  detail: string;
  severity: "high" | "medium" | "low";
}

export default function CaregiverNotifications() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [reminders, setReminders] = useState<FirestoreReminder[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [acks, setAcks] = useState<ReminderAck[]>([]);
  const [stepsList, setStepsList] = useState<DailySteps[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!profile?.linkedResidentUid) {
      setReminders([]);
      setLogs([]);
      setAcks([]);
      setStepsList([]);
      return;
    }
    try {
      const [reminderList, recentLogs, ackList, steps] = await Promise.all([
        getFirestoreReminders(profile.linkedResidentUid),
        getRecentLogs(profile.linkedResidentUid, DAYS),
        getReminderAcksSince(profile.linkedResidentUid, DAYS),
        getDailyStepsSince(profile.linkedResidentUid, DAYS),
      ]);
      setReminders(reminderList);
      setLogs(recentLogs);
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

  const alerts: AlertItem[] = [];
  for (const d of days) {
    if (d.morningCheckIn === "missed") {
      alerts.push({
        id: `${d.dateKey}-morning`,
        date: formatHumanDate(d.dateKey),
        icon: "sunny-outline",
        title: "Missed morning check-in",
        detail: "No check-in before noon.",
        severity: d.isToday ? "high" : "medium",
      });
    }
    if (d.eveningCheckIn === "missed") {
      alerts.push({
        id: `${d.dateKey}-evening`,
        date: formatHumanDate(d.dateKey),
        icon: "moon-outline",
        title: "Missed evening check-in",
        detail: "No check-in by 8 PM.",
        severity: d.isToday ? "high" : "medium",
      });
    }
    for (const r of d.reminderResults.filter((x) => x.status === "missed")) {
      alerts.push({
        id: `${d.dateKey}-${r.reminderId}`,
        date: formatHumanDate(d.dateKey),
        icon: r.kind === "medicine" ? "medkit" : "restaurant",
        title: `Missed ${r.kind === "medicine" ? "medicine" : "meal"}: ${r.label}`,
        detail: `Scheduled at ${formatTime(r.hour, r.minute)}.`,
        severity: r.kind === "medicine" ? "high" : "medium",
      });
    }
  }

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
          greeting="Notifications"
          name={profile?.displayName ?? ""}
          accountHref="/caregiver/account"
        />

        {!profile?.linkedResidentUid ? (
          <Card style={{ marginTop: 24, alignItems: "center", paddingVertical: 36 }}>
            <Ionicons name="link-outline" size={42} color={c.mutedForeground} />
            <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
              Link a resident from the Home tab to see their notifications.
            </Text>
          </Card>
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: c.foreground }]}>
              Alerts (last 7 days)
            </Text>

            {alerts.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: 28 }}>
                <Ionicons name="checkmark-done-circle" size={42} color={c.success} />
                <Text style={[styles.emptyTitle, { color: c.foreground }]}>All clear</Text>
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  No missed check-ins or reminders recently.
                </Text>
              </Card>
            ) : (
              alerts.map((a) => (
                <View
                  key={a.id}
                  style={[
                    styles.alertRow,
                    {
                      backgroundColor: c.card,
                      borderColor: c.border,
                      borderRadius: c.radius,
                      borderLeftWidth: 5,
                      borderLeftColor:
                        a.severity === "high"
                          ? c.destructive
                          : a.severity === "medium"
                            ? c.warning
                            : c.mutedForeground,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.alertIcon,
                      {
                        backgroundColor:
                          a.severity === "high" ? "#fee2e2" : c.muted,
                        borderRadius: 22,
                      },
                    ]}
                  >
                    <Ionicons
                      name={a.icon}
                      size={22}
                      color={a.severity === "high" ? c.destructive : c.foreground}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.alertTitle, { color: c.foreground }]} numberOfLines={2}>
                      {a.title}
                    </Text>
                    <Text style={[styles.alertDetail, { color: c.mutedForeground }]}>
                      {a.date} · {a.detail}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <Text style={[styles.sectionTitle, { color: c.foreground, marginTop: 24 }]}>
              Resident&apos;s reminder schedule
            </Text>

            {reminders.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: 24 }}>
                <Ionicons name="alarm-outline" size={36} color={c.mutedForeground} />
                <Text style={[styles.emptyText, { color: c.mutedForeground }]}>
                  No reminders scheduled yet.
                </Text>
              </Card>
            ) : (
              reminders.map((r) => (
                <View
                  key={r.id}
                  style={[
                    styles.scheduleRow,
                    {
                      backgroundColor: c.card,
                      borderColor: c.border,
                      borderRadius: c.radius,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.alertIcon,
                      { backgroundColor: c.muted, borderRadius: 22 },
                    ]}
                  >
                    <Ionicons
                      name={r.kind === "medicine" ? "medkit" : "restaurant"}
                      size={22}
                      color={c.primary}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.alertTitle, { color: c.foreground }]} numberOfLines={1}>
                      {r.label}
                    </Text>
                    <Text style={[styles.alertDetail, { color: c.mutedForeground }]}>
                      Daily at {formatTime(r.hour, r.minute)} ·{" "}
                      {r.kind === "medicine" ? "Medicine" : "Meal"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 12,
  },
  emptyText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  alertIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitle: { fontFamily: "Inter_700Bold", fontSize: 16 },
  alertDetail: { fontFamily: "Inter_500Medium", fontSize: 13, marginTop: 2 },
});
