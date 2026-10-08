import { useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LabButton, LabMessage, LabShell } from "../lab-ui/primitives";
import { StoryIconButton } from "../stories/story-ui";
import { typography } from "../../theme/typography";
import { ContactList } from "./messages-view";
import {
  contactFilters,
  filterContacts,
  type ContactFilter,
  type ShareRecipient,
  type SharedDesign,
} from "./model";

export type ShareViewProps = {
  width?: number;
  design?: SharedDesign;
  recipients: ShareRecipient[];
  selected?: ShareRecipient;
  source: "recent" | "discover";
  search: string;
  loading?: boolean;
  designLoading?: boolean;
  designError?: string;
  error?: string;
  sendError?: string;
  busy?: boolean;
  hasMore?: boolean;
  sent?: boolean;
  preview?: boolean;
  notice?: string;
  onBack: () => void;
  onSearch: (value: string) => void;
  onSource: (value: "recent" | "discover") => void;
  onSelect: (recipient?: ShareRecipient) => void;
  onSend: () => void;
  onRetry: () => void;
  onMore: () => void;
  onOpenChat: () => void;
};
export function ShareDesignView(p: ShareViewProps) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<ContactFilter>("All contacts");
  const recipients = filterContacts(
    p.recipients,
    p.source === "recent" ? p.search : "",
    filter,
  );
  const blocked =
    p.busy ||
    !p.selected ||
    p.selected.available === false ||
    !p.design ||
    !!p.designError ||
    p.designLoading ||
    p.loading ||
    !!p.error;
  return (
    <LabShell width={p.width} dark>
      <View style={[s.header, { paddingTop: insets.top + 14 }]}>
        <StoryIconButton
          label="Back from sharing"
          glyph="‹"
          onPress={p.onBack}
        />
        <Text accessibilityRole="header" style={s.title}>
          Share to Chat
        </Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={s.body}
          showsVerticalScrollIndicator={false}
        >
          {p.designLoading ? (
            <ActivityIndicator
              accessibilityLabel="Loading shared design"
              color="#ffd0e0"
            />
          ) : p.designError ? (
            <LabMessage error>{p.designError}</LabMessage>
          ) : (
            p.design && (
              <View style={s.design}>
                {p.design.image ? (
                  <Image
                    source={p.design.image}
                    style={s.image}
                    cachePolicy="none"
                    contentFit="cover"
                    accessibilityLabel={p.design.title}
                  />
                ) : (
                  <View style={[s.image, s.placeholder]}>
                    <Text style={s.small}>Design</Text>
                  </View>
                )}
                <View style={{ flex: 1, gap: 8 }}>
                  <Text style={s.eyebrow}>SHARING A DESIGN</Text>
                  <Text numberOfLines={2} style={s.designTitle}>
                    {p.design.title}
                  </Text>
                  {!!p.design.metadata && (
                    <Text numberOfLines={2} style={s.small}>
                      {p.design.metadata}
                    </Text>
                  )}
                </View>
              </View>
            )
          )}
          {p.sent ? (
            <View style={s.confirmation}>
              <Text style={s.check}>✓</Text>
              <Text accessibilityRole="header" style={s.successTitle}>
                {p.preview ? "Preview shared" : "Shared"} with{" "}
                {p.selected?.name}
              </Text>
              <Text style={s.bodyText}>
                {p.preview
                  ? "This example stays in the demo. No message was sent to a real account."
                  : "Your design is now in the conversation."}
              </Text>
              {!!p.notice && <LabMessage>{p.notice}</LabMessage>}
            </View>
          ) : (
            <>
              <View style={{ gap: 6 }}>
                <Text style={s.section}>Choose someone to inspire</Text>
                <Text style={s.small}>
                  Select one person, then send. A private design is shared only
                  with that person. Public designs stay public.
                </Text>
              </View>
              <View style={s.sources}>
                {(["recent", "discover"] as const).map((value) => (
                  <Pressable
                    key={value}
                    accessibilityRole="tab"
                    accessibilityLabel={
                      value === "recent" ? "Recent chats" : "Artists & salons"
                    }
                    accessibilityState={{
                      selected: p.source === value,
                      disabled: !!p.busy,
                    }}
                    disabled={p.busy}
                    onPress={() => {
                      setFilter("All contacts");
                      p.onSource(value);
                    }}
                    style={[s.source, p.source === value && s.sourceSelected]}
                  >
                    <Text style={s.sourceText}>
                      {value === "recent" ? "Recent chats" : "Artists & salons"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                accessibilityLabel="Search share recipients"
                placeholder={
                  p.source === "recent"
                    ? "Search your chats…"
                    : "Search artists or salons by name…"
                }
                placeholderTextColor="#c5a0ae"
                value={p.search}
                onChangeText={p.onSearch}
                editable={!p.busy}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                onSubmitEditing={Keyboard.dismiss}
                style={s.input}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {contactFilters
                  .filter(
                    (value) =>
                      p.source === "recent" ||
                      !["Clients", "Unread"].includes(value),
                  )
                  .map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityLabel={`Recipients: ${value}`}
                      accessibilityState={{
                        checked: filter === value,
                        disabled: !!p.busy,
                      }}
                      disabled={p.busy}
                      onPress={() => setFilter(value)}
                      style={[s.chip, filter === value && s.chipSelected]}
                    >
                      <Text style={s.small}>
                        {value === "All contacts" ? "All" : value}
                      </Text>
                    </Pressable>
                  ))}
              </ScrollView>
              {p.loading ? (
                <ActivityIndicator
                  accessibilityLabel="Loading recipients"
                  color="#ffb5cf"
                />
              ) : p.error ? (
                <LabMessage error>{p.error}</LabMessage>
              ) : recipients.length ? (
                <ContactList
                  contacts={recipients}
                  busy={p.busy}
                  mode="recipients"
                  selected={p.selected?.id}
                  onOpen={(id) =>
                    p.onSelect(p.recipients.find((c) => c.id === id))
                  }
                />
              ) : (
                <LabMessage>
                  {p.source === "recent"
                    ? "No chats match. Find an artist or salon to start a new conversation."
                    : "No artists or salons match. Try a different name or filter."}
                </LabMessage>
              )}
              {!!p.sendError && (
                <LabMessage error>
                  {p.sendError} Your selection is kept; retrying won’t send the
                  same design twice.
                </LabMessage>
              )}
              {(p.error || p.designError) && (
                <LabButton
                  title="Reload sharing"
                  secondary
                  disabled={p.busy}
                  onPress={p.onRetry}
                />
              )}
              {!!p.hasMore && !p.error && (
                <LabButton
                  title="Load more recipients"
                  secondary
                  busy={p.loading}
                  disabled={p.busy}
                  onPress={p.onMore}
                />
              )}
              {!!p.preview && (
                <Text style={s.small}>
                  Design preview · no real messages are sent.
                </Text>
              )}
            </>
          )}
        </ScrollView>
        <View
          style={[s.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}
        >
          {!p.sent && (
            <View style={s.selectedRow}>
              <Text style={[s.small, { flex: 1 }]}>
                {p.selected
                  ? `To: ${p.selected.name}`
                  : "No recipient selected"}
              </Text>
              {p.selected && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear recipient"
                  disabled={p.busy}
                  onPress={() => p.onSelect(undefined)}
                  style={s.clear}
                >
                  <Text style={s.small}>Clear</Text>
                </Pressable>
              )}
            </View>
          )}
          <LabButton
            title={
              p.sent
                ? "Open chat"
                : p.sendError
                  ? "Retry sharing"
                  : p.selected
                    ? `Send to ${p.selected.name}`
                    : "Choose a recipient"
            }
            disabled={!p.sent && blocked}
            busy={p.busy}
            onPress={() => {
              Keyboard.dismiss();
              if (p.sent) p.onOpenChat();
              else if (!blocked) p.onSend();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </LabShell>
  );
}
const s = StyleSheet.create({
  header: {
    paddingHorizontal: 24,
    paddingBottom: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  title: {
    ...typography.heading,
    color: "white",
    fontSize: 28,
    lineHeight: 34,
    flex: 1,
  },
  body: { paddingHorizontal: 24, paddingBottom: 26, gap: 20 },
  design: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.17)",
    backgroundColor: "rgba(255,255,255,.06)",
  },
  image: { width: 82, height: 100, borderRadius: 16 },
  placeholder: {
    backgroundColor: "#542635",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    ...typography.caption,
    color: "#edb5c9",
    fontSize: 9,
    letterSpacing: 1.5,
  },
  designTitle: { ...typography.section, color: "white", fontSize: 21 },
  small: {
    ...typography.caption,
    color: "#e3c2ce",
    fontSize: 12,
    lineHeight: 18,
  },
  section: {
    ...typography.heading,
    color: "white",
    fontSize: 23,
    lineHeight: 29,
  },
  bodyText: { ...typography.body, color: "#edcbd8", textAlign: "center" },
  sources: { flexDirection: "row", gap: 8 },
  source: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.18)",
  },
  sourceSelected: {
    backgroundColor: "rgba(234,123,162,.2)",
    borderColor: "#d991ac",
  },
  sourceText: { ...typography.caption, color: "white" },
  input: {
    ...typography.body,
    color: "white",
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.07)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.15)",
  },
  chipSelected: {
    backgroundColor: "rgba(241,154,184,.23)",
    borderColor: "#d790aa",
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.1)",
    backgroundColor: "rgba(36,5,17,.92)",
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 30,
    gap: 12,
  },
  clear: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  confirmation: { paddingVertical: 24, gap: 18, alignItems: "center" },
  check: { color: "#ffc3d8", fontSize: 40 },
  successTitle: {
    ...typography.heading,
    color: "white",
    fontSize: 28,
    lineHeight: 36,
    textAlign: "center",
  },
});
