import { useEffect, useState } from "react";
import { AppState, Text } from "react-native";
import { Image } from "expo-image";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
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
import { api, ApiError, checked } from "../lib/api";
import { useProfile, queryClient } from "../lib/auth";
import { accountScope } from "../lib/account-scope";
import { readPending, writePending } from "../lib/pending";
import { setSaved } from "../lib/designs";
import { supabase } from "../lib/supabase";
type Request = {
  requestId: string;
  shape: string;
  length: string;
  vibe: string[];
  colors: string[];
  customText: string;
  freeRegen?: boolean;
  parentGenerationId?: string;
};
type Result = {
  status?: string;
  generationId?: string;
  imageUrl?: string;
  creditsRemaining?: number;
  error?: string;
  freeRegenUsed?: boolean;
};
function Lab() {
  const profile = useProfile();
  const [shape, setShape] = useState("Almond"),
    [length, setLength] = useState("Medium"),
    [vibe, setVibe] = useState("Minimal"),
    [colors, setColors] = useState(""),
    [prompt, setPrompt] = useState(""),
    [pending, setPending] = useState<Request | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void readPending<Request>("generation")
      .then(setPending)
      .catch((e) => setError(e.message));
  }, []);
  const accept = async (data: Result) => {
    if (data.generationId && data.imageUrl) {
      await writePending("generation", null, accountScope.capture());
      const saved = await checked<{ free_regen_used: boolean }>(
        supabase
          .from("nail_lab_generations")
          .select("free_regen_used")
          .eq("id", data.generationId)
          .single(),
      );
      setResult({ ...data, freeRegenUsed: saved.free_regen_used });
      setPending(null);
      setNotice("Your design is ready.");
      await queryClient.invalidateQueries();
    } else if (data.status === "released") {
      await writePending("generation", null, accountScope.capture());
      setPending(null);
      setNotice(
        "This attempt ended. Your current balance is shown above. You can start a new generation.",
      );
      await queryClient.invalidateQueries();
    } else
      setNotice(
        "Your design is processing. You can leave this screen and return to check it.",
      );
  };
  useEffect(() => {
    if (!pending) return;
    const ticket = accountScope.capture();
    let active = true;
    const check = () => {
      if (AppState.currentState !== "active") return;
      void api<Result>(`/generation-status?requestId=${pending.requestId}`)
        .then(async (data) => {
          if (active && accountScope.isCurrent(ticket)) await accept(data);
        })
        .catch((e) => {
          if (active && accountScope.isCurrent(ticket))
            setError(
              e.status === 404
                ? "This request has not reached the server. Retry the same request."
                : e.message,
            );
        });
    };
    check();
    const timer = setInterval(check, 5000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      active = false;
      clearInterval(timer);
      sub.remove();
    };
    // This effect follows only the durable request identity; UI settings may change independently.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.requestId]);
  const generate = async (free = false) => {
    setBusy(true);
    setError("");
    setNotice("");
    const ticket = accountScope.capture();
    try {
      const request = pending || {
        requestId: Crypto.randomUUID(),
        shape,
        length,
        vibe: [vibe],
        colors: colors
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        customText: prompt,
        ...(free && result?.generationId
          ? { freeRegen: true, parentGenerationId: result.generationId }
          : {}),
      };
      await writePending("generation", request, ticket);
      setPending(request);
      const data = await api<Result>("/generate-nail-design", request);
      accountScope.assert(ticket);
      await accept(data);
    } catch (e) {
      if (
        e instanceof ApiError &&
        [400, 402, 403, 410, 422].includes(e.status) &&
        accountScope.isCurrent(ticket)
      ) {
        await writePending("generation", null, ticket);
        setPending(null);
      }
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const publish = async (asDraft: boolean) => {
    setBusy(true);
    setError("");
    try {
      const { designId } = await api<{ designId: string }>(
        "/publish-nail-lab-generation",
        { generationId: result!.generationId, asDraft },
      );
      if (asDraft) await setSaved(accountScope.capture().id!, designId, true);
      await queryClient.invalidateQueries();
      router.push({ pathname: "/design/[id]", params: { id: designId } });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Text style={styles.text}>Your next set starts with an idea.</Text>
      <Card>
        <Text style={styles.subtitle}>
          {profile.data?.credit_balance ?? "…"} credits
        </Text>
        <Button
          title="Credits & subscriptions"
          secondary
          onPress={() => router.push("/billing")}
        />
        <Button
          title="Generation history"
          secondary
          onPress={() => router.push("/generation-history")}
        />
      </Card>
      <Chips
        label="Shape"
        values={["Almond", "Oval", "Square", "Coffin", "Stiletto", "Round"]}
        value={shape}
        onChange={setShape}
      />
      <Chips
        label="Length"
        values={["Short", "Medium", "Long", "Extra Long"]}
        value={length}
        onChange={setLength}
      />
      <Chips
        label="Vibe"
        values={[
          "Minimal",
          "Dark",
          "Glam",
          "Y2K",
          "Bridal",
          "Floral",
          "Abstract",
          "Coastal",
        ]}
        value={vibe}
        onChange={setVibe}
      />
      <Field
        label="Colours, separated by commas"
        value={colors}
        onChangeText={setColors}
        maxLength={300}
      />
      <Field
        label="Describe your idea"
        value={prompt}
        onChangeText={setPrompt}
        multiline
        maxLength={500}
      />
      <Button
        title={
          pending ? "Retry / recover this generation" : "Generate · 1 credit"
        }
        busy={busy}
        onPress={() => void generate()}
      />
      {pending && (
        <Notice>
          The same request is kept through interruptions. Retrying it does not
          create a second charge.
        </Notice>
      )}
      {notice && <Notice>{notice}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {result?.imageUrl && (
        <>
          <Image
            source={result.imageUrl}
            contentFit="contain"
            style={{ width: "100%", aspectRatio: 1.5, borderRadius: 24 }}
            cachePolicy="none"
            accessibilityLabel="Generated nail design"
          />
          <Button
            title="Save privately"
            disabled={busy}
            onPress={() => void publish(true)}
          />
          <Button
            title="Publish to community"
            secondary
            disabled={busy}
            onPress={() => void publish(false)}
          />
          {!result.freeRegenUsed && (
            <Button
              title="Try one free variation"
              secondary
              disabled={busy || !!pending}
              onPress={() => void generate(true)}
            />
          )}
        </>
      )}
    </>
  );
}
export default function LabScreen() {
  return (
    <Screen title="LaQue Lab">
      <RequireAuth>
        <Lab />
      </RequireAuth>
    </Screen>
  );
}
