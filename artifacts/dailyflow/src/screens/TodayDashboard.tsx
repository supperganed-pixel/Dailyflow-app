import type { ReactNode } from "react";
import { Text, View } from "react-native";
import {
  blockingReasons,
  calculateTaskPriority,
  dailyGreeting,
  getDailyBrief,
  getEndOfDayReview,
  isOpen,
  type FlowItem,
} from "@workspace/flow-core";
import { Button, Icon, Label, useTheme, s } from "../ui";

type Actions = {
  items: FlowItem[];
  now: Date;
  onEdit: (item: FlowItem) => void;
  onComplete: (item: FlowItem) => void;
  onFocus: (item: FlowItem) => void;
  onRemoveFocus: (item: FlowItem) => void;
  onMoveTomorrow: (item: FlowItem) => void;
  onWaiting: (item: FlowItem, action: "followed_up" | "responded" | "resolved" | "cancelled" | "snoozed") => void;
};

function Section({ title, empty, children, count }: { title: string; empty: string; children: ReactNode; count: number }) {
  const c = useTheme();
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 20, fontWeight: "600" }}>{title}</Text>
        <Text style={{ color: c.muted }}>{count}</Text>
      </View>
      {count ? children : <Label muted>{empty}</Label>}
    </View>
  );
}

function TaskCard({ item, actions, focusAction }: {
  item: FlowItem;
  actions: Actions;
  focusAction?: "add" | "remove";
}) {
  const c = useTheme();
  const priority = calculateTaskPriority(item, actions.items, actions.now);
  const blocked = blockingReasons(item, actions.items);
  return (
    <View style={{ padding: 18, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface, gap: 10 }}>
      <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600" }}>{item.title}</Text>
      {item.dueAt && <Label small muted>Due {new Date(item.dueAt).toLocaleString()}</Label>}
      <View style={[s.wrap, { alignItems: "center" }]}>
        <Text style={{ color: priority.level === "high" ? c.brand : c.muted, fontWeight: "600" }}>
          {priority.level[0].toUpperCase() + priority.level.slice(1)} priority
        </Text>
        {priority.reasons.slice(0, 2).map((reason) => <Label small muted key={reason}>· {reason}</Label>)}
      </View>
      {blocked.blocked && (
        <View style={{ backgroundColor: c.soft, padding: 12, borderRadius: 10, gap: 3 }}>
          <Label>Blocked</Label>
          {blocked.dependencies.map((dependency) => <Label small muted key={dependency.id}>Waiting for {dependency.title}</Label>)}
          {blocked.waiting.map((waiting) => <Label small muted key={waiting.id}>Waiting for {waiting.person || waiting.title}</Label>)}
        </View>
      )}
      <View style={s.wrap}>
        <Button title={item.status === "completed" ? "Reopen" : "Complete"} onPress={() => actions.onComplete(item)} />
        {focusAction === "add" && <Button title="Add to Focus" onPress={() => actions.onFocus(item)} />}
        {focusAction === "remove" && <Button title="Remove Focus" onPress={() => actions.onRemoveFocus(item)} />}
        <Button title="Details" onPress={() => actions.onEdit(item)} />
      </View>
    </View>
  );
}

