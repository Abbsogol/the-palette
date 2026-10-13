import { typography } from "../../theme/typography";
import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeGlass, HomeIcon } from "../home/home-primitives";
import { homeFonts } from "../home/tokens";
import { SearchBackground } from "../search/search-background";
import { LabButton, LabMessage, LabSheet } from "../lab-ui/primitives";
import {
  contactFilters,
  contactRoleLabel,
  filterContacts,
  inboxTime,
  type ContactFilter,
  type MessageContact,
} from "./model";

const icons = {
  search: require("../../../assets/figma/messages/3df6a.svg"),
  filter: require("../../../assets/figma/messages/27920.svg"),
};
export type MessagesViewProps = {
  width?: number;
  contacts: MessageContact[];
  loading?: boolean;
  refreshing?: boolean;
  busy?: boolean;
  error?: string;
  actionError?: string;
  hasMore?: boolean;
  onOpen: (id: string) => void;
  onRefresh: () => void;
  onMore: () => void;
  onFind: () => void;
};
export function MessagesView(p: MessagesViewProps) {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const width =
    p.width ??
    (Platform.OS === "web" ? Math.min(393, window.width) : window.width);
  const [input, setInput] = useState("");
  const [contactsMode, setContactsMode] = useState(false);
  const [filter, setFilter] = useState<ContactFilter>("All contacts");
  const [filterOpen, setFilterOpen] = useState(false);
  const contacts = filterContacts(p.contacts, input, filter);
  return (
    <View style={s.outer}>
      <View style={{ flex: 1, width }}>
        <SearchBackground width={width} variant="messages" />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(41,0,10,.8)", "rgba(41,0,10,0)"]}
          style={[s.shade, { height: insets.top + 115 }]}
        />
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={!!p.refreshing}
              onRefresh={p.onRefresh}
              tintColor="white"
            />
          }
          contentContainerStyle={[
            s.content,
            {
              paddingTop: insets.top + 16,
              paddingBottom: Math.max(insets.bottom, 34) + 120,
            },
          ]}
        >
          <View style={s.headerRow}>
            <Text accessibilityRole="header" style={[s.title, { flex: 1 }]}>
              {contactsMode ? "New message" : "Messages"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                contactsMode ? "Back to inbox" : "New message"
              }
              onPress={() => {
                setContactsMode(!contactsMode);
                setInput("");
                setFilter("All contacts");
              }}
              style={s.newButton}
            >
              <Text style={s.newLabel}>
                {contactsMode ? "‹ Inbox" : "+ New"}
              </Text>
            </Pressable>
          </View>
          <View style={s.search}>
            <View style={s.searchIcon}>
              <HomeIcon source={icons.search} size={16} />
            </View>
            <TextInput
              accessibilityLabel="Search contacts by name, username or city"
              placeholder="Search by name, @username or city…"
              placeholderTextColor="rgba(255,255,255,.8)"
              value={input}
              onChangeText={setInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              style={s.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Filter contacts"
              accessibilityState={{ expanded: filterOpen }}
              onPress={() => {
                Keyboard.dismiss();
                setFilterOpen(true);
              }}
              hitSlop={10}
              style={s.filter}
            >
              <HomeIcon source={icons.filter} size={24} />
              {filter !== "All contacts" && <View style={s.filterDot} />}
            </Pressable>
          </View>
          <Text style={s.section}>
            {filter === "All contacts"
              ? contactsMode
                ? "RECENT CONTACTS"
                : "CONVERSATIONS"
              : filter.toUpperCase()}
          </Text>
          {p.loading ? (
            <ActivityIndicator
              accessibilityLabel="Loading contacts"
              color="#d98cab"
            />
          ) : p.error ? (
            <>
              <LabMessage error>{p.error}</LabMessage>
              <LabButton title="Try again" onPress={p.onRefresh} />
            </>
          ) : contacts.length ? (
            <ContactList
              contacts={contacts}
              busy={p.busy}
              mode={contactsMode ? "contacts" : "inbox"}
              onOpen={p.onOpen}
            />
          ) : (
            <LabMessage>
              {input.trim() || filter !== "All contacts"
                ? "No recent contacts match your search or filter."
                : "No conversations yet. Find an artist or salon to start a message."}
            </LabMessage>
          )}
          {!!p.actionError && <LabMessage error>{p.actionError}</LabMessage>}
          {p.hasMore && !p.error && !p.loading && (
            <LabButton
              title="Load more contacts"
              secondary
              busy={p.refreshing}
              onPress={p.onMore}
            />
          )}
          {!p.loading && !p.error && (contactsMode || !contacts.length) && (
            <LabButton
              title="Find an artist or salon"
              secondary
              onPress={p.onFind}
            />
          )}
        </ScrollView>
        <LabSheet
          visible={filterOpen}
          title="Filter contacts"
          onClose={() => setFilterOpen(false)}
        >
          {contactFilters.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={value}
              accessibilityState={{ checked: filter === value }}
              onPress={() => {
                setFilter(value);
                setFilterOpen(false);
              }}
              style={[s.filterChoice, filter === value && s.filterSelected]}
            >
              <Text style={s.name}>{value}</Text>
              {filter === value && <Text style={s.name}>✓</Text>}
            </Pressable>
          ))}
          <LabButton
            title="Refresh contacts"
            secondary
            onPress={() => {
              setFilterOpen(false);
              p.onRefresh();
            }}
          />
          <LabButton
            title="Find an artist or salon"
            secondary
            onPress={() => {
              setFilterOpen(false);
              p.onFind();
            }}
          />
        </LabSheet>
      </View>
    </View>
  );
}
export function ContactList({
  contacts,
  busy,
  mode = "contacts",
  selected,
  onOpen,
}: {
  contacts: MessageContact[];
  busy?: boolean;
  mode?: "contacts" | "inbox" | "recipients";
  selected?: string;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={s.list}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, s.listBorder]}
      />
      {contacts.map((contact, index) => {
        const disabled =
          !!busy || ("available" in contact && contact.available === false);
        return (
          <View key={contact.id}>
            {index > 0 && <View style={s.separator} />}
            <Pressable
              accessibilityRole={mode === "recipients" ? "radio" : "button"}
              accessibilityLabel={
                mode === "recipients"
                  ? `Select ${contact.name}`
                  : `Message ${contact.name}${contact.unread ? ", unread messages" : ""}`
              }
              accessibilityState={{
                disabled,
                ...(mode === "recipients"
                  ? { checked: selected === contact.id }
                  : {}),
              }}
              disabled={disabled}
              onPress={() => onOpen(contact.id)}
            >
              <HomeGlass
                intensity={4}
                style={[
                  s.contact,
                  selected === contact.id && s.selectedContact,
                  disabled && { opacity: 0.5 },
                ]}
              >
                <View
                  style={[s.avatar, contact.role !== "creator" && s.avatarFill]}
                >
                  {contact.avatar ? (
                    <Image
                      source={contact.avatar}
                      cachePolicy="none"
                      accessibilityLabel={`${contact.name} profile photo`}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 50,
                      }}
                      contentFit="cover"
                    />
                  ) : (
                    <Text style={s.initial}>
                      {contact.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={s.info}>
                  <View style={s.nameRow}>
                    <Text numberOfLines={1} style={s.name}>
                      {contact.name}
                    </Text>
                  </View>
                  {mode === "inbox" ? (
                    <Text
                      numberOfLines={1}
                      style={[s.preview, contact.unread && s.unreadText]}
                    >
                      {contact.lastMessage || "Start a conversation"}
                    </Text>
                  ) : (
                    <Text numberOfLines={1} style={s.location}>
                      {[contactRoleLabel(contact.role), contact.location]
                        .filter(Boolean)
                        .join(" · ") || contact.username}
                    </Text>
                  )}
                </View>
                {mode === "inbox" ? (
                  <View style={s.trailing}>
                    <Text style={s.time}>
                      {inboxTime(contact.lastMessageAt)}
                    </Text>
                    {contact.unread && <View style={s.unread} />}
                  </View>
                ) : mode === "recipients" ? (
                  <View
                    style={[
                      s.radio,
                      selected === contact.id && s.radioSelected,
                    ]}
                  >
                    {selected === contact.id && <View style={s.radioDot} />}
                  </View>
                ) : (
                  <Text style={s.chevron}>›</Text>
                )}
              </HomeGlass>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
const s = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  newButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
  },
  newLabel: { ...typography.caption, color: "#ffe1ed" },
  selectedContact: { backgroundColor: "rgba(230,103,150,.2)" },
  preview: { ...typography.caption, color: "#c7a9b5", fontSize: 13 },
  unreadText: { color: "#fff2f6" },
  trailing: { alignItems: "flex-end", gap: 12, maxWidth: 64 },
  time: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 14,
    color: "#dbb8c7",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#ad8696",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: "#ffb6d0" },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#ffb6d0",
  },
  outer: { flex: 1, alignItems: "center", backgroundColor: "#260d14" },
  shade: { position: "absolute", top: 0, left: 0, right: 0 },
  content: { paddingHorizontal: 24, gap: 24 },
  title: {
    color: "white",
    ...typography.heading,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.08)",
  },
  searchIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: "rgba(255,255,255,.8)",
    fontFamily: homeFonts.light,
    fontSize: 14,
    lineHeight: 16.8,
    padding: 0,
  },
  filter: { width: 24, height: 24 },
  filterDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ff517f",
  },
  section: {
    color: "rgba(255,255,255,.4)",
    fontFamily: homeFonts.regular,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 1,
  },
  list: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,.06)",
    overflow: "hidden",
  },
  listBorder: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.1)",
  },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 68,
    borderRadius: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFill: { backgroundColor: "rgba(255,255,255,.08)" },
  initial: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontWeight: "500",
    fontSize: 18,
  },
  info: { flex: 1, gap: 4 },
  nameRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  name: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontWeight: "500",
    fontSize: 16,
    lineHeight: 18,
    flexShrink: 1,
  },
  badge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontWeight: "500",
    fontSize: 10,
    lineHeight: 12,
  },
  location: {
    color: "rgba(255,255,255,.5)",
    fontFamily: homeFonts.light,
    fontSize: 13,
    lineHeight: 15.6,
  },
  chevron: {
    color: "rgba(255,255,255,.5)",
    fontFamily: homeFonts.light,
    fontSize: 22,
    lineHeight: 24,
  },
  unread: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ff517f" },
  separator: { height: 1, backgroundColor: "rgba(255,255,255,.06)" },
  filterChoice: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
  },
  filterSelected: { backgroundColor: "rgba(255,81,127,.18)" },
});
