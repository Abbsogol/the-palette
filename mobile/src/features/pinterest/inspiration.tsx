import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { api, ApiError } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { homeFonts as f } from "../home/tokens";
import { filterPinterestDesigns, type PinterestPinText } from "./nail-design-filter";
import { emptyFilters, type SearchFilters } from "../search/filters";

export type InspirationPin = PinterestPinText & {
  source: "pinterest"; imageUrl: string; pinUrl: string; creator: string | null; detailTicket: string;
};
export type InspirationPage = { records: InspirationPin[]; cursor: string | null; topic: string };
const topicOptions = [["all", "Featured"], ["halloween", "Halloween"], ["french", "French"], ["chrome", "Chrome"],
  ["minimal", "Minimal"], ["dark", "Dark"], ["short", "Short"]] as const;
const topicWords: Record<string, string> = { all: "", halloween: "Halloween", french: "French", chrome: "Chrome", minimal: "Minimal", dark: "Dark", short: "Short" };
export function selectedInspiration(pins: readonly InspirationPin[], topic: string, query: string, filters: SearchFilters) {
  return filterPinterestDesigns(pins, { query: [topicWords[topic] || "", query].join(" "), filters });
}

// Content lives only in this mounted view. No query cache, disk cache or persisted catalog.
export function usePinterestFeed(active: boolean, authenticated: boolean, preview = false) {
  const [page, setPage] = useState<InspirationPage | null>(null);
  const [topic, setTopic] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [retryAt, setRetryAt] = useState<string | undefined>();
  const [addedIds, setAddedIds] = useState<string[] | null>(null);
  const serial = useRef(0), busy = useRef(false), dirty = useRef(false), expiry = useRef(0);
  const scope = accountScope.capture();
  const invalidate = useCallback(() => { serial.current++; busy.current = false; }, []);
  const clear = useCallback(() => {
    invalidate();
    if (!dirty.current) return;
    dirty.current = false; setPage(null); setError(""); setCode(""); setRetryAt(undefined); setAddedIds(null); setLoading(false);
  }, [invalidate]);
  useEffect(() => accountScope.onChange(clear), [clear, scope.id, scope.epoch]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") clear(); });
    return () => subscription.remove();
  }, [clear]);
  useEffect(() => {
    if (!page) return;
    const timer = setTimeout(clear, Math.max(0, expiry.current - Date.now()));
    return () => clearTimeout(timer);
  }, [page, clear]);
  const load = async (nextTopic = topic, more = false) => {
    if (!active || !authenticated || preview || busy.current || AppState.currentState === "background" ||
        code === "PINTEREST_BUDGET" && retryAt && Date.parse(retryAt) > Date.now()) return;
    const run = ++serial.current, ticket = accountScope.capture();
    dirty.current = true; busy.current = true; setLoading(true); setError(""); setCode(""); setRetryAt(undefined); setAddedIds(null);
    if (!more) { setPage(null); setTopic(nextTopic); }
    try {
      const response = await api<InspirationPage>(`/pinterest/inspiration?topic=${nextTopic}${more && page?.cursor ? `&cursor=${encodeURIComponent(page.cursor)}` : ""}`);
      if (run !== serial.current || !accountScope.isCurrent(ticket)) return;
      if (response.topic !== nextTopic || !Array.isArray(response.records)) throw new Error("Pinterest returned an unsupported selection.");
      if (!more) expiry.current = Date.now() + 300000;
      const previous = more ? page?.records || [] : [];
      const previousIds = new Set(previous.map(pin => pin.id));
      const records = [...new Map([...previous, ...response.records].map(pin => [pin.id, pin])).values()];
      setPage({ ...response, records });
      setAddedIds(more ? records.filter(pin => !previousIds.has(pin.id)).map(pin => pin.id) : null);
    } catch (e) {
      if (run === serial.current && accountScope.isCurrent(ticket)) {
        setError(e instanceof Error ? e.message : "Pinterest couldn’t load.");
        setCode(e instanceof ApiError ? e.code || "" : "");
        setRetryAt(e instanceof ApiError ? e.retryAt : undefined);
        if (e instanceof ApiError && (["PINTEREST_DISABLED", "PINTEREST_ACCESS", "PINTEREST_VIEW_EXPIRED"].includes(e.code || "") || [401, 403].includes(e.status))) setPage(null);
      }
    } finally {
      if (run === serial.current) { busy.current = false; setLoading(false); }
    }
  };
  useEffect(() => {
    let entered = true;
    void Promise.resolve().then(() => {
      if (!entered) return;
      if (active && authenticated && !preview) void load("all");
      else clear();
    });
    return () => { entered = false; invalidate(); };
    // Loads on entry only; keyword/filter changes never request the upstream API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, authenticated, preview, scope.id, scope.epoch]);
  return { page, topic, loading, error, code, retryAt, addedIds, load };
}
export type PinterestFeed = ReturnType<typeof usePinterestFeed>;

function PinImage({ pin, height = 220 }: { pin: InspirationPin; height?: number }) {
  const [failed, setFailed] = useState(false);
  return <View style={{ height, backgroundColor: "#260910", borderRadius: 20, overflow: "hidden" }}>
    {failed ? <Text style={s.body}>Image unavailable</Text> :
      <Image source={{ uri: pin.imageUrl }} cachePolicy="none" contentFit="contain"
        accessibilityLabel={pin.alt_text || pin.title || "Pinterest nail inspiration"} accessible
        onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} />}
  </View>;
}
export function PinterestInspiration({ feed, query = "", filters = emptyFilters(),
  authenticated = true, preview = false, active = true, onSignIn }: {
  feed: PinterestFeed; query?: string; filters?: SearchFilters;
  authenticated?: boolean; preview?: boolean; active?: boolean; onSignIn?: () => void;
}) {
  const [detail, setDetail] = useState<InspirationPin | null>(null);
  const [detailError, setDetailError] = useState("");
  const [opening, setOpening] = useState(false);
  const request = useRef(0), pending = useRef(false), dirty = useRef(false);
  const scope = accountScope.capture();
  const [now, setNow] = useState(() => Date.now());
  const retryTime = feed.code === "PINTEREST_BUDGET" ? Date.parse(feed.retryAt || "") : NaN;
  const paused = Number.isFinite(retryTime) && retryTime > now;
  const retrySeconds = Math.max(0, Math.ceil((retryTime - now) / 1000));
  useEffect(() => {
    if (!active || !paused) return;
    const remaining = retryTime - Date.now();
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1, Math.min(remaining <= 3600000 ? 1000 : 60000, remaining)));
    return () => clearTimeout(timer);
  }, [active, paused, retryTime, now]);
  const invalidate = useCallback(() => { request.current++; pending.current = false; }, []);
  const close = useCallback(() => {
    invalidate();
    if (!dirty.current) return;
    dirty.current = false; setDetail(null); setDetailError(""); setOpening(false);
  }, [invalidate]);
  useEffect(() => accountScope.onChange(close), [close, scope.id, scope.epoch]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state !== "active") close(); });
    return () => subscription.remove();
  }, [close]);
  useEffect(() => {
    let entered = true;
    void Promise.resolve().then(() => { if (entered && !active) close(); });
    return () => { entered = false; invalidate(); };
  }, [active, close, invalidate]);
  useEffect(() => {
    if (!detail) return;
    const timer = setTimeout(close, 300000);
    return () => clearTimeout(timer);
  }, [detail, close]);
  const records = selectedInspiration(active ? feed.page?.records || [] : [], feed.topic, query, filters);
  const rows = Array.from({ length: Math.ceil(records.length / 2) }, (_, index) => records.slice(index * 2, index * 2 + 2));
  const addedMatches = records.filter(({ pin }) => feed.addedIds?.includes(pin.id)).length;
  const open = async (pin: InspirationPin) => {
    if (pending.current) return;
    const run = ++request.current, ticket = accountScope.capture();
    dirty.current = true; pending.current = true; setOpening(true); setDetail(null); setDetailError("");
    try {
      const result = await api<InspirationPage>(`/pinterest/inspiration?topic=${feed.topic}&pin=${encodeURIComponent(pin.detailTicket)}`);
      if (run !== request.current || !accountScope.isCurrent(ticket)) return;
      const fresh = result.records.find(row => row.id === pin.id);
      if (!fresh || !filterPinterestDesigns([fresh]).length) throw new Error("This nail inspiration is no longer available.");
      setDetail(fresh);
    } catch (e) {
      if (run === request.current && accountScope.isCurrent(ticket)) setDetailError((e as Error).message);
    } finally { if (run === request.current) { pending.current = false; setOpening(false); } }
  };
  const external = async () => {
    if (!detail) return;
    const ticket = accountScope.capture(), run = request.current;
    try {
      if (detail.pinUrl !== `https://www.pinterest.com/pin/${detail.id}/` || !/^\d{1,30}$/.test(detail.id)) throw new Error();
      await Linking.openURL(detail.pinUrl);
    } catch { if (run === request.current && accountScope.isCurrent(ticket)) setDetailError("Pinterest couldn’t open. Try again."); }
  };
  return <View style={s.section} testID="pinterest-inspiration">
    <Text accessibilityRole="header" style={s.heading}>Pinterest inspiration</Text>
    <Text style={s.body}>Nail looks from Pinterest. Search and filters apply to the selection loaded here.</Text>
    {!authenticated ? <><Text style={s.body}>Sign in to see Pinterest inspiration.</Text>
      <Button label="Sign in" onPress={() => onSignIn?.()} /></> :
      preview ? <Text style={s.body}>Pinterest isn’t connected in this preview. LaQue sample designs are available.</Text> :
      <>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {topicOptions.map(([key, label]) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={`Pinterest topic: ${label}`}
            accessibilityState={{ selected: feed.topic === key, disabled: feed.loading || paused }} disabled={feed.loading || paused}
            onPress={() => void feed.load(key)} style={[s.chip, feed.topic === key && s.selected]}>
            <Text style={s.body}>{label}</Text></Pressable>)}
        </ScrollView>
        {!!feed.error && <Text accessibilityRole="alert" style={s.body}>{feed.error}</Text>}
        {feed.code === "PINTEREST_BUDGET" && Number.isFinite(retryTime) && <Text style={s.body}>
          {paused ? retrySeconds <= 3600
            ? `Retry available in ${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, "0")}.`
            : `Available to retry ${new Date(retryTime).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" })}.`
            : "The pause has ended. Tap Retry Pinterest to load designs."}
        </Text>}
        {feed.loading && <ActivityIndicator color="#ff517f" accessibilityLabel="Loading Pinterest inspiration" />}
        {!feed.loading && !feed.error && feed.page && !records.length && <Text style={s.body}>No nail looks match this loaded selection. Try another topic or clear your filters.</Text>}
        {records.length > 0 && <Text style={s.body}>{records.length} matching looks in this selection · suggested filters come from text</Text>}
        {/* Cards use the screen's vertical scroll; a nested ScrollView can clip the loaded page. */}
        <View style={s.grid}>
          {rows.map(row => <View key={row[0].pin.id} style={s.row}>
          {row.map(({ pin }) => <View key={pin.id} style={s.card}>
            <Pressable accessibilityRole="button" accessibilityLabel={`View Pinterest design: ${pin.title}`} onPress={() => void open(pin)}>
              <PinImage pin={pin} /></Pressable>
            <Text style={s.source}>From Pinterest{pin.creator ? ` · @${pin.creator}` : ""}</Text>
            <Pressable accessibilityRole="button" onPress={() => void open(pin)}><Text numberOfLines={2} style={s.title}>{pin.title}</Text></Pressable>
          </View>)}
          {row.length === 1 && <View style={s.card} />}
          </View>)}
        </View>
        {!feed.loading && !feed.error && feed.addedIds !== null && <Text accessibilityLiveRegion="polite" style={s.body}>
          {addedMatches ? `${addedMatches} more matching ${addedMatches === 1 ? "look" : "looks"} added.` :
            `No additional looks match this selection.${feed.page?.cursor ? " Try clearing filters or load the next page." : ""}`}
        </Text>}
        {!feed.loading && !["PINTEREST_DISABLED", "PINTEREST_ACCESS"].includes(feed.code) &&
          <Button label={feed.error ? "Retry Pinterest" : feed.page?.cursor ? "Load more Pinterest" : "Refresh Pinterest"} disabled={paused} onPress={() => void feed.load(feed.topic, !!feed.page?.cursor)} />}
      </>}
    <Modal visible={active && (!!detail || opening || !!detailError)} transparent animationType="slide" onRequestClose={close}>
      <View style={s.backdrop}><View style={s.detail}>
        <Button label="Close Pinterest design" onPress={close} />
        <ScrollView contentContainerStyle={{ gap: 16, paddingBottom: 24 }}>
          {opening && <ActivityIndicator color="#ff517f" accessibilityLabel="Checking Pinterest design" />}
          {detail && <><PinImage key={detail.id} pin={detail} height={320} />
            <Text style={s.source}>From Pinterest{detail.creator ? ` · @${detail.creator}` : ""}</Text>
            <Text accessibilityRole="header" style={s.heading}>{detail.title}</Text>
            {!!detail.description && <Text style={s.body}>{detail.description}</Text>}
            <Button label="View on Pinterest" onPress={() => void external()} /></>}
          {!!detailError && <Text accessibilityRole="alert" style={s.body}>{detailError}</Text>}
        </ScrollView>
      </View></View>
    </Modal>
  </View>;
}
function Button({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && { opacity: 0.5 }]}><Text style={s.title}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({
  section: { gap: 16 }, heading: { fontFamily: f.regular, fontSize: 24, color: "white" },
  body: { fontFamily: f.regular, fontSize: 15, lineHeight: 22, color: "#f5dce2" },
  title: { fontFamily: f.regular, fontSize: 17, color: "white" }, source: { fontFamily: f.regular, fontSize: 13, color: "#f4aabc" },
  chip: { paddingHorizontal: 16, minHeight: 44, justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: "#9e6475" },
  selected: { backgroundColor: "#921e43" }, button: { minHeight: 48, padding: 14, borderRadius: 24, backgroundColor: "#85213e", alignItems: "center" },
  grid: { gap: 24 }, row: { flexDirection: "row", gap: 16, alignItems: "flex-start" }, card: { flex: 1, minWidth: 0, gap: 8 },
  backdrop: { flex: 1, backgroundColor: "#12030ce6", justifyContent: "flex-end" },
  detail: { maxHeight: "92%", padding: 24, gap: 16, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: "#3c000e" },
});
