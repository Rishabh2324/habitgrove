import { isRunningInExpoGo } from 'expo';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';
import { addDays, dayKey, streakStatus, type StreakStatus } from './dates';
import type { Habit, Reminder } from './store';

// Local notifications aren't available on web, and on Android, Expo Go (SDK 53+) throws as soon as
// expo-notifications is imported. Reminders there need a development build.
const needsDevBuild = Platform.OS === 'android' && isRunningInExpoGo();
export const remindersSupported = Platform.OS !== 'web' && !needsDevBuild;
export const remindersUnavailableReason = needsDevBuild
  ? 'Needs a development build (not available in Expo Go)'
  : 'Available in the iOS and Android app';

// Loaded lazily so unsupported environments never evaluate the module. Every use below is behind `remindersSupported`.
const Notifications: typeof NotificationsModule = remindersSupported ? require('expo-notifications') : (null as never);

const CHANNEL = 'reminders';
// iOS keeps at most 64 pending notifications per app; stay under it across all trees.
const MAX_PENDING = 60;
const MAX_DAYS_AHEAD = 7;

if (remindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export function formatTime({ hour, minute }: Reminder) {
  const h12 = hour % 12 || 12;
  return `${h12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Asks for notification permission if needed. Resolves to whether reminders can be delivered. */
export async function ensurePermission(): Promise<boolean> {
  if (!remindersSupported) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Watering reminders',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Rebuilds every scheduled reminder from the current habits.
 *
 * Reminders are scheduled as one-off notifications for the next few days rather than a repeating
 * daily trigger, so a tree that's already been watered today stays quiet. This runs whenever habits
 * change and whenever the app comes to the foreground, which keeps the window topped up.
 */
export function syncReminders(habits: Habit[]): Promise<void> {
  // Run one sync at a time and skip stale ones, so an older sync can't re-add a reminder
  // that a newer one (e.g. right after watering) just cancelled.
  latest = habits;
  queue = queue.then(() => (latest === habits ? rebuild(habits) : undefined)).catch(() => {});
  return queue;
}

let queue: Promise<void> = Promise.resolve();
let latest: Habit[] | null = null;

async function rebuild(habits: Habit[]) {
  if (!remindersSupported) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const withReminder = habits.filter((h) => h.reminder);
  if (!withReminder.length || !(await Notifications.getPermissionsAsync()).granted) return;

  const days = Math.max(1, Math.min(MAX_DAYS_AHEAD, Math.floor(MAX_PENDING / withReminder.length)));
  const now = new Date();
  const jobs: Promise<string>[] = [];
  for (const habit of withReminder) {
    const { hour, minute } = habit.reminder!;
    const done = new Set(habit.done);
    for (let i = 0; i < days; i++) {
      const day = addDays(now, i);
      const key = dayKey(day);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute);
      if (at <= now || done.has(key)) continue;
      jobs.push(
        Notifications.scheduleNotificationAsync({
          identifier: `${habit.id}:${key}`,
          content: { ...message(habit, i === 0 ? streakStatus(done) : null), data: { habitId: habit.id } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
        }),
      );
    }
  }
  await Promise.all(jobs);
}

/** `status` is today's; later days get the plain nudge since their state isn't known yet. */
function message(habit: Habit, status: StreakStatus | null) {
  const streak = status?.streak ?? 0;
  if (status?.health === 'fallen') {
    return {
      title: `🪵 Your “${habit.name}” tree has fallen`,
      body: `Water it today to stand it back up and save your ${streak}-day streak 💧`,
    };
  }
  if (streak > 0) {
    return {
      title: `🔥 Keep your ${streak}-day streak alive`,
      body: `Your “${habit.name}” tree is waiting for today's water 💧`,
    };
  }
  return { title: `💧 Time to water “${habit.name}”`, body: 'Check in today and watch your tree grow 🌱' };
}

/** Calls `onOpen` with the habit id when the user taps a reminder (including the one that launched the app). */
export function onReminderTapped(onOpen: (habitId: string) => void) {
  if (!remindersSupported) return () => {};
  const handle = (r: NotificationsModule.NotificationResponse | null) => {
    const id = r?.notification.request.content.data?.habitId;
    if (typeof id === 'string') onOpen(id);
  };
  // Handle the tap that launched the app once, then forget it so later launches don't reopen the tree.
  handle(Notifications.getLastNotificationResponse());
  Notifications.clearLastNotificationResponse();
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
