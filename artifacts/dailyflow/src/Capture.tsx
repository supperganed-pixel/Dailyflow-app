import { useState } from "react";
import { View, Text } from "react-native";
import * as Crypto from "expo-crypto";
import {
  captureSuggestion,
  duplicateOf,
  itemSchema,
  type FlowItem,
} from "@workspace/flow-core";
import { Button, Choice, Field, Label, useTheme, s } from "./ui";
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
  const [priority, setPriority] = useState<FlowItem["priority"]>(
    item?.priority ?? initial?.priority ?? "normal",
  );
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
  function suggest() {
    const result = captureSuggestion(raw);
    setTitle(result.title);
    setDue(localDate(result.dueAt));
    setKind(result.kind);
    setUrl(result.url);
    setPriority(result.priority);
    setHint(result.explanation);
  }
  function save() {
    try {
      const now = new Date().toISOString();
      const result = itemSchema.parse({
        id: item?.id ?? Crypto.randomUUID(),
        title,
        kind,
        status,
        priority,
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
        <Field
          label="Waiting for whom?"
          value={person}
          onChangeText={setPerson}
          placeholder="Name or team"
          maxLength={120}
        />
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
        options={["normal", "important"]}
        value={priority}
        onChange={(v) => setPriority(v as FlowItem["priority"])}
      />
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
