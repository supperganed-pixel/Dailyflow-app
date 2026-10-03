import { ProfileProvider, useProfile } from "./ProfileContext";
import { AppearanceProvider, AppearanceSettings, AnimatedToggle, accentPalette, useAppearance } from "./appearance";
import { TaskMotion, Reveal } from "./components/TaskMotion";
import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  attentionReason,
  attentionSort,
  blockingReasons,
  calculateTaskPriority,
  isOpen,
  isToday,
  isVisible,
  type FlowItem,
} from "@workspace/flow-core";
import { useFlow } from "./useFlow";
import {
  Button,
  Icon,
  Label,
  Theme,
  Choice,
  Field,
  dark,
  light,
  s as ui,
  useTheme,
} from "./ui";
import Capture from "./Capture";
import Account from "./Account";
import ShareCapture from "./ShareCapture";
import { exportBackup, readBackup } from "./backup";
import { preferences } from "./storage";
import { enableReminders, refreshReminders, sendTestReminder } from "./reminders";
import { deleteAccount } from "./api";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { Skeleton } from "./components/Loading";
import TodayDashboard, { WaitingPanel } from "./screens/TodayDashboard";
import {
  addToDailyFocus,
  removeFromDailyFocus,
  completeTask,
  waitingChange,
  moveToTomorrow,
} from "./services/dailyflow";
import Constants from "expo-constants";
const Files = lazy(() => import("./screens/Files"));
const Releases = lazy(() => import("./screens/Releases"));
const Profile = lazy(() => import("./screens/Profile"));
const Onboarding = lazy(() => import("./Onboarding"));

type Screen =
  | "Today"
  | "Inbox"
  | "Waiting"
  | "Notes"
  | "Schedule"
  | "History"
  | "More"
  | "Files"
  | "Downloads";
type Dialog = {
  title: string;
  body: string;
  action: () => void | Promise<void>;
  label: string;
  danger?: boolean;
};
const screens: {
  name: Screen;
  icon: React.ComponentProps<typeof Icon>["name"];
  description: string;
}[] = [
  { name: "Today", icon: "sun", description: "A little clarity for your day." },
  {
    name: "Inbox",
    icon: "inbox",
    description: "Collect first. Decide when you’re ready.",
  },
  {
    name: "Waiting",
    icon: "clock",
    description: "Keep your follow-ups out of your head.",
  },
  {
    name: "Notes",
    icon: "file-text",
    description: "A home for the things worth keeping.",
  },
  {
    name: "Schedule",
    icon: "calendar",
    description: "Your upcoming tasks and follow-ups.",
  },
  {
    name: "History",
    icon: "check-circle",
    description: "What you’ve handled and set aside.",
  },
  { name: "More", icon: "grid", description: "Make DailyFlow feel like you." },
  {
    name: "Files",
    icon: "folder",
    description: "Your private documents and images.",
  },
  {
    name: "Downloads",
    icon: "download",
    description: "New releases and improvements.",
  },
];
function displayDate(date: string | null) {
  return date
    ? new Date(date).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "No date";
}
function ItemCard({
  item,
  items,
  onEdit,
  onComplete,
  onSnooze,
  onArchive,
  onAccept,
  now,
}: {
  item: FlowItem;
  items: FlowItem[];
  onEdit: () => void;
  onComplete: () => void;
  onSnooze: () => void;
  onArchive: () => void;
  onAccept: () => void;
  now: Date;
}) {
  const c = useTheme();
  const [expanded, setExpanded] = useState(false);
  const done = item.status === "completed" || item.status === "archived";
  const priority = calculateTaskPriority(item, items, now);
  const blocked = item.kind === "task" ? blockingReasons(item, items) : null;
  return (
    <View
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}
    >
      <View style={styles.row}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel={`${done ? "Reopen" : "Complete"} ${item.title}`}
          accessibilityState={{ checked: done }}
          onPress={onComplete}
          style={[
            styles.check,
            {
              borderColor: done ? c.brand : c.line,
              backgroundColor: done ? c.soft : c.surface,
            },
          ]}
        >
          {done && <Icon name="check" size={18} />}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Details for ${item.title}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(!expanded)}
          style={{ flex: 1, gap: 6 }}
        >
          <Text
            style={{
              fontSize: 17,
              fontWeight: "600",
              color: c.ink,
              textDecorationLine: done ? "line-through" : "none",
            }}
          >
            {item.title}
          </Text>
          <Label small muted>
            {item.person ? `${item.person} · ` : ""}
            {item.snoozedUntil && Date.parse(item.snoozedUntil) > +now
              ? `Snoozed until ${displayDate(item.snoozedUntil)}`
              : item.dueAt
                ? displayDate(item.dueAt)
                : item.kind === "note"
                  ? "Note"
                  : attentionReason(item, now)}
          </Label>
        </Pressable>
        {item.priority === "important" && (
          <Icon name="star" size={17} color={c.brand} />
        )}
      </View>
      <Button title={expanded ? "Hide details" : "Show details"} icon={expanded ? "chevron-up" : "chevron-down"} onPress={() => setExpanded(!expanded)} />
      <Reveal open={expanded}>
      {!!item.notes && (
        <Text
          numberOfLines={undefined}
          style={{ color: c.muted, lineHeight: 21, marginLeft: 40 }}
        >
          {item.notes}
        </Text>
      )}
      {item.kind === "task" && !done && (
        <View style={{ marginLeft: 40, gap: 4 }}>
          <Label small muted>{priority.level[0].toUpperCase() + priority.level.slice(1)} priority{priority.reasons.length ? ` · ${priority.reasons.slice(0, 2).join(" · ")}` : ""}</Label>
          {blocked?.blocked && <Label small muted>Blocked · {blocked.dependencies.length} task(s), {blocked.waiting.length} waiting item(s)</Label>}
        </View>
      )}
      <View
        style={[
          styles.row,
          { justifyContent: "space-between", flexWrap: "wrap", marginLeft: 40 },
        ]}
      >
        <View style={styles.tag}>
          <Icon
            name={
              item.source === "share"
                ? "share-2"
                : item.kind === "link"
                  ? "link"
                  : "edit-3"
            }
            size={11}
          />
          <Label small muted>
            {item.source === "share"
              ? "Shared to DailyFlow"
              : item.source === "import"
                ? "Imported"
                : item.kind}
          </Label>
        </View>
        <View style={ui.wrap}>
          {item.status === "inbox" ? (
            <Button title="Review" onPress={onAccept} />
          ) : (
            !done && <Button title="Snooze" onPress={onSnooze} />
          )}
          <Button
            title={done ? "Details" : "Archive"}
            onPress={done ? onEdit : onArchive}
          />
        </View>
      </View>
      {!!item.url && (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(item.url)}
          style={{ marginLeft: 40, paddingVertical: 8 }}
        >
          <Text numberOfLines={1} style={{ color: c.brand, fontSize: 13 }}>
            Open saved link ↗
          </Text>
        </Pressable>
      )}
      <Button title="Edit item" onPress={onEdit} />
      </Reveal>
    </View>
  );
}
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View style={{ padding: 32, flex: 1, justifyContent: "center" }}>
        <Text style={{ fontSize: 20 }}>
          DailyFlow couldn’t open this screen.
        </Text>
        <Text style={{ marginTop: 12 }}>
          Close and reopen the app. Your saved data has not been deleted.
        </Text>
      </View>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider><AppearanceProvider><DailyFlow /></AppearanceProvider></ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
