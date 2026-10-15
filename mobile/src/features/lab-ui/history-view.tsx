import { typography } from "../../theme/typography";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import {
  LabButton,
  LabHeader,
  LabMessage,
  LabPageBody,
  LabShell,
  s,
} from "./primitives";
export type GenerationCard = {
  id: string;
  title: string;
  shape: string;
  length: string;
  date: string;
  image: ImageSource | string | number | null;
};
export type HistoryViewProps = {
  width?: number;
  designs: GenerationCard[];
  total?: number;
  loading?: boolean;
  error?: string;
  actionError?: string;
  busy?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  onBack: () => void;
  onRetry: () => void;
  onMore: () => void;
  onSave?: (id: string, asDraft: boolean) => void;
  onOpen: (id: string) => void;
};
export function HistoryView(p: HistoryViewProps) {
  const { fontScale, width: windowWidth } = useWindowDimensions();
  const count = p.total;
  const columns = fontScale > 1.5 || (p.width ?? windowWidth) < 340 ? 1 : 2;
  return (
    <LabShell width={p.width} dark>
      <LabHeader onBack={p.onBack} />
      <LabPageBody>
        {!!p.actionError && <LabMessage error>{p.actionError}</LabMessage>}
        <View style={{ gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={{
              ...typography.heading,
              color: "white",
            }}
          >
            My Generations
          </Text>
          <Text style={[s.subtitle, { color: "rgba(255,255,255,.8)" }]}>
            {p.loading
              ? "Loading designs…"
              : p.error
                ? "Unable to load designs"
                : `${count ?? p.designs.length}${count === undefined && p.hasMore ? "+" : ""} ${(count ?? p.designs.length) === 1 ? "design" : "designs"}`}
          </Text>
        </View>
        {p.loading ? (
          <ActivityIndicator
            accessibilityLabel="Loading generations"
            color="#d98cab"
          />
        ) : p.error ? (
          <>
            <LabMessage error>{p.error}</LabMessage>
            <LabButton title="Try again" onPress={p.onRetry} />
          </>
        ) : !p.designs.length ? (
          <>
            <LabMessage>
              Your next idea starts here. Generate your first design in Nail
              Lab.
            </LabMessage>
            <LabButton title="Create a design" onPress={p.onBack} />
          </>
        ) : (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
              marginTop: 4,
            }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <View key={column} style={{ flex: 1, gap: 12 }}>
                {p.designs
                  .filter((_, index) => index % columns === column)
                  .map((design) => (
                    <Pressable
                      key={design.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Open generation: ${design.title}, ${design.shape}, ${design.length}, ${design.date}`}
                      disabled={p.busy}
                      onPress={() => p.onOpen(design.id)}
                      style={[
                        s.card,
                        {
                          padding: 12,
                          gap: 8,
                          borderWidth: 0,
                          outlineWidth: 1,
                          outlineColor: "rgba(255,255,255,.1)",
                          outlineOffset: -1,
                        },
                      ]}
                    >
                      <GenerationImage design={design} />
                      <View style={{ gap: 4 }}>
                        <Text
                          style={[
                            s.text,
                            {
                              fontSize: 14,
                              lineHeight: 16.8,
                              fontWeight: "500",
                            },
                          ]}
                        >
                          {design.title}
                        </Text>
                        <Text
                          style={[
                            s.small,
                            {
                              color: "rgba(255,255,255,.8)",
                              fontSize: 13,
                              lineHeight: 15.6,
                            },
                          ]}
                        >
                          {design.shape} · {design.length} · {design.date}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
              </View>
            ))}
          </View>
        )}
        {p.hasMore && !p.error && (
          <LabButton
            title="Load older designs"
            secondary
            busy={p.loadingMore}
            onPress={p.onMore}
          />
        )}
      </LabPageBody>

    </LabShell>
  );
}
function GenerationImage({
  design,
  contain = false,
}: {
  design: GenerationCard;
  contain?: boolean;
}) {
  const [failedImage, setFailedImage] = useState<GenerationCard["image"]>();
  return !design.image || failedImage === design.image ? (
    <View
      style={{
        width: "100%",
        aspectRatio: 4 / 3,
        borderRadius: 12,
        backgroundColor: "rgba(255,255,255,.05)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={s.small}>Image unavailable</Text>
    </View>
  ) : (
    <Image
      key={design.id}
      source={design.image}
      accessibilityLabel={design.title}
      onError={() => setFailedImage(design.image)}
      style={{
        width: "100%",
        aspectRatio: contain ? 1.5 : 4 / 3,
        borderRadius: 12,
      }}
      contentFit={contain ? "contain" : "cover"}
      cachePolicy="none"
    />
  );
}
