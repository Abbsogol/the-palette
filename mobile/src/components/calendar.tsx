import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { calendarDay, monthCells, moveMonth } from "../lib/calendar";
import { useCurrentTime } from "../lib/clock";
import { Button, styles, palette } from "./ui";
export function Calendar({
  timeZone,
  value,
  onChange,
}: {
  timeZone: string;
  value: string;
  onChange: (date: string) => void;
}) {
  const now = useCurrentTime();
  const today = calendarDay(now, timeZone);
  const [chosenMonth, setMonth] = useState("");
  const month = chosenMonth || value.slice(0, 7) || today.slice(0, 7);
  const label = new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <Button
          title="Previous month"
          secondary
          disabled={month <= today.slice(0, 7)}
          onPress={() => setMonth(moveMonth(month, -1))}
        />
        <Button
          title="Next month"
          secondary
          onPress={() => setMonth(moveMonth(month, 1))}
        />
      </View>
      <Text accessibilityRole="header" style={styles.subtitle}>
        {label}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <Text
            key={index}
            style={[styles.muted, { width: "14.285%", textAlign: "center" }]}
          >
            {day}
          </Text>
        ))}
        {monthCells(month).map((date, index) =>
          date ? (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityLabel={date}
              accessibilityState={{
                selected: date === value,
                disabled: date < today,
              }}
              disabled={date < today}
              onPress={() => onChange(date)}
              style={{
                width: "14.285%",
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 24,
                opacity: date < today ? 0.35 : 1,
                backgroundColor:
                  date === value ? palette.burgundy : "transparent",
              }}
            >
              <Text style={styles.text}>{Number(date.slice(-2))}</Text>
            </Pressable>
          ) : (
            <View
              key={`empty-${index}`}
              style={{ width: "14.285%", minHeight: 48 }}
            />
          ),
        )}
      </View>
    </View>
  );
}
