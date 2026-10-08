import { useState } from "react";
import { Platform, Pressable, Switch, Text, View } from "react-native";
import { Image } from "expo-image";
import { accountScope } from "../../lib/account-scope";
import { LabSheet } from "../lab-ui/primitives";
import {
  Button,
  Card,
  Chips,
  Empty,
  Field,
  Notice,
  Row,
  Section,
  styles,
} from "./primitives";
export type BlockedAccount = {
  id: string;
  name: string;
  username?: string | null;
  avatar?: string | null;
};
export type PrivacySettings = {
  is_private: boolean;
  message_permission: string;
  show_saves: boolean;
};
export function PrivacyView({
  settings,
  busy,
  blocks,
  onUpdate,
  onUnblock,
  onDelete,
  onPolicy,
}: {
  settings: PrivacySettings;
  busy?: boolean;
  blocks: BlockedAccount[];
  onUpdate: (v: Partial<PrivacySettings>) => void;
  onUnblock: (id: string) => Promise<boolean>;
  onDelete: () => void;
  onPolicy: () => void;
}) {
  const [unblock, setUnblock] = useState<BlockedAccount | null>(null);
  const [search, setSearch] = useState(""),
    [unblockError, setUnblockError] = useState("");
  const filtered = blocks.filter((b) =>
    `${b.name} ${b.username || ""}`
      .toLowerCase()
      .includes(search.trim().replace(/^@/, "").toLowerCase()),
  );
  return (
    <>
      <Section
        title="Your space, your choice"
        subtitle="Control what you share and who can reach you."
      >
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.text}>Private profile</Text>
              <Text style={styles.small}>
                Limit your designs and stories to followers. Your basic profile
                stays visible.
              </Text>
            </View>
            <Switch
              {...(Platform.OS === "web"
                ? { activeThumbColor: "#fff1f5" }
                : {})}
              thumbColor="#fff1f5"
              accessibilityLabel="Private profile"
              value={settings.is_private}
              disabled={busy}
              trackColor={{ true: "#bc315b", false: "#71505c" }}
              onValueChange={(v) => onUpdate({ is_private: v })}
            />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.text}>Show saved designs</Text>
              <Text style={styles.small}>
                Display saves on your profile, subject to design visibility.
              </Text>
            </View>
            <Switch
              {...(Platform.OS === "web"
                ? { activeThumbColor: "#fff1f5" }
                : {})}
              thumbColor="#fff1f5"
              accessibilityLabel="Show saved designs"
              value={settings.show_saves}
              disabled={busy}
              trackColor={{ true: "#bc315b", false: "#71505c" }}
              onValueChange={(v) => onUpdate({ show_saves: v })}
            />
          </View>
        </Card>
      </Section>
      <Section title="Messages">
        <Card>
          <Chips
            label="Who can send me messages?"
            values={["Everyone", "Followers", "No one"]}
            value={
              { everyone: "Everyone", followers: "Followers", none: "No one" }[
                settings.message_permission
              ] || "No one"
            }
            disabled={busy}
            onChange={(v) =>
              onUpdate({
                message_permission: v === "No one" ? "none" : v.toLowerCase(),
              })
            }
          />
          <Text style={styles.small}>
            Blocking someone also prevents messages between you.
          </Text>
        </Card>
      </Section>
      <Section
        title={`Blocked accounts${blocks.length ? ` (${blocks.length})` : ""}`}
      >
        {blocks.length ? (
          <Card>
            <Field
              label="Search blocked accounts"
              value={search}
              onChangeText={setSearch}
              placeholder="Name or @username"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {!filtered.length && (
              <Text style={styles.muted}>
                No blocked accounts match this search.
              </Text>
            )}
            {filtered.map((b) => (
              <Pressable
                key={b.id}
                accessibilityRole="button"
                accessibilityLabel={`Review unblocking ${b.name}${b.username ? `, @${b.username}` : ""}`}
                disabled={busy}
                onPress={() => {
                  setUnblockError("");
                  setUnblock(b);
                }}
                style={styles.link}
              >
                <View style={styles.emblem}>
                  {b.avatar ? (
                    <Image
                      source={{ uri: b.avatar }}
                      cachePolicy="memory"
                      style={{ width: 56, height: 56, borderRadius: 28 }}
                      accessible={false}
                    />
                  ) : (
                    <Text style={styles.text}>
                      {b.name.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={styles.text}>{b.name}</Text>
                  {!!b.username && (
                    <Text style={styles.small}>@{b.username}</Text>
                  )}
                  <Text style={styles.small}>Blocked · Review unblocking</Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            ))}
          </Card>
        ) : (
          <Empty
            title="No blocked accounts"
            detail="You can block or report someone from their profile or a conversation’s More Options menu."
          />
        )}
      </Section>
      <Section title="Your account & data">
        <Card>
          <Row
            title="Privacy & retention policy"
            detail="How your information is used and kept"
            onPress={onPolicy}
          />
          <Row
            title="Delete account"
            detail="Permanent closure. No restore option."
            danger
            onPress={onDelete}
          />
        </Card>
      </Section>
      <LabSheet
        visible={!!unblock}
        title="Unblock account?"
        onClose={() => {
          if (!busy) setUnblock(null);
        }}
      >
        <Text style={styles.text}>
          {unblock?.name} may be able to see your content and contact you again,
          subject to your privacy settings.
        </Text>
        {!!unblockError && <Notice error>{unblockError}</Notice>}
        <Button
          title="Unblock"
          busy={busy}
          onPress={() => {
            if (unblock) {
              const ticket = accountScope.capture();
              void onUnblock(unblock.id)
                .then((ok) => {
                  if (!accountScope.isCurrent(ticket)) return;
                  if (ok) setUnblock(null);
                  else
                    setUnblockError(
                      "Couldn’t unblock this account. It remains blocked here; retry or refresh your blocked accounts.",
                    );
                })
                .catch(() => {
                  if (accountScope.isCurrent(ticket))
                    setUnblockError(
                      "Couldn’t confirm unblocking. Retry or refresh your blocked accounts.",
                    );
                });
            }
          }}
        />
        <Button
          title="Keep blocked"
          secondary
          disabled={busy}
          onPress={() => setUnblock(null)}
        />
      </LabSheet>
    </>
  );
}
