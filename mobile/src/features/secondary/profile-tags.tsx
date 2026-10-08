import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Field, Notice, Section, styles } from "./primitives";
const suggestions = [
  "Minimal",
  "Glam",
  "Nail Art",
  "French",
  "Chrome",
  "BIAB",
  "Gel-X",
  "Bridal",
  "3D",
  "Airbrush",
  "Cat-eye",
  "Marble",
  "Aura",
  "Ombré",
  "Gel",
  "Acrylic",
  "Extensions",
];
export function ProfileTags({
  value,
  creator,
  disabled,
  onChange,
  onPendingChange,
}: {
  value: string[];
  creator: boolean;
  disabled: boolean;
  onChange: (tags: string[]) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [custom, setCustom] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    onPendingChange?.(!!custom.trim());
  }, [custom, onPendingChange]);
  const selected = (tag: string) =>
    value.some((v) => v.toLowerCase() === tag.toLowerCase());
  const choices = [...value, ...suggestions.filter((tag) => !selected(tag))];
  function toggle(tag: string) {
    setError("");
    if (selected(tag))
      onChange(value.filter((v) => v.toLowerCase() !== tag.toLowerCase()));
    else if (value.length >= 20)
      setError("Choose up to 20 tags. Remove one to add another.");
    else onChange([...value, tag]);
  }
  return (
    <Section
      title={creator ? "Your specialties" : "Your interests"}
      subtitle={
        creator
          ? "Help clients discover your style and techniques. These tags appear on your public profile."
          : "Show the styles you love. These tags appear on your public profile."
      }
    >
      <Card>
        <Text style={styles.tag}>{value.length} OF 20 SELECTED · OPTIONAL</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {choices.map((tag) => (
            <Pressable
              key={tag}
              accessibilityRole="checkbox"
              aria-checked={selected(tag)}
              aria-disabled={disabled}
              accessibilityLabel={tag}
              accessibilityState={{ checked: selected(tag), disabled }}
              disabled={disabled}
              onPress={() => toggle(tag)}
              style={{
                minHeight: 44,
                maxWidth: "100%",
                paddingHorizontal: 16,
                paddingVertical: 11,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: selected(tag) ? "#ff91b0" : "#ffffff40",
                backgroundColor: selected(tag) ? "#aa3153" : "#ffffff09",
              }}
            >
              <Text style={styles.small}>
                {selected(tag) ? "✓ " : ""}
                {tag}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Add your own tag"
          value={custom}
          onChangeText={setCustom}
          maxLength={50}
          editable={!disabled}
          placeholder="e.g. Sculpted gel"
          hint="Up to 50 characters per tag."
        />
        <Button
          title="Add tag"
          secondary
          disabled={disabled || !custom.trim()}
          onPress={() => {
            const tag = custom.trim();
            if (selected(tag)) {
              setError("This tag is already selected.");
              return;
            }
            if (value.length >= 20) {
              setError("Choose up to 20 tags. Remove one to add another.");
              return;
            }
            onChange([...value, tag]);
            setCustom("");
            setError("");
          }}
        />
        {!!error && <Notice error>{error}</Notice>}
      </Card>
    </Section>
  );
}
