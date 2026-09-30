import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  blockingReasons,
  calculateTaskPriority,
  canDependOn,
  getDailyBrief,
  getEndOfDayReview,
  itemSchema,
  orderSyncChanges,
  type FlowItem,
} from "./index";

const now = new Date(2026, 8, 30, 12);
const at = (day: number) => new Date(2026, 8, day, 9).toISOString();
const make = (patch: Partial<FlowItem> = {}): FlowItem => itemSchema.parse({
  id: randomUUID(), title: "Task", kind: "task", status: "active",
  priority: "normal", notes: "", person: "", source: "capture",
  sourceText: "", url: "", dueAt: null, snoozedUntil: null,
  createdAt: at(20), updatedAt: at(20), deletedAt: null, version: 0,
  ...patch,
});

test("priority explains due dates, Focus, and blocking work", () => {
  const parent = make({ title: "Send report", dueAt: at(29), focusDate: "2026-09-30", focusOrder: 1 });
  const child = make({ title: "Publish report", dependsOnIds: [parent.id] });
  const result = calculateTaskPriority(parent, [parent, child], now);
  assert.equal(result.level, "high");
  assert.ok(result.reasons.includes("Overdue by 1 day"));
  assert.ok(result.reasons.includes("Blocking 1 other task"));
  assert.ok(result.reasons.includes("In today's Focus"));
});

test("dependencies block until completion and cycles are rejected", () => {
  const first = make();
  const second = make({ dependsOnIds: [first.id] });
  assert.equal(blockingReasons(second, [first, second]).blocked, true);
  assert.equal(blockingReasons(second, [{ ...first, status: "completed" }, second]).blocked, false);
  assert.equal(canDependOn(first.id, second.id, [first, second]), false);
  assert.equal(canDependOn(first.id, first.id, [first, second]), false);
  assert.deepEqual(orderSyncChanges([second, first]).map((item) => item.id), [first.id, second.id]);
});

test("brief counts follow-ups on the correct day and keeps history", () => {
  const task = make({ dueAt: at(30), focusDate: "2026-09-30", focusOrder: 1 });
  const waiting = make({ status: "waiting", person: "Alex", followUpAt: at(30), relatedTaskId: task.id,
    waitingHistory: [{ at: at(29), action: "created" }] });
  const later = make({ status: "waiting", followUpAt: new Date(2026, 9, 2, 9).toISOString() });
  const brief = getDailyBrief([task, waiting, later], now);
  assert.equal(brief.counts.focus, 1);
  assert.equal(brief.counts.dueToday, 1);
  assert.deepEqual(brief.followUps.map((item) => item.id), [waiting.id]);
  assert.equal(blockingReasons(task, [task, waiting]).blocked, true);
  assert.equal(blockingReasons(task, [task, { ...waiting, waitingState: "resolved" }]).blocked, false);
  assert.equal(waiting.waitingHistory?.[0].action, "created");
});

test("end-of-day review leaves unfinished work unchanged", () => {
  const unfinished = make({ dueAt: at(29), focusDate: "2026-09-30", focusOrder: 1 });
  const complete = make({ status: "completed", completedAt: now.toISOString(), focusDate: "2026-09-30", focusOrder: 2 });
  const review = getEndOfDayReview([unfinished, complete], now);
  assert.equal(review.focusCompleted, 1);
  assert.deepEqual(review.unfinished.map((item) => item.id), [unfinished.id]);
  assert.equal(unfinished.dueAt, at(29));
});
