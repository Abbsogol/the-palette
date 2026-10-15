import { SocialMediaView } from "../social/media";
import { SocialTags, type TaggedPerson } from "../social/people";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LabButton,
  LabMessage,
  LabShell,
  LabSheet,
} from "../lab-ui/primitives";
import { HomeIcon } from "../home/home-primitives";
import { labAssets } from "../lab-ui/assets";
import { typography, appFonts } from "../../theme/typography";

export type StoryItem = {
  id: string;
  userId: string;
  name: string;
  image: ImageSource | string | number;
  caption?: string | null;
  mediaType?: "image" | "video";
  tags?: string[];
  people?: TaggedPerson[];
  createdAt: string;
  expiresAt?: string;
  avatar?: ImageSource | string | null;
};
export function timeAgo(value: string, now = Date.now()) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Recently";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
export function StoryIconButton({
  label,
  glyph,
  onPress,
  disabled = false,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[s.iconButton, disabled && { opacity: 0.35 }]}
    >
      <Text style={s.glyph}>{glyph}</Text>
    </Pressable>
  );
}

function StoryPhoto({ story }: { story: StoryItem }) {
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  return failed ? (
    <View style={s.photoFallback}>
      <Text style={s.section}>This photo couldn’t load</Text>
      <Text style={s.muted}>Check your connection and try again.</Text>
      <LabButton
        title="Retry photo"
        secondary
        onPress={() => {
          setAttempt((v) => v + 1);
          setFailed(false);
          setLoading(true);
        }}
      />
    </View>
  ) : (
    <>
      <Image
        key={attempt}
        source={story.image}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        cachePolicy="memory"
        accessible
        accessibilityLabel={`Story by ${story.name}`}
        onError={() => setFailed(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { alignItems: "center", justifyContent: "center" },
          ]}
        >
          <ActivityIndicator
            accessibilityLabel="Loading story photo"
            color="#ff8dae"
          />
        </View>
      )}
    </>
  );
}

