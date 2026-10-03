import { useProfile } from "../ProfileContext";
import { useState, type ReactNode } from "react";
import { useAppearance } from "../appearance";
import { TaskMotion, Reveal } from "../components/TaskMotion";
import { FocusProgress } from "../components/FocusProgress";
import { Pressable, Text, View } from "react-native";
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
  const appearance = useAppearance();
  const [expanded, setExpanded] = useState(false);
  const priority = calculateTaskPriority(item, actions.items, actions.now);
  const blocked = blockingReasons(item, actions.items);
  const done = item.status === "completed";
  return <TaskMotion done={done} onComplete={() => actions.onComplete(item)} onTomorrow={() => actions.onMoveTomorrow(item)} onFocus={focusAction === "add" ? () => actions.onFocus(item) : undefined}>
    {(complete, completing) => <View style={{ padding: appearance.layout === "compact" ? 13 : 20, borderWidth: 1, borderColor: done || completing ? c.brand : c.line, borderRadius: 20, backgroundColor: done || completing ? c.soft : c.surface, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={(done ? "Reopen " : "Complete ") + item.title} accessibilityState={{ checked: done || completing, disabled: completing }} disabled={completing} onPress={complete} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><Icon name={done || completing ? "check-square" : "square"} size={25} color={c.brand} /></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={"Details for " + item.title} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ flex: 1, minHeight: 44, justifyContent: "center", gap: 5 }}>
          <Text style={{ color: c.ink, fontSize: 17, fontWeight: "600", textDecorationLine: done || completing ? "line-through" : "none" }}>{item.title}</Text>
          <Label small muted>{done ? "Completed" : priority.level + " priority"}{blocked.blocked ? " · Blocked" : ""}</Label>
        </Pressable><Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={c.muted} />
      </View>
      {item.dueAt && <Label small muted>Due {new Date(item.dueAt).toLocaleString()}</Label>}
      <Reveal open={expanded}>
        {!!item.notes && <Label>{item.notes}</Label>}
        {priority.reasons.map((reason) => <Label small muted key={reason}>{reason}</Label>)}
        {blocked.blocked && <View style={{ padding: 12, borderRadius: 12, backgroundColor: c.soft, gap: 4 }}>
          <Label>Blocked</Label>
          {blocked.dependencies.map((dependency) => <Label small muted key={dependency.id}>Waiting for {dependency.title}</Label>)}
          {blocked.waiting.map((waiting) => <Label small muted key={waiting.id}>Waiting for {waiting.person || waiting.title}</Label>)}
        </View>}
        <View style={s.wrap}>
          <Button title="Edit task" onPress={() => actions.onEdit(item)} />
          {focusAction === "remove" && <Button title="Remove Focus" onPress={() => actions.onRemoveFocus(item)} />}
        </View>
      </Reveal>
    </View>}
  </TaskMotion>;
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
  const { profile } = useProfile();
  const c = useTheme();
  const appearance = useAppearance();
  const brief = getDailyBrief(actions.items, actions.now);
  const review = getEndOfDayReview(actions.items, actions.now);
  const focusIds = new Set(brief.dailyFocus.map((item) => item.id));
  const dueIds = new Set([...brief.overdue, ...brief.dueToday].map((item) => item.id));
  const overdue = brief.overdue.filter((item) => !focusIds.has(item.id));
  const dueToday = brief.dueToday.filter((item) => !focusIds.has(item.id));
  const topPriority = brief.topPriority.filter((item) => !focusIds.has(item.id) && !dueIds.has(item.id));
  return (
    <View style={{ gap: appearance.layout === "compact" ? 18 : 28 }}>
      <View style={{ backgroundColor: c.soft, padding: 24, borderRadius: 24, gap: 12, overflow: "hidden", borderWidth: 1, borderColor: c.line }}>
        {appearance.depth && <View pointerEvents="none" accessible={false} style={{ position: "absolute", right: -30, top: -55, width: 155, height: 155, borderRadius: 45, backgroundColor: c.brand, opacity: 0.12, transform: [{ perspective: 500 }, { rotateX: "25deg" }, { rotateZ: "32deg" }], shadowColor: c.brand, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } }} />}
        <Text accessibilityRole="header" style={{ color: c.ink, fontSize: 24, fontWeight: "600" }}>{appearance.greeting.trim() || (dailyGreeting(actions.now) + (profile?.display_name ? `, ${profile.display_name}` : ""))}</Text>
        <Label muted>Choose a few things that matter today. Swipe a task for quick actions.</Label>
        <View style={[s.wrap, { gap: 16 }]}>
          <Label>{brief.counts.dueToday} due today</Label>
          <Label>{brief.counts.overdue} overdue</Label>
          <Label>{brief.counts.focus} in Focus</Label>
          <Label>{brief.counts.followUps} follow-ups</Label>
          <Label>{brief.counts.completedToday} completed</Label>
        </View>
        <FocusProgress completed={review.focusCompleted} total={review.focusTotal} day={actions.now.toDateString()} />
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

