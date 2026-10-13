import { Text } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, styles } from "../features/secondary/primitives";
export default function AccountClosed() {
  return (
    <Screen title="Account closed" back={false}>
      <Card>
        <Text style={styles.tag}>PERMANENTLY CLOSED</Text>
        <Text style={styles.heading}>Your account\nhas been closed.</Text>
        <Text style={styles.text}>
          Your profile is no longer available. This account cannot be restored.
        </Text>
        <Text style={styles.muted}>
          File cleanup and any outstanding refunds continue separately. We keep
          only records needed for outstanding obligations and applicable legal
          requirements.
        </Text>
      </Card>
      <Button title="Return to Home" onPress={() => router.replace("/")} />
    </Screen>
  );
}
