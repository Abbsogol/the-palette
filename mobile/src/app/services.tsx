import { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import {
  Button,
  Card,
  Field,
  Notice,
  QueryState,
  RequireAuth,
  Screen,
  styles,
  money,
} from "../components/ui";
import { useAccountQuery, useAuth, useProfile, queryClient } from "../lib/auth";
import { checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Service } from "../lib/types";
function Services() {
  const { session } = useAuth();
  const profile = useProfile();
  const [editing, setEditing] = useState<string | null>(null),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [price, setPrice] = useState(""),
    [deposit, setDeposit] = useState("0"),
    [duration, setDuration] = useState("60"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const query = useAccountQuery(["services", session!.user.id], () =>
    checked<Service[]>(
      supabase
        .from("services")
        .select("*")
        .eq("creator_id", session!.user.id)
        .order("created_at"),
    ),
  );
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const p = Number(price),
        d = Number(deposit),
        minutes = Number(duration);
      if (
        !name.trim() ||
        !price.trim() ||
        !Number.isFinite(p) ||
        !Number.isFinite(d) ||
        p < 0 ||
        d < 0 ||
        d > p ||
        !Number.isInteger(minutes) ||
        minutes < 15 ||
        minutes > 480
      )
        throw new Error(
          "Enter a name, valid price and deposit, and a duration between 15 and 480 minutes.",
        );
      const fields = {
        name: name.trim(),
        description: description.trim(),
        price: Math.round(p * 100) / 100,
        deposit_amount: Math.round(d * 100) / 100,
        duration_minutes: minutes,
        is_active: true,
      };
      await checked(
        editing
          ? supabase
              .from("services")
              .update(fields)
              .eq("id", editing)
              .eq("creator_id", session!.user.id)
              .select("id")
          : supabase
              .from("services")
              .insert({ ...fields, creator_id: session!.user.id })
              .select("id"),
      );
      setEditing(null);
      setName("");
      setDescription("");
      setPrice("");
      setDeposit("0");
      await queryClient.invalidateQueries();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (profile.data?.account_type === "user")
    return (
      <Button
        title="Become a creator"
        onPress={() => router.push("/creator-onboarding")}
      />
    );
  return (
    <>
      <Notice>
        Fixed-price services in AED. Set your service location in Edit profile.
      </Notice>
      <Button
        title="Set working hours & time zone"
        secondary
        onPress={() => router.push("/availability")}
      />
      <Card>
        <Text style={styles.subtitle}>
          {editing ? "Edit service" : "New service"}
        </Text>
        <Field
          label="Service name"
          value={name}
          onChangeText={setName}
          maxLength={100}
        />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={1000}
        />
        <Field
          label="Total price (AED)"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
        />
        <Field
          label="Deposit (AED)"
          value={deposit}
          onChangeText={setDeposit}
          keyboardType="decimal-pad"
        />
        <Field
          label="Duration (minutes)"
          value={duration}
          onChangeText={setDuration}
          keyboardType="number-pad"
        />
        <Button title="Save service" busy={busy} onPress={() => void save()} />
      </Card>
      <QueryState
        loading={query.isPending}
        error={query.error}
        empty={!query.data?.length}
        retry={() => void query.refetch()}
      >
        {query.data?.map((s) => (
          <Card key={s.id}>
            <Text style={styles.subtitle}>
              {s.name}
              {!s.is_active ? " · Hidden" : ""}
            </Text>
            <Text style={styles.text}>
              {s.duration_minutes} min · {money(s.price)} ·{" "}
              {money(s.deposit_amount)} deposit
            </Text>
            <Button
              title="Edit"
              secondary
              disabled={busy}
              onPress={() => {
                setEditing(s.id);
                setName(s.name);
                setDescription(s.description || "");
                setPrice(String(s.price));
                setDeposit(String(s.deposit_amount));
                setDuration(String(s.duration_minutes));
              }}
            />
            <Button
              title={
                s.is_active ? "Remove from booking menu" : "Restore service"
              }
              secondary
              disabled={busy}
              onPress={() => {
                void checked(
                  supabase
                    .from("services")
                    .update({ is_active: !s.is_active })
                    .eq("id", s.id)
                    .eq("creator_id", session!.user.id)
                    .select("id"),
                )
                  .then(() => queryClient.invalidateQueries())
                  .catch((e) => setError(e.message));
              }}
            />
          </Card>
        ))}
      </QueryState>
      {error && <Notice error>{error}</Notice>}
    </>
  );
}
export default function ServiceScreen() {
  return (
    <Screen title="My services" back>
      <RequireAuth>
        <Services />
      </RequireAuth>
    </Screen>
  );
}
