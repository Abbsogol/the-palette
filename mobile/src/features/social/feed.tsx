import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import {
  Button,
  Card,
  Field,
  Notice,
  Screen,
  styles,
} from "../secondary/primitives";
import { SocialMediaView, type SocialMedia } from "./media";
import { SocialTags } from "./people";
import { timeAgo } from "../stories/story-ui";
import type { SocialPost } from "./data";
export function CommunityFeed({
  posts,
  loading,
  error,
  onRetry,
  onCompose,
  onProfile,
  onReport,
  onDelete,
  onMore,
  preview = false,
}: {
  posts: SocialPost[];
  loading?: boolean;
  error?: string;
  onRetry: () => void;
  onCompose?: () => void;
  onProfile: (id: string) => void;
  onReport?: (id: string) => void;
  onDelete?: (id: string) => void;
  onMore?: () => void;
  preview?: boolean;
}) {
  const [opened, setOpened] = useState<SocialMedia>(),
    [filter, setFilter] = useState("");
  return (
    <View style={{ gap: 20, paddingHorizontal: 24, paddingBottom: 28 }}>
      <View style={{ gap: 8 }}>
        <Text accessibilityRole="header" style={styles.heading}>
          Community
        </Text>
        <Text style={styles.muted}>
          Sets, stories and moments from the people behind the nails.
        </Text>
        {preview && (
          <Text style={styles.small}>Local preview · sample posts</Text>
        )}
      </View>
      {onCompose && (
        <Button title="Share a photo or video" onPress={onCompose} />
      )}
      <Field
        label="Find posts"
        placeholder="Caption, #tag or @username"
        value={filter}
        onChangeText={setFilter}
      />
      {loading ? (
        <Text style={styles.muted}>Loading community…</Text>
      ) : error ? (
        <>
          <Notice error>{error}</Notice>
          <Button title="Try again" onPress={onRetry} />
        </>
      ) : !posts.length ? (
        <Card>
          <Text style={styles.subtitle}>Make the first moment</Text>
          <Text style={styles.muted}>
            Photos and videos shared by the community appear here.
          </Text>
        </Card>
      ) : (
        posts
          .filter(
            (p) =>
              !filter ||
              [
                p.caption,
                p.username,
                p.name,
                ...p.tags,
                ...p.people.map((x) => x.username),
              ]
                .join(" ")
                .toLowerCase()
                .includes(filter.replace(/^[@#]/, "").toLowerCase()),
          )
          .map((p) => (
            <Card key={p.id}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View profile: ${p.name}`}
                onPress={() => onProfile(p.userId)}
                style={{ gap: 4, paddingVertical: 8 }}
              >
                <Text style={styles.subtitle}>{p.name}</Text>
                <Text style={styles.small}>
                  {p.username ? `@${p.username} · ` : ""}
                  {timeAgo(p.createdAt)}
                </Text>
              </Pressable>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator
              >
                {p.media.map((m, i) => (
                  <View
                    key={i}
                    style={{
                      width: 290,
                      height: 350,
                      borderRadius: 20,
                      overflow: "hidden",
                      marginRight: 8,
                      backgroundColor: "#21090f",
                    }}
                  >
                    <SocialMediaView media={m} />
                    {m.type === "image" && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Open photo ${i + 1} by ${p.name}`}
                        style={{ position: "absolute", inset: 0 }}
                        onPress={() => setOpened(m)}
                      />
                    )}
                  </View>
                ))}
              </ScrollView>
              {p.media.length > 1 && (
                <Text style={styles.small}>
                  {p.media.length} photos / videos · Swipe to view
                </Text>
              )}
              {!!p.caption && <Text style={styles.text}>{p.caption}</Text>}
              <SocialTags
                tags={p.tags}
                people={p.people}
                onProfile={onProfile}
              />
              {onReport && (
                <Button
                  title="Report account"
                  secondary
                  onPress={() => onReport(p.userId)}
                />
              )}
              {onDelete && (
                <Button
                  title="Delete my post"
                  secondary
                  onPress={() => onDelete(p.id)}
                />
              )}
            </Card>
          ))
      )}
      {onMore && <Button title="Load more posts" secondary onPress={onMore} />}
      <Modal visible={!!opened} onRequestClose={() => setOpened(undefined)}>
        {opened && (
          <Screen title="Photo" onBack={() => setOpened(undefined)}>
            <View style={{ height: 540 }}>
              <SocialMediaView media={opened} />
            </View>
          </Screen>
        )}
      </Modal>
    </View>
  );
}
