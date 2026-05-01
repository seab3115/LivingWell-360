import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { deleteUser, signOut } from "firebase/auth";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { mapAuthError } from "@/lib/authErrors";
import { auth } from "@/lib/firebase";
import { deleteUserProfile } from "@/lib/firestoreData";

export function AccountScreenContent() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState<"signout" | "delete" | null>(null);

  const initials = (profile?.displayName ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    setBusy("signout");
    try {
      await signOut(auth);
      router.replace("/(auth)/login");
    } finally {
      setBusy(null);
    }
  };

  const performDelete = async () => {
    if (!user) return;
    setBusy("delete");
    try {
      // Delete Firestore profile first (auth still valid for the rule check)
      try {
        await deleteUserProfile(user.uid);
      } catch {
        // best effort; continue to auth delete
      }
      await deleteUser(user);
      router.replace("/(auth)/login");
    } catch (e) {
      const isFb =
        typeof e === "object" && e !== null && "code" in e
          ? (e as { code?: string }).code
          : undefined;
      if (isFb === "auth/requires-recent-login") {
        Alert.alert(
          "Please sign in again",
          "For your security, please sign out and sign back in, then try deleting your account again.",
        );
      } else {
        Alert.alert("Could not delete account", mapAuthError(e));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your account and all your saved data. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ],
    );
  };

  const memberSince = profile?.createdAt
    ? profile.createdAt.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 20,
        }}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: c.muted, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Ionicons name="chevron-back" size={26} color={c.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>Account</Text>
        </View>

        <View style={styles.profileBlock}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: c.primary, borderRadius: 60 },
            ]}
          >
            <Text style={[styles.avatarText, { color: c.primaryForeground }]}>
              {initials || "?"}
            </Text>
          </View>
          <Text style={[styles.name, { color: c.foreground }]}>
            {profile?.displayName ?? "—"}
          </Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: c.secondary, borderRadius: 999 },
            ]}
          >
            <Ionicons
              name={profile?.role === "caregiver" ? "medkit" : "person"}
              size={14}
              color={c.secondaryForeground}
            />
            <Text style={[styles.roleText, { color: c.secondaryForeground }]}>
              {profile?.role === "caregiver" ? "Caregiver" : "Resident"}
            </Text>
          </View>
        </View>

        <Card style={{ marginTop: 24 }}>
          <Text style={[styles.cardSection, { color: c.foreground }]}>
            Account details
          </Text>
          <DetailRow label="Email" value={profile?.email ?? user?.email ?? "—"} c={c} />
          <DetailRow label="Display name" value={profile?.displayName ?? "—"} c={c} />
          <DetailRow
            label="Role"
            value={profile?.role === "caregiver" ? "Caregiver" : "Resident"}
            c={c}
          />
          {profile?.role === "caregiver" && (
            <DetailRow
              label="Linked resident"
              value={profile.linkedResidentEmail ?? "Not linked yet"}
              c={c}
            />
          )}
          {memberSince && (
            <DetailRow label="Member since" value={memberSince} c={c} last />
          )}
        </Card>

        <Card style={{ marginTop: 16, alignItems: "center", paddingVertical: 18 }}>
          <Image
            source={require("@/assets/images/livingwell-logo.png")}
            style={{ width: 140, height: 95 }}
            resizeMode="contain"
          />
          <Text style={{ color: c.mutedForeground, fontFamily: "Inter_500Medium", marginTop: 4 }}>
            LivingWell 360 · v1.0
          </Text>
        </Card>

        <View style={{ marginTop: 28, gap: 12 }}>
          <Pressable
            onPress={handleSignOut}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.bigBtn,
              {
                backgroundColor: c.muted,
                borderRadius: c.radius,
                opacity: pressed ? 0.85 : 1,
                borderColor: c.border,
                borderWidth: 1.5,
              },
            ]}
          >
            {busy === "signout" ? (
              <ActivityIndicator color={c.foreground} />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={22} color={c.foreground} />
                <Text style={[styles.bigBtnText, { color: c.foreground }]}>
                  Sign out
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={handleDelete}
            disabled={busy !== null}
            style={({ pressed }) => [
              styles.bigBtn,
              {
                backgroundColor: c.destructive,
                borderRadius: c.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {busy === "delete" ? (
              <ActivityIndicator color={c.destructiveForeground} />
            ) : (
              <>
                <Ionicons
                  name="trash-outline"
                  size={22}
                  color={c.destructiveForeground}
                />
                <Text style={[styles.bigBtnText, { color: c.destructiveForeground }]}>
                  Delete account
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
  c,
  last,
}: {
  label: string;
  value: string;
  c: ReturnType<typeof useColors>;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.detailRow,
        !last && { borderBottomColor: c.border, borderBottomWidth: 1 },
      ]}
    >
      <Text style={[styles.detailLabel, { color: c.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: c.foreground }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24 },
  profileBlock: { alignItems: "center", marginTop: 16 },
  avatar: {
    width: 96,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 36, letterSpacing: 1 },
  name: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    marginTop: 14,
    letterSpacing: -0.5,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  roleText: { fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 0.3 },
  cardSection: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    gap: 12,
  },
  detailLabel: { fontFamily: "Inter_500Medium", fontSize: 15 },
  detailValue: { fontFamily: "Inter_700Bold", fontSize: 15, flexShrink: 1, textAlign: "right" },
  bigBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    minHeight: 56,
  },
  bigBtnText: { fontFamily: "Inter_700Bold", fontSize: 17 },
});
