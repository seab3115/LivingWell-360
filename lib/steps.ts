import { Pedometer } from "expo-sensors";
import { Platform } from "react-native";

export interface StepResult {
  available: boolean;
  steps: number | null;
  message?: string | null;
}

/**
 * iOS: reads historical step count since midnight via getStepCountAsync.
 * Android: `getStepCountAsync` with a date range is NOT supported.
 *          Returns `available: false` with a null message so the caller
 *          can switch to the subscription-based approach via `subscribeToSteps`.
 * Web:   Always unavailable.
 */
export async function getTodaySteps(): Promise<StepResult> {
  if (Platform.OS === "web") {
    return {
      available: false,
      steps: null,
      message: "Step counting works on your phone.",
    };
  }

  if (Platform.OS === "android") {
    // getStepCountAsync with a date range is not supported on Android.
    // Callers should fall back to subscribeToSteps() instead.
    return { available: false, steps: null, message: null };
  }

  // iOS path
  try {
    const isAvailable = await Pedometer.isAvailableAsync();
    if (!isAvailable) {
      return {
        available: false,
        steps: null,
        message: "Step counting isn't supported on this device.",
      };
    }

    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) {
      return {
        available: false,
        steps: null,
        message: "Motion permission is required to count steps.",
      };
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    const result = await Pedometer.getStepCountAsync(start, end);
    return { available: true, steps: result.steps };
  } catch (e) {
    return {
      available: false,
      steps: null,
      message: e instanceof Error ? e.message : "Could not read step count.",
    };
  }
}

/**
 * Subscribes to live step counting. Works on both iOS and Android.
 * On Android this is the only supported way to count steps.
 * Returns a cleanup function — call it when the component unmounts.
 * `onUpdate(steps)` is called every time the count increments.
 */
export function subscribeToSteps(onUpdate: (steps: number) => void): () => void {
  if (Platform.OS === "web") return () => undefined;

  let total = 0;
  let started = false;
  let sub: ReturnType<typeof Pedometer.watchStepCount> | null = null;

  Pedometer.isAvailableAsync().then((available) => {
    if (!available || started) return;
    started = true;
    sub = Pedometer.watchStepCount((result) => {
      // watchStepCount returns cumulative steps since subscription start
      total = result.steps;
      onUpdate(total);
    });
  }).catch(() => undefined);

  return () => {
    sub?.remove();
  };
}
