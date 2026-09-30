import type { FlowItem } from "./index";

export type PriorityLevel = "low" | "medium" | "high";
export type PriorityResult = {
  score: number;
  level: PriorityLevel;
  reasons: string[];
};

export function localDateKey(date = new Date()) {
  const two = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

export function dailyGreeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function dayNumber(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function active(item: FlowItem) {
  return !item.deletedAt && item.status !== "archived" && item.status !== "completed" &&
    !(item.status === "waiting" && ["resolved", "cancelled"].includes(item.waitingState ?? "waiting"));
}

export function blockingReasons(task: FlowItem, items: FlowItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const dependencies = (task.dependsOnIds ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is FlowItem => !!item && active(item));
  const waiting = items.filter(
    (item) =>
      item.relatedTaskId === task.id &&
      !item.deletedAt &&
      item.status === "waiting" &&
      !["resolved", "cancelled"].includes(item.waitingState ?? "waiting"),
  );
  return { dependencies, waiting, blocked: dependencies.length + waiting.length > 0 };
}

export function canDependOn(taskId: string, dependencyId: string, items: FlowItem[]) {
  if (taskId === dependencyId) return false;
  const byId = new Map(items.map((item) => [item.id, item]));
  const target = byId.get(dependencyId);
  if (!target || target.kind !== "task" || target.deletedAt) return false;
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === taskId) return false;
    if (seen.has(id)) return true;
    seen.add(id);
    return (byId.get(id)?.dependsOnIds ?? []).every(visit);
  };
  return visit(dependencyId);
}

// Parents must reach the server before newly created dependents in a sync batch.
export function orderSyncChanges(items: FlowItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const visited = new Set<string>();
  const ordered: FlowItem[] = [];
  const visit = (item: FlowItem) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    for (const id of [...(item.dependsOnIds ?? []), ...(item.relatedTaskId ? [item.relatedTaskId] : [])]) {
      const parent = byId.get(id);
      if (parent) visit(parent);
    }
    ordered.push(item);
  };
  items.forEach(visit);
  return ordered;
}

export function calculateTaskPriority(
  task: FlowItem,
  items: FlowItem[],
  now = new Date(),
): PriorityResult {
  const blockingCount = items.filter(
    (item) => active(item) && (item.dependsOnIds ?? []).includes(task.id),
  ).length;
  return priorityFor(task, blockingCount, now);
}

function priorityFor(task: FlowItem, blockingCount: number, now: Date): PriorityResult {
  const today = localDateKey(now);
  const reasons: string[] = [];
  let score = 0;
  if (task.focusDate === today) {
    score += 50;
    reasons.push("In today's Focus");
  }
  if (task.dueAt) {
    const due = localDateKey(new Date(task.dueAt));
    const days = dayNumber(due) - dayNumber(today);
    if (days < 0) {
      score += 40;
      reasons.push(`Overdue by ${-days} day${days === -1 ? "" : "s"}`);
    } else if (days === 0) {
      score += 30;
      reasons.push("Due today");
    } else if (days <= 3) {
      score += 10;
      reasons.push(days === 1 ? "Due tomorrow" : `Due in ${days} days`);
    }
  }
  const manual = task.priorityLevel ?? (task.priority === "important" ? "high" : "medium");
  if (manual === "high") {
    score += 25;
    reasons.push("Marked high priority");
  } else if (manual === "medium") score += 10;
  if (blockingCount) {
    score += 20;
    reasons.push(`Blocking ${blockingCount} other task${blockingCount === 1 ? "" : "s"}`);
  }
  return { score, level: score >= 50 ? "high" : score >= 20 ? "medium" : "low", reasons };
}

export function getDailyBrief(items: FlowItem[], now = new Date()) {
  const today = localDateKey(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const upcomingEnd = new Date(end);
  upcomingEnd.setDate(upcomingEnd.getDate() + 3);
  const tasks = items.filter((item) => !item.deletedAt && item.kind === "task");
  const open = tasks.filter((item) => active(item) && item.status === "active");
  const dailyFocus = tasks
    .filter((item) => item.focusDate === today)
    .sort((a, b) => (a.focusOrder ?? 99) - (b.focusOrder ?? 99));
  const dueToday = open.filter(
    (item) => item.dueAt && Date.parse(item.dueAt) >= +start && Date.parse(item.dueAt) <= +end,
  );
  const overdue = open.filter((item) => item.dueAt && Date.parse(item.dueAt) < +start);
  const followUps = items.filter((item) => {
    if (item.deletedAt || item.status !== "waiting" || ["resolved", "cancelled"].includes(item.waitingState ?? "waiting")) return false;
    const date = item.followUpAt === undefined ? item.dueAt : item.followUpAt;
    return !!date && Date.parse(date) <= +end;
  });
  const upcoming = open
    .filter((item) => item.dueAt && Date.parse(item.dueAt) > +end && Date.parse(item.dueAt) <= +upcomingEnd)
    .sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!));
  const completedToday = tasks.filter((item) => {
    const completed = item.completedAt ?? (item.status === "completed" ? item.updatedAt : null);
    return !!completed && Date.parse(completed) >= +start && Date.parse(completed) <= +end;
  });
  const blockingCounts = new Map<string, number>();
  for (const item of items) if (active(item))
    for (const id of item.dependsOnIds ?? [])
      blockingCounts.set(id, (blockingCounts.get(id) ?? 0) + 1);
  const scores = new Map(open.map((item) => [item.id, priorityFor(item, blockingCounts.get(item.id) ?? 0, now).score]));
  const topPriority = [...open]
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    .slice(0, 5);
  return {
    date: today,
    counts: {
      dueToday: dueToday.length,
      overdue: overdue.length,
      focus: dailyFocus.length,
      followUps: followUps.length,
      completedToday: completedToday.length,
    },
    dailyFocus,
    dueToday,
    overdue,
    followUps,
    upcoming,
    completedToday,
    topPriority,
  };
}

export function getEndOfDayReview(items: FlowItem[], now = new Date()) {
  const brief = getDailyBrief(items, now);
  const unfinished = [...new Map(
    [...brief.dailyFocus, ...brief.dueToday, ...brief.overdue]
      .filter(active)
      .map((item) => [item.id, item]),
  ).values()];
  return {
    completed: brief.completedToday,
    focusCompleted: brief.dailyFocus.filter((item) => item.status === "completed").length,
    focusTotal: brief.dailyFocus.length,
    unfinished,
    waiting: brief.followUps,
  };
}