function DailyFlow() {
  const auth = useAuth();
  const flow = useFlow();
  const { profile } = useProfile();
  const system = useColorScheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [theme, setTheme] = useState("system");
  const appearance = useAppearance();
  const isDark = theme === "dark" || (theme === "system" && system === "dark");
  const c = useMemo(() => accentPalette(isDark ? dark : light, appearance.accent, isDark), [isDark, appearance.accent]);
  const [screen, setScreen] = useState<Screen>("Today");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("attention");
  const [capture, setCapture] = useState<{
    item?: FlowItem;
    shared?: string;
  } | null>(null);
  const [account, setAccount] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => void;
  } | null>(null);
  const [reminders, setReminders] = useState(false);
  const [quiet, setQuiet] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteModal, setDeleteModal] = useState(false);
  const [now, setNow] = useState(new Date());
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    setLimit(50);
  }, [screen, query, filter]);
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.session) {
      setCapture(null);
      setProfileOpen(false);
      setSettings(false);
      setTutorial(false);
      setDialog(null);
      setDeleteModal(false);
      setDeletePassword("");
      setToast(null);
    }
    if (Platform.OS === "web")
      window.history.replaceState(
        {},
        "",
        auth.session ? "/" : "/login",
      );
  }, [auth.loading, auth.session?.user.id]);
  useEffect(() => {
    const userId = auth.session?.user.id;
    if (!userId || !flow.ready || flow.items.length > 0) return;
    let live = true;
    void preferences
      .get(`tutorial.v1.${userId}`)
      .then((seen) => {
        if (live && seen !== "done") setTutorial(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [auth.session?.user.id, flow.ready, flow.items.length]);
  function closeTutorial() {
    setTutorial(false);
    const userId = auth.session?.user.id;
    if (userId) void preferences.set(`tutorial.v1.${userId}`, "done");
  }
  useEffect(() => {
    let live = true;
    if (auth.session)
      void import("./services/releases")
        .then(async (m) => {
          const result = await m.getReleases();
          if (
            live &&
            result.releases[0] &&
            !result.releases[0].prerelease &&
            m.isNewer(result.releases[0].tag_name, m.currentVersion)
          )
            setToast({
              text: `DailyFlow ${result.releases[0].tag_name} is available in Downloads.`,
            });
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [auth.session?.user.id]);
  const reminderQueue = useRef(Promise.resolve());
  const notify = (text: string, undo?: () => void) => setToast({ text, undo });
  useEffect(() => {
    void Promise.all([
      preferences.get("theme"),
      preferences.get("reminders"),
      preferences.get("quiet"),
    ])
      .then(([t, r, q]) => {
        if (t) setTheme(t);
        setReminders(r === "true");
        setQuiet(q !== "false");
        setPrefsLoaded(true);
      })
      .catch(() => flow.setError("Could not load your preferences."));
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), toast.undo ? 10000 : 6000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!flow.ready || !prefsLoaded) return;
    const timer = setTimeout(() => {
      reminderQueue.current = reminderQueue.current
        .catch(() => {})
        .then(() => refreshReminders(flow.items, reminders, quiet))
        .catch(() =>
          notify(
            "Could not update device reminders. Check notification permission in Android settings.",
          ),
        );
    }, 500);
    return () => clearTimeout(timer);
  }, [flow.items, flow.ready, prefsLoaded, reminders, quiet]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      flow.setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = useMemo(
    () => flow.items.filter((i) => !i.deletedAt),
    [flow.items],
  );
  const open = useMemo(() => visible.filter(isOpen), [visible]);
  const inbox = useMemo(() => open.filter((i) => i.status === "inbox"), [open]);
  const waiting = useMemo(
    () => open.filter((i) => i.status === "waiting"),
    [open],
  );
  const matches = useMemo(
    () =>
      visible.filter((i) =>
        `${i.title} ${i.notes} ${i.person} ${i.sourceText} ${i.url}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [visible, query],
  );
  const list = useMemo(
    () =>
      query
        ? matches
        : screen === "Inbox"
          ? inbox
          : screen === "Waiting"
            ? waiting
            : screen === "Notes"
              ? visible.filter(
                  (i) =>
                    i.kind === "note" &&
                    !["completed", "archived"].includes(i.status),
                )
              : screen === "History"
                ? visible.filter((i) =>
                    ["completed", "archived"].includes(i.status) ||
                    (i.status === "waiting" && ["resolved", "cancelled"].includes(i.waitingState ?? "waiting")),
                  )
                : screen === "Schedule"
                  ? open.filter(
                      (i) =>
                        i.dueAt && i.status !== "inbox" && i.kind !== "note",
                    )
                  : filter === "all"
                    ? open.filter(
                        (i) => i.status !== "inbox" && i.kind !== "note",
                      )
                    : filter === "snoozed"
                      ? open.filter(
                          (i) =>
                            i.snoozedUntil && Date.parse(i.snoozedUntil) > +now,
                        )
                      : open.filter(
                          (i) =>
                            i.status !== "inbox" &&
                            i.kind !== "note" &&
                            isVisible(i, now) &&
                            (isToday(i, now) ||
                              i.priority === "important" ||
                              !i.dueAt),
                        ),
    [query, matches, screen, inbox, waiting, visible, open, filter, now],
  );
  const sorted = useMemo(
    () =>
      [...list].sort(
        screen === "Schedule"
          ? (a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? "")
          : attentionSort,
      ),
    [list, screen],
  );
  const title = query
    ? "Search results"
    : screen === "Today"
      ? "A calmer day starts here."
      : screen;
  function select(value: Screen) {
    setQuery("");
    setScreen(value);
  }
  function change(item: FlowItem, patch: Partial<FlowItem>, message: string) {
    flow.update(item.id, patch);
    notify(message, () =>
      flow.update(item.id, {
        status: item.status,
        snoozedUntil: item.snoozedUntil,
        deletedAt: item.deletedAt,
        completedAt: item.completedAt,
        archivedAt: item.archivedAt,
        focusDate: item.focusDate,
        focusOrder: item.focusOrder,
        dueAt: item.dueAt,
        waitingState: item.waitingState,
        followUpAt: item.followUpAt,
        lastFollowedUpAt: item.lastFollowedUpAt,
        waitingHistory: item.waitingHistory,
      }),
    );
  }
  function focusItem(item: FlowItem) {
    try {
      change(item, addToDailyFocus(item, flow.items, now), "Added to today's Focus");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not add this task to Focus.");
    }
  }
  function waitingAction(item: FlowItem, action: "followed_up" | "responded" | "resolved" | "cancelled" | "snoozed") {
    try {
      const next = action === "snoozed" ? moveToTomorrow(now).dueAt : null;
      change(item, waitingChange(item, action, now, next),
        action === "followed_up" ? "Follow-up recorded" :
        action === "responded" ? "Response recorded" :
        action === "resolved" ? "Waiting item resolved" :
        action === "cancelled" ? "Waiting item cancelled" : "Follow-up moved to tomorrow");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not update this follow-up.");
    }
  }
  const dashboardActions = {
    items: flow.items,
    now,
    onEdit: (item: FlowItem) => setCapture({ item }),
    onComplete: (item: FlowItem) => change(item, completeTask(item, now), item.status === "completed" ? "Item reopened" : "One less thing on your mind"),
    onFocus: focusItem,
    onRemoveFocus: (item: FlowItem) => change(item, removeFromDailyFocus(), "Removed from today's Focus"),
    onMoveTomorrow: (item: FlowItem) => change(item, moveToTomorrow(now), "Moved to tomorrow at 9 AM"),
    onWaiting: waitingAction,
  };
  function snooze(item: FlowItem) {
    setDialog({
      title: "Give it a little time",
      body: "Bring this item back tomorrow at 9 AM in your current time zone. The original deadline stays visible.",
      label: "Snooze until tomorrow",
      action: () => {
        const next = new Date();
        next.setDate(next.getDate() + 1);
        next.setHours(9, 0, 0, 0);
        change(
          item,
          { snoozedUntil: next.toISOString() },
          "Snoozed until tomorrow",
        );
      },
    });
  }
  const closeCapture = () => {
    if (capture)
      setDialog({
        title: "Close capture?",
        body: "Any unsaved changes in this form will be discarded.",
        label: "Discard changes",
        action: () => setCapture(null),
      });
  };
  function sheet(
    visible: boolean,
    title: string,
    onClose: () => void,
    children: React.ReactNode,
  ) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[styles.sheet, { backgroundColor: c.bg }]}
          >
            <View
              style={[
                styles.row,
                {
                  padding: 22,
                  borderBottomWidth: 1,
                  borderBottomColor: c.line,
                  justifyContent: "space-between",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 23,
                  fontWeight: "600",
                  color: c.ink,
                  flex: 1,
                }}
              >
                {title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close dialog"
                onPress={onClose}
                style={{ padding: 12 }}
              >
                <Icon name="x" />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 22, gap: 18 }}
            >
              {children}
              {!!flow.error && (
                <Text accessibilityRole="alert" style={{ color: c.danger }}>
                  {flow.error}
                </Text>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }
  function empty() {
    return (
      <View style={[styles.empty, { borderColor: c.line }]}>
        <View style={[styles.emptyIcon, { backgroundColor: c.soft }]}>
          <Icon
            name={query ? "search" : screen === "Inbox" ? "inbox" : "feather"}
            size={28}
          />
        </View>
        <Text style={{ fontSize: 22, color: c.ink, fontWeight: "600" }}>
          {query
            ? "Nothing found"
            : screen === "Today"
              ? "A little room to breathe."
              : `Your ${screen.toLowerCase()} is clear.`}
        </Text>
        <Label muted>
          {query
            ? "Try a different word, person or link."
            : screen === "Inbox"
              ? "Share text or a link from another app, or capture something for later review."
              : "Capture a task, a thought, or something you don’t want to forget."}
        </Label>
        {!query && (
          <Button
            title="Capture something"
            icon="plus"
            primary
            onPress={() => setCapture({})}
          />
        )}
      </View>
    );
  }
  const settingsContent = (
    <View style={{ gap: 22 }}>
      <Label>
        Your space, your choice. DailyFlow processes date suggestions on this
        device. No cloud AI, ads or analytics are included.
      </Label>
      <Label small muted>
        APPEARANCE
      </Label>
      <AnimatedToggle label="Dark mode" value={isDark} onChange={(enabled) => { const value = enabled ? "dark" : "light"; setTheme(value); void run(() => preferences.set("theme", value)); }} />
      <Choice
        options={["light", "dark", "system"]}
        value={theme}
        onChange={(value) => {
          setTheme(value);
          void run(() => preferences.set("theme", value));
        }}
      />
      <AppearanceSettings />
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <Label>Device reminders</Label>
          <Label small muted>
            {Platform.OS === "web"
              ? "Available in the Android app"
              : "Only for items you save with a date"}
          </Label>
        </View>
        <Switch
          accessibilityLabel="Device reminders"
          value={reminders}
          disabled={Platform.OS === "web" || busy}
          onValueChange={(value) =>
            void run(async () => {
              if (value && !(await enableReminders())) {
                notify("Notification permission was not granted.");
                return;
              }
              await preferences.set("reminders", String(value));
              setReminders(value);
            })
          }
        />
      </View>
      <View style={{ gap: 8 }}>
        <Label small muted>
          On Android, scheduled reminders appear in the notification bar even
          when DailyFlow is in the background or closed. The app must be opened
          after creating or changing a task so its reminder can be scheduled.
        </Label>
        <Button
          title="Send test notification"
          icon="bell"
          disabled={Platform.OS === "web" || busy}
          onPress={() =>
            void run(async () => {
              await sendTestReminder();
              notify("Test notification scheduled for about 3 seconds from now.");
            })
          }
        />
      </View>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1 }}>
          <Label>Quiet hours · 9 PM–8 AM</Label>
          <Label small muted>
            Night reminders move to the next 8 AM.
          </Label>
        </View>
        <Switch
          accessibilityLabel="Quiet hours"
          value={quiet}
          onValueChange={(value) =>
            void run(async () => {
              await preferences.set("quiet", String(value));
              setQuiet(value);
            })
          }
        />
      </View>
      <Label small muted>
        DATA & PRIVACY
      </Label>
      <Label muted>
        {flow.session
          ? `Cloud sync is on for ${flow.session.user.email}. Tasks, notes and files are stored in your private Supabase account. A local task cache is also kept on this device.`
          : "Cloud sync is off. Your items are stored only on this device or browser. Clearing browser storage or uninstalling the app removes them."}
      </Label>
      <Label small muted>
        DailyFlow cannot read your messages, notifications, clipboard, contacts
        or files in the background. Share-sheet capture only receives text and
        links you choose to share.
      </Label>
      <View style={ui.wrap}>
        <Button
          title="Export backup"
          icon="download"
          disabled={busy}
          onPress={() => void run(() => exportBackup(flow.items))}
        />
        <Button
          title="Import backup"
          icon="upload"
          disabled={busy}
          onPress={() =>
            void run(async () => {
              const items = await readBackup();
              if (items)
                setDialog({
                  title: "Import backup?",
                  body: `Add ${items.filter((i) => !i.deletedAt).length} items as new copies? Existing items will stay.`,
                  label: "Import copies",
                  action: () => {
                    flow.importItems(items);
                    notify("Backup imported");
                  },
                });
            })
          }
        />
      </View>
      <Label small muted>
        GETTING STARTED
      </Label>
      <Button
        title="Open the DailyFlow guide"
        icon="book-open"
        onPress={() => {
          setSettings(false);
          setTutorial(true);
        }}
      />
      {flow.session ? (
        <>
          <Label small muted>
            ACCOUNT
          </Label>
          <Label>{flow.session.user.email}</Label>
          <Button
            title="Import items from the previous app"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await flow.importLegacy();
                notify("Previous items imported as copies");
              })
            }
          />
          <Label small muted>
            {flow.syncMessage}
            {flow.pending ? ` · ${flow.pending} pending change(s)` : ""}
          </Label>
          <View style={ui.wrap}>
            <Button
              title={flow.syncing ? "Syncing…" : "Sync now"}
              disabled={flow.syncing || busy}
              onPress={() => void flow.sync()}
            />
            <Button
              title="Sign out"
              disabled={busy || flow.syncing || flow.pending > 0}
              onPress={() =>
                setDialog({
                  title: "Sign out?",
                  body: "Synced account data will be removed from this device and you’ll return to sign in.",
                  label: "Sign out",
                  action: () => flow.disconnect(),
                })
              }
            />
          </View>
          {flow.pending > 0 && (
            <Label small muted>
              Sync pending changes before signing out, or export a backup for
              safekeeping.
            </Label>
          )}
          <Button
            title="Delete account and cloud data"
            danger
            onPress={() => {
              setSettings(false);
              setDeleteModal(true);
            }}
          />
        </>
      ) : (
        <>
          <Button
            title="Connect an account"
            icon="cloud"
            onPress={() => {
              setSettings(false);
              setAccount(true);
            }}
          />
          <Button
            title="Clear device-only data"
            danger
            disabled={busy}
            onPress={() =>
              setDialog({
                title: "Clear this device?",
                body: "All device-only tasks and notes will be permanently removed. Export a backup first if you want to keep them.",
                label: "Delete local data",
                danger: true,
                action: () => flow.clearLocal(),
              })
            }
          />
        </>
      )}
      <Label small muted>
        Version {Constants.expoConfig?.version ?? "1.0.4"} · DailyFlow
      </Label>
    </View>
  );
  if (auth.loading || !auth.session)
    return (
      <Theme.Provider value={c}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#11150F" }}>
          <StatusBar style="light" />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 24,
            }}
          >
            <View
              style={{
                width: "100%",
                maxWidth: 980,
                alignSelf: "center",
                gap: 24,
              }}
            >
              {auth.loading ? <Skeleton /> : <Account />}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Theme.Provider>
    );
  return (
    <Theme.Provider value={c}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style={c === dark ? "light" : "dark"} />
        <ShareCapture
          ready={flow.ready}
          onCapture={(shared) => setCapture({ shared })}
          onError={notify}
        />
        <View style={{ flex: 1, flexDirection: "row" }}>
          {wide && (
            <View style={[styles.sidebar, { borderColor: c.line }]}>
              <View style={[styles.row, { marginBottom: 40 }]}>
                <View style={styles.logo}>
                  <Icon name="wind" size={24} color="#E3EDCE" />
                </View>
                <Text style={[styles.brand, { color: c.ink }]}>
                  DailyFlow<Text style={{ color: c.brand }}>·</Text>
                </Text>
              </View>
              <Label small muted>
                YOUR DAILY SPACE
              </Label>
              <View style={{ gap: 8, marginTop: 16 }}>
                {screens
                  .filter((s) => s.name !== "More")
                  .map((n) => (
                    <Pressable
                      key={n.name}
                      accessibilityRole="button"
                      onPress={() => select(n.name)}
                      style={[
                        styles.nav,
                        {
                          backgroundColor:
                            screen === n.name ? c.soft : "transparent",
                        },
                      ]}
                    >
                      <Icon name={n.icon} size={19} />
                      <Text
                        style={{
                          flex: 1,
                          color: c.ink,
                          fontWeight: screen === n.name ? "600" : "400",
                        }}
                      >
                        {n.name}
                      </Text>
                      {n.name === "Inbox" && !!inbox.length && (
                        <Label small>{inbox.length}</Label>
                      )}
                    </Pressable>
                  ))}
              </View>
              <View style={{ flex: 1 }} />
              <View style={[styles.sidebarNote, { backgroundColor: c.soft }]}>
                <Icon name="feather" />
                <Label>One thing at a time.</Label>
                <Label small muted>
                  You don’t have to hold it all in your head.
                </Label>
              </View>
              <Button
                title="Privacy & settings"
                icon="settings"
                onPress={() => setSettings(true)}
              />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={[styles.topbar, { borderColor: c.line }]}>
              {!wide && (
                <View style={styles.row}>
                  <Icon name="wind" color={c.brand} />
                  <Text style={[styles.brand, { fontSize: 20, color: c.ink }]}>
                    DailyFlow
                  </Text>
                </View>
              )}
              {wide && (
                <Label small muted>
                  YOUR SPACE TO THINK CLEARLY
                </Label>
              )}
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open privacy and settings"
                  onPress={() => setSettings(true)}
                  style={{ padding: 10 }}
                >
                  <Icon name={flow.session ? "cloud" : "shield"} size={18} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={profile?.display_name ? `${profile.display_name}'s avatar` : "Your avatar"}
                  accessibilityHint={flow.session ? "Opens your profile" : "Opens account sign in"}
                  onPress={() => flow.session ? setProfileOpen(true) : setAccount(true)}
                  style={[styles.avatar, { backgroundColor: c.soft }]}
                >
                  {profile?.avatar && profile.avatar !== "initials" ? (
                    <Icon name={profile.avatar} size={18} color={c.brand} />
                  ) : (
                    <Text style={{ fontWeight: "600", color: c.ink }}>
                      {profile?.display_name
                        ?.split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase() ||
                        flow.session?.user.email?.[0]?.toUpperCase() ||
                        "D"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.content,
                { padding: wide ? 40 : 20 },
              ]}
            >
              <View style={styles.heading}>
                <View style={{ flex: 1, gap: 10 }}>
                  <Label small muted>
                    {now
                      .toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })
                      .toUpperCase()}
                  </Label>
                  <Text
                    accessibilityRole="header"
                    style={[
                      styles.title,
                      { color: c.ink, fontSize: wide ? 38 : 30 },
                    ]}
                  >
                    {title}
                  </Text>
                  <Label muted>
                    {query
                      ? `${matches.length} matching item${matches.length === 1 ? "" : "s"}`
                      : screens.find((n) => n.name === screen)?.description}
                  </Label>
                </View>
                {wide && (
                  <Button
                    title="Quick capture"
                    primary
                    icon="plus"
                    disabled={!flow.ready}
                    onPress={() => setCapture({})}
                  />
                )}
              </View>
              <View
                style={[
                  styles.search,
                  { borderColor: c.line, backgroundColor: c.surface },
                ]}
              >
                <Icon name="search" size={18} color={c.muted} />
                <TextInput
                  accessibilityLabel="Search all tasks, notes and people"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Find a task, note, person or link…"
                  placeholderTextColor={c.muted}
                  style={{
                    flex: 1,
                    color: c.ink,
                    paddingVertical: 12,
                    fontSize: 14,
                  }}
                />
                {!!query && (
                  <Pressable
                    accessibilityLabel="Clear search"
                    accessibilityRole="button"
                    style={{ padding: 12 }}
                    onPress={() => setQuery("")}
                  >
                    <Icon name="x" size={17} />
                  </Pressable>
                )}
              </View>
              {!!flow.error && (
                <View
                  accessibilityRole="alert"
                  style={[
                    styles.card,
                    { backgroundColor: c.surface, borderColor: c.danger },
                  ]}
                >
                  <Text style={{ color: c.danger }}>{flow.error}</Text>
                  {flow.ready && (
                    <Button title="Dismiss" onPress={() => flow.setError("")} />
                  )}
                </View>
              )}
              {!flow.ready && !flow.error ? (
                <ActivityIndicator
                  accessibilityLabel="Loading your items"
                  color={c.brand}
                />
              ) : (
                flow.ready && (
                  <>
                    {!query && screen === "Today" ? (
                      <TodayDashboard {...dashboardActions} />
                    ) : !query && screen === "More" ? (
                      <View style={{ gap: 12 }}>
                        {screens
                          .filter(
                            (n) =>
                              !["Today", "Inbox", "Waiting", "More"].includes(
                                n.name,
                              ),
                          )
                          .map((n) => (
                            <Pressable
                              key={n.name}
                              accessibilityRole="button"
                              onPress={() => select(n.name)}
                              style={[
                                styles.card,
                                styles.row,
                                {
                                  backgroundColor: c.surface,
                                  borderColor: c.line,
                                },
                              ]}
                            >
                              <Icon name={n.icon} />
                              <View style={{ flex: 1 }}>
                                <Label>{n.name}</Label>
                                <Label small muted>
                                  {n.description}
                                </Label>
                              </View>
                              <Icon name="chevron-right" size={18} />
                            </Pressable>
                          ))}
                        <Button
                          title="Getting started guide"
                          icon="book-open"
                          onPress={() => setTutorial(true)}
                        />
                        <Button
                          title="Privacy & settings"
                          icon="settings"
                          onPress={() => setSettings(true)}
                        />
                      </View>
                    ) : !query && screen === "Waiting" ? (
                      <WaitingPanel {...dashboardActions} />
                    ) : !query && screen === "Files" ? (
                      <Suspense fallback={<Skeleton />}>
                        <Files />
                      </Suspense>
                    ) : !query && screen === "Downloads" ? (
                      <Suspense fallback={<Skeleton />}>
                        <Releases />
                      </Suspense>
                    ) : sorted.length ? (
                      <View style={{ gap: 12 }}>
                        {sorted.slice(0, limit).map((item) => (
                          <TaskMotion key={item.id} done={item.status === "completed" || item.status === "archived"} onComplete={() => dashboardActions.onComplete(item)} onTomorrow={item.kind === "task" ? () => dashboardActions.onMoveTomorrow(item) : undefined} onFocus={item.kind === "task" && item.status === "active" ? () => focusItem(item) : undefined}>
                          {(complete) => <ItemCard
                            item={item}
                            items={flow.items}
                            now={now}
                            onEdit={() => setCapture({ item })}
                            onAccept={() => setCapture({ item })}
                            onComplete={complete}
                            onSnooze={() => snooze(item)}
                            onArchive={() =>
                              change(
                                item,
                                { status: "archived", archivedAt: now.toISOString(), focusDate: null, focusOrder: null, snoozedUntil: null },
                                "Item archived",
                              )
                            }
                          />}
                          </TaskMotion>
                        ))}
                        {sorted.length > limit && (
                          <Button
                            title="Load more items"
                            onPress={() => setLimit((n) => n + 50)}
                          />
                        )}
                      </View>
                    ) : (
                      empty()
                    )}
                    {!query && screen === "Inbox" && (
                      <Label small muted>
                        Review each captured item, then choose Active, Waiting,
                        or Archive. Nothing becomes a reminder until you choose.
                      </Label>
                    )}
                    {!query && screen === "Schedule" && (
                      <Label small muted>
                        This agenda shows deadlines and follow-up dates saved in
                        DailyFlow. External calendars are not connected.
                      </Label>
                    )}
                    <View
                      style={[
                        styles.row,
                        { justifyContent: "center", paddingVertical: 15 },
                      ]}
                    >
                      <Icon name="shield" size={12} color={c.muted} />
                      <Label small muted>
                        {flow.session
                          ? flow.syncMessage
                          : "Your space is private. Saved on this device."}
                      </Label>
                    </View>
                  </>
                )
              )}
            </ScrollView>
            {!wide && (
              <View
                style={[
                  styles.bottom,
                  { backgroundColor: c.surface, borderColor: c.line },
                ]}
              >
                {(
                  ["Today", "Inbox", "Capture", "Waiting", "More"] as const
                ).map((n) => (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={n}
                    disabled={!flow.ready}
                    onPress={() =>
                      n === "Capture" ? setCapture({}) : select(n)
                    }
                    style={styles.bottomItem}
                  >
                    {n === "Capture" ? (
                      <View
                        style={[
                          styles.captureButton,
                          { backgroundColor: c.brand },
                        ]}
                      >
                        <Icon name="plus" color={c.bg} />
                      </View>
                    ) : (
                      <Icon
                        name={screens.find((s) => s.name === n)!.icon}
                        color={screen === n ? c.brand : c.muted}
                      />
                    )}
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "600",
                        color: screen === n ? c.brand : c.muted,
                      }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
        {!!toast && (
          <View
            accessibilityLiveRegion="polite"
            style={[styles.toast, { backgroundColor: c.ink }]}
          >
            <Text style={{ color: c.bg, flex: 1 }}>{toast.text}</Text>
            {toast.undo && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.undo?.();
                  setToast(null);
                }}
                style={{ padding: 10 }}
              >
                <Text style={{ color: c.bg, fontWeight: "700" }}>Undo</Text>
              </Pressable>
            )}
          </View>
        )}
        {sheet(
          !!capture,
          capture?.item ? "Item details" : "Make space in your head",
          closeCapture,
          capture && (
            <Capture
              key={capture.item?.id ?? capture.shared ?? "new"}
              item={capture.item}
              shared={capture.shared}
              items={flow.items}
              onSave={(item) => {
                flow.put(item);
                setCapture(null);
                notify("Saved to your flow");
              }}
              onCancel={closeCapture}
            />
          ),
        )}
        {sheet(
          tutorial,
          "Welcome to DailyFlow",
          closeTutorial,
          <Suspense fallback={<Skeleton />}>
            <Onboarding onDone={closeTutorial} />
          </Suspense>,
        )}
        {sheet(
          account,
          "Your DailyFlow account",
          () => setAccount(false),
          <Account
            onConnect={() => {
              setAccount(false);
              notify("Account connected");
            }}
          />,
        )}
        {sheet(
          profileOpen,
          "Your profile",
          () => setProfileOpen(false),
          <Suspense fallback={<Skeleton />}>
            <Profile />
          </Suspense>,
        )}
        {sheet(
          settings,
          "Privacy & settings",
          () => setSettings(false),
          settingsContent,
        )}
        {sheet(
          deleteModal,
          "Delete your account",
          () => setDeleteModal(false),
          <>
            <Label>
              This permanently deletes the account and all cloud items. It also
              clears this account’s data from this device. Other offline devices
              may retain their local copies until cleared.
            </Label>
            <Field
              label="Confirm your password"
              value={deletePassword}
              onChangeText={setDeletePassword}
              secureTextEntry
            />
            <Button
              title="Permanently delete account"
              danger
              disabled={busy || !deletePassword || flow.syncing}
              onPress={() =>
                void run(async () => {
                  if (!flow.session) return;
                  await deleteAccount(
                    flow.session.access_token,
                    deletePassword,
                  );
                  await flow.disconnect(true);
                  setDeletePassword("");
                  setDeleteModal(false);
                  notify("Account and cloud data deleted");
                })
              }
            />
          </>,
        )}
        {sheet(
          !!dialog,
          dialog?.title ?? "",
          () => !busy && setDialog(null),
          dialog && (
            <>
              <Label>{dialog.body}</Label>
              <Button
                title={busy ? "Please wait…" : dialog.label}
                primary={!dialog.danger}
                danger={dialog.danger}
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    await dialog.action();
                    setDialog(null);
                  })
                }
              />
              <Button
                title="Cancel"
                disabled={busy}
                onPress={() => setDialog(null)}
              />
            </>
          ),
        )}
      </SafeAreaView>
    </Theme.Provider>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  sidebar: { width: 245, borderRightWidth: 1, padding: 25, gap: 16 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#203F34",
    alignItems: "center",
    justifyContent: "center",
  },
  brand: { fontSize: 24, fontWeight: "700", letterSpacing: -1 },
  nav: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 15,
    borderRadius: 12,
  },
  sidebarNote: { padding: 18, borderRadius: 16, gap: 10, marginBottom: 8 },
  topbar: {
    height: 76,
    paddingHorizontal: 25,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    maxWidth: 1120,
    width: "100%",
    alignSelf: "center",
    gap: 24,
    paddingBottom: 50,
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 20 },
  title: { fontWeight: "600", letterSpacing: -1.2, lineHeight: 44 },
  search: {
    borderWidth: 1,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
  },
  brief: { padding: 26, borderRadius: 20, gap: 16 },
  tag: { flexDirection: "row", gap: 6, alignItems: "center" },
  stat: { fontSize: 28, fontWeight: "600", marginBottom: 4 },
  card: { padding: 18, borderWidth: 1, borderRadius: 16, gap: 12 },
  check: {
    width: 28,
    height: 28,
    borderWidth: 1.5,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 20,
    padding: 32,
    gap: 16,
    alignItems: "flex-start",
  },
  emptyIcon: {
    height: 56,
    width: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 9 },
  bottomItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    minHeight: 56,
  },
  captureButton: {
    width: 42,
    height: 35,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(9,24,20,.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: Platform.OS === "web" ? 20 : 10,
  },
  sheet: {
    width: "100%",
    maxWidth: 620,
    maxHeight: "92%",
    borderRadius: 24,
    overflow: "hidden",
  },
  toast: {
    position: "absolute",
    bottom: 88,
    left: 20,
    right: 20,
    maxWidth: 600,
    alignSelf: "center",
    borderRadius: 15,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});

