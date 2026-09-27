import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { configurationError } from "../lib/config";
import { Notice, Screen, palette } from "../components/ui";
import { ServiceGate } from "../components/service-gate";
import { AccountNavigation } from "../components/account-navigation";

function Routes() {
  const { epoch } = useAuth();
  return (
    <>
      <AccountNavigation />
      <Stack
        key={epoch}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: palette.background },
        }}
      />
    </>
  );
}
export default function Layout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {configurationError ? (
        <Screen title="LaQue development">
          <Notice>{configurationError}</Notice>
          <Notice>
            This build needs an isolated backend before you can sign in. Ask the
            beta administrator to configure it.
          </Notice>
        </Screen>
      ) : (
        <ServiceGate>
          <AuthProvider>
            <Routes />
          </AuthProvider>
        </ServiceGate>
      )}
    </SafeAreaProvider>
  );
}
