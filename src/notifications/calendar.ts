import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { settings } from '@/db/schema';
import { fromIso, type IsoDate } from '@/lib/date';

/**
 * Optional mirror of scheduled workouts into the device calendar, so the gym
 * shows up next to everything else competing for that hour.
 *
 * Writes to a calendar this app owns, never to a personal one — so removing it
 * cannot touch anything the user put there.
 */

const CALENDAR_ID_KEY = 'workout_calendar_id';
const CALENDAR_TITLE = 'التمارين';

function storedCalendarId(): string | null {
  return db.select().from(settings).where(eq(settings.key, CALENDAR_ID_KEY)).get()?.value ?? null;
}

function storeCalendarId(id: string): void {
  db.insert(settings)
    .values({ key: CALENDAR_ID_KEY, value: id })
    .onConflictDoUpdate({ target: settings.key, set: { value: id } })
    .run();
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Calendar.getCalendarPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Calendar.requestCalendarPermissionsAsync()).granted;
}

async function defaultSource(): Promise<Calendar.Source | { isLocalAccount: true; name: string; type: string }> {
  if (Platform.OS === 'ios') {
    const source = await Calendar.getDefaultCalendarAsync();
    return source.source;
  }
  return { isLocalAccount: true, name: CALENDAR_TITLE, type: Calendar.SourceType.LOCAL };
}

/** Find or create the app's own calendar. */
export async function ensureCalendar(): Promise<string | null> {
  if (!(await ensurePermission())) return null;

  const existingId = storedCalendarId();
  if (existingId) {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    // The user may have deleted it from the system calendar app.
    if (calendars.some((calendar) => calendar.id === existingId)) return existingId;
  }

  const source = await defaultSource();
  const id = await Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: '#4C8DFF',
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: 'id' in source ? source.id : undefined,
    source: source as Calendar.Source,
    name: CALENDAR_TITLE,
    ownerAccount: 'personal',
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  storeCalendarId(id);
  return id;
}

/**
 * Put one workout on the calendar. Returns the event id, or null when calendar
 * access was refused — never throws, because a calendar refusal must not stop
 * the workout being logged.
 */
export async function addWorkoutEvent(
  date: IsoDate,
  title: string,
  hour: number,
  durationMinutes = 75,
): Promise<string | null> {
  try {
    const calendarId = await ensureCalendar();
    if (!calendarId) return null;

    const startDate = fromIso(date);
    startDate.setHours(hour, 0, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

    return await Calendar.createEventAsync(calendarId, { title, startDate, endDate });
  } catch {
    return null;
  }
}

export async function removeEvent(eventId: string): Promise<void> {
  try {
    await Calendar.deleteEventAsync(eventId);
  } catch {
    // Already gone — nothing to undo.
  }
}
