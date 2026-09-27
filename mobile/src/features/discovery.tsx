import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  Button,
  Chips,
  Field,
  Notice,
  QueryState,
  Screen,
  styles,
} from "../components/ui";
import { DesignCard, DesignGrid } from "../components/design-card";
import { useAccountQuery, useAuth } from "../lib/auth";
import { listDesigns } from "../lib/designs";
import { checked } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/types";

export default function Discovery({ search = false }: { search?: boolean }) {
  const { session, epoch } = useAuth();
  const [input, setInput] = useState(""),
    [query, setQuery] = useState(""),
    [mode, setMode] = useState("Designs");
  const [vibe, setVibe] = useState("All"),
    [length, setLength] = useState("All"),
    [shape, setShape] = useState("All"),
    [sort, setSort] = useState("Newest"),
    [filters, setFilters] = useState(false),
    [artistLimit, setArtistLimit] = useState(30);
  const feed = useInfiniteQuery({
    queryKey: [
      "designs",
      session?.user.id,
      epoch,
      { query, vibe, length, shape, sort },
    ],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      listDesigns({ query, vibe, length, shape, sort }, pageParam, signal),
    getNextPageParam: (last, pages) =>
      last.length === 24 ? pages.length : undefined,
    enabled: mode === "Designs",
  });
  const artists = useAccountQuery(
    ["artists", query, artistLimit],
    (signal) => {
      let request = supabase
        .from("profiles")
        .select("*")
        .in("account_type", ["creator", "salon", "nail_artist"])
        .order("display_name")
        .order("id")
        .limit(artistLimit);
      if (query)
        request = request.ilike(
          "display_name",
          `%${query.replace(/[%_]/g, "")}%`,
        );
      return checked<Profile[]>(request.abortSignal(signal));
    },
    mode === "Artists",
  );
  const trending = useAccountQuery(
    ["trending"],
    (signal) => listDesigns({ sort: "Most saved" }, 0, signal),
    !search,
  );
  const designs = feed.data?.pages.flat() || [];
  return (
    <Screen title={search ? "Find your next set" : "LaQue"}>
      {!search && (
        <Text style={styles.muted}>Nail & beauty design library</Text>
      )}
      <Field
        label="Search designs and creators"
        value={input}
        onChangeText={setInput}
        returnKeyType="search"
        onSubmitEditing={() => setQuery(input.trim())}
      />
      <View style={styles.row}>
        <Button title="Search" onPress={() => setQuery(input.trim())} />
        <Button
          title={filters ? "Close filters" : "Filters"}
          secondary
          onPress={() => setFilters(!filters)}
        />
        <Button
          title="Updates"
          secondary
          onPress={() => router.push("/notifications")}
        />
      </View>
      {search && (
        <Chips
          values={["Designs", "Artists"]}
          value={mode}
          onChange={setMode}
        />
      )}
      <Chips
        values={["All", "Dark", "Minimal", "Glam", "Y2K"]}
        value={vibe}
        onChange={setVibe}
      />
      {filters && (
        <>
          <Chips
            label="Length"
            values={["All", "Short", "Medium", "Long", "Extra Long"]}
            value={length}
            onChange={setLength}
          />
          <Chips
            label="Shape"
            values={[
              "All",
              "Almond",
              "Oval",
              "Square",
              "Coffin",
              "Stiletto",
              "Round",
            ]}
            value={shape}
            onChange={setShape}
          />
        </>
      )}
      <Chips
        label="Sort"
        values={["Newest", "Most saved"]}
        value={sort}
        onChange={setSort}
      />
      {mode === "Artists" ? (
        <QueryState
          loading={artists.isPending}
          error={artists.error}
          empty={!artists.data?.length}
          retry={() => void artists.refetch()}
        >
          {artists.data?.map((artist) => (
            <Button
              key={artist.id}
              title={`${artist.display_name || "Creator"}${artist.location ? ` · ${artist.location}` : ""}`}
              secondary
              onPress={() =>
                router.push({
                  pathname: "/creator/[id]",
                  params: { id: artist.id },
                })
              }
            />
          ))}
          {artists.data?.length === artistLimit && (
            <Button
              title="Load more creators"
              secondary
              onPress={() => setArtistLimit(artistLimit + 30)}
            />
          )}
        </QueryState>
      ) : (
        <QueryState
          loading={feed.isPending}
          error={feed.error}
          empty={!designs.length}
          retry={() => void feed.refetch()}
        >
          {!search && designs.length > 0 && (
            <>
              <Text style={styles.subtitle}>TRENDING</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 16 }}
              >
                {(trending.data || []).slice(0, 5).map((design, i) => (
                  <View key={design.id} style={{ width: 146 }}>
                    <DesignCard design={design} index={1} />
                    <Text style={styles.muted}>
                      {design.saves_count} saves · #{i + 1}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={styles.subtitle}>
            {search ? "Designs" : "Explore Library"}
          </Text>
          <DesignGrid designs={designs} />
          {feed.hasNextPage && (
            <Button
              title="Load more designs"
              busy={feed.isFetchingNextPage}
              secondary
              onPress={() => void feed.fetchNextPage()}
            />
          )}
        </QueryState>
      )}
      {!session && (
        <Notice>
          Explore freely. Sign in when you’re ready to save or book.
        </Notice>
      )}
    </Screen>
  );
}
