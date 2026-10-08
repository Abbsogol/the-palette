import { useRef, useState } from "react";
import { View, Pressable, Text } from "react-native";
import { Image } from "expo-image";
import { SocialComposer, type SocialDraft } from "../features/social/composer";
import { pickSocialMedia } from "../features/social/picker";
import type { SocialMedia } from "../features/social/media";
import type { TaggedPerson } from "../features/social/people";
import {
  LabSheet,
  LabButton,
  LabMessage,
  s,
} from "../features/lab-ui/primitives";
export const samplePeople: TaggedPerson[] = [
  { id: "preview-self", username: "sarah.nails", name: "Sarah" },
  { id: "anelia", username: "anelia.cafe", name: "Anelia Cafe" },
  { id: "sarah", username: "sarah.m", name: "Sarah M." },
];
export const previewPeople = async (q: string) =>
  samplePeople.filter((p) =>
    `${p.username} ${p.name}`
      .toLowerCase()
      .includes(q.replace(/^@/, "").toLowerCase()),
  );
const samples = [
  require("../../assets/figma/home-main/f24ce.png"),
  require("../../assets/figma/home-main/6cdce.png"),
  require("../../assets/figma/home-main/e8424.png"),
];
export function SocialComposerPreview({
  kind,
  onClose,
  onPost,
}: {
  kind: "post" | "story";
  onClose: () => void;
  onPost: (d: SocialDraft) => void;
}) {
  const [picker, setPicker] = useState(false),
    [error, setError] = useState("");
  const resolve = useRef<((m: SocialMedia | null) => void) | null>(null);
  const finish = (m: SocialMedia | null) => {
    resolve.current?.(m);
    resolve.current = null;
    setPicker(false);
  };
  return (
    <>
      <SocialComposer
        kind={kind}
        onClose={onClose}
        onPick={() =>
          new Promise((r) => {
            resolve.current = r;
            setPicker(true);
          })
        }
        searchPeople={previewPeople}
        preview
        onPost={async (d) => onPost(d)}
      />
      <LabSheet
        visible={picker}
        title="Choose photo or video"
        onClose={() => finish(null)}
      >
        <LabButton
          title="Choose from photo library"
          onPress={() =>
            void pickSocialMedia()
              .then(finish)
              .catch((e) => setError(e.message))
          }
        />
        <Text style={s.text}>Or try a sample photo</Text>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {samples.map((source, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={`Use sample photo ${i + 1}`}
              onPress={() => finish({ uri: source, type: "image" })}
              style={{ flex: 1 }}
            >
              <Image
                source={source}
                style={{ width: "100%", aspectRatio: 0.75, borderRadius: 16 }}
              />
            </Pressable>
          ))}
        </View>
        {!!error && <LabMessage error>{error}</LabMessage>}
        <Text style={s.small}>
          Nothing is published. This content stays in your preview session.
        </Text>
      </LabSheet>
    </>
  );
}
