import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { isOpen, type FlowItem } from "@workspace/flow-core";

if (Platform.OS !== "web")
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
export async function enableReminders() {
  if (Platform.OS === "web")
    throw new Error("Device reminders are available in the Android app.");
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "DailyFlow reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: null,
  });
  const result = await Notifications.requestPermissionsAsync();
  return result.granted;
}
// Only schedule future reminders; the Today view retains overdue work.
export async function refreshReminders(
  items: FlowItem[],
  enabled: boolean,
  quiet: boolean,
) {
  if (Platform.OS === "web") return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!enabled || !(await Notifications.getPermissionsAsync()).granted) return;
  const next = items
    .filter(
      (i) =>
        isOpen(i) &&
        i.status !== "inbox" &&
        i.kind !== "note" &&
        (i.dueAt || i.snoozedUntil),
    )
    .map((item) => {
      const date = new Date(item.snoozedUntil ?? item.dueAt!);
      if (quiet && (date.getHours() < 8 || date.getHours() >= 21)) {
        if (date.getHours() >= 21) date.setDate(date.getDate() + 1);
        date.setHours(8, 0, 0, 0);
      }
      return { item, date };
    })
    .filter(({ date }) => +date > Date.now())
    .sort((a, b) => +a.date - +b.date)
    .slice(0, 50);
  for (const { item, date } of next)
    await Notifications.scheduleNotificationAsync({
      identifier: item.id,
      content: {
        title:
          item.status === "waiting"
            ? "Time to follow up"
            : "DailyFlow reminder",
        body: item.title,
        data: { itemId: item.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        channelId: "reminders",
      },
    });
}
