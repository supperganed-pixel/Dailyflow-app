import { canDependOn, localDateKey, type FlowItem } from "@workspace/flow-core";

export function addToDailyFocus(item: FlowItem, items: FlowItem[], now = new Date()) {
  if (item.kind !== "task" || item.deletedAt || item.status !== "active")
    throw new Error("Choose an active task for Focus.");
  const date = localDateKey(now);
  if (item.focusDate === date) return { focusDate: date, focusOrder: item.focusOrder ?? 1 };
  const focus = items.filter((other) => other.id !== item.id && !other.deletedAt && other.focusDate === date);
  if (focus.length >= 3) throw new Error("You can choose up to 3 Focus tasks for today.");
  const order = [1, 2, 3].find((slot) => !focus.some((other) => other.focusOrder === slot));
  if (!order) throw new Error("All Focus positions are taken.");
  return { focusDate: date, focusOrder: order };
}

export function removeFromDailyFocus() {
  return { focusDate: null, focusOrder: null };
}

export function completeTask(item: FlowItem, now = new Date()) {
  const reopen = item.status === "completed" || item.status === "archived";
  return {
    status: (reopen ? "active" : "completed") as FlowItem["status"],
    completedAt: reopen ? null : now.toISOString(),
    archivedAt: reopen ? null : item.archivedAt,
    snoozedUntil: null,
  };
}

export function validateDependencies(item: FlowItem, ids: string[], items: FlowItem[]) {
  if (ids.length > 25 || new Set(ids).size !== ids.length)
    throw new Error("Choose up to 25 different dependencies.");
  if (ids.some((id) => !canDependOn(item.id, id, items)))
    throw new Error("A dependency must be your own task and cannot make a cycle.");
  return ids;
}

type WaitingAction = "followed_up" | "responded" | "resolved" | "cancelled" | "snoozed";
export function waitingChange(item: FlowItem, action: WaitingAction, now = new Date(), next?: string | null) {
  if (item.status !== "waiting") throw new Error("This item is not waiting for a response.");
  if (["resolved", "cancelled"].includes(item.waitingState ?? "waiting"))
    throw new Error("This waiting item is already closed.");
  const history = [...(item.waitingHistory ?? []), { at: now.toISOString(), action }].slice(-200);
  return {
    waitingHistory: history,
    waitingState: (action === "responded" ? "responded" : action === "resolved" ? "resolved" : action === "cancelled" ? "cancelled" : "waiting") as FlowItem["waitingState"],
    lastFollowedUpAt: action === "followed_up" ? now.toISOString() : (item.lastFollowedUpAt ?? null),
    followUpAt: action === "snoozed" ? (next ?? null) : action === "followed_up" ? (next ?? null) : action === "responded" || action === "resolved" || action === "cancelled" ? null : (item.followUpAt ?? null),
  };
}

export function moveToTomorrow(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return { dueAt: tomorrow.toISOString() };
}
