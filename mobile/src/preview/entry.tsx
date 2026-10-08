import { registerRootComponent } from "expo";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import WelcomePreview from "./welcome";
import { AppFonts } from "../components/app-fonts";

function HomePreviewApp() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppFonts>
        <WelcomePreview />
      </AppFonts>
    </SafeAreaProvider>
  );
}
registerRootComponent(HomePreviewApp);
