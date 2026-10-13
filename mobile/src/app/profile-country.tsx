import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { RequireAuth, QueryState } from "../components/ui";
import {
  Screen,
  Card,
  Field,
  Button,
  Notice,
  styles,
} from "../features/secondary/primitives";
import { countries, countryLabel } from "../features/rewards/countries";
import { api } from "../lib/api";
import { accountScope } from "../lib/account-scope";
import { queryClient, useAccountQuery } from "../lib/auth";
import { useSubmission } from "../features/secondary/use-submission";
function Country() {
  const query = useAccountQuery(["profile-country"], () =>
      api<{ country: string | null }>("/mobile/rewards/country"),
    ),
    save = useSubmission();
  const [selectedOverride, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [saved, setSaved] = useState(false);
  const selected = selectedOverride ?? query.data?.country ?? "";
  const shown = countries.filter(
    (c) =>
      !search ||
      countryLabel(c).toLowerCase().includes(search.toLowerCase()) ||
      c.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <Screen
      title="Profile country"
      onBack={() =>
        router.canGoBack() ? router.back() : router.replace("/profile-edit")
      }
    >
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      >
        <Card>
          <Text style={styles.text}>Choose the country where you live.</Text>
          <Text style={styles.muted}>
            LaQue uses this profile setting to show regional news and
            competitions. It does not verify your physical location. Prize
            eligibility may require proof of residence.
          </Text>
          <Text style={styles.muted}>
            Country changes are locked while you have an entry in an unfinished
            round.
          </Text>
          <Field
            label="Search countries"
            value={search}
            onChangeText={setSearch}
            placeholder="Country name or code"
            autoCapitalize="none"
          />
          <Text style={styles.text}>
            Selected: {selected ? countryLabel(selected) : "Not set"}
          </Text>
          <View style={{ gap: 8 }}>
            {shown.slice(0, 30).map((c) => (
              <Pressable
                key={c}
                disabled={save.busy}
                accessibilityRole="radio"
                accessibilityState={{ selected: selected === c }}
                style={styles.card}
                onPress={() => {
                  setSelected(c);
                  setSaved(false);
                }}
              >
                <Text style={styles.text}>
                  {selected === c ? "●" : "○"} {countryLabel(c)} ({c})
                </Text>
              </Pressable>
            ))}
          </View>
          {shown.length > 30 && (
            <Text style={styles.muted}>
              Search to narrow the list of countries.
            </Text>
          )}
          <Button
            title="Save profile country"
            busy={save.busy}
            disabled={!selected || selected === query.data?.country}
            onPress={() =>
              void save.run(async () => {
                const ticket = accountScope.capture();
                await api("/mobile/rewards/country", { country: selected });
                accountScope.assert(ticket);
                await queryClient.invalidateQueries();
                accountScope.assert(ticket);
                setSaved(true);
              })
            }
          />
          {save.error && <Notice error>{save.error}</Notice>}
          {saved && (
            <Notice>
              Profile country saved. Regional content updates on refresh.
            </Notice>
          )}
        </Card>
      </QueryState>
    </Screen>
  );
}
export default function ProfileCountry() {
  return (
    <RequireAuth>
      <Country />
    </RequireAuth>
  );
}