export function WaitingCard({ item, actions }: { item: FlowItem; actions: Actions }) {
  const c = useTheme();
  const followUp = item.followUpAt === undefined ? item.dueAt : item.followUpAt;
  return (
    <View style={{ padding: 18, borderWidth: 1, borderColor: c.line, borderRadius: 16, backgroundColor: c.surface, gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
        <Icon name="clock" size={17} color={c.brand} />
        <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600", flex: 1 }}>{item.title}</Text>
      </View>
      <Label small muted>{item.person || "Waiting for a response"}{item.waitingState === "responded" ? " · Responded" : ""}</Label>
      {followUp && <Label small muted>Follow up {new Date(followUp).toLocaleString()}</Label>}
      {item.lastFollowedUpAt && <Label small muted>Last followed up {new Date(item.lastFollowedUpAt).toLocaleString()}</Label>}
      <View style={s.wrap}>
        <Button title="Followed up" onPress={() => actions.onWaiting(item, "followed_up")} />
        <Button title="Responded" onPress={() => actions.onWaiting(item, "responded")} />
        <Button title="Resolve" onPress={() => actions.onWaiting(item, "resolved")} />
        <Button title="Cancel waiting" onPress={() => actions.onWaiting(item, "cancelled")} />
        <Button title="Tomorrow, 9 AM" onPress={() => actions.onWaiting(item, "snoozed")} />
        <Button title="Details & history" onPress={() => actions.onEdit(item)} />
      </View>
    </View>
  );
}

export function WaitingPanel(actions: Actions) {
  const waiting = actions.items.filter((item) => item.status === "waiting" && isOpen(item));
  return (
    <Section title="Waiting for" count={waiting.length} empty="No open follow-ups. Capture one when you are waiting for someone.">
      <View style={{ gap: 12 }}>
        {waiting.map((item) => <WaitingCard key={item.id} item={item} actions={actions} />)}
      </View>
    </Section>
  );
}

export default function TodayDashboard(actions: Actions) {
  const c = useTheme();
  const brief = getDailyBrief(actions.items, actions.now);
  const review = getEndOfDayReview(actions.items, actions.now);
  const focusIds = new Set(brief.dailyFocus.map((item) => item.id));
  const dueIds = new Set([...brief.overdue, ...brief.dueToday].map((item) => item.id));
  const overdue = brief.overdue.filter((item) => !focusIds.has(item.id));
  const dueToday = brief.dueToday.filter((item) => !focusIds.has(item.id));
  const topPriority = brief.topPriority.filter((item) => !focusIds.has(item.id) && !dueIds.has(item.id));
  return (
    <View style={{ gap: 26 }}>
      <View style={{ backgroundColor: c.soft, padding: 24, borderRadius: 20, gap: 12 }}>
        <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 24, fontWeight: "600" }}>{dailyGreeting(actions.now)} 👋</Text>
        <Label muted>Choose a few things that matter today. Nothing moves or completes without you.</Label>
        <View style={[s.wrap, { gap: 16 }]}>
          <Label>{brief.counts.dueToday} due today</Label>
          <Label>{brief.counts.overdue} overdue</Label>
          <Label>{brief.counts.focus} in Focus</Label>
          <Label>{brief.counts.followUps} follow-ups</Label>
          <Label>{brief.counts.completedToday} completed</Label>
        </View>
      </View>
      <Section title="Focus Today" count={brief.dailyFocus.length} empty="Choose up to 3 tasks to focus on today.">
        <View style={{ gap: 12 }}>
          {brief.dailyFocus.map((item) => <TaskCard key={item.id} item={item} actions={actions} focusAction="remove" />)}
        </View>
      </Section>
      <Section title="Needs attention" count={overdue.length} empty="Nothing overdue needs your attention.">
        <View style={{ gap: 12 }}>
          {overdue.map((item) => <TaskCard key={item.id} item={item} actions={actions} focusAction="add" />)}
        </View>
      </Section>
      <Section title="Due today" count={dueToday.length} empty="Nothing else is due today.">
        <View style={{ gap: 12 }}>
          {dueToday.map((item) => <TaskCard key={item.id} item={item} actions={actions} focusAction="add" />)}
        </View>
      </Section>
      <Section title="Follow-ups" count={brief.followUps.length} empty="No follow-ups needed today.">
        <View style={{ gap: 12 }}>
          {brief.followUps.map((item) => <WaitingCard key={item.id} item={item} actions={actions} />)}
        </View>
      </Section>
      <Section title="Top priority" count={topPriority.length} empty="Your current priorities are shown above.">
        <View style={{ gap: 12 }}>
          {topPriority.map((item) => <TaskCard key={item.id} item={item} actions={actions} focusAction="add" />)}
        </View>
      </Section>
      <Section title="Upcoming" count={brief.upcoming.length} empty="No deadlines coming up soon.">
        <View style={{ gap: 12 }}>
          {brief.upcoming.map((item) => <TaskCard key={item.id} item={item} actions={actions} focusAction="add" />)}
        </View>
      </Section>
      <View style={{ padding: 20, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, gap: 12 }}>
        <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 20, fontWeight: "600" }}>End-of-day review</Text>
        <Label muted>{review.completed.length} completed today · {review.focusCompleted} of {review.focusTotal} Focus tasks completed</Label>
        {review.unfinished.length ? review.unfinished.map((item) => (
          <View key={item.id} style={{ gap: 7 }}>
            <Label>{item.title}</Label>
            <View style={s.wrap}>
              <Button title="Move to tomorrow" onPress={() => actions.onMoveTomorrow(item)} />
            </View>
          </View>
        )) : <Label muted>No unfinished due or Focus tasks to review.</Label>}
        {!!review.waiting.length && <Label small muted>{review.waiting.length} follow-up(s) still need attention.</Label>}
      </View>
    </View>
  );
}
