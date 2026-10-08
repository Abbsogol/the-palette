import {
  EligibilityConsent,
  emptyEligibility,
  eligibilityMessage,
  type Eligibility,
} from "./eligibility";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeAssets } from "../home/assets";
import { homeFonts } from "../home/tokens";
import { HomeGlass } from "../home/home-primitives";
import { ProgressiveBlur } from "../home/progressive-blur";

export const INTRO_SLIDES = [
  {
    image: require("../../../assets/figma/onboarding/intro-1.png"),
    title: "laQue",
    description: "Your next nail set, designed,\ntried on, and booked",
  },
  {
    image: require("../../../assets/figma/onboarding/intro-2.png"),
    title: "FULL COLOUR SPECS",
    description:
      "Hex codes, gel brand, shade names, finish type. No more vague inspo",
  },
  {
    image: require("../../../assets/figma/onboarding/intro-3.png"),
    title: "SEARCH & FILTER",
    description:
      "By shape, length, technique,\nor occasion. Everyday to editorial",
  },
  {
    image: require("../../../assets/figma/onboarding/intro-4.png"),
    title: "SAVE & SHARE",
    description:
      "Bookmark looks and send a direct link straight to your nail tech",
  },
];
export type AuthMode =
  "welcome" | "Sign in" | "Create account" | "Reset password" | "Verify email";
