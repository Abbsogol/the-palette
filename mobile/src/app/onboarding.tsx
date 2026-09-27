import { useState } from "react";
import { Text } from "react-native";
import { router, type Href } from "expo-router";
import {
  Button,
  Card,
  Chips,
  Field,
  Notice,
  RequireAuth,
  Screen,
  styles,
} from "../components/ui";
import { api } from "../lib/api";
import { queryClient } from "../lib/auth";

import { safeReturnPath } from "../lib/links";
import { secureStorage } from "../lib/secure-storage";
function Form() {
  const [role, setRole] = useState("Customer"),
    [name, setName] = useState(""),
    [location, setLocation] = useState(""),
    [bio, setBio] = useState("");
  const [step, setStep] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      if (!name.trim()) throw new Error("Enter your name.");
      await api("/set-account-type", {
        accountType: role === "Creator" ? "creator" : "user",
        displayName: name.trim(),
      });
      await api("/complete-onboarding", {
        display_name: name.trim(),
        location: location.trim(),
        bio: bio.trim(),
      });
      await queryClient.invalidateQueries();
      const next = safeReturnPath(
        await secureStorage.getItem("laque.auth-intent"),
      );
      await secureStorage.removeItem("laque.auth-intent");
      router.replace(next as Href);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const slides = [
    [
      "Discover your next set",
      "Explore designs and find creators who bring your ideas to life.",
    ],
    [
      "A little inspiration, made yours",
      "Save designs in collections and share them with your nail artist.",
    ],
    [
      "Create with LaQue Lab",
      "Explore ideas with AI, then save or publish the designs you love.",
    ],
  ];
  if (step < slides.length)
    return (
      <Card>
        <Text style={styles.muted}>{step + 1} of 3</Text>
        <Text style={styles.title}>{slides[step][0]}</Text>
        <Notice>{slides[step][1]}</Notice>
        <Button
          title={step === 2 ? "Set up my profile" : "Continue"}
          onPress={() => setStep(step + 1)}
        />
        <Button
          title="Skip introduction"
          secondary
          onPress={() => setStep(3)}
        />
      </Card>
    );
  return (
    <>
      <Chips
        label="I’m here as a"
        values={["Customer", "Creator"]}
        value={role}
        onChange={setRole}
      />
      <Field
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={80}
      />
      <Field
        label="Location"
        value={location}
        onChangeText={setLocation}
        maxLength={160}
      />
      <Field
        label="About me"
        value={bio}
        onChangeText={setBio}
        multiline
        maxLength={1000}
      />
      {role === "Creator" && (
        <Notice>
          After setting up your profile, add your services, working hours and
          local time zone before accepting bookings.
        </Notice>
      )}
      <Button title="Finish profile" busy={busy} onPress={() => void save()} />
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function Onboarding() {
  return (
    <Screen title="Your LaQue">
      <RequireAuth>
        <Form />
      </RequireAuth>
    </Screen>
  );
}
