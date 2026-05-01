import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";

import { db } from "./firebase";

export type UserRole = "resident" | "caregiver";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  linkedResidentEmail?: string;
  linkedResidentUid?: string;
  createdAt?: Date;
}

export type MoodValue = "good" | "tired" | "notwell";

export interface LogEntry {
  id: string;
  type: "checkin" | "mood" | "memory";
  value: string;
  dateKey: string;
  timestamp: Date;
}

export type ReminderKind = "medicine" | "food";
export type MealRelation = "before" | "with" | "after";

export interface FirestoreReminder {
  id: string;
  kind: ReminderKind;
  label: string;
  hour: number;
  minute: number;
  mealRelation?: MealRelation; // only for medicine
  createdAt: Date | null;
}

export interface ReminderAck {
  id: string;
  reminderId: string;
  dateKey: string;
  completedAt: Date;
}

export interface DailySteps {
  dateKey: string;
  steps: number;
  updatedAt: Date | null;
}

export function dateKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function createUserProfile(
  profile: Omit<UserProfile, "linkedResidentUid" | "createdAt">,
): Promise<void> {
  let linkedResidentUid: string | undefined;
  if (profile.role === "caregiver" && profile.linkedResidentEmail) {
    linkedResidentUid =
      (await findResidentUidByEmail(profile.linkedResidentEmail)) ?? undefined;
  }

  const data: Record<string, unknown> = {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    role: profile.role,
    createdAt: serverTimestamp(),
  };
  if (profile.linkedResidentEmail)
    data.linkedResidentEmail = profile.linkedResidentEmail.toLowerCase();
  if (linkedResidentUid) data.linkedResidentUid = linkedResidentUid;

  await setDoc(doc(db, "users", profile.uid), data);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const d = snap.data();
  const ts = d.createdAt as Timestamp | null;
  return {
    uid: d.uid,
    email: d.email,
    displayName: d.displayName,
    role: d.role,
    linkedResidentEmail: d.linkedResidentEmail,
    linkedResidentUid: d.linkedResidentUid,
    createdAt: ts ? ts.toDate() : undefined,
  };
}

export async function findResidentUidByEmail(email: string): Promise<string | null> {
  const lower = email.trim().toLowerCase();
  const q = query(
    collection(db, "users"),
    where("email", "==", lower),
    where("role", "==", "resident"),
    limit(1),
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data().uid as string;
}

export async function linkCaregiverToResident(
  caregiverUid: string,
  residentEmail: string,
): Promise<string | null> {
  const lower = residentEmail.trim().toLowerCase();
  const uid = await findResidentUidByEmail(lower);
  await setDoc(
    doc(db, "users", caregiverUid),
    { linkedResidentEmail: lower, linkedResidentUid: uid ?? null },
    { merge: true },
  );
  return uid;
}

export async function deleteUserProfile(uid: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid));
}

export async function addLogEntry(
  uid: string,
  type: LogEntry["type"],
  value: string,
): Promise<void> {
  const now = new Date();
  await addDoc(collection(db, "users", uid, "logs"), {
    type,
    value,
    dateKey: dateKeyFor(now),
    timestamp: serverTimestamp(),
  });
}

function logFromSnap(docSnap: { id: string; data: () => Record<string, unknown> }): LogEntry {
  const d = docSnap.data();
  const ts = d.timestamp as Timestamp | null;
  return {
    id: docSnap.id,
    type: d.type as LogEntry["type"],
    value: d.value as string,
    dateKey: d.dateKey as string,
    timestamp: ts ? ts.toDate() : new Date(),
  };
}

export async function getTodayLogs(uid: string): Promise<LogEntry[]> {
  const today = dateKeyFor(new Date());
  const q = query(
    collection(db, "users", uid, "logs"),
    where("dateKey", "==", today),
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map(logFromSnap);
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return entries;
}

export async function getRecentLogs(uid: string, days = 7): Promise<LogEntry[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceKey = dateKeyFor(since);
  const q = query(
    collection(db, "users", uid, "logs"),
    where("dateKey", ">=", sinceKey),
    orderBy("dateKey", "desc"),
  );
  const snap = await getDocs(q);
  const entries = snap.docs.map(logFromSnap);
  entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return entries;
}

// ----- Reminders (Firestore) -----

export async function createFirestoreReminder(
  uid: string,
  data: {
    kind: ReminderKind;
    label: string;
    hour: number;
    minute: number;
    mealRelation?: MealRelation;
  },
): Promise<string> {
  const payload: Record<string, unknown> = {
    kind: data.kind,
    label: data.label,
    hour: data.hour,
    minute: data.minute,
    createdAt: serverTimestamp(),
  };
  if (data.mealRelation) payload.mealRelation = data.mealRelation;
  const ref = await addDoc(collection(db, "users", uid, "reminders"), payload);
  return ref.id;
}

export async function deleteFirestoreReminder(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "users", uid, "reminders", id));
}

export async function getFirestoreReminders(uid: string): Promise<FirestoreReminder[]> {
  const snap = await getDocs(collection(db, "users", uid, "reminders"));
  const list: FirestoreReminder[] = snap.docs.map((s) => {
    const d = s.data();
    const ts = d.createdAt as Timestamp | null;
    return {
      id: s.id,
      kind: d.kind as ReminderKind,
      label: d.label as string,
      hour: d.hour as number,
      minute: d.minute as number,
      mealRelation: (d.mealRelation as MealRelation | undefined) ?? undefined,
      createdAt: ts ? ts.toDate() : null,
    };
  });
  list.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  return list;
}

export async function ackReminder(
  uid: string,
  reminderId: string,
): Promise<void> {
  const dateKey = dateKeyFor(new Date());
  await addDoc(collection(db, "users", uid, "reminderLogs"), {
    reminderId,
    dateKey,
    completedAt: serverTimestamp(),
  });
}

export async function getReminderAcksSince(
  uid: string,
  days: number,
): Promise<ReminderAck[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceKey = dateKeyFor(since);
  const q = query(
    collection(db, "users", uid, "reminderLogs"),
    where("dateKey", ">=", sinceKey),
  );
  const snap = await getDocs(q);
  return snap.docs.map((s) => {
    const d = s.data();
    const ts = d.completedAt as Timestamp | null;
    return {
      id: s.id,
      reminderId: d.reminderId as string,
      dateKey: d.dateKey as string,
      completedAt: ts ? ts.toDate() : new Date(),
    };
  });
}

// ----- Daily steps -----

export async function setDailySteps(uid: string, steps: number): Promise<void> {
  const dateKey = dateKeyFor(new Date());
  await setDoc(
    doc(db, "users", uid, "dailySteps", dateKey),
    { dateKey, steps, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function getDailyStepsSince(
  uid: string,
  days: number,
): Promise<DailySteps[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const sinceKey = dateKeyFor(since);
  const q = query(
    collection(db, "users", uid, "dailySteps"),
    where("dateKey", ">=", sinceKey),
  );
  const snap = await getDocs(q);
  return snap.docs.map((s) => {
    const d = s.data();
    const ts = d.updatedAt as Timestamp | null;
    return {
      dateKey: d.dateKey as string,
      steps: (d.steps as number) ?? 0,
      updatedAt: ts ? ts.toDate() : null,
    };
  });
}