export function WelcomeBackground({ width }: { width: number }) {
  const scale = width / 393;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}
    >
      <Image
        source={homeAssets.background}
        accessible={false}
        contentFit="fill"
        style={{
          position: "absolute",
          left: -21 * scale,
          top: -7 * scale,
          width: 629 * scale,
          height: 1353 * scale,
        }}
      />
    </View>
  );
}
function Frame({
  children,
}: {
  children: (width: number, height: number) => ReactNode;
}) {
  const window = useWindowDimensions();
  const width =
    Platform.OS === "web" ? Math.min(393, window.width) : window.width;
  return (
    <View style={s.outer}>
      <View
        style={{
          width,
          flex: 1,
          overflow: "hidden",
          backgroundColor: "#21090f",
        }}
      >
        {children(width, window.height)}
      </View>
    </View>
  );
}
export function WelcomeButton({
  title,
  onPress,
  busy,
  disabled,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ busy: !!busy, disabled: !!disabled || !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[s.button, (disabled || busy) && { opacity: 0.65 }]}
    >
      {secondary ? (
        <HomeGlass style={StyleSheet.absoluteFill} />
      ) : (
        <LinearGradient
          colors={["#660007", "#ff517f"]}
          locations={[0.47832, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={s.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}
export function IntroView({
  onFinish,
}: {
  onFinish: () => Promise<void> | void;
}) {
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef(false);
  const insets = useSafeAreaInsets(),
    { fontScale } = useWindowDimensions();
  const finish = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onFinish();
    } catch {
      setError("Could not continue. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const slide = INTRO_SLIDES[step];
  return (
    <Frame>
      {(width, height) => {
        const scale = width / 393;
        const canvas = Math.max(
          height,
          852 * scale,
          fontScale > 1.3 ? 1100 : 0,
        );
        return (
          <ScrollView
            testID="welcome-intro"
            contentContainerStyle={{ minHeight: canvas }}
            showsVerticalScrollIndicator={false}
          >
            <WelcomeBackground width={width} />
            <Image
              key={`photo-${step}`}
              source={slide.image}
              accessible={false}
              contentFit="fill"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width,
                height: 761 * scale,
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 208 * scale,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            >
              <ProgressiveBlur />
              {/* The exported photos fade to white. Finish the dark fade at
                  the same image position on every screen, then stay opaque. */}
              <LinearGradient
                colors={["rgba(32,5,11,0)", "#20050b"]}
                style={{ height: 400 * scale, flexShrink: 0 }}
              />
              <View style={{ flex: 1, backgroundColor: "#20050b" }} />
            </View>
            <View
              style={[
                s.introToolbar,
                { top: Math.max(insets.top + 20, 64 * scale) },
              ]}
            >
              {step > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous slide"
                  disabled={busy}
                  onPress={() => setStep(step - 1)}
                  style={s.textButton}
                >
                  <Text style={s.caption}>Back</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip introduction"
                disabled={busy}
                onPress={() => void finish()}
                style={s.textButton}
              >
                <Text style={s.caption}>Skip</Text>
              </Pressable>
            </View>
            <View
              key={`copy-${step}`}
              accessibilityLiveRegion="polite"
              style={{
                marginTop: (step ? 454 : 431.8) * scale,
                paddingHorizontal: 24,
                gap: step ? 32 : 0,
              }}
            >
              {step > 0 && <Text style={s.counter}>{`0${step}/03`}</Text>}
              <View>
                <Text
                  accessibilityRole="header"
                  style={
                    step
                      ? [
                          s.introTitle,
                          { fontSize: 32 * scale, lineHeight: 38.4 * scale },
                        ]
                      : [
                          s.introLogo,
                          { fontSize: 112 * scale, lineHeight: 134.4 * scale },
                        ]
                  }
                >
                  {slide.title}
                </Text>
                <Text style={s.caption}>{slide.description}</Text>
              </View>
            </View>
            <View
              style={{
                marginTop: "auto",
                paddingTop: 40,
                paddingHorizontal: 24,
                paddingBottom: Math.max(92 * scale, insets.bottom + 50),
              }}
            >
              {!!error && (
                <Text accessibilityRole="alert" style={s.feedback}>
                  {error}
                </Text>
              )}
              <WelcomeButton
                title={step === 3 ? "Get started" : "Next"}
                busy={busy}
                onPress={() => (step === 3 ? void finish() : setStep(step + 1))}
              />
            </View>
          </ScrollView>
        );
      }}
    </Frame>
  );
}
export type AuthViewProps = {
  mode: AuthMode;
  onMode: (mode: AuthMode) => void;
  email: string;
  password: string;
  onEmail: (value: string) => void;
  onPassword: (value: string) => void;
  onSubmit: (eligibility?: Eligibility) => void;
  onProvider: (provider: "google" | "apple", eligibility?: Eligibility) => void;
  onCreator: () => void;
  onBack: () => void;
  onResend: () => void;
  /** Only supplied by the isolated visual-preview entry point. */
  onDemo?: () => void;
  onPreviewLinks?: () => void;
  busy?: boolean;
  error?: string;
  message?: string;
  canResend?: boolean;
};
export function AuthView(p: AuthViewProps) {
  const [eligibility, setEligibility] = useState(emptyEligibility),
    [eligibilityError, setEligibilityError] = useState("");
  const submit = () => {
    if (
      p.mode === "Create account" &&
      (!eligibility.ageConfirmed || !eligibility.privacyAccepted)
    ) {
      setEligibilityError(eligibilityMessage);
      return;
    }
    setEligibilityError("");
    p.onSubmit(eligibility);
  };
  const provider = (name: "google" | "apple") => {
    if (!eligibility.ageConfirmed || !eligibility.privacyAccepted) {
      setEligibilityError(eligibilityMessage);
      return;
    }
    setEligibilityError("");
    p.onProvider(name, eligibility);
  };
  const insets = useSafeAreaInsets();
  const landing = p.mode === "welcome";
  const emailLink = p.mode === "Reset password" || p.mode === "Verify email";
  const [showPassword, setShowPassword] = useState(false);
  return (
    <Frame>
      {(width) => (
        <>
          <WelcomeBackground width={width} />
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingTop: Math.max(insets.top, 17),
                paddingBottom: Math.max(insets.bottom, 34),
                paddingHorizontal: 24,
              }}
            >
              <Text style={s.headerLogo}>LaQue</Text>
              {!landing && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to sign-in options"
                  onPress={p.onBack}
                  disabled={p.busy}
                  style={[
                    s.textButton,
                    { alignSelf: "flex-start", marginTop: 12 },
                  ]}
                >
                  <Text style={s.small}>Back</Text>
                </Pressable>
              )}
              {landing ? (
                <>
                  <Text
                    accessibilityRole="header"
                    style={[
                      s.landingLogo,
                      {
                        fontSize: Math.min(96, (width - 48) / 3.2),
                        lineHeight: 115.2,
                      },
                    ]}
                  >
                    laQue
                  </Text>
                  <Text style={s.caption}>
                    {"Your next nail set, designed,\ntried on, and booked"}
                  </Text>
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={s.formTitle}>
                    {p.mode === "Create account"
                      ? "Join LaQue"
                      : p.mode === "Reset password"
                        ? "Reset password"
                        : p.mode === "Verify email"
                          ? "Verify your email"
                          : "Welcome back"}
                  </Text>
                  <Text
                    style={[s.small, { textAlign: "center", marginBottom: 24 }]}
                  >
                    {p.mode === "Reset password"
                      ? "We’ll send you a link to reset your password."
                      : p.mode === "Verify email"
                        ? "Request a fresh verification link. Open the newest email on this device."
                        : "Your next set starts here."}
                  </Text>
                </>
              )}
              <View style={{ marginTop: landing ? 39 : 0, gap: 12 }}>
                {!!p.onDemo && (
                  <>
                    <WelcomeButton
                      title="Explore demo account"
                      onPress={p.onDemo}
                    />
                    <Text style={[s.small, { textAlign: "center" }]}>
                      LaQue Demo · No password needed. Browse sample designs;
                      messages, bookings and purchases are not connected.
                    </Text>
                  </>
                )}
                {!!p.onPreviewLinks && (
                  <WelcomeButton
                    title="Preview account links"
                    secondary
                    onPress={p.onPreviewLinks}
                  />
                )}
                {!!p.error && (
                  <Text accessibilityRole="alert" style={s.feedback}>
                    {p.error}
                  </Text>
                )}
                {!!p.message && (
                  <Text accessibilityLiveRegion="polite" style={s.feedback}>
                    {p.message}
                  </Text>
                )}
                {!emailLink && (
                  <EligibilityConsent
                    value={eligibility}
                    onChange={(value) => {
                      setEligibility(value);
                      setEligibilityError("");
                    }}
                    disabled={p.busy}
                  />
                )}
                {!!eligibilityError && (
                  <Text accessibilityRole="alert" style={s.feedback}>
                    {eligibilityError}
                  </Text>
                )}
                {landing ? (
                  <>
                    <WelcomeButton
                      title="Continue with Google"
                      disabled={p.busy}
                      onPress={() => provider("google")}
                    />
                    <WelcomeButton
                      title="Continue with Apple"
                      disabled={p.busy}
                      secondary
                      onPress={() => provider("apple")}
                    />
                    <Text style={[s.small, s.or]}>or use your email</Text>
                    <View style={s.emailChoices}>
                      <View style={{ flex: 1 }}>
                        <WelcomeButton
                          title="Sign in"
                          disabled={p.busy}
                          onPress={() => p.onMode("Sign in")}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <WelcomeButton
                          title="Sign up"
                          disabled={p.busy}
                          secondary
                          onPress={() => p.onMode("Create account")}
                        />
                      </View>
                    </View>
                    <WelcomeButton
                      title="Join as a Creator"
                      disabled={p.busy}
                      secondary
                      onPress={p.onCreator}
                    />

                    <Text
                      style={[s.small, { textAlign: "center", opacity: 0.8 }]}
                    >
                      Sign in or create an account to enter LaQue.
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={s.label}>Email</Text>
                    <TextInput
                      accessibilityLabel="Email"
                      style={s.input}
                      value={p.email}
                      onChangeText={p.onEmail}
                      placeholder="you@example.com"
                      placeholderTextColor="#d8a5b0"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      autoComplete="email"
                      editable={!p.busy}
                    />
                    {!emailLink && (
                      <>
                        <Text style={s.label}>Password</Text>
                        <View style={s.passwordField}>
                          <TextInput
                            accessibilityLabel="Password"
                            style={[s.input, { flex: 1, paddingRight: 62 }]}
                            value={p.password}
                            onChangeText={p.onPassword}
                            secureTextEntry={!showPassword}
                            placeholder={
                              p.mode === "Create account"
                                ? "At least 8 characters"
                                : "Your password"
                            }
                            placeholderTextColor="#d8a5b0"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoComplete={
                              p.mode === "Create account"
                                ? "new-password"
                                : "current-password"
                            }
                            editable={!p.busy}
                            onSubmitEditing={submit}
                            returnKeyType="go"
                          />
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onPress={() => setShowPassword(!showPassword)}
                            style={s.passwordToggle}
                          >
                            <Text style={s.small}>
                              {showPassword ? "Hide" : "Show"}
                            </Text>
                          </Pressable>
                        </View>
                      </>
                    )}
                    <WelcomeButton
                      title={
                        p.mode === "Reset password"
                          ? "Send reset link"
                          : p.mode === "Verify email"
                            ? "Send verification link"
                            : p.mode === "Create account"
                              ? "Create account"
                              : "Sign in"
                      }
                      busy={p.busy}
                      onPress={submit}
                    />
                    {p.canResend && (
                      <WelcomeButton
                        title="Resend verification email"
                        secondary
                        disabled={p.busy}
                        onPress={p.onResend}
                      />
                    )}
                    {p.mode === "Sign in" && (
                      <Pressable
                        accessibilityRole="button"
                        disabled={p.busy}
                        onPress={() => p.onMode("Reset password")}
                        style={s.textButton}
                      >
                        <Text style={s.small}>Forgot password?</Text>
                      </Pressable>
                    )}
                    {!emailLink && (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          disabled={p.busy}
                          onPress={() =>
                            p.onMode(
                              p.mode === "Sign in"
                                ? "Create account"
                                : "Sign in",
                            )
                          }
                          style={s.textButton}
                        >
                          <Text style={s.small}>
                            {p.mode === "Sign in"
                              ? "New here? Sign up"
                              : "Already have an account? Sign in"}
                          </Text>
                        </Pressable>
                        <WelcomeButton
                          title="Continue with Google"
                          secondary
                          disabled={p.busy}
                          onPress={() => provider("google")}
                        />
                        <WelcomeButton
                          title="Continue with Apple"
                          secondary
                          disabled={p.busy}
                          onPress={() => provider("apple")}
                        />
                      </>
                    )}
                  </>
                )}
                {landing && p.busy && (
                  <ActivityIndicator
                    accessibilityLabel="Signing in"
                    color="white"
                  />
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

        </>
      )}
    </Frame>
  );
}
const s = StyleSheet.create({
  outer: { flex: 1, backgroundColor: "#21090f", alignItems: "center" },
  introToolbar: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 2,
  },
  textButton: {
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  introLogo: {
    fontFamily: homeFonts.display,
    color: "white",
    textAlign: "center",
  },
  introTitle: {
    fontFamily: homeFonts.display,
    color: "white",
    textAlign: "center",
  },
  caption: {
    color: "#ffeded",
    fontFamily: homeFonts.light,
    fontWeight: "300",
    fontSize: 20,
    lineHeight: 22,
    textAlign: "center",
  },
  counter: {
    fontFamily: homeFonts.light,
    color: "white",
    fontSize: 20,
    lineHeight: 22,
    textAlign: "center",
    fontWeight: "200",
  },
  button: {
    minHeight: 54,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 100,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 18,
    lineHeight: 22,
    textAlign: "center",
  },
  headerLogo: {
    color: "white",
    fontFamily: homeFonts.display,
    fontSize: 24,
    lineHeight: 29,
    textAlign: "center",
  },
  landingLogo: {
    fontFamily: homeFonts.display,
    color: "white",
    textAlign: "center",
    marginTop: 41,
    marginBottom: 9,
  },
  small: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  or: { textAlign: "center", marginVertical: 6, color: "#ffeded" },
  emailChoices: { flexDirection: "row", gap: 12 },
  formTitle: {
    fontFamily: homeFonts.display,
    fontSize: 36,
    lineHeight: 44,
    textAlign: "center",
    color: "white",
    marginTop: 16,
    marginBottom: 12,
  },
  feedback: {
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: "rgba(40,0,10,.7)",
    padding: 14,
    borderRadius: 16,
    marginBottom: 4,
  },
  label: {
    color: "#ffeded",
    fontFamily: homeFonts.regular,
    fontSize: 16,
    lineHeight: 20,
  },
  input: {
    minHeight: 54,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.35)",
    backgroundColor: "rgba(255,255,255,.1)",
    paddingHorizontal: 18,
    paddingVertical: 14,
    color: "white",
    fontFamily: homeFonts.regular,
    fontSize: 16,
    lineHeight: 22,
  },
  passwordField: { flexDirection: "row", alignItems: "center" },
  passwordToggle: {
    position: "absolute",
    right: 6,
    minWidth: 50,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
});
