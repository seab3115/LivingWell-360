import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  getAuth,
  initializeAuth,
} from "firebase/auth";
import * as firebaseAuth from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

function createAuth(): Auth {
  if (Platform.OS === "web") {
    return getAuth(app);
  }
  // getReactNativePersistence is exported from firebase/auth's React Native bundle
  // at runtime, but isn't typed in the default declarations.
  const getReactNativePersistence = (
    firebaseAuth as unknown as {
      getReactNativePersistence?: (storage: unknown) => unknown;
    }
  ).getReactNativePersistence;

  if (typeof getReactNativePersistence !== "function") {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      persistence: getReactNativePersistence(AsyncStorage) as any,
    });
  } catch {
    // initializeAuth throws if called twice (HMR); fall back to getAuth.
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
