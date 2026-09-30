import { useState } from "react";
import { View, Text } from "react-native";
import * as Crypto from "expo-crypto";
import {
  captureSuggestion,
  blockingReasons,
  canDependOn,
  duplicateOf,
  itemSchema,
  type FlowItem,
} from "@workspace/flow-core";
import { Button, Choice, Field, Label, useTheme, s } from "./ui";
import { validateDependencies } from "./services/dailyflow";
export function localDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function parseLocalDate(value: string) {
  if (!value.trim()) return null;
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!m)
    throw new Error("Use YYYY-MM-DD HH:mm, for example 2026-10-05 09:00.");
  const [, year, month, day, hour = "09", minute = "00"] = m;
  const date = new Date(+year, +month - 1, +day, +hour, +minute);
  if (
    date.getFullYear() !== +year ||
    date.getMonth() !== +month - 1 ||
    date.getDate() !== +day ||
    date.getHours() !== +hour ||
    date.getMinutes() !== +minute
  )
    throw new Error("This date or time is not valid.");
  return date.toISOString();
}
export default function Capture({
  item,
  shared,
  items,
  onSave,
  onCancel,
}: {
  item?: FlowItem;
  shared?: string;
  items: FlowItem[];
  onSave: (item: FlowItem) => void;
  onCancel: () => void;
}) {
  const c = useTheme();
  const [raw, setRaw] = useState(shared ?? "");
  const initial = shared ? captureSuggestion(shared) : null;
  const [title, setTitle] = useState(item?.title ?? initial?.title ?? "");
  const [kind, setKind] = useState<FlowItem["kind"]>(
    item?.kind ?? initial?.kind ?? "task",
  );
  const [status, setStatus] = useState<FlowItem["status"]>(
    item?.status ?? (shared ? "inbox" : "active"),
  );
  const [priorityLevel, setPriorityLevel] = useState<"low" | "medium" | "high">(
    item?.priorityLevel ?? ((item?.priority ?? initial?.priority) === "important" ? "high" : "medium"),
  );
  const [dependsOnIds, setDependsOnIds] = useState(item?.dependsOnIds ?? []);
  const [relatedTaskId, setRelatedTaskId] = useState(item?.relatedTaskId ?? null);
  const [waitingState, setWaitingState] = useState<"waiting" | "responded" | "resolved" | "cancelled">(item?.waitingState ?? "waiting");
  const [expected, setExpected] = useState(localDate(item?.expectedAt ?? null));
  const [followUp, setFollowUp] = useState(localDate(item?.followUpAt ?? item?.dueAt ?? null));
  const [snoozedUntil, setSnoozedUntil] = useState(item?.snoozedUntil ?? null);
  const [due, setDue] = useState(
    localDate(item?.dueAt ?? initial?.dueAt ?? null),
  );
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [person, setPerson] = useState(item?.person ?? "");
  const [url, setUrl] = useState(item?.url ?? initial?.url ?? "");
  const [hint, setHint] = useState(
    initial?.explanation ??
      "Dates are suggested on this device. You choose what gets saved.",
  );
  const [error, setError] = useState("");
  const [duplicateAllowed, setDuplicateAllowed] = useState(false);
  const duplicate = duplicateOf(items, title, item?.id);
  const taskOptions = items.filter((candidate) =>
    candidate.kind === "task" && !candidate.deletedAt && candidate.id !== item?.id,
  );
  const blocked = item ? blockingReasons({ ...item, dependsOnIds }, items) : null;
  function suggest() {
    const result = captureSuggestion(raw);
    setTitle(result.title);
    setDue(localDate(result.dueAt));
    setKind(result.kind);
    setUrl(result.url);
    setPriorityLevel(result.priority === "important" ? "high" : "medium");
    setHint(result.explanation);
  }
  function save() {
    try {
      const now = new Date().toISOString();
      const waitingHistory = status === "waiting"
        ? item?.waitingHistory ?? [{ at: now, action: "created" as const }]
        : item?.waitingHistory;
      const nextHistory = status === "waiting" && item && waitingState !== (item.waitingState ?? "waiting")
        ? [...(waitingHistory ?? []), { at: now, action: waitingState === "waiting" ? "reopened" as const : waitingState }].slice(-200)
        : waitingHistory;
      const result = itemSchema.parse({
        id: item?.id ?? Crypto.randomUUID(),
        title,
        kind,
        status,
        priority: priorityLevel === "high" ? "important" : "normal",
        priorityLevel,
        focusDate: kind === "task" && ["active", "completed"].includes(status) ? (item?.focusDate ?? null) : null,
        focusOrder: kind === "task" && ["active", "completed"].includes(status) ? (item?.focusOrder ?? null) : null,
        completedAt: status === "completed" ? (item?.completedAt ?? now) : null,
        archivedAt: status === "archived" ? (item?.archivedAt ?? now) : null,
        dependsOnIds: kind === "task" && item ? validateDependencies(item, dependsOnIds, items) : [],
        relatedTaskId: status === "waiting" ? relatedTaskId : null,
        requestedAt: status === "waiting" ? (item?.requestedAt ?? now) : null,
        expectedAt: status === "waiting" ? parseLocalDate(expected) : null,
        followUpAt: status === "waiting" && waitingState === "waiting" ? (parseLocalDate(followUp) ?? parseLocalDate(due)) : null,
        lastFollowedUpAt: item?.lastFollowedUpAt ?? null,
        waitingState: status === "waiting" ? waitingState : undefined,
        waitingHistory: nextHistory,
        notes,
        person,
        url,
        dueAt: kind === "note" ? null : parseLocalDate(due),
        snoozedUntil: kind === "note" ? null : snoozedUntil,
        source: item?.source ?? (shared ? "share" : "capture"),
        sourceText: item?.sourceText ?? raw,
        createdAt: item?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
        version: item?.version ?? 0,
      });
      onSave(result);
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "ZodError"
          ? e.message
          : "Add a title (up to 240 characters) and check the link and other fields.",
      );
    }
  }
  return (
    <View style={{ gap: 18 }}>
      {!item && (
        <>
          <Field
            label="What’s on your mind?"
            value={raw}
            onChangeText={setRaw}
            placeholder="Send the project files tomorrow at 10"
            multiline
            maxLength={20000}
          />
          <Button
            title="Suggest details"
            icon="zap"
            onPress={suggest}
            disabled={!raw.trim()}
          />
          <Label small muted>
            {hint}
          </Label>
        </>
      )}
      <Field
        label="Title"
        placeholder="Give this a clear next action"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setDuplicateAllowed(false);
        }}
        maxLength={240}
      />
      <Label small>Save as</Label>
      <Choice
        options={["task", "note", "link"]}
        value={kind}
        onChange={(v) => setKind(v as FlowItem["kind"])}
      />
      <Label small>Where it belongs</Label>
      <Choice
        options={["inbox", "active", "waiting", "completed", "archived"]}
        value={status}
        onChange={(v) => setStatus(v as FlowItem["status"])}
      />
      {status === "waiting" && (
        <>
          <Field
            label="Waiting for whom?"
            value={person}
            onChangeText={setPerson}
            placeholder="Name or team"
            maxLength={120}
          />
          <Label small>Waiting status</Label>
          <Choice
            options={["waiting", "responded", "resolved", "cancelled"]}
            value={waitingState}
            onChange={(value) => setWaitingState(value as typeof waitingState)}
          />
          <Field label="Expected date (optional)" value={expected} onChangeText={setExpected} placeholder="YYYY-MM-DD HH:mm" />
          <Field label="Follow-up date (optional)" value={followUp} onChangeText={setFollowUp} placeholder="YYYY-MM-DD HH:mm" />
          <Label small>Related task</Label>
          <Button title={relatedTaskId ? "No related task" : "None"} onPress={() => setRelatedTaskId(null)} />
          {taskOptions.map((candidate) => (
            <Button
              key={candidate.id}
              title={`${relatedTaskId === candidate.id ? "✓ " : ""}${candidate.title}`}
              onPress={() => setRelatedTaskId(candidate.id)}
            />
          ))}
        </>
      )}
      {kind !== "note" && (
        <>
          <Field
            label={
              status === "waiting"
                ? "Follow-up date and time"
                : "Due date and time (optional)"
            }
            value={due}
            onChangeText={setDue}
            placeholder="YYYY-MM-DD HH:mm"
            autoCapitalize="none"
          />
          <Label small muted>
            Times use this device’s local time zone. A date without a time uses
            09:00.
          </Label>
          <View style={s.wrap}>
            <Button
              title="Tomorrow, 9 AM"
              onPress={() => {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                d.setHours(9, 0, 0, 0);
                setDue(localDate(d.toISOString()));
              }}
            />
            <Button title="No date" onPress={() => setDue("")} />
          </View>
        </>
      )}
      <Label small>Priority</Label>
      <Choice
        options={["low", "medium", "high"]}
        value={priorityLevel}
        onChange={(v) => setPriorityLevel(v as "low" | "medium" | "high")}
      />
      {kind === "task" && item && (
        <View style={{ gap: 10 }}>
          <Label small>Blocked by another task</Label>
          {taskOptions.map((candidate) => {
            const selected = dependsOnIds.includes(candidate.id);
            return (
              <Button
                key={candidate.id}
                title={`${selected ? "Remove: " : "Wait for: "}${candidate.title}`}
                disabled={!selected && (!canDependOn(item.id, candidate.id, items) || dependsOnIds.length >= 25)}
                onPress={() => setDependsOnIds(selected
                  ? dependsOnIds.filter((id) => id !== candidate.id)
                  : [...dependsOnIds, candidate.id])}
              />
            );
          })}
          {blocked?.blocked && (
            <View style={{ backgroundColor: c.soft, padding: 14, borderRadius: 12, gap: 6 }}>
              <Label>Blocked</Label>
              {blocked.dependencies.map((dependency) => <Label small muted key={dependency.id}>Waiting for: {dependency.title}</Label>)}
              {blocked.waiting.map((waiting) => <Label small muted key={waiting.id}>Waiting for: {waiting.person || waiting.title}</Label>)}
            </View>
          )}
        </View>
      )}
      {status === "waiting" && !!item?.waitingHistory?.length && (
        <View style={{ gap: 6 }}>
          <Label small>Follow-up history</Label>
          {item.waitingHistory.map((event, index) => (
            <Label key={`${event.at}-${index}`} small muted>{new Date(event.at).toLocaleString()} · {event.action.replace(/_/g, " ")}</Label>
          ))}
        </View>
      )}
      <Field
        label="Link (optional)"
        value={url}
        onChangeText={setUrl}
        placeholder="https://…"
        keyboardType="url"
        autoCapitalize="none"
        maxLength={2048}
      />
      <Field
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Keep helpful details here"
        multiline
        maxLength={20000}
      />
      {item?.sourceText ? (
        <View
          style={{ backgroundColor: c.soft, padding: 15, borderRadius: 12 }}
        >
          <Label small muted>
            ORIGINAL CAPTURE · {item.source}
          </Label>
          <Label>{item.sourceText}</Label>
        </View>
      ) : null}
      {!!snoozedUntil && (
        <Button title="Clear snooze" onPress={() => setSnoozedUntil(null)} />
      )}
      {duplicate && !duplicateAllowed && (
        <View style={{ gap: 8 }}>
          <Label>A similar item already exists: “{duplicate.title}”.</Label>
          <Button
            title="Keep both anyway"
            onPress={() => setDuplicateAllowed(true)}
          />
        </View>
      )}
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: c.danger }}>
          {error}
        </Text>
      )}
      <View style={s.wrap}>
        <Button
          title={
            item
              ? "Save changes"
              : status === "inbox"
                ? "Save to Inbox"
                : "Save item"
          }
          primary
          icon="check"
          disabled={!title.trim() || (!!duplicate && !duplicateAllowed)}
          onPress={save}
        />
        <Button title="Cancel" onPress={onCancel} />
      </View>
    </View>
  );
}
