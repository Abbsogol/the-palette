import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LabShell, LabButton, LabMessage } from "../lab-ui/primitives";
import { HomeIcon } from "../home/home-primitives";
import { homeAssets } from "../home/assets";
import { profileAssets } from "../profiles/assets";
import { typography } from "../../theme/typography";
import {
  activityDay,
  activityDetails,
  activityTime,
  type Activity,
  type PushState,
} from "./model";
export type NotificationViewProps = {
  items: Activity[];
  device: PushState;
  loading?: boolean;
  error?: boolean;
  hasMore?: boolean;
  busy?: boolean;
  actionError?: string;
  notice?: string;
  preview?: boolean;
  width?: number;
  now?: number;
  onBack: () => void;
  onRefresh: () => void;
  onOlder: () => void;
  onOpen: (n: Activity) => void;
  onRead: (ids: string[], read: boolean) => void;
  onEnable: () => void;
  onDisable: () => void;
  onCheck: () => void;
  onSettings: () => void;
};
export function NotificationsView(p: NotificationViewProps) {
  const inset = useSafeAreaInsets();
  const [section, setSection] = useState("Activity"),
    [filter, setFilter] = useState("All");
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const unread = p.items.filter((n) => !n.read),
    items = filter === "Unread" ? unread : p.items,
    now = p.now ?? clock;
  const state = p.device.state;
  const deviceTitle =
    state === "checking"
      ? "Checking this device…"
      : state === "enabled"
        ? "Device alerts are on"
        : state === "quiet"
          ? "Quiet notifications are on"
          : state === "off"
            ? "Device alerts are off"
            : state === "denied"
              ? "Blocked in device settings"
              : state === "unavailable"
                ? "Device alerts unavailable"
                : "Status unavailable";
  const deviceBody =
    state === "enabled"
      ? "Get message and booking alerts for this account on this device."
      : state === "quiet"
        ? "Alerts arrive quietly. Choose banners or sounds in your device settings."
        : state === "off"
          ? "Enable alerts to stay up to date with messages and appointments."
          : state === "denied"
            ? "LaQue can’t show alerts with your current permission. Allow notifications in your device settings, then return and enable them here."
            : state === "unavailable"
              ? p.device.reason ||
                "Use the LaQue app on a physical iPhone or Android device."
              : state === "unknown"
                ? "We couldn’t confirm the current setting. Check your connection and try again."
                : "Your activity remains available while we check notification permission and this device’s registration.";
  return (
    <LabShell width={p.width} dark>
      <View style={[s.header, { paddingTop: inset.top + 14 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back from notifications"
          onPress={p.onBack}
          style={s.back}
        >
          <Text style={s.arrow}>‹</Text>
        </Pressable>
        <Text accessibilityRole="header" style={s.heading}>
          Notifications
        </Text>
        {!!unread.length && (
          <View style={s.count}>
            <Text style={s.countText}>{unread.length}</Text>
          </View>
        )}
      </View>
      <View accessibilityRole="tablist" style={s.tabs}>
        {["Activity", "Preferences"].map((name) => (
          <Pressable
            key={name}
            accessibilityRole="tab"
            accessibilityState={{ selected: section === name }}
            onPress={() => setSection(name)}
            style={[s.tab, section === name && s.activeTab]}
          >
            <Text style={[s.tabText, section === name && s.activeText]}>
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
      <ScrollView
        contentContainerStyle={[
          s.body,
          { paddingBottom: Math.max(inset.bottom, 24) },
        ]}
      >
        {p.preview && (
          <LabMessage>
            Design preview · sample activity and settings only. No notifications
            are sent.
          </LabMessage>
        )}
        {!!p.notice && <LabMessage>{p.notice}</LabMessage>}
        {!!p.actionError && <LabMessage error>{p.actionError}</LabMessage>}
        {section === "Activity" ? (
          <>
            <View style={s.summary}>
              <Text style={s.section}>Your activity</Text>
              <Text style={s.muted}>
                {unread.length
                  ? `${unread.length} unread in recent activity`
                  : "Messages, bookings and your design community"}
              </Text>
            </View>
            <View style={s.tools}>
              <View style={s.filters}>
                {["All", "Unread"].map((name) => (
                  <Pressable
                    key={name}
                    accessibilityRole="button"
                    accessibilityLabel={`${name} activity`}
                    accessibilityState={{ selected: filter === name }}
                    onPress={() => setFilter(name)}
                    style={[s.filter, filter === name && s.activeFilter]}
                  >
                    <Text style={s.small}>{name}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh activity"
                disabled={p.loading || p.busy}
                onPress={p.onRefresh}
                style={s.textButton}
              >
                <Text style={s.link}>Refresh</Text>
              </Pressable>
            </View>
            {!!unread.length && (
              <Pressable
                accessibilityRole="button"
                disabled={p.busy || p.loading}
                accessibilityState={{ disabled: !!p.busy || !!p.loading }}
                onPress={() =>
                  p.onRead(
                    unread.map((n) => n.id),
                    true,
                  )
                }
                style={[s.textButton, { alignSelf: "flex-end" }]}
              >
                <Text style={s.link}>Mark shown as read</Text>
              </Pressable>
            )}
            {p.loading && !p.items.length && (
              <View style={s.empty}>
                <ActivityIndicator color="#ffc8dd" />
                <Text style={s.muted}>Loading activity…</Text>
              </View>
            )}
            {p.error && (
              <View style={s.empty}>
                <Text style={s.section}>Activity couldn’t be refreshed</Text>
                <Text style={s.muted}>
                  Check your connection and try again.
                  {p.items.length ? " Your last loaded activity is below." : ""}
                </Text>
                <LabButton
                  title="Retry activity"
                  secondary
                  onPress={p.onRefresh}
                  disabled={p.loading}
                />
              </View>
            )}
            {!p.loading && !p.error && !items.length && (
              <View style={s.empty}>
                <HomeIcon source={homeAssets.bell} size={32} />
                <Text style={s.section}>
                  {filter === "Unread"
                    ? "No unread activity here"
                    : "No activity yet"}
                </Text>
                <Text style={s.muted}>
                  {filter === "Unread"
                    ? "Everything on this page has been read. You can check older activity below."
                    : "Messages, booking updates, followers and design activity will appear here."}
                </Text>
              </View>
            )}
            {items.map((n, index) => {
              const d = activityDetails(n),
                day = activityDay(n.created_at, now),
                showDay =
                  index === 0 ||
                  activityDay(items[index - 1].created_at, now) !== day;
              const icon =
                d.kind === "message"
                  ? homeAssets.messages
                  : d.kind === "booking"
                    ? profileAssets.calendar
                    : d.kind === "design"
                      ? homeAssets.heart
                      : d.kind === "follow"
                        ? homeAssets.profile
                        : d.kind === "collection"
                          ? profileAssets.folder
                          : homeAssets.bell;
              return (
                <View key={n.id} style={{ gap: 10 }}>
                  {showDay && (
                    <Text accessibilityRole="header" style={s.day}>
                      {day}
                    </Text>
                  )}
                  <View style={[s.card, !n.read && s.unread]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${n.read ? "Read" : "Unread"}: ${d.title}. ${d.body}. ${activityTime(n.created_at, now)}. ${d.path ? d.label : "Link unavailable"}`}
                      disabled={p.busy || !d.path}
                      accessibilityState={{ disabled: !!p.busy || !d.path }}
                      onPress={() => p.onOpen(n)}
                      style={s.row}
                    >
                      <View style={s.avatar}>
                        {n.actor?.avatar_url ? (
                          <Image
                            source={{ uri: n.actor.avatar_url }}
                            cachePolicy="memory"
                            contentFit="cover"
                            style={s.avatarImage}
                            accessible={false}
                          />
                        ) : (
                          <HomeIcon source={icon} size={22} />
                        )}
                        <View style={s.kindBadge}>
                          <HomeIcon source={icon} size={11} />
                        </View>
                      </View>
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={s.rowTitle}>
                          <Text style={s.title}>{d.title}</Text>
                          {!n.read && <View accessible={false} style={s.dot} />}
                        </View>
                        <Text style={s.bodyText}>{d.body}</Text>
                        <Text style={s.time}>
                          {activityTime(n.created_at, now)} ·{" "}
                          {n.read ? "Read" : "Unread"}
                        </Text>
                        <Text style={s.link}>
                          {d.path ? `${d.label} ›` : "Link unavailable"}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mark ${d.title} ${n.read ? "unread" : "read"}`}
                      accessibilityState={{ disabled: !!p.busy }}
                      disabled={p.busy}
                      onPress={() => p.onRead([n.id], !n.read)}
                      style={s.readAction}
                    >
                      <Text style={s.small}>
                        {n.read ? "Mark unread" : "Mark read"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {p.hasMore && (
              <LabButton
                title="Load older activity"
                secondary
                disabled={p.loading || p.busy}
                onPress={p.onOlder}
              />
            )}
          </>
        ) : (
          <>
            <Text style={s.section}>Alerts on this device</Text>
            <Text style={s.muted}>
              These settings apply to this account on this device. They don’t
              change your in-app activity.
            </Text>
            <View style={s.preferenceCard}>
              <View style={s.deviceHeading}>
                <HomeIcon source={homeAssets.bell} size={24} />
                <Text style={s.section}>{deviceTitle}</Text>
              </View>
              <Text style={s.bodyText}>{deviceBody}</Text>
              {!!p.device.reason && state !== "unavailable" && (
                <LabMessage>{p.device.reason}</LabMessage>
              )}
              {state === "checking" ? (
                <ActivityIndicator color="#ffc8dd" />
              ) : state === "off" ? (
                <LabButton
                  title="Enable notifications"
                  busy={p.busy}
                  onPress={p.onEnable}
                />
              ) : state === "denied" ? (
                <LabButton
                  title="Open device settings"
                  busy={p.busy}
                  onPress={p.onSettings}
                />
              ) : state === "unknown" ? (
                <LabButton
                  title="Check device status"
                  busy={p.busy}
                  onPress={p.onCheck}
                />
              ) : null}
              {(p.device.registered || state === "unknown") && (
                <LabButton
                  title="Disable on this device"
                  secondary
                  disabled={p.busy}
                  onPress={p.onDisable}
                />
              )}
              {["enabled", "quiet", "off"].includes(state) && (
                <LabButton
                  title="Open device settings"
                  secondary
                  disabled={p.busy}
                  onPress={p.onSettings}
                />
              )}
              {state !== "checking" &&
                state !== "unavailable" &&
                state !== "unknown" && (
                  <LabButton
                    title="Check device status"
                    secondary
                    disabled={p.busy}
                    onPress={p.onCheck}
                  />
                )}
            </View>
            <View style={s.preferenceCard}>
              <Text style={s.section}>Your activity stays here</Text>
              <Text style={s.bodyText}>
                You can view messages, bookings and design activity in LaQue
                even when device alerts are off.
              </Text>
            </View>
            <View style={s.preferenceCard}>
              <Text style={s.section}>Private on your lock screen</Text>
              <Text style={s.bodyText}>
                Alerts keep message and appointment details private. Open LaQue
                to see the full update.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </LabShell>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#996878",
    justifyContent: "center",
    alignItems: "center",
  },
  arrow: { fontSize: 30, color: "white" },
  heading: {
    ...typography.heading,
    fontSize: 31,
    lineHeight: 38,
    color: "white",
    flex: 1,
  },
  count: {
    backgroundColor: "#ff4e83",
    borderRadius: 16,
    minWidth: 26,
    padding: 5,
    alignItems: "center",
  },
  countText: { ...typography.caption, color: "white" },
  tabs: {
    marginHorizontal: 24,
    flexDirection: "row",
    backgroundColor: "rgba(30,4,15,.25)",
    borderRadius: 24,
    padding: 4,
    gap: 4,
  },
  tab: {
    minHeight: 44,
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: {
    backgroundColor: "rgba(255,161,194,.2)",
    borderWidth: 1,
    borderColor: "rgba(255,218,230,.3)",
  },
  tabText: { ...typography.body, color: "#e1b6c5" },
  activeText: { color: "white" },
  body: { padding: 24, gap: 18 },
  summary: { gap: 8 },
  section: { ...typography.section, color: "white", flexShrink: 1 },
  muted: { ...typography.caption, color: "#edc2d2" },
  tools: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  filters: { flexDirection: "row", gap: 8 },
  filter: {
    paddingHorizontal: 17,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#98717f",
    justifyContent: "center",
  },
  activeFilter: { backgroundColor: "#a12650", borderColor: "#d15580" },
  small: { ...typography.caption, color: "#ffe2ed" },
  textButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  link: { ...typography.caption, color: "#ffcee0" },
  day: { ...typography.caption, color: "#edbccf", marginTop: 6 },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.17)",
    backgroundColor: "rgba(255,255,255,.04)",
    padding: 16,
  },
  unread: {
    borderColor: "rgba(255,139,179,.5)",
    backgroundColor: "rgba(255,135,177,.10)",
  },
  row: { flexDirection: "row", gap: 14 },
  avatar: {
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: "#703144",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { height: 46, width: 46, borderRadius: 23 },
  kindBadge: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: "#8b3152",
    borderWidth: 1,
    borderColor: "#e6adc3",
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: {
    ...typography.caption,
    fontSize: 16,
    lineHeight: 22,
    color: "white",
    flex: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#ff689c" },
  bodyText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: "#f1d2de",
  },
  time: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 17,
    color: "#e3b5c7",
  },
  readAction: {
    minHeight: 44,
    alignSelf: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 8,
    marginTop: 4,
  },
  empty: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "#845466",
    gap: 16,
    alignItems: "flex-start",
  },
  preferenceCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.055)",
    padding: 20,
    gap: 16,
  },
  deviceHeading: { flexDirection: "row", gap: 12, alignItems: "center" },
});
