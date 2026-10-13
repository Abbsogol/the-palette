import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import {
  AuthView,
  IntroView,
  type AuthMode,
} from "../features/welcome/welcome-view";
import {
  FirstLaunchProvider,
  useFirstLaunch,
} from "../features/welcome/first-launch";
import { AuthLinksPreview } from "./auth-links";
import HomeDesignPreview from "./home-main";

function PreviewFlow() {
  const launch = useFirstLaunch();
  const [screen, setScreen] = useState<"auth" | "home" | null>(null);
  const [mode, setMode] = useState<AuthMode>("welcome"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [demo, setDemo] = useState(false);
  const [links, setLinks] = useState(false);
  if (!launch.ready)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: "#21090f",
        }}
      >
        <ActivityIndicator color="white" />
      </View>
    );
  if (!launch.seen)
    return (
      <IntroView
        onFinish={async () => {
          await launch.complete();
          setScreen("auth");
        }}
      />
    );
  const showAuth = () => {
    setMode("welcome");
    setMessage(
      "Choose the demo account to explore this preview without signing in.",
    );
    setScreen("auth");
  };
  if (links) return <AuthLinksPreview onClose={() => setLinks(false)} />;
  if (screen === "home" && demo)
    return (
      <HomeDesignPreview
        guest={!demo}
        onRequireSignIn={showAuth}
        onExitDemo={
          demo
            ? () => {
                setDemo(false);
                showAuth();
              }
            : undefined
        }
      />
    );
  const previewNotice = () =>
    setMessage(
      "Real sign-in is available in the connected LaQue development build. Tap Explore demo account to browse here without a password.",
    );
  return (
    <AuthView
      mode={mode}
      onMode={(value) => {
        setMode(value);
        setMessage("");
        setPassword("");
      }}
      email={email}
      password={password}
      onEmail={setEmail}
      onPassword={setPassword}
      message={message}
      onSubmit={previewNotice}
      onProvider={previewNotice}
      onResend={previewNotice}
      onPreviewLinks={() => setLinks(true)}
      onDemo={() => {
        setEmail("");
        setPassword("");
        setMessage("");
        setDemo(true);
        setScreen("home");
      }}

      onCreator={() => {
        setMode("Create account");
        setMessage("");
      }}
      onBack={() => setMode("welcome")}
    />
  );
}
export default function WelcomePreview() {
  return (
    <FirstLaunchProvider preview>
      <PreviewFlow />
    </FirstLaunchProvider>
  );
}
