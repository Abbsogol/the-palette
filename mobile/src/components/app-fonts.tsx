import { useFonts } from "expo-font";
import { appFonts } from "../theme/typography";
import { useState, type PropsWithChildren } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const fonts = {
  "Anola-Regular": require("../../assets/fonts/Anola-Regular.otf"),
};

// Runtime loading also covers Expo Go and the standalone web design preview.
// Native development/beta builds additionally embed the font via app.config.ts.
function FontLoader({
  children,
  retry,
}: PropsWithChildren<{ retry: () => void }>) {
  const [loaded, error] = useFonts(fonts);
  if (loaded) return children;

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text accessibilityRole="alert" style={styles.text}>
            LaQue couldn’t load its fonts. Please try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={retry}
            style={styles.retry}
          >
            <Text style={styles.text}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color="white" accessibilityLabel="Loading LaQue" />
      )}
    </View>
  );
}

export function AppFonts({ children }: PropsWithChildren) {
  const [attempt, setAttempt] = useState(0);
  return (
    <FontLoader key={attempt} retry={() => setAttempt((value) => value + 1)}>
      {children}
    </FontLoader>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3c000e",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 16,
  },
  text: {
    fontFamily: appFonts.regular,
    color: "white",
    fontSize: 16,
    textAlign: "center",
  },
  retry: {
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: "#662737",
    borderRadius: 24,
  },
});
