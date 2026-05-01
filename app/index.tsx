import { Redirect } from "expo-router";
import { signOut } from "firebase/auth";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { auth } from "@/lib/firebase";

export default function Splash() {
  const { user, profile, loading } = useAuth();
  const c = useColors();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <Image
          source={require("@/assets/images/livingwell-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color={c.primary} style={{ marginTop: 32 }} />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/login" />;

  if (!profile) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <Image
          source={require("@/assets/images/livingwell-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.errorTitle, { color: c.foreground }]}>
          We couldn&apos;t load your profile.
        </Text>
        <Text style={[styles.errorText, { color: c.mutedForeground }]}>
          This usually means Firestore Database isn&apos;t set up yet, or your
          account is missing data. Please sign out and sign up again after
          enabling Firestore in your Firebase Console.
        </Text>
        <Pressable
          onPress={() => signOut(auth)}
          style={({ pressed }) => [
            styles.signOutBtn,
            {
              backgroundColor: c.primary,
              borderRadius: c.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.signOutText, { color: c.primaryForeground }]}>
            Sign Out
          </Text>
        </Pressable>
      </View>
    );
  }

  if (profile.role === "resident") return <Redirect href="/resident" />;
  return <Redirect href="/caregiver" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 240,
    height: 180,
  },
  errorTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    textAlign: "center",
    marginTop: 16,
  },
  errorText: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  signOutBtn: {
    marginTop: 28,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  signOutText: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
  },
});
