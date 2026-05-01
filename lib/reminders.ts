import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createFirestoreReminder,
  deleteFirestoreReminder,
  FirestoreReminder,
  getFirestoreReminders,
  MealRelation,
  ReminderKind,
} from "./firestoreData";
import {
  cancelReminder,
  ensureNotificationPermission,
  scheduleDailyReminder,
} from "./notifications";

export type { ReminderKind, MealRelation };
export type Reminder = FirestoreReminder;

const NOTIF_MAP_PREFIX = "lw360.notifMap.";

interface NotifMap {
  [reminderId: string]: string;
}

async function readNotifMap(uid: string): Promise<NotifMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIF_MAP_PREFIX + uid);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as NotifMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeNotifMap(uid: string, map: NotifMap): Promise<void> {
  await AsyncStorage.setItem(NOTIF_MAP_PREFIX + uid, JSON.stringify(map));
}

export async function getReminders(uid: string): Promise<Reminder[]> {
  return getFirestoreReminders(uid);
}

function titleFor(kind: ReminderKind): string {
  return kind === "medicine" ? "Medicine reminder" : "Meal reminder";
}

function bodyFor(kind: ReminderKind, label: string, mealRelation?: MealRelation): string {
  if (kind === "medicine") {
    if (mealRelation === "before") return `Time to take ${label} — before your meal.`;
    if (mealRelation === "after") return `Time to take ${label} — after your meal.`;
    if (mealRelation === "with") return `Time to take ${label} — with your meal.`;
    return `Time to take: ${label}`;
  }
  return `Time to eat: ${label}`;
}

export async function addReminder(
  uid: string,
  input: {
    kind: ReminderKind;
    label: string;
    hour: number;
    minute: number;
    mealRelation?: MealRelation;
  },
): Promise<{ ok: boolean; reason?: string; reminder?: Reminder }> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    return {
      ok: false,
      reason:
        "Notification permission is needed to ring alarms. Please enable notifications for LivingWell in your device settings.",
    };
  }

  let reminderId: string;
  try {
    reminderId = await createFirestoreReminder(uid, {
      kind: input.kind,
      label: input.label,
      hour: input.hour,
      minute: input.minute,
      mealRelation: input.mealRelation,
    });
  } catch (e) {
    return {
      ok: false,
      reason:
        e instanceof Error
          ? `Could not save reminder: ${e.message}`
          : "Could not save reminder.",
    };
  }

  let notificationId: string | null = null;
  try {
    notificationId = await scheduleDailyReminder({
      title: titleFor(input.kind),
      body: bodyFor(input.kind, input.label, input.mealRelation),
      hour: input.hour,
      minute: input.minute,
    });
  } catch {
    // Notification scheduling may fail on web; reminder still saved
  }

  if (notificationId) {
    const map = await readNotifMap(uid);
    map[reminderId] = notificationId;
    await writeNotifMap(uid, map);
  }

  return {
    ok: true,
    reminder: {
      id: reminderId,
      kind: input.kind,
      label: input.label,
      hour: input.hour,
      minute: input.minute,
      mealRelation: input.mealRelation,
      createdAt: new Date(),
    },
  };
}

export async function removeReminder(uid: string, id: string): Promise<void> {
  const map = await readNotifMap(uid);
  const notificationId = map[id];
  if (notificationId) {
    await cancelReminder(notificationId);
    delete map[id];
    await writeNotifMap(uid, map);
  }
  await deleteFirestoreReminder(uid, id);
}

export function formatTime(hour: number, minute: number): string {
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "AM" : "PM";
  const mm = String(minute).padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}
