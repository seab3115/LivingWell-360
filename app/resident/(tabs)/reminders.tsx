import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderBar } from "@/components/HeaderBar";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import {
  addReminder,
  formatTime,
  getReminders,
  MealRelation,
  Reminder,
  ReminderKind,
  removeReminder,
} from "@/lib/reminders";

const MEAL_RELATION_OPTIONS: { value: MealRelation; label: string; icon: string }[] = [
  { value: "before", label: "Before meal", icon: "time-outline" },
  { value: "with", label: "With meal", icon: "restaurant-outline" },
  { value: "after", label: "After meal", icon: "checkmark-done-outline" },
];

export default function ResidentRemindersTab() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [kind, setKind] = useState<ReminderKind>("medicine");
  const [label, setLabel] = useState("");
  const [hourStr, setHourStr] = useState("8");
  const [minuteStr, setMinuteStr] = useState("00");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [mealRelation, setMealRelation] = useState<MealRelation>("after");

  const load = useCallback(async () => {
    if (!user) return;
    const list = await getReminders(user.uid);
    setReminders(list);
  }, [user]);

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

  const handleAdd = async () => {
    if (!user) return;
    const cleanLabel = label.trim();
    if (!cleanLabel) {
      Alert.alert(
        "Missing info",
        kind === "medicine"
          ? "Please enter the medicine name."
          : "Please enter a meal name (e.g. Breakfast, Lunch, Dinner).",
      );
      return;
    }
    const h12 = parseInt(hourStr, 10);
    const m = parseInt(minuteStr, 10);
    if (!Number.isFinite(h12) || h12 < 1 || h12 > 12) {
      Alert.alert("Invalid time", "Hour must be between 1 and 12.");
      return;
    }
    if (!Number.isFinite(m) || m < 0 || m > 59) {
      Alert.alert("Invalid time", "Minute must be between 0 and 59.");
      return;
    }
    let hour24 = h12 % 12;
    if (ampm === "PM") hour24 += 12;

    setSubmitting(true);
    try {
      const result = await addReminder(user.uid, {
        kind,
        label: cleanLabel,
        hour: hour24,
        minute: m,
        mealRelation: kind === "medicine" ? mealRelation : undefined,
      });
      if (!result.ok) {
        Alert.alert("Could not add", result.reason ?? "Unknown error");
      } else {
        setLabel("");
      }
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    Alert.alert("Delete reminder?", "This alarm will stop ringing.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await removeReminder(user.uid, id);
          await load();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: 20,
          paddingHorizontal: 20,
        }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <HeaderBar
          greeting="Manage"
          name={profile?.displayName ?? "Reminders"}
          accountHref="/resident/account"
        />

        <Text style={[styles.sectionTitle, { color: c.foreground, marginTop: 20 }]}>
          Add new reminder
        </Text>

        {/* Kind selector */}
        <View style={styles.kindRow}>
          <KindButton
            active={kind === "medicine"}
            onPress={() => setKind("medicine")}
            icon="medkit"
            label="Medicine"
          />
          <KindButton
            active={kind === "food"}
            onPress={() => setKind("food")}
            icon="restaurant"
            label="Meal"
          />
        </View>

        {/* Medicine name / Meal name */}
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>
          {kind === "medicine" ? "Medicine name" : "Meal name"}
        </Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={
            kind === "medicine"
              ? "e.g. Blood pressure pill, Vitamin D"
              : "e.g. Breakfast, Lunch, Dinner"
          }
          placeholderTextColor={c.mutedForeground}
          style={[
            styles.input,
            {
              borderColor: c.border,
              color: c.foreground,
              borderRadius: c.radius,
              backgroundColor: c.card,
            },
          ]}
        />

        {/* Medicine-specific: before / with / after meal */}
        {kind === "medicine" && (
          <>
            <Text style={[styles.fieldLabel, { color: c.foreground }]}>
              When to take it
            </Text>
            <View style={styles.mealRelRow}>
              {MEAL_RELATION_OPTIONS.map((opt) => {
                const active = mealRelation === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setMealRelation(opt.value)}
                    style={({ pressed }) => [
                      styles.mealRelBtn,
                      {
                        flex: 1,
                        borderColor: active ? c.primary : c.border,
                        backgroundColor: active ? c.secondary : c.card,
                        borderRadius: c.radius,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon as React.ComponentProps<typeof Ionicons>["name"]}
                      size={22}
                      color={active ? c.primary : c.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.mealRelText,
                        { color: active ? c.primary : c.foreground },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.mealRelHint, { color: c.mutedForeground }]}>
              The alarm will ring at the time you set below.
            </Text>
          </>
        )}

        {/* Time picker */}
        <Text style={[styles.fieldLabel, { color: c.foreground }]}>
          {kind === "medicine" ? "Time of intake" : "Meal time"}
        </Text>
        <View style={styles.timeRow}>
          <TextInput
            value={hourStr}
            onChangeText={setHourStr}
            keyboardType="number-pad"
            maxLength={2}
            style={[
              styles.timeInput,
              {
                borderColor: c.border,
                color: c.foreground,
                borderRadius: c.radius,
                backgroundColor: c.card,
              },
            ]}
          />
          <Text style={[styles.timeColon, { color: c.foreground }]}>:</Text>
          <TextInput
            value={minuteStr}
            onChangeText={setMinuteStr}
            keyboardType="number-pad"
            maxLength={2}
            style={[
              styles.timeInput,
              {
                borderColor: c.border,
                color: c.foreground,
                borderRadius: c.radius,
                backgroundColor: c.card,
              },
            ]}
          />
          <View style={styles.ampmGroup}>
            {(["AM", "PM"] as const).map((period) => (
              <Pressable
                key={period}
                onPress={() => setAmpm(period)}
                style={[
                  styles.ampmBtn,
                  {
                    borderColor: c.border,
                    borderRadius: c.radius,
                    backgroundColor: ampm === period ? c.primary : c.card,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.ampmText,
                    { color: ampm === period ? c.primaryForeground : c.foreground },
                  ]}
                >
                  {period}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {Platform.OS === "web" && (
          <Text style={[styles.helperText, { color: c.mutedForeground }]}>
            Tip: Reminders ring with sound and vibration on your phone. The web
            preview cannot ring native alarms.
          </Text>
        )}

        <PrimaryButton
          label="Save reminder"
          onPress={handleAdd}
          loading={submitting}
          style={{ marginTop: 24 }}
        />

        {/* Saved reminders list */}
        <Text style={[styles.sectionTitle, { color: c.foreground, marginTop: 32 }]}>
          Your reminders ({reminders.length})
        </Text>

        {reminders.length === 0 ? (
          <Text style={[styles.helperText, { color: c.mutedForeground }]}>
            You don&apos;t have any reminders yet. Add one above.
          </Text>
        ) : (
          <View style={{ marginTop: 8 }}>
            {reminders.map((r) => (
              <View
                key={r.id}
                style={[
                  styles.itemRow,
                  {
                    backgroundColor: c.card,
                    borderColor: c.border,
                    borderRadius: c.radius,
                  },
                ]}
              >
                <View
                  style={[
                    styles.itemIcon,
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
                  <Text style={[styles.itemTitle, { color: c.foreground }]} numberOfLines={1}>
                    {r.label}
                  </Text>
                  <Text style={[styles.itemTime, { color: c.mutedForeground }]}>
                    Daily at {formatTime(r.hour, r.minute)}
                    {r.kind === "medicine" && r.mealRelation
                      ? ` · ${mealRelationLabel(r.mealRelation)}`
                      : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => handleDelete(r.id)}
                  style={({ pressed }) => [
                    styles.deleteBtn,
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                  accessibilityLabel="Delete reminder"
                >
                  <Ionicons name="trash-outline" size={22} color={c.destructive} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function mealRelationLabel(r: MealRelation): string {
  if (r === "before") return "Before meal";
  if (r === "with") return "With meal";
  return "After meal";
}

function KindButton({
  active,
  onPress,
  icon,
  label,
}: {
  active: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.kindBtn,
        {
          backgroundColor: active ? c.primary : c.card,
          borderColor: active ? c.primary : c.border,
          borderRadius: c.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={26} color={active ? c.primaryForeground : c.primary} />
      <Text
        style={[
          styles.kindLabel,
          { color: active ? c.primaryForeground : c.foreground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 20, marginBottom: 12 },
  kindRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  kindBtn: {
    flex: 1,
    borderWidth: 2,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  kindLabel: { fontFamily: "Inter_700Bold", fontSize: 17 },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    minHeight: 56,
  },
  mealRelRow: { flexDirection: "row", gap: 8 },
  mealRelBtn: {
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  mealRelText: { fontFamily: "Inter_700Bold", fontSize: 13, textAlign: "center" },
  mealRelHint: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 18,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  timeInput: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    width: 70,
    textAlign: "center",
    minHeight: 56,
  },
  timeColon: { fontFamily: "Inter_700Bold", fontSize: 24 },
  ampmGroup: { flexDirection: "row", gap: 8, marginLeft: 8 },
  ampmBtn: {
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
    justifyContent: "center",
  },
  ampmText: { fontFamily: "Inter_700Bold", fontSize: 16 },
  helperText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  itemIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontFamily: "Inter_700Bold", fontSize: 17 },
  itemTime: { fontFamily: "Inter_500Medium", fontSize: 14, marginTop: 2 },
  deleteBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
