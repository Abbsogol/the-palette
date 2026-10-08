import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, Notice, styles } from "../secondary/primitives";
export type TaggedPerson = { id: string; username: string; name: string };
export function TagPeople({
  value,
  onChange,
  search,
  disabled = false,
}: {
  value: TaggedPerson[];
  onChange: (v: TaggedPerson[]) => void;
  search: (q: string, signal: AbortSignal) => Promise<TaggedPerson[]>;
  disabled?: boolean;
}) {
  const [q, setQ] = useState(""),
    [results, setResults] = useState<TaggedPerson[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    if (q.trim().replace(/^@/, "").length < 2) return () => abort.abort();
    const timer = setTimeout(
      () =>
        void search(q, abort.signal)
          .then((rows) => {
            if (!abort.signal.aborted) {
              setResults(rows);
              setError("");
            }
          })
          .catch(() => {
            if (!abort.signal.aborted)
              setError("Accounts could not load. Edit your search to retry.");
          })
          .finally(() => {
            if (!abort.signal.aborted) setLoading(false);
          }),
      250,
    );
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [q, search]);
  const changeSearch = (text: string) => {
    setQ(text);
    setResults([]);
    setError("");
    setLoading(text.trim().replace(/^@/, "").length >= 2);
  };
  return (
    <View style={{ gap: 10 }}>
      <Field
        label="Tag people"
        value={q}
        onChangeText={changeSearch}
        editable={!disabled}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="Search @username"
        hint="Tagged names link to that person’s profile."
      />
      {loading && <Text style={styles.small}>Finding people…</Text>}
      {!!error && <Notice error>{error}</Notice>}
      {results
        .filter((p) => !value.some((v) => v.id === p.id))
        .map((p) => (
          <Button
            key={p.id}
            title={`@${p.username} · ${p.name}`}
            secondary
            disabled={disabled || value.length >= 20}
            onPress={() => {
              onChange([...value, p]);
              changeSearch("");
            }}
          />
        ))}
      {q.length >= 2 && !loading && !results.length && !error && (
        <Text style={styles.small}>No accounts found</Text>
      )}
      <View style={styles.wrap}>
        {value.map((p) => (
          <Button
            key={p.id}
            title={`Remove @${p.username}`}
            secondary
            disabled={disabled}
            onPress={() => onChange(value.filter((v) => v.id !== p.id))}
          />
        ))}
      </View>
    </View>
  );
}
export function SocialTags({
  tags = [],
  people = [],
  onProfile,
}: {
  tags?: string[];
  people?: TaggedPerson[];
  onProfile?: (id: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      {!!tags.length && (
        <Text style={[styles.text, { color: "#ffa3c1" }]}>
          {tags.map((t) => `#${t}`).join(" ")}
        </Text>
      )}
      <View style={styles.wrap}>
        {people.map((p) => (
          <Text
            key={p.id}
            accessibilityRole="link"
            onPress={() => onProfile?.(p.id)}
            style={[styles.text, { color: "#ffa3c1", paddingVertical: 12 }]}
          >
            @{p.username}
          </Text>
        ))}
      </View>
    </View>
  );
}
