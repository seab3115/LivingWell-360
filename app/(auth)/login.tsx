import { Link, router } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useColors } from "@/hooks/useColors";
import { mapAuthError } from "@/lib/authErrors";
import { auth } from "@/lib/firebase";

export default function LoginScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("Missing info", "Please enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace("/");
    } catch (e: unknown) {
      Alert.alert("Sign in failed", mapAuthError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 24);
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
          <Text style={[styles.title, { color: c.foreground }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
            Sign in to continue
          </Text>
        </View>

        <View style={styles.form}>
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

          <Text style={[styles.label, { color: c.foreground, marginTop: 16 }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="Your password"
            placeholderTextColor={c.mutedForeground}
            style={[
              styles.input,
              { borderColor: c.border, color: c.foreground, borderRadius: c.radius, backgroundColor: c.card },
            ]}
          />

          <PrimaryButton
            label="Sign In"
            onPress={handleLogin}
            loading={submitting}
            style={{ marginTop: 28 }}
          />

          <View style={styles.footer}>
            <Text style={{ color: c.mutedForeground, fontSize: 16, fontFamily: "Inter_400Regular" }}>
              Don&apos;t have an account?{" "}
            </Text>
            <Link href="/(auth)/register" style={{ color: c.primary, fontSize: 16, fontFamily: "Inter_700Bold" }}>
              Create one
            </Link>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", marginBottom: 24 },
  logo: { width: 200, height: 140 },
  title: { fontFamily: "Inter_700Bold", fontSize: 30, letterSpacing: -0.5, marginTop: 4 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 17, marginTop: 6 },
  form: { width: "100%" },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 18, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    fontFamily: "Inter_500Medium",
    minHeight: 60,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
    flexWrap: "wrap",
  },
});
