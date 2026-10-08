import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeIcon } from "../home/home-primitives";
import { LabButton, LabMessage, LabSheet } from "../lab-ui/primitives";
import { searchAssets } from "../search/assets";
import { appFonts, typography } from "../../theme/typography";
import { chatAssets } from "./assets";
import {
  joinedMessages,
  messageDay,
  type ChatAction,
  type ChatAppointment,
  type ChatContact,
  type ChatMessage,
} from "./model";

export type ChatViewProps = {
  width?: number;
  contact?: ChatContact;
  messages: ChatMessage[];
  appointment?: ChatAppointment;
  connection?: string;
  loading?: boolean;
  error?: string;
  actionError?: string;
  busy?: boolean;
  refreshing?: boolean;
  favorite?: boolean;
  muted?: boolean;
  pending?: boolean;
  ready?: boolean;
  hasMore?: boolean;
  draft: string;
  attachment?: ImageSource | null;
  onDraft: (text: string) => void;
  onRemoveAttachment: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onMore: () => void;
  onSend: () => void;
  onAction: (action: ChatAction, id?: string) => void;
  preview?: boolean;
};
const gradient = ["#660007", "#660007", "#ff517f"] as const;
function Avatar({
  contact,
  large = false,
}: {
  contact?: ChatContact;
  large?: boolean;
}) {
  const size = large ? 56 : 36;
  return (
    <LinearGradient
      colors={gradient}
      locations={[0, 0.48, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {contact?.avatar ? (
        <Image
          source={contact.avatar}
          accessibilityLabel={`${contact.name} profile photo`}
          cachePolicy="none"
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <Text style={[s.text, { fontSize: large ? 22 : 15, color: "white" }]}>
          {contact?.name[0]?.toUpperCase() || "?"}
        </Text>
      )}
    </LinearGradient>
  );
}
function Touch({
  label,
  onPress,
  children,
  disabled,
}: {
  label: string;
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      style={[s.touch, disabled && { opacity: 0.4 }]}
    >
      {children}
    </Pressable>
  );
}
export function ChatView(p: ChatViewProps) {
  const window = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const width =
    p.width ??
    (Platform.OS === "web" ? Math.min(window.width, 393) : window.width);
  const [options, setOptions] = useState(false),
    [search, setSearch] = useState<string | null>(null),
    [media, setMedia] = useState(false),
    [attach, setAttach] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "delete" | "discard" | null>(
      null,
    ),
    [photo, setPhoto] = useState<ImageSource | null>(null);
  const [inputHeight, setInputHeight] = useState(38);
  const scroll = useRef<ScrollView>(null),
    nearBottom = useRef(true),
    lastId = useRef(p.messages.at(-1)?.id);
  const openOptions = () => {
    Keyboard.dismiss();
    setOptions(true);
  };
  const act = (action: ChatAction, id?: string) => {
    setOptions(false);
    p.onAction(action, id);
  };
  const messages = p.messages.filter(
    (m) =>
      (!media || m.image || m.design || m.location) &&
      (search === null ||
        `${m.text} ${m.design?.title || ""} ${m.location?.name || ""}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  const creator = p.contact?.role === "creator" || p.contact?.role === "salon";
  const row = (
    label: string,
    icon: number,
    onPress: () => void,
    tone?: string,
  ) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={p.busy || !p.contact}
      onPress={onPress}
      style={s.menuRow}
    >
      <HomeIcon source={icon} size={16} />
      <Text style={[s.menuText, tone ? { color: tone } : null]}>{label}</Text>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
  return (
    <View style={s.outer}>
      <View style={{ flex: 1, width }}>
        <Image
          source={searchAssets.background}
          contentFit="cover"
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <LinearGradient
            colors={["rgba(32,5,11,0)", "rgba(32,5,11,.8)"]}
            style={[s.header, { paddingTop: insets.top + 8 }]}
          >
            <Touch label="Back to messages" onPress={p.onBack}>
              <HomeIcon source={chatAssets.back} size={16} />
            </Touch>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${p.contact?.name || "contact"} profile`}
              disabled={!p.contact}
              onPress={() => act("profile")}
              style={s.identity}
            >
              <Avatar contact={p.contact} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.name} numberOfLines={1}>
                  {p.contact?.name || "Conversation"}
                </Text>
                <Text style={s.status} numberOfLines={1}>
                  {p.connection || "Connecting…"}
                </Text>
              </View>
            </Pressable>
            <Touch
              label="Chat more options"
              onPress={openOptions}
              disabled={!p.contact}
            >
              <Text style={s.dots}>•••</Text>
            </Touch>
          </LinearGradient>
          {!p.error && p.appointment && (
            <View style={s.pinSpace}>
              <View style={s.pin}>
                <LinearGradient
                  colors={["#ff517f", "#660007"]}
                  style={s.pinAccent}
                />
                <View style={s.spread}>
                  <Text style={s.pinLabel}>UPCOMING APPOINTMENT</Text>
                  <Text style={s.pink}>
                    {p.appointment.status === "confirmed"
                      ? "✓ Confirmed"
                      : "Awaiting confirmation"}
                  </Text>
                </View>
                <View style={{ gap: 2 }}>
                  <Text style={s.pinTitle}>{p.appointment.title}</Text>
                  <Text style={s.pinDetail}>▦ {p.appointment.when}</Text>
                  <Text style={s.pinDetail}>⌖ {p.appointment.location}</Text>
                </View>
                <View style={[s.spread, s.pinFooter]}>
                  <Text style={s.pink}>{p.appointment.relative}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View appointment"
                    onPress={() => act("appointment", p.appointment!.id)}
                    hitSlop={8}
                    style={{ minHeight: 18, justifyContent: "center" }}
                  >
                    <Text style={s.pinDetail}>View appointment ›</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          )}
          {(search !== null || media) && (
            <View style={s.filterBar}>
              {search !== null ? (
                <TextInput
                  accessibilityLabel="Search in conversation"
                  placeholder="Search in conversation…"
                  placeholderTextColor="#c2aab1"
                  value={search}
                  onChangeText={setSearch}
                  autoFocus
                  style={[s.input, { flex: 1 }]}
                />
              ) : (
                <Text style={[s.text, { flex: 1 }]}>
                  Shared designs, photos & locations
                </Text>
              )}
              <Touch
                label="Show all messages"
                onPress={() => {
                  setSearch(null);
                  setMedia(false);
                }}
              >
                <Text style={s.text}>×</Text>
              </Touch>
            </View>
          )}
          <ScrollView
            ref={scroll}
            style={{ flex: 1 }}
            contentContainerStyle={s.messages}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl
                refreshing={!!p.refreshing}
                onRefresh={p.onRefresh}
                tintColor="white"
              />
            }
            onScroll={({ nativeEvent: e }) => {
              nearBottom.current =
                e.contentSize.height -
                  e.layoutMeasurement.height -
                  e.contentOffset.y <
                100;
            }}
            scrollEventThrottle={100}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            onContentSizeChange={() => {
              const latest = p.messages.at(-1);
              if (
                latest &&
                latest.id !== lastId.current &&
                (nearBottom.current || latest.own)
              )
                scroll.current?.scrollToEnd({ animated: !!lastId.current });
              lastId.current = latest?.id;
            }}
          >
            {p.preview && (
              <Text style={s.preview}>
                Design preview · messages stay on this device
              </Text>
            )}
            {p.loading ? (
              <ActivityIndicator
                color="white"
                accessibilityLabel="Loading conversation"
              />
            ) : p.error ? (
              <>
                <LabMessage error>{p.error}</LabMessage>
                <LabButton title="Try again" onPress={p.onRefresh} />
              </>
            ) : (
              <>
                {p.hasMore && (
                  <LabButton
                    title="Load older messages"
                    secondary
                    onPress={p.onMore}
                    disabled={p.refreshing}
                  />
                )}
                {(search !== null || media) && (
                  <Text style={s.status}>
                    Showing matches in loaded messages
                    {p.hasMore
                      ? "; load older messages to search further."
                      : "."}
                  </Text>
                )}
                {!messages.length && (
                  <Text style={s.empty}>
                    {search !== null || media
                      ? "No matching messages."
                      : "Start the conversation."}
                  </Text>
                )}
                {messages.map((m, index) => {
                  const previous = messages[index - 1],
                    next = messages[index + 1],
                    joined = joinedMessages(m, next);
                  return (
                    <View
                      key={m.id}
                      style={{ gap: 4, marginBottom: joined ? 4 : 16 }}
                    >
                      {(!previous ||
                        messageDay(previous.createdAt) !==
                          messageDay(m.createdAt)) && (
                        <View style={s.day}>
                          <Text style={s.dayText}>
                            {messageDay(m.createdAt)}
                          </Text>
                        </View>
                      )}
                      <View
                        style={{
                          alignItems: m.own ? "flex-end" : "flex-start",
                          gap: 4,
                        }}
                      >
                        {!!m.text && (
                          <Pressable
                            accessibilityRole={!m.own ? "button" : undefined}
                            accessibilityLabel={
                              !m.own
                                ? `${m.text}. Long press to report message`
                                : undefined
                            }
                            accessibilityHint={
                              !m.own
                                ? "Long press to report this message"
                                : undefined
                            }
                            accessibilityActions={
                              !m.own
                                ? [{ name: "report", label: "Report message" }]
                                : undefined
                            }
                            onAccessibilityAction={(e) => {
                              if (
                                !m.own &&
                                e.nativeEvent.actionName === "report"
                              )
                                p.onAction("report-message", m.id);
                            }}
                            onLongPress={
                              !m.own
                                ? () => p.onAction("report-message", m.id)
                                : undefined
                            }
                          >
                            <LinearGradient
                              colors={
                                m.own
                                  ? gradient
                                  : [
                                      "rgba(255,255,255,.08)",
                                      "rgba(255,255,255,.08)",
                                    ]
                              }
                              locations={m.own ? [0, 0.48, 1] : [0, 1]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={[
                                s.bubble,
                                { maxWidth: Math.min(260, width - 32) },
                                m.own ? s.outgoing : s.incoming,
                              ]}
                            >
                              <Text
                                style={[s.text, m.own && { color: "white" }]}
                              >
                                {m.text}
                              </Text>
                            </LinearGradient>
                          </Pressable>
                        )}
                        {m.design && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`View shared design ${m.design.title}`}
                            onPress={() => act("design", m.design!.id)}
                            onLongPress={
                              !m.own
                                ? () => p.onAction("report-message", m.id)
                                : undefined
                            }
                            style={[
                              s.mediaCard,
                              { width: Math.min(240, width - 32) },
                            ]}
                          >
                            {m.design.image && (
                              <Image
                                source={m.design.image}
                                contentFit="cover"
                                cachePolicy="none"
                                accessibilityLabel={m.design.title}
                                style={{ width: "100%", height: 180 }}
                              />
                            )}
                            <View style={s.mediaBody}>
                              <Text style={s.cardTitle}>{m.design.title}</Text>
                              <Text style={s.metadata}>
                                {m.design.metadata.toUpperCase()}
                              </Text>
                              <Text style={s.badge}>✦ Laque Design</Text>
                            </View>
                          </Pressable>
                        )}
                        {m.image && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Open shared photo"
                            onPress={() => setPhoto(m.image!)}
                            onLongPress={
                              !m.own
                                ? () => p.onAction("report-message", m.id)
                                : undefined
                            }
                          >
                            <Image
                              source={m.image}
                              contentFit="cover"
                              cachePolicy="none"
                              accessibilityLabel="Shared photo"
                              style={s.photo}
                            />
                          </Pressable>
                        )}
                        {m.location && (
                          <View
                            style={[
                              s.mediaCard,
                              { width: Math.min(240, width - 32) },
                            ]}
                          >
                            <Image
                              source={m.location.image}
                              contentFit="cover"
                              accessibilityLabel="Studio location map"
                              style={{ width: "100%", height: 100 }}
                            />
                            <View style={s.mediaBody}>
                              <Text style={s.cardTitle}>{m.location.name}</Text>
                              <Text style={s.status}>
                                📍 {m.location.address}
                              </Text>
                            </View>
                          </View>
                        )}
                        {m.mediaError && (
                          <Text style={s.mediaError}>{m.mediaError}</Text>
                        )}
                        {!joined && (
                          <Text style={s.time}>
                            {new Date(m.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                            {m.own
                              ? ` · ${m.demo ? "Preview" : m.read ? "Read" : "Sent"}`
                              : ""}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </ScrollView>
          <View
            style={[
              s.composerArea,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {p.actionError && (
              <View style={{ paddingBottom: 8 }}>
                <LabMessage error>{p.actionError}</LabMessage>
                <LabButton
                  title="Refresh conversation"
                  secondary
                  onPress={p.onRefresh}
                  disabled={p.busy}
                />
              </View>
            )}
            {p.attachment && (
              <View style={s.spread}>
                <Image
                  source={p.attachment}
                  cachePolicy="none"
                  contentFit="contain"
                  style={{ width: 64, height: 64, borderRadius: 8 }}
                  accessibilityLabel="Photo ready to send"
                />
                <Touch
                  label="Remove attachment"
                  disabled={p.busy || p.pending}
                  onPress={p.onRemoveAttachment}
                >
                  <Text style={s.text}>×</Text>
                </Touch>
              </View>
            )}
            {p.pending && (
              <View style={s.spread}>
                <Text style={[s.status, { flex: 1 }]}>
                  Message awaiting confirmation. Retry safely.
                </Text>
                <Touch
                  label="Discard pending message"
                  disabled={p.busy}
                  onPress={() => setConfirm("discard")}
                >
                  <Text style={s.text}>×</Text>
                </Touch>
              </View>
            )}
            <LinearGradient
              colors={["rgba(255,255,255,.03)", "rgba(255,141,160,.2)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.composer}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add attachment"
                disabled={!p.ready || p.busy || p.pending}
                onPress={() => {
                  Keyboard.dismiss();
                  setAttach(true);
                }}
                style={s.add}
              >
                <Text style={s.plus}>+</Text>
              </Pressable>
              <TextInput
                accessibilityLabel="Write a message"
                placeholder="Write a message…"
                placeholderTextColor="rgba(255,255,255,.4)"
                value={p.draft}
                onChangeText={p.onDraft}
                multiline
                maxLength={4000}
                editable={p.ready && !p.busy && !p.pending}
                onContentSizeChange={(e) =>
                  setInputHeight(
                    Math.min(
                      110,
                      Math.max(38, e.nativeEvent.contentSize.height),
                    ),
                  )
                }
                style={[s.input, { height: inputHeight }]}
              />
              <Touch
                label={p.pending ? "Retry sending" : "Send message"}
                onPress={p.onSend}
                disabled={
                  !p.ready ||
                  p.busy ||
                  (!p.pending && !p.draft.trim() && !p.attachment)
                }
              >
                {p.busy ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <HomeIcon source={chatAssets.send} size={16} />
                )}
              </Touch>
            </LinearGradient>
          </View>
        </KeyboardAvoidingView>
        <Modal
          visible={options}
          transparent
          animationType="slide"
          onRequestClose={() => setOptions(false)}
        >
          <View style={s.scrim}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close chat options"
              style={StyleSheet.absoluteFill}
              onPress={() => setOptions(false)}
            />
            <LinearGradient
              colors={[
                "rgba(56,37,43,.97)",
                "rgba(56,37,43,.97)",
                "rgba(158,104,121,.97)",
              ]}
              locations={[0, 0.56, 1]}
              style={[
                s.sheet,
                {
                  width,
                  maxHeight: window.height - insets.top - 24,
                  height: 638,
                  paddingBottom: Math.max(insets.bottom, 16),
                },
              ]}
            >
              <View accessibilityViewIsModal style={{ flex: 1 }}>
                <View style={s.handle} />
                <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${p.contact?.name || "contact"} public profile`}
                    onPress={() => act("profile")}
                    disabled={!p.contact || p.busy}
                    style={s.contactRow}
                  >
                    <Avatar contact={p.contact} large />
                    <View>
                      <Text style={s.sheetName}>{p.contact?.name}</Text>
                      <Text style={s.role}>
                        {p.contact?.role === "salon"
                          ? "Salon"
                          : creator
                            ? "Nail Artist"
                            : "Client"}
                      </Text>
                    </View>
                  </Pressable>
                  {(creator || p.appointment) && (
                    <View style={s.book}>
                      <LabButton
                        title={
                          p.appointment
                            ? "Manage appointment"
                            : "Book appointment"
                        }
                        onPress={() =>
                          p.appointment
                            ? act("appointment", p.appointment.id)
                            : act("book")
                        }
                        disabled={p.busy}
                      />
                    </View>
                  )}
                  <Text style={s.section}>PROFILE</Text>
                  {row("View profile", chatAssets.profile, () =>
                    act("profile"),
                  )}
                  {creator &&
                    row("View services & portfolio", chatAssets.portfolio, () =>
                      act("portfolio"),
                    )}
                  {creator &&
                    row(
                      p.favorite ? "Remove from favorites" : "Add to favorites",
                      chatAssets.favorite,
                      () => act("favorite"),
                    )}
                  <Text style={s.section}>CONVERSATION</Text>
                  {row(
                    "Shared designs, photos & locations",
                    chatAssets.media,
                    () => {
                      setOptions(false);
                      setMedia(true);
                      setSearch(null);
                    },
                  )}
                  {row("Search in conversation", chatAssets.search, () => {
                    setOptions(false);
                    setSearch("");
                    setMedia(false);
                  })}
                  {row(
                    p.muted ? "Unmute notifications" : "Mute notifications",
                    chatAssets.mute,
                    () => act("mute"),
                  )}
                  <Text style={s.section}>SAFETY</Text>
                  {row(
                    "Report",
                    chatAssets.report,
                    () => act("report"),
                    "#ffd290",
                  )}
                  {row(
                    "Block",
                    chatAssets.block,
                    () => {
                      setOptions(false);
                      setConfirm("block");
                    },
                    "#ff91a1",
                  )}
                  {row(
                    "Delete conversation",
                    chatAssets.delete,
                    () => {
                      setOptions(false);
                      setConfirm("delete");
                    },
                    "#ff91a1",
                  )}
                </ScrollView>
              </View>
            </LinearGradient>
          </View>
        </Modal>
        <LabSheet
          visible={!!confirm}
          title={
            confirm === "block"
              ? "Block this profile?"
              : confirm === "discard"
                ? "Discard pending message?"
                : "Delete this conversation?"
          }
          onClose={() => setConfirm(null)}
        >
          <Text style={s.text}>
            {confirm === "block"
              ? "Neither of you will be able to send new messages to the other. Existing appointments are not cancelled."
              : confirm === "discard"
                ? "This message may already have arrived after a connection interruption. Refresh the conversation before discarding it."
                : "This removes the conversation from your inbox only. The other participant keeps their messages. A new incoming message can bring it back."}
          </Text>
          <LabButton
            title={
              confirm === "block"
                ? "Block profile"
                : confirm === "discard"
                  ? "Discard message"
                  : "Delete from my inbox"
            }
            onPress={() => {
              if (confirm) act(confirm);
              setConfirm(null);
            }}
            disabled={p.busy}
          />
          <LabButton
            title="Keep conversation"
            secondary
            onPress={() => setConfirm(null)}
          />
        </LabSheet>
        <LabSheet
          visible={attach}
          title="Share in conversation"
          onClose={() => setAttach(false)}
        >
          <LabButton
            title="Share photo"
            onPress={() => {
              setAttach(false);
              act("photo");
            }}
          />
          <LabButton
            title="Choose a design"
            secondary
            onPress={() => {
              setAttach(false);
              act("share-design");
            }}
          />
          <Text style={s.status}>
            You can also paste an address or location link into your message.
          </Text>
        </LabSheet>
        <LabSheet
          visible={!!photo}
          title="Shared photo"
          onClose={() => setPhoto(null)}
        >
          {photo && (
            <Image
              source={photo}
              contentFit="contain"
              cachePolicy="none"
              style={{ width: "100%", height: window.height * 0.55 }}
              accessibilityLabel="Full shared photo"
            />
          )}
        </LabSheet>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#260d14", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 16,
    paddingBottom: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.06)",
  },
  touch: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  identity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 44,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  name: {
    fontFamily: appFonts.regular,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "500",
    color: "white",
  },
  status: {
    fontFamily: appFonts.light,
    fontSize: 12,
    lineHeight: 16,
    color: "rgba(255,255,255,.5)",
  },
  dots: { fontSize: 18, color: "rgba(255,255,255,.4)" },
  messages: { padding: 16 },
  day: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,.06)",
    marginBottom: 16,
  },
  dayText: {
    fontFamily: appFonts.light,
    color: "rgba(255,255,255,.4)",
    fontSize: 11,
  },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  incoming: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },
  outgoing: { borderBottomRightRadius: 4 },
  text: {
    fontFamily: appFonts.regular,
    color: "rgba(255,255,255,.85)",
    fontSize: 15,
    lineHeight: 20,
  },
  time: {
    fontFamily: appFonts.light,
    fontSize: 11,
    lineHeight: 14,
    color: "rgba(255,255,255,.4)",
  },
  mediaCard: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
    backgroundColor: "rgba(255,255,255,.06)",
  },
  mediaBody: { padding: 12, gap: 4 },
  cardTitle: {
    fontFamily: appFonts.regular,
    fontSize: 14,
    color: "white",
    fontWeight: "500",
  },
  metadata: {
    fontFamily: appFonts.light,
    fontSize: 11,
    color: "rgba(255,255,255,.4)",
  },
  badge: { fontFamily: appFonts.regular, color: "#ff7498", fontSize: 10 },
  photo: { width: 200, height: 150, borderRadius: 12 },
  mediaError: {
    fontFamily: appFonts.regular,
    color: "#ffd1db",
    fontSize: 12,
    maxWidth: 240,
  },
  composerArea: {
    paddingTop: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.06)",
    backgroundColor: "rgba(32,5,11,.2)",
  },
  composer: {
    borderRadius: 1000,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.3)",
  },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  plus: {
    color: "rgba(255,255,255,.4)",
    fontSize: 24,
    fontFamily: appFonts.light,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: appFonts.light,
    fontSize: 14,
    lineHeight: 18,
    color: "white",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 120,
  },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  empty: {
    ...typography.body,
    color: "white",
    textAlign: "center",
    paddingVertical: 24,
  },
  preview: {
    fontFamily: appFonts.light,
    color: "rgba(255,255,255,.5)",
    fontSize: 10,
    textAlign: "center",
    paddingBottom: 10,
  },
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.5)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    backgroundColor: "rgba(255,255,255,.2)",
    borderRadius: 2,
    marginVertical: 16,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  sheetName: {
    fontFamily: appFonts.regular,
    fontSize: 18,
    color: "white",
    fontWeight: "600",
  },
  role: {
    fontFamily: appFonts.light,
    fontSize: 13,
    color: "rgba(255,255,255,.5)",
    marginTop: 2,
  },
  book: {
    paddingHorizontal: 24,
    paddingVertical: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.06)",
  },
  section: {
    fontFamily: appFonts.regular,
    color: "rgba(255,255,255,.3)",
    fontSize: 11,
    fontWeight: "500",
    paddingLeft: 24,
    paddingTop: 28,
    paddingBottom: 8,
  },
  menuRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,.04)",
  },
  menuText: {
    flex: 1,
    fontFamily: appFonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(255,255,255,.85)",
  },
  chevron: { color: "rgba(255,255,255,.2)", fontSize: 16 },
  pinSpace: { paddingHorizontal: 16, paddingVertical: 12 },
  pin: {
    padding: 16,
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.08)",
    backgroundColor: "rgba(255,255,255,.06)",
    overflow: "hidden",
  },
  pinAccent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  pinLabel: {
    fontFamily: appFonts.light,
    fontSize: 10,
    color: "rgba(255,255,255,.4)",
  },
  pink: { fontFamily: appFonts.regular, fontSize: 11, color: "#ff7498" },
  pinTitle: {
    fontFamily: appFonts.regular,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "500",
    color: "#ffffe6",
  },
  pinDetail: {
    fontFamily: appFonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: "#ffff99",
  },
  pinFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.12)",
    paddingTop: 6,
  },
});
