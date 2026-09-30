import { z } from "zod";
import { parse } from "chrono-node";

export const itemSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(240),
    kind: z.enum(["task", "note", "link"]),
    status: z.enum(["inbox", "active", "waiting", "completed", "archived"]),
    priority: z.enum(["normal", "important"]),
    notes: z.string().max(20000),
    person: z.string().max(120),
    source: z.enum(["capture", "share", "import"]),
    sourceText: z.string().max(20000),
    url: z
      .string()
      .max(2048)
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        "Use an http or https link",
      ),
    dueAt: z.string().datetime().nullable(),
    snoozedUntil: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    deletedAt: z.string().datetime().nullable(),
    version: z.number().int().nonnegative(),
  })
  .strict();
export type FlowItem = z.infer<typeof itemSchema>;
export type FlowStatus = FlowItem["status"];
export const syncSchema = z.object({ changes: z.array(itemSchema).max(500) });
export const syncResponseSchema = z.object({
  items: z.array(itemSchema),
  conflicts: z.array(z.string().uuid()),
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z.string().min(12).max(128),
});
export const sessionSchema = z.object({
  token: z.string(),
  user: z.object({ id: z.string().uuid(), email: z.string().email() }),
});
export type Session = z.infer<typeof sessionSchema>;
export const backupSchema = z.object({
  format: z.literal("dailyflow"),
  version: z.literal(1),
  items: z.array(itemSchema).max(10000),
});

export function migrateLegacy(
  input: unknown,
  newId: () => string,
  now = new Date(),
): FlowItem[] {
  const legacy = z
    .object({
      tasks: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            detail: z.string().optional(),
            source: z.string().optional(),
            dateLabel: z.string().optional(),
            time: z.string().optional(),
            priority: z.string().optional(),
            completed: z.boolean().optional(),
            createdAt: z.string().optional(),
          }),
        )
        .default([]),
      notes: z
        .array(
          z.object({
            id: z.string(),
            title: z.string(),
            body: z.string().optional(),
            pinned: z.boolean().optional(),
            createdAt: z.string().optional(),
          }),
        )
        .default([]),
    })
    .parse(input);
  const base = () => ({
    id: newId(),
    priority: "normal" as const,
    person: "",
    url: "",
    dueAt: null,
    snoozedUntil: null,
    source: "import" as const,
    sourceText: "",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    deletedAt: null,
    version: 0,
  });
  return [
    ...legacy.tasks.map((t) => ({
      ...base(),
      title: t.title.slice(0, 240) || "Imported task",
      kind: "task" as const,
      status: t.completed
        ? ("completed" as const)
        : t.priority === "waiting"
          ? ("waiting" as const)
          : ("active" as const),
      priority: ["urgent", "important"].includes(t.priority ?? "")
        ? ("important" as const)
        : ("normal" as const),
      notes: [
        t.detail,
        t.dateLabel
          ? `Original schedule: ${t.dateLabel}${t.time ? ` at ${t.time}` : ""}. Review the date before setting a reminder.`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 20000),
      sourceText: t.source ?? "",
    })),
    ...legacy.notes.map((n) => ({
      ...base(),
      title: n.title.slice(0, 240) || "Imported note",
      kind: "note" as const,
      status: "active" as const,
      notes: (n.body ?? "").slice(0, 20000),
      priority: n.pinned ? ("important" as const) : ("normal" as const),
    })),
  ].map((i) => itemSchema.parse(i));
}

export function captureSuggestion(text: string, now = new Date()) {
  const date = parse(text, now, { forwardDate: true })[0];
  const due = date?.start.date();
  if (due && !date.start.isCertain("hour")) due.setHours(9, 0, 0, 0);
  const url = text.match(/https?:\/\/[^\s]+/i)?.[0] ?? "";
  return {
    title: text.trim().slice(0, 240),
    dueAt: due?.toISOString() ?? null,
    url,
    kind: (url ? "link" : "task") as FlowItem["kind"],
    priority: (/\b(urgent|important|asap)\b/i.test(text)
      ? "important"
      : "normal") as FlowItem["priority"],
    explanation: date
      ? `Suggested date from “${date.text}”. Check the date and time before saving.`
      : "No date detected. Add one if you need a reminder.",
  };
}
export function isOpen(item: FlowItem) {
  return !item.deletedAt && !["completed", "archived"].includes(item.status);
}
export function isVisible(item: FlowItem, now = new Date()) {
  return (
    isOpen(item) &&
    (!item.snoozedUntil || Date.parse(item.snoozedUntil) <= +now)
  );
}
export function isToday(item: FlowItem, now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return (
    isVisible(item, now) &&
    item.status !== "inbox" &&
    item.kind !== "note" &&
    !!item.dueAt &&
    Date.parse(item.dueAt) <= +end
  );
}
export function attentionReason(item: FlowItem, now = new Date()) {
  if (item.status === "inbox") return "Ready for your review";
  if (item.dueAt && Date.parse(item.dueAt) < +now)
    return item.status === "waiting" ? "Follow-up is due" : "Past its due time";
  if (isToday(item, now))
    return item.status === "waiting" ? "Follow up today" : "Due today";
  if (item.priority === "important") return "Marked important by you";
  if (item.status === "waiting")
    return `Waiting${item.person ? ` for ${item.person}` : " for a reply"}`;
  return item.dueAt ? "Coming up" : "Ready when you are";
}
export function attentionSort(a: FlowItem, b: FlowItem) {
  const now = new Date();
  const rank = (i: FlowItem) =>
    i.dueAt && Date.parse(i.dueAt) < +now
      ? 0
      : isToday(i, now)
        ? 1
        : i.priority === "important"
          ? 2
          : 3;
  return (
    rank(a) - rank(b) ||
    (a.dueAt ? Date.parse(a.dueAt) : 9e12) -
      (b.dueAt ? Date.parse(b.dueAt) : 9e12) ||
    a.createdAt.localeCompare(b.createdAt)
  );
}
export function duplicateOf(
  items: FlowItem[],
  title: string,
  exclude?: string,
) {
  return items.find(
    (i) =>
      i.id !== exclude &&
      isOpen(i) &&
      i.title.trim().toLocaleLowerCase() === title.trim().toLocaleLowerCase(),
  );
}
// Reconcile against the snapshot that was sent, preserving edits made during a request.
export function reconcileSync(
  local: FlowItem[],
  sent: FlowItem[],
  remote: SyncResponse,
  newId: () => string,
  pending: string[] = local.map((i) => i.id),
) {
  const sentMap = new Map(sent.map((i) => [i.id, i]));
  const result = new Map(remote.items.map((i) => [i.id, i]));
  const dirty = new Set<string>();
  for (const item of local) {
    const previous = sentMap.get(item.id);
    const server = result.get(item.id);
    if (remote.conflicts.includes(item.id)) {
      const copy = {
        ...item,
        id: newId(),
        title: `${item.title.slice(0, 220)} (local copy)`,
        version: 0,
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      };
      result.set(copy.id, copy);
      dirty.add(copy.id);
    } else if (
      pending.includes(item.id) &&
      (!previous || item.updatedAt !== previous.updatedAt)
    ) {
      if (!server || previous || item.version === 0) {
        result.set(item.id, {
          ...item,
          version: server?.version ?? item.version,
        });
        dirty.add(item.id);
      }
    }
  }
  return { items: [...result.values()], dirty: [...dirty] };
}
