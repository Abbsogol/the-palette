import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { Design } from "../lib/types";
import { styles } from "./ui";
export function DesignCard({
  design,
  index = 0,
}: {
  design: Design;
  index?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${design.title}`}
      onPress={() =>
        router.push({ pathname: "/design/[id]", params: { id: design.id } })
      }
      style={{ flex: 1, gap: 8 }}
    >
      <Image
        source={design.image_url}
        contentFit="cover"
        style={{
          width: "100%",
          height: index % 2 ? 158 : 204,
          borderRadius: 24,
          backgroundColor: "#3d2630",
        }}
        accessibilityLabel={design.title}
      />
      <Text style={styles.subtitle}>{design.title}</Text>
      <Text style={styles.muted}>
        {[design.shape, design.category].filter(Boolean).join(" · ")}
      </Text>
    </Pressable>
  );
}
export function DesignGrid({ designs }: { designs: Design[] }) {
  return (
    <View style={{ flexDirection: "row", gap: 12 }}>
      {[0, 1].map((column) => (
        <View key={column} style={{ flex: 1, gap: 20 }}>
          {designs
            .filter((_, i) => i % 2 === column)
            .map((design, i) => (
              <DesignCard key={design.id} design={design} index={i + column} />
            ))}
        </View>
      ))}
    </View>
  );
}
