import { dateKeyFor, FirestoreReminder, LogEntry, MoodValue, ReminderAck } from "./firestoreData";

export interface DayStatus {
  dateKey: string;
  isToday: boolean;
  morningCheckIn: "done" | "missed" | "pending";
  eveningCheckIn: "done" | "missed" | "pending";
  mood: MoodValue | null;
  memoryDone: boolean;
  steps: number | null;
  reminderResults: ReminderResult[];
}

export interface ReminderResult {
  reminderId: string;
  kind: FirestoreReminder["kind"];
  label: string;
  hour: number;
  minute: number;
  status: "done" | "missed" | "pending";
}

const MORNING_DEADLINE_HOUR = 12; // morning expected by 12pm
const EVENING_DEADLINE_HOUR = 20; // evening expected by 8pm

export function buildDayStatus(opts: {
  dateKey: string;
  logs: LogEntry[];
  reminders: FirestoreReminder[];
  acks: ReminderAck[];
  steps: number | null;
  now: Date;
}): DayStatus {
  const { dateKey, logs, reminders, acks, steps, now } = opts;
  const todayKey = dateKeyFor(now);
  const isToday = dateKey === todayKey;
  const isPast = dateKey < todayKey;

  const dayLogs = logs.filter((l) => l.dateKey === dateKey);
  const checkins = dayLogs.filter((l) => l.type === "checkin");
  const morning = checkins.find((l) => l.timestamp.getHours() < 12);
  const evening = checkins.find((l) => l.timestamp.getHours() >= 12);

  const moodLog = dayLogs.find((l) => l.type === "mood");
  const memoryLog = dayLogs.find((l) => l.type === "memory");

  let morningStatus: DayStatus["morningCheckIn"];
  if (morning) morningStatus = "done";
  else if (isPast || (isToday && now.getHours() >= MORNING_DEADLINE_HOUR))
    morningStatus = "missed";
  else morningStatus = "pending";

  let eveningStatus: DayStatus["eveningCheckIn"];
  if (evening) eveningStatus = "done";
  else if (isPast || (isToday && now.getHours() >= EVENING_DEADLINE_HOUR))
    eveningStatus = "missed";
  else eveningStatus = "pending";

  const dayAcks = acks.filter((a) => a.dateKey === dateKey);
  const reminderResults: ReminderResult[] = reminders.map((r) => {
    const acked = dayAcks.some((a) => a.reminderId === r.id);
    let status: ReminderResult["status"] = "pending";
    if (acked) status = "done";
    else {
      const reminderTimeMin = r.hour * 60 + r.minute;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (isPast) status = "missed";
      else if (isToday && nowMin > reminderTimeMin + 30) status = "missed";
      else status = "pending";
    }
    return {
      reminderId: r.id,
      kind: r.kind,
      label: r.label,
      hour: r.hour,
      minute: r.minute,
      status,
    };
  });
  reminderResults.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));

  return {
    dateKey,
    isToday,
    morningCheckIn: morningStatus,
    eveningCheckIn: eveningStatus,
    mood: moodLog ? (moodLog.value as MoodValue) : null,
    memoryDone: !!memoryLog,
    steps,
    reminderResults,
  };
}

export function buildLastNDays(opts: {
  days: number;
  logs: LogEntry[];
  reminders: FirestoreReminder[];
  acks: ReminderAck[];
  stepsByDate: Map<string, number>;
  now?: Date;
}): DayStatus[] {
  const now = opts.now ?? new Date();
  const result: DayStatus[] = [];
  for (let i = 0; i < opts.days; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const key = dateKeyFor(d);
    result.push(
      buildDayStatus({
        dateKey: key,
        logs: opts.logs,
        reminders: opts.reminders,
        acks: opts.acks,
        steps: opts.stepsByDate.get(key) ?? null,
        now,
      }),
    );
  }
  return result;
}

export function formatHumanDate(dateKey: string, now: Date = new Date()): string {
  const todayKey = dateKeyFor(now);
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (dateKey === todayKey) return "Today";
  if (dateKey === dateKeyFor(y)) return "Yesterday";
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}
