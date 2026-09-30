import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { itemSchema, type FlowItem } from "@workspace/flow-core";
import { addToDailyFocus, waitingChange, moveToTomorrow } from "./dailyflow";

const today = new Date(2026, 8, 30, 12);
const make = (patch: Partial<FlowItem> = {}): FlowItem => itemSchema.parse({
  id: randomUUID(), title: "Task", kind: "task", status: "active",
  priority: "normal", notes: "", person: "", source: "capture",
  sourceText: "", url: "", dueAt: null, snoozedUntil: null,
  createdAt: today.toISOString(), updatedAt: today.toISOString(),
  deletedAt: null, version: 0, ...patch,
});

test("Focus has three distinct positions and rejects a fourth task", () => {
  const tasks = [1, 2, 3].map((focusOrder) => make({ focusDate: "2026-09-30", focusOrder }));
  const fourth = make();
  assert.throws(() => addToDailyFocus(fourth, tasks, today), /up to 3/);
  const patch = addToDailyFocus(fourth, tasks.slice(1), today);
  assert.deepEqual(patch, { focusDate: "2026-09-30", focusOrder: 1 });
});

test("follow-up actions preserve history and only reschedule on an explicit action", () => {
  const waiting = make({ status: "waiting", followUpAt: today.toISOString() });
  const responded = waitingChange(waiting, "responded", today);
  assert.equal(responded.followUpAt, null);
  assert.equal(responded.waitingState, "responded");
  assert.equal(responded.waitingHistory[0].action, "responded");
  assert.equal(waiting.followUpAt, today.toISOString());
  const tomorrow = moveToTomorrow(today).dueAt;
  assert.equal(new Date(tomorrow).getHours(), 9);
});
