import * as Notifications from 'expo-notifications';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { settings } from '@/db/schema';
import { MEAL_SLOTS, SLOT_DEFAULT_HOUR, SLOT_LABEL_AR, type MealSlot } from '@/lib/slots';

/**
 * Local notifications only — nothing leaves the device, and nothing here needs
 * a network or a push token.
 *
 * Three kinds of reminder:
 *   - meal times, one per slot
 *   - the workout, at a chosen hour
 *   - Thursday evening: plan next week and do the weekly review
 */

export type ReminderSettings = {
  enabled: boolean;
  /** Slot key to hour of day (0–23). A slot missing from here is not reminded. */
  mealHours: Partial<Record<MealSlot, number>>;
  workoutHour: number | null;
  /** Thursday evening review; null disables it. */
  reviewHour: number | null;
};

export const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  mealHours: Object.fromEntries(MEAL_SLOTS.map((slot) => [slot, SLOT_DEFAULT_HOUR[slot]])),
  workoutHour: 17,
  reviewHour: 20,
};

const SETTINGS_KEY = 'reminders';

/** Thursday. `expo-notifications` weekdays are 1-based from Sunday. */
const THURSDAY = 5;

export function loadReminders(): ReminderSettings {
  const row = db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).get();
  if (!row) return DEFAULT_REMINDERS;
  try {
    return { ...DEFAULT_REMINDERS, ...(JSON.parse(row.value) as Partial<ReminderSettings>) };
  } catch {
    // A corrupt blob should not disable reminders silently forever.
    return DEFAULT_REMINDERS;
  }
}

export function storeReminders(value: ReminderSettings): void {
  const payload = JSON.stringify(value);
  db.insert(settings)
    .values({ key: SETTINGS_KEY, value: payload })
    .onConflictDoUpdate({ target: settings.key, set: { value: payload } })
    .run();
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Rewrite every scheduled reminder from the given settings.
 *
 * Cancels everything first rather than diffing: there are at most seven
 * notifications, and a stale reminder firing at the old time is far worse than
 * the cost of rescheduling.
 */
export async function applyReminders(value: ReminderSettings): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  storeReminders(value);

  if (!value.enabled) return true;

  const granted = await ensurePermission();
  if (!granted) return false;

  const daily = async (hour: number, title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  };

  for (const slot of MEAL_SLOTS) {
    const hour = value.mealHours[slot];
    if (hour == null) continue;
    await daily(hour, SLOT_LABEL_AR[slot], 'أكّد وجبتك بضغطة واحدة.');
  }

  if (value.workoutHour != null) {
    await daily(value.workoutHour, 'التمرين', 'تمرين اليوم بانتظارك.');
  }

  if (value.reviewHour != null) {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'مراجعة الأسبوع', body: 'راجع أسبوعك وخطّط للقادم.' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: THURSDAY,
        hour: value.reviewHour,
        minute: 0,
      },
    });
  }

  return true;
}

/** Foreground behaviour: a reminder that arrives while the app is open still shows. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}