export function StoryViewer({
  stories: suppliedStories,
  loading,
  error,
  onRetry,
  onClose,
  onProfile,
  onReport,
  width,
  preview = false,
  initialStoryId,
  viewerId,
}: {
  stories: StoryItem[];
  initialStoryId?: string;
  viewerId?: string | null;
  loading?: boolean;
  error?: string;
  onRetry: () => void;
  onClose: () => void;
  onProfile?: (story: StoryItem) => void;
  onReport?: (story: StoryItem) => void;
  width?: number;
  preview?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(
    initialStoryId || null,
  );
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const stories =
    loading || error
      ? []
      : suppliedStories.filter(
          (s) => !s.expiresAt || Date.parse(s.expiresAt) > clock,
        );
  const index = Math.max(
    0,
    stories.findIndex((v) => v.id === selected),
  );
  const story = stories[index];
  const insets = useSafeAreaInsets();
  const [options, setOptions] = useState(false);
  const navigate = (offset: number) => {
    const next = stories[index + offset];
    if (next) setSelected(next.id);
    else if (offset > 0) onClose();
  };
  return (
    <LabShell width={width} dark>
      <View style={[s.viewerHeader, { paddingTop: insets.top + 14 }]}>
        <View
          style={s.progress}
          accessibilityLabel={
            story ? `Story ${index + 1} of ${stories.length}` : "Stories"
          }
        >
          {stories
            .slice(Math.floor(index / 7) * 7, Math.floor(index / 7) * 7 + 7)
            .map((item) => (
              <View
                key={item.id}
                style={[
                  s.track,
                  stories.indexOf(item) <= index && s.trackActive,
                ]}
              />
            ))}
        </View>
        <View style={s.row}>
          <View style={s.avatar}>
            {story?.avatar ? (
              <Image
                source={story.avatar}
                style={{ width: 44, height: 44, borderRadius: 22 }}
                cachePolicy="memory"
                accessible={false}
              />
            ) : (
              <Text style={s.initial}>{story?.name.charAt(0) || "L"}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>
              {story?.name || "Stories"}
            </Text>
            <Text style={s.caption}>
              {preview
                ? "Story preview"
                : story
                  ? timeAgo(story.createdAt, clock)
                  : "Your daily inspiration"}
            </Text>
          </View>
          {!!story && story.userId !== viewerId && onReport && (
            <StoryIconButton
              label="Story options"
              glyph="···"
              onPress={() => setOptions(true)}
            />
          )}
          <StoryIconButton label="Close story" glyph="×" onPress={onClose} />
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          s.viewerBody,
          { paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        {loading ? (
          <View style={s.state}>
            <ActivityIndicator
              accessibilityLabel="Loading story"
              color="#ff8dae"
            />
            <Text style={s.muted}>Opening this moment…</Text>
          </View>
        ) : error ? (
          <View style={s.state}>
            <LabMessage error>{error}</LabMessage>
            <LabButton title="Try again" onPress={onRetry} />
          </View>
        ) : !story ? (
          <View style={s.state}>
            <Text style={s.title}>This moment has passed</Text>
            <Text style={s.muted}>
              This story has expired or is no longer available.
            </Text>
            <LabButton title="Check again" secondary onPress={onRetry} />
            <LabButton title="Back to Home" onPress={onClose} />
          </View>
        ) : (
          <>
            <View style={s.viewerPhoto}>
              {story.mediaType === "video" ? (
                <SocialMediaView media={{ type: "video", uri: story.image }} />
              ) : (
                <StoryPhoto key={story.id} story={story} />
              )}
            </View>
            {!!story.caption && (
              <Text style={s.storyCaption}>{story.caption}</Text>
            )}
            <SocialTags
              tags={story.tags}
              people={story.people}
              onProfile={(id) => onProfile?.({ ...story, userId: id })}
            />
            <View style={s.spread}>
              <Text style={s.caption}>
                {index + 1} / {stories.length}
                {preview ? " · Preview" : " · Available for 24 hours"}
              </Text>
              <View style={s.row}>
                <StoryIconButton
                  label="Previous story"
                  glyph="‹"
                  disabled={index === 0}
                  onPress={() => navigate(-1)}
                />
                <StoryIconButton
                  label={
                    index === stories.length - 1
                      ? "Finish stories"
                      : "Next story"
                  }
                  glyph="›"
                  onPress={() => navigate(1)}
                />
              </View>
            </View>
            {onProfile && (
              <LabButton
                title="View profile"
                secondary
                onPress={() => onProfile(story)}
              />
            )}
          </>
        )}
      </ScrollView>
      <LabSheet
        visible={options && !!story && story.userId !== viewerId}
        title="Story options"
        onClose={() => setOptions(false)}
      >
        <Text style={s.muted}>
          You can report this account to the LaQue support team.
        </Text>
        <LabButton
          title="Report account"
          secondary
          onPress={() => {
            setOptions(false);
            if (story) onReport?.(story);
          }}
        />
      </LabSheet>
    </LabShell>
  );
}

export function StoryComposerView({
  image,
  caption,
  onCaption,
  onPick,
  onPost,
  onClose,
  busy = false,
  locked = false,
  error,
  stage,
  width,
  previewOnly = false,
}: {
  image?: ImageSource | string | number | null;
  caption: string;
  onCaption: (value: string) => void;
  onPick: () => void;
  onPost: () => void;
  onClose: () => void;
  busy?: boolean;
  locked?: boolean;
  error?: string;
  stage?: string;
  width?: number;
  previewOnly?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [preview, setPreview] = useState(false),
    [discard, setDiscard] = useState(false);
  const window = useWindowDimensions();
  const [failedImage, setFailedImage] = useState<typeof image>();
  const close = () => {
    if (!busy) {
      if (image || caption.trim()) setDiscard(true);
      else onClose();
    }
  };
  return (
    <LabShell width={width} dark>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[s.composerHeader, { paddingTop: insets.top + 12 }]}>
          <StoryIconButton
            label="Close composer"
            glyph="‹"
            onPress={close}
            disabled={busy}
          />
          <Text accessibilityRole="header" style={s.title}>
            Your story
          </Text>
          <StoryIconButton
            label="Preview story"
            glyph="↗"
            disabled={!image || busy}
            onPress={() => setPreview(true)}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.composerBody}
        >
          <Text style={s.muted}>
            Share your latest set, a work in progress, or a little inspiration.
          </Text>
          <View style={s.visibility}>
            <Text style={s.visibilityText}>PUBLIC STORY</Text>
            <Text style={s.caption}>Disappears from Home after 24h</Text>
          </View>
          <View
            style={[
              s.composerPhoto,
              { height: Math.min(380, Math.max(220, window.height * 0.4)) },
            ]}
          >
            {image ? (
              <>
                {failedImage === image ? (
                  <View style={s.photoFallback}>
                    <Text style={s.muted}>
                      Photo preview unavailable. Choose a supported image.
                    </Text>
                  </View>
                ) : (
                  <Image
                    source={image}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="memory"
                    accessibilityLabel="Your story photo"
                    onError={() => setFailedImage(image)}
                  />
                )}
                <View pointerEvents="none" style={s.previewBadge}>
                  <Text style={s.visibilityText}>PHOTO PREVIEW</Text>
                </View>
              </>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose photo"
                disabled={busy}
                onPress={onPick}
                style={s.photoFallback}
              >
                <View style={s.imageIcon}>
                  <HomeIcon source={labAssets.image} size={30} />
                </View>
                <Text style={s.section}>Start with a photo</Text>
                <Text style={s.muted}>
                  Choose a moment from your camera roll
                </Text>
                <Text style={s.caption}>Images up to 8 MB</Text>
              </Pressable>
            )}
          </View>
          {!!image && (
            <LabButton
              title="Choose another photo"
              secondary
              disabled={busy || locked}
              onPress={onPick}
            />
          )}
          <View style={s.captionCard}>
            <View style={s.spread}>
              <Text style={s.section}>Add a caption</Text>
              <Text style={s.caption}>{caption.length}/500</Text>
            </View>
            <TextInput
              accessibilityLabel="Caption"
              placeholder="The details behind the design…"
              placeholderTextColor="#d3abb8"
              value={caption}
              onChangeText={onCaption}
              multiline
              maxLength={500}
              editable={!busy && !locked}
              style={s.captionInput}
            />
          </View>
          {locked && (
            <Text style={s.caption}>
              Your photo and caption are saved for this attempt. Retry to check
              whether it was posted.
            </Text>
          )}
          {!!error && <LabMessage error>{error}</LabMessage>}
          {!!stage && (
            <Text accessibilityLiveRegion="polite" style={s.muted}>
              {stage}
            </Text>
          )}
          {previewOnly && (
            <Text style={s.caption}>
              Demo story · visible only in this preview session.
            </Text>
          )}
        </ScrollView>
        <View
          style={[s.publishBar, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <Text style={s.caption}>Everyone on LaQue can view your story.</Text>
          <LabButton
            title="Post story"
            busy={busy}
            disabled={!image || busy}
            onPress={onPost}
          />
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={preview}
        animationType="slide"
        onRequestClose={() => setPreview(false)}
      >
        <StoryViewer
          width={width}
          preview
          stories={
            image
              ? [
                  {
                    id: "draft",
                    userId: "self",
                    name: "Your story",
                    image,
                    caption,
                    createdAt: new Date().toISOString(),
                  },
                ]
              : []
          }
          onClose={() => setPreview(false)}
          onRetry={() => undefined}
        />
      </Modal>
      <LabSheet
        visible={discard}
        title="Leave this story?"
        onClose={() => setDiscard(false)}
      >
        <Text style={s.muted}>
          {locked
            ? "This attempt may already have reached LaQue. Check Your story on Home before posting it again."
            : "Your photo and caption haven’t been posted. Leaving will discard this draft."}
        </Text>
        <LabButton title="Keep editing" onPress={() => setDiscard(false)} />
        <LabButton
          title={locked ? "Leave and check Home" : "Discard draft"}
          secondary
          onPress={() => {
            setDiscard(false);
            onClose();
          }}
        />
      </LabSheet>
    </LabShell>
  );
}

const s = StyleSheet.create({
  viewerHeader: { paddingHorizontal: 16, gap: 16, paddingBottom: 16 },
  progress: { flexDirection: "row", gap: 5 },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,.22)",
  },
  trackActive: { backgroundColor: "#ffb3c9" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  spread: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#7c203c",
    borderWidth: 1,
    borderColor: "#ed9eb7",
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { ...typography.body, color: "white" },
  name: { ...typography.body, color: "white" },
  title: {
    ...typography.heading,
    fontSize: 30,
    lineHeight: 36,
    color: "white",
    flexShrink: 1,
  },
  section: { ...typography.section, color: "white" },
  muted: { ...typography.body, color: "#f1d8df" },
  caption: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: "#e4bdca",
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  glyph: {
    color: "white",
    fontSize: 26,
    lineHeight: 30,
    fontFamily: appFonts.regular,
  },
  viewerBody: { flexGrow: 1, paddingHorizontal: 12, gap: 14 },
  viewerPhoto: {
    width: "100%",
    aspectRatio: 0.73,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#1c0c12",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.13)",
  },
  storyCaption: { ...typography.body, color: "white", paddingHorizontal: 10 },
  photoFallback: {
    flex: 1,
    padding: 24,
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  state: { padding: 20, flex: 1, justifyContent: "center", gap: 20 },
  composerHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  composerBody: { paddingHorizontal: 24, paddingBottom: 24, gap: 18 },
  visibility: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  visibilityText: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 16,
    letterSpacing: 1.4,
    color: "#ffe2ed",
  },
  composerPhoto: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.32)",
    borderStyle: "dashed",
    backgroundColor: "rgba(20,3,12,.35)",
    overflow: "hidden",
  },
  imageIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewBadge: {
    position: "absolute",
    left: 16,
    top: 16,
    borderRadius: 20,
    backgroundColor: "rgba(35,7,19,.7)",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  captionCard: {
    backgroundColor: "rgba(255,255,255,.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
    borderRadius: 24,
    padding: 16,
    gap: 8,
  },
  captionInput: {
    ...typography.body,
    color: "white",
    minHeight: 76,
    textAlignVertical: "top",
    paddingVertical: 8,
  },
  publishBar: {
    backgroundColor: "rgba(36,6,18,.75)",
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.1)",
  },
});
