import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  captureSuggestion,
  isToday,
  isVisible,
  itemSchema,
  reconcileSync,
  migrateLegacy,
  duplicateOf,
  type FlowItem,
} from "./index";
const make = (patch: Partial<FlowItem> = {}): FlowItem => ({
  id: randomUUID(),
  title: "Send report",
  kind: "task",
  status: "active",
  priority: "normal",
  notes: "",
  person: "",
  source: "capture",
  sourceText: "",
  url: "",
  dueAt: null,
  snoozedUntil: null,
  createdAt: "2026-09-25T00:00:00.000Z",
  updatedAt: "2026-09-25T00:00:00.000Z",
  deletedAt: null,
  version: 0,
  ...patch,
});
test("capture extracts a local morning deadline without sending text anywhere", () => {
  const now = new Date(2026, 8, 25, 12);
  const s = captureSuggestion("Send report tomorrow", now);
  const d = new Date(s.dueAt!);
  assert.equal(d.getDate(), 26);
  assert.equal(d.getHours(), 9);
  assert.equal(s.title, "Send report tomorrow");
});
test("explicit times survive date extraction", () => {
  const d = new Date(
    captureSuggestion("Call tomorrow at 6pm", new Date(2026, 8, 25, 12)).dueAt!,
  );
  assert.equal(d.getHours(), 18);
});
test("snoozed and inbox tasks stay out of Today; overdue follow-ups remain", () => {
  const now = new Date("2026-09-25T10:00:00Z");
  const i = make({ dueAt: "2026-09-24T09:00:00.000Z", status: "waiting" });
  assert.equal(isToday(i, now), true);
  assert.equal(isToday({ ...i, status: "inbox" }, now), false);
  assert.equal(
    isVisible({ ...i, snoozedUntil: "2026-09-26T09:00:00.000Z" }, now),
    false,
  );
});
test("remote sync does not overwrite an edit made while a request was in flight", () => {
  const sent = make();
  const changed = {
    ...sent,
    title: "Updated report",
    updatedAt: "2026-09-25T01:00:00.000Z",
  };
  const result = reconcileSync(
    [changed],
    [sent],
    { items: [{ ...sent, version: 1 }], conflicts: [] },
    randomUUID,
  );
  assert.equal(result.items[0].title, "Updated report");
  assert.equal(result.items[0].version, 1);
  assert.deepEqual(result.dirty, [sent.id]);
});
test("accepted mutations become clean and remote edits refresh clean local items", () => {
  const sent = make();
  const remote = { ...sent, version: 2, title: "Changed on second device" };
  const result = reconcileSync(
    [sent],
    [],
    { items: [remote], conflicts: [] },
    randomUUID,
    [],
  );
  assert.equal(result.items[0].title, remote.title);
  assert.deepEqual(result.dirty, []);
  const ack = reconcileSync(
    [sent],
    [sent],
    { items: [{ ...sent, version: 1 }], conflicts: [] },
    randomUUID,
    [sent.id],
  );
  assert.deepEqual(ack.dirty, []);
});
test("conflicts preserve both versions and only queue the new local copy", () => {
  const local = make({ version: 1 });
  const remote = { ...local, title: "Server version", version: 2 };
  const result = reconcileSync(
    [local],
    [local],
    { items: [remote], conflicts: [local.id] },
    randomUUID,
  );
  assert.equal(result.items.length, 2);
  assert.equal(
    result.items.find((i) => i.id === local.id)?.title,
    "Server version",
  );
  const copy = result.items.find((i) => i.id !== local.id)!;
  assert.equal(copy.version, 0);
  assert.match(copy.title, /local copy/);
  assert.deepEqual(result.dirty, [copy.id]);
});
test("unsent changes outside a batch and tombstones survive reconciliation", () => {
  const deleted = make({ deletedAt: "2026-09-25T01:00:00.000Z" });
  const result = reconcileSync(
    [deleted],
    [],
    { items: [], conflicts: [] },
    randomUUID,
    [deleted.id],
  );
  assert.equal(result.items[0].deletedAt, deleted.deletedAt);
  assert.deepEqual(result.dirty, [deleted.id]);
});
test("legacy tasks and pinned notes migrate without guessing stale relative dates", () => {
  const result = migrateLegacy(
    {
      tasks: [
        {
          id: "old",
          title: "Rent",
          dateLabel: "Tomorrow",
          time: "10 AM",
          completed: false,
        },
      ],
      notes: [
        { id: "note", title: "Ideas", body: "A useful thought", pinned: true },
      ],
    },
    randomUUID,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].dueAt, null);
  assert.match(result[0].notes, /Original schedule: Tomorrow/);
  assert.equal(result[1].priority, "important");
  assert.equal(result[1].notes, "A useful thought");
  assert.ok(itemSchema.array().safeParse(result).success);
});
test("unsafe URLs and incomplete backups are rejected", () => {
  assert.equal(
    itemSchema.safeParse(make({ url: "javascript:alert(1)" })).success,
    false,
  );
  assert.equal(
    itemSchema.safeParse({ ...make(), id: "old-format" }).success,
    false,
  );
});
test("duplicate warnings ignore archived and deleted items", () => {
  assert.ok(duplicateOf([make()], " send REPORT "));
  assert.equal(
    duplicateOf([make({ status: "archived" })], "Send report"),
    undefined,
  );
  assert.equal(
    duplicateOf([make({ deletedAt: new Date().toISOString() })], "Send report"),
    undefined,
  );
});
