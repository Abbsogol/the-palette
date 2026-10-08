import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LabSheet } from "../lab-ui/primitives";
import { Button, styles } from "./primitives";
const digits = (value: number) => String(value).padStart(2, "0");
function TimeColumn({
  label,
  count,
  value,
  onChange,
}: {
  label: string;
  count: number;
  value: string;
  onChange: (value: string) => void;
}) {
  const scroll = useRef<ScrollView>(null);
  useEffect(() => {
    scroll.current?.scrollTo({
      y: Math.max(0, (Number(value) - 2) * 48),
      animated: false,
    });
  }, [value]);
  return (
    <View style={s.column}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView
        ref={scroll}
        style={s.list}
        contentContainerStyle={{ gap: 4 }}
      >
        {Array.from({ length: count }, (_, i) => digits(i)).map((v) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${v}`}
            accessibilityState={{ selected: value === v }}
            onPress={() => onChange(v)}
            style={[s.option, value === v && s.selected]}
          >
            <Text style={styles.text}>{v}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
export function TimeSelector({
  title,
  value,
  closing,
  onCancel,
  onConfirm,
}: {
  title: string;
  value: string;
  closing: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [hour, setHour] = useState(value.slice(0, 2)),
    [minute, setMinute] = useState(value.slice(3, 5));
  const midnight = hour === "24";
  return (
    <LabSheet visible title={title} onClose={onCancel}>
      <Text style={styles.small}>24-hour time · your service time zone</Text>
      <Text
        accessibilityLiveRegion="polite"
        style={[styles.subtitle, { textAlign: "center" }]}
      >
        {hour}:{midnight ? "00" : minute}
      </Text>
      <View style={s.columns}>
        <TimeColumn
          label="Hour"
          count={closing ? 25 : 24}
          value={hour}
          onChange={setHour}
        />
        {midnight ? (
          <View style={s.column}>
            <Text style={styles.label}>Minute</Text>
            <Text style={styles.muted}>
              00 · midnight at the end of this day
            </Text>
          </View>
        ) : (
          <TimeColumn
            label="Minute"
            count={60}
            value={minute}
            onChange={setMinute}
          />
        )}
      </View>
      <Button
        title="Use time"
        onPress={() => onConfirm(`${hour}:${midnight ? "00" : minute}`)}
      />
      <Button title="Cancel time selection" secondary onPress={onCancel} />
    </LabSheet>
  );
}
export function TimeControl({
  label,
  value,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[s.control, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.subtitle}>
        {value} <Text style={styles.small}>⌄</Text>
      </Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  columns: { flexDirection: "row", gap: 16 },
  column: { flex: 1, gap: 8 },
  list: { height: 192 },
  option: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.12)",
  },
  selected: { backgroundColor: "rgba(255,81,127,.25)", borderColor: "#ff517f" },
  control: {
    flex: 1,
    minWidth: 110,
    minHeight: 78,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.06)",
    gap: 8,
  },
});
