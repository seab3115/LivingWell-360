import { Ionicons } from "@expo/vector-icons";
import { Link, router } from "expo-router";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  updateProfile,
} from "firebase/auth";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { mapAuthError } from "@/lib/authErrors";
import { auth } from "@/lib/firebase";
import { createUserProfile, UserRole } from "@/lib/firestoreData";

export default function RegisterScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("resident");
  const [residentEmail, setResidentEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!displayName.trim() || !email.trim() || !password) {
      Alert.alert("Missing info", "Please fill in your name, email, and password.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Password too short", "Password must be at least 6 characters.");
      return;
    }
    if (role === "caregiver" && !residentEmail.trim()) {
      Alert.alert("Missing info", "Please enter the resident's email to link.");
      return;
    }

    setSubmitting(true);
    let createdUser: import("firebase/auth").User | null = null;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      createdUser = cred.user;
      await updateProfile(cred.user, { displayName: displayName.trim() });

      try {
        await createUserProfile({
          uid: cred.user.uid,
          email: email.trim().toLowerCase(),
          displayName: displayName.trim(),
          role,
          linkedResidentEmail:
            role === "caregiver" ? residentEmail.trim().toLowerCase() : undefined,
        });
      } catch (profileErr) {
        // Roll back the auth account so the user can retry from a clean state
        if (createdUser) {
          try {
            await deleteUser(createdUser);
          } catch {
            // best effort
          }
        }
        throw profileErr;
      }

      await refreshProfile();
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("Sign up failed", mapAuthError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 16);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 24);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: topPad,
          paddingBottom: bottomPad,
          paddingHorizontal: 24,
          flexGrow: 1,
        }}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Image
            source={require("@/assets/images/livingwell-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: c.foreground }]}>Create account</Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            Choose your role to begin
          </Text>
        </View>

        <View style={styles.roleRow}>
          <RoleCard
            active={role === "resident"}
            onPress={() => setRole("resident")}
            icon="person"
            label="Resident"
            description="I'll check in daily"
          />
          <RoleCard
            active={role === "caregiver"}
            onPress={() => setRole("caregiver")}
            icon="medkit"
            label="Caregiver"
            description="I look after someone"
          />
        </View>

        <Text style={[styles.label, { color: c.foreground }]}>Full name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Jane Doe"
          placeholderTextColor={c.mutedForeground}
          style={[
            styles.input,
            { borderColor: c.border, color: c.foreground, borderRadius: c.radius, backgroundColor: c.card },
          ]}
        />

        <Text style={[styles.label, { color: c.foreground }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
          placeholderTextColor={c.mutedForeground}
          style={[
            styles.input,
            { borderColor: c.border, color: c.foreground, borderRadius: c.radius, backgroundColor: c.card },
          ]}
        />

        <Text style={[styles.label, { color: c.foreground }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 6 characters"
          placeholderTextColor={c.mutedForeground}
          style={[
            styles.input,
            { borderColor: c.border, color: c.foreground, borderRadius: c.radius, backgroundColor: c.card },
          ]}
        />

        {role === "caregiver" && (
          <>
            <Text style={[styles.label, { color: c.foreground }]}>Resident&apos;s email</Text>
            <TextInput
              value={residentEmail}
              onChangeText={setResidentEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="resident@example.com"
              placeholderTextColor={c.mutedForeground}
              style={[
                styles.input,
                { borderColor: c.border, color: c.foreground, borderRadius: c.radius, backgroundColor: c.card },
              ]}
            />
            <Text style={{ color: c.mutedForeground, fontSize: 14, marginTop: 6, fontFamily: "Inter_400Regular" }}>
              We&apos;ll link you to view their daily logs.
            </Text>
          </>
        )}

        <PrimaryButton
          label="Create Account"
          onPress={handleRegister}
          loading={submitting}
          style={{ marginTop: 28 }}
        />

        <View style={styles.footer}>
          <Text style={{ color: c.mutedForeground, fontSize: 16, fontFamily: "Inter_400Regular" }}>
            Already have an account?{" "}
          </Text>
          <Link href="/(auth)/login" style={{ color: c.primary, fontSize: 16, fontFamily: "Inter_700Bold" }}>
            Sign in
          </Link>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

function RoleCard({
  active,
  onPress,
  icon,
  label,
  description,
}: {
  active: boolean;
  onPress: () => void;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description: string;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleCard,
        {
          backgroundColor: active ? c.primary : c.card,
          borderColor: active ? c.primary : c.border,
          borderRadius: c.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Ionicons
        name={icon}
        size={32}
        color={active ? c.primaryForeground : c.primary}
      />
      <Text
        style={[
          styles.roleLabel,
          { color: active ? c.primaryForeground : c.foreground },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.roleDesc,
          { color: active ? c.primaryForeground : c.mutedForeground },
        ]}
      >
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 16 },
  logo: { width: 160, height: 110 },
  title: { fontFamily: "Inter_700Bold", fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 16, marginTop: 4 },
  roleRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  roleCard: {
    flex: 1,
    borderWidth: 2,
    padding: 18,
    alignItems: "center",
    minHeight: 120,
    justifyContent: "center",
  },
  roleLabel: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 8,
  },
  roleDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
  },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 17, marginBottom: 8, marginTop: 14 },
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: "Inter_500Medium",
    minHeight: 56,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    flexWrap: "wrap",
  },
});
