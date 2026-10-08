import { useEffect, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEvent } from "expo";
import { Button, styles } from "../secondary/primitives";
export type SocialMedia = {
  type: "image" | "video";
  uri: ImageSource | string | number;
  path?: string;
  mime?: string;
};
function Video({ uri, onRetry }: { uri: string; onRetry: () => void }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
  });
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={{ flex: 1 }}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture={false}
      />
      {status === "loading" && (
        <View style={fallback}>
          <ActivityIndicator
            accessibilityLabel="Loading video"
            color="#ff8dae"
          />
        </View>
      )}
      {status === "error" && (
        <View style={fallback}>
          <Text accessibilityRole="alert" style={styles.muted}>
            {error?.message ||
              "This video couldn’t load. Check your connection and retry."}
          </Text>
          <Button title="Retry video" secondary onPress={onRetry} />
        </View>
      )}
    </View>
  );
}
const fallback = {
  ...StyleSheet.absoluteFill,
  backgroundColor: "#21090f",
  justifyContent: "center" as const,
  padding: 24,
  gap: 16,
};
function Photo({ media }: { media: SocialMedia }) {
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0);
  if (failed)
    return (
      <View style={fallback}>
        <Text style={styles.subtitle}>This photo couldn’t load</Text>
        <Text style={styles.muted}>Check your connection and try again.</Text>
        <Button
          title="Retry photo"
          secondary
          onPress={() => {
            setAttempt((v) => v + 1);
            setFailed(false);
            setLoading(true);
          }}
        />
      </View>
    );
  return (
    <>
      <Image
        key={attempt}
        source={media.uri}
        contentFit="contain"
        style={StyleSheet.absoluteFill}
        cachePolicy="none"
        accessibilityLabel="Photo"
        onLoad={() => setLoading(false)}
        onError={() => setFailed(true)}
      />
      {loading && (
        <View
          pointerEvents="none"
          style={{ ...StyleSheet.absoluteFill, justifyContent: "center" }}
        >
          <ActivityIndicator
            accessibilityLabel="Loading photo"
            color="#ff8dae"
          />
        </View>
      )}
    </>
  );
}
export function SocialMediaView({ media }: { media: SocialMedia }) {
  const [attempt, setAttempt] = useState(0);
  return media.type === "video" && typeof media.uri === "string" ? (
    <Video
      key={`${media.uri}:${attempt}`}
      uri={media.uri}
      onRetry={() => setAttempt((v) => v + 1)}
    />
  ) : (
    <Photo key={String(media.uri)} media={media} />
  );
}
