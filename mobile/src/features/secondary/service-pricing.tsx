import { StyleSheet, Text, View } from "react-native";
import { styles } from "./primitives";
export function aed(amount: number) {
  return `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
// Accept the currency precision clients see; never silently round an entered amount.
export function parseServiceAmount(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  return Number.isSafeInteger(Math.round(amount * 100)) ? amount : null;
}
export function ServicePricing({
  price,
  deposit,
}: {
  price: number;
  deposit: number;
}) {
  const balance = Math.round((price - deposit) * 100) / 100;
  return (
    <View style={s.panel}>
      <Text style={styles.small}>Fixed total price</Text>
      <Text style={s.amount}>{aed(price)}</Text>
      <View style={s.row}>
        <View style={s.part}>
          <Text style={styles.small}>Deposit to confirm</Text>
          <Text style={styles.label}>{aed(deposit)}</Text>
        </View>
        <View style={s.part}>
          <Text style={styles.small}>Balance at appointment</Text>
          <Text style={styles.label}>{aed(balance)}</Text>
        </View>
      </View>
      <Text style={styles.small}>
        {deposit === 0
          ? "No deposit required. The client pays the total at the appointment."
          : balance === 0
            ? "The deposit covers the full service price. Nothing remains to pay at the appointment."
            : "The deposit is included in the total. The client pays the balance at the appointment."}
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  panel: {
    gap: 10,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "rgba(255,255,255,.06)",
    borderColor: "rgba(255,255,255,.12)",
    borderWidth: 1,
  },
  amount: { ...styles.subtitle, fontSize: 30, lineHeight: 36 },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,.12)",
  },
  part: { flexGrow: 1, flexBasis: 120, gap: 6 },
});
