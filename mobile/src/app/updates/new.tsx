import { router } from "expo-router";
import { RequireAuth } from "../../components/ui";
import {
  Screen,
  Card,
  Button,
  styles,
} from "../../features/secondary/primitives";
import { Text } from "react-native";
export default function NewUpdate() {
  return (
    <RequireAuth>
      <Screen
        title="Official Updates"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
      >
        <Card>
          <Text style={styles.text}>
            Official Updates are managed by assigned admins in Admin Studio.
          </Text>
          <Text style={styles.muted}>
            Share your designs, photos and videos with a caption in Community.
          </Text>
          <Button
            title="Create a Community post"
            onPress={() => router.replace("/community/new")}
          />
        </Card>
      </Screen>
    </RequireAuth>
  );
}
