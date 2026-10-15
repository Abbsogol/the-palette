import { typography } from "../../theme/typography";
import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeGlass, HomeIcon } from "../home/home-primitives";
import { homeAssets } from "../home/assets";
import { homeFonts as f, homeColors as c } from "../home/tokens";
import { searchAssets } from "./assets";
import { FilterSheet } from "./filter-sheet";
import { SearchBackground } from "./search-background";
import {
  filterCount,
  type SearchFilters,
  type SearchMode,
  type SearchSort,
} from "./filters";
export type SearchDesign = {
  id: string;
  title: string;
  image: ImageSource | string | number | null;
  attributes: string[];
  saved?: boolean;
  saving?: boolean;
  saves?: number;
  reviewCount?: number;
  compactCaption?: boolean;
};
export type SearchArtist = {
  username?:string|null;
  id: string;
  name: string;
  image: SearchDesign["image"];
  kind: "NAIL ARTIST" | "SALON" | "MEMBER";
  location?: string | null;
  saved?: boolean;
  saving?: boolean;
  rating?: number;
  reviews?: number;
};
export type SearchViewProps = {
  width?: number;
  active?: boolean;
  source?: "LaQue" | "Pinterest";
  onSource?: (source: "LaQue" | "Pinterest") => void;
  pinterest?: ReactNode;
  input: string;
  onInput: (text: string) => void;
  onSubmit: () => void;
  mode: SearchMode;
  onMode: (mode: SearchMode) => void;
  sort: SearchSort;
  onSort: (sort: SearchSort) => void;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
  onDraft: (filters: SearchFilters | null) => void;
  draftTotal?: number;
  counting?: boolean;
  countError?: string;
  onRetryCount: () => void;
  total?: number;
  designs: SearchDesign[];
  artists: SearchArtist[];
  loading?: boolean;
  error?: string;
  saveError?: string;
  onRetry: () => void;
  onDesign: (id: string) => void;
  onSave: (id: string) => void;
  onArtist: (id: string) => void;
  onSaveArtist: (id: string) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  moreError?: string;
  onMore: () => void;
};
function SaveButton({
  label,
  saved,
  saving,
  count,
  onPress,
}: {
  label: string;
  saved?: boolean;
  saving?: boolean;
  count?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${saved ? "Unsave" : "Save"} ${label}`}
      accessibilityState={{
        selected: !!saved,
        disabled: !!saving,
        busy: !!saving,
      }}
      disabled={saving}
      onPress={onPress}
      style={s.saveTarget}
    >
      <View style={[s.saveCircle, saved && s.savedCircle]}>
        {saved && (
          <LinearGradient
            pointerEvents="none"
            colors={["#be757a", "#bb4866"]}
            style={[StyleSheet.absoluteFill, { borderRadius: 100 }]}
          />
        )}
        {saving ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <>
            <HomeIcon
              source={saved ? searchAssets.savedHeart : homeAssets.heart}
              size={saved ? 16 : 14}
            />
            {saved && count !== undefined && (
              <Text style={s.savedCount}>{count}</Text>
            )}
          </>
        )}
      </View>
    </Pressable>
  );
}
function ArtistSaveButton({
  artist,
  onPress,
}: {
  artist: SearchArtist;
  onPress: () => void;
}) {
  const icon = artist.saving ? (
    <ActivityIndicator color="white" size="small" />
  ) : (
    <HomeIcon
      source={artist.saved ? searchAssets.savedHeart : searchAssets.artistHeart}
      size={artist.saved ? 16 : 14}
    />
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${artist.saved ? "Unsave" : "Save"} ${artist.name}`}
      accessibilityState={{
        selected: !!artist.saved,
        disabled: !!artist.saving,
        busy: !!artist.saving,
      }}
      disabled={artist.saving}
      onPress={onPress}
      style={s.artistSaveTarget}
    >
      {artist.saved ? (
        <View style={[s.artistHeart, s.artistSavedHeart]}>{icon}</View>
      ) : (
        <HomeGlass style={s.artistHeart} tint="dark" intensity={10}>
          {icon}
        </HomeGlass>
      )}
    </Pressable>
  );
}
export function DesignResult({
  design: d,
  width,
  onOpen,
  onSave,
}: {
  design: SearchDesign;
  width: number;
  onOpen: () => void;
  onSave: () => void;
}) {
  const [failed, setFailed] = useState<SearchDesign["image"]>();
  return (
    <View testID={`search-design-${d.id}`} style={s.design}>
      <View style={[s.photo, { height: 251 * (width / 345) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${d.title}`}
          onPress={onOpen}
          style={StyleSheet.absoluteFill}
        >
          {d.image && failed !== d.image ? (
            <Image
              source={d.image}
              accessible={false}
              cachePolicy="memory"
              contentFit="cover"
              onError={() => setFailed(d.image)}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Text style={s.fallback}>Image unavailable</Text>
          )}
        </Pressable>
        <SaveButton
          label={d.title}
          saved={d.saved}
          saving={d.saving}
          count={d.saves}
          onPress={onSave}
        />
      </View>
      <View style={{ gap: 8 }}>
        <View style={s.caption}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Details for ${d.title}`}
            onPress={onOpen}
            style={{ flex: 1 }}
          >
            <Text
              style={[
                s.designTitle,
                d.compactCaption && { fontSize: 20, lineHeight: 24 },
              ]}
            >
              {d.title}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View ${d.title} details`}
            onPress={onOpen}
            hitSlop={10}
          >
            <Text style={s.review}>
              {d.reviewCount === undefined
                ? "Details"
                : `${d.reviewCount} Review`}
            </Text>
          </Pressable>
        </View>
        {!d.compactCaption && !!d.attributes.length && (
          <Text style={s.attributes}>{d.attributes.join(" • ")}</Text>
        )}
      </View>
    </View>
  );
}
export function ArtistResult({
  artist: a,
  width,
  onOpen,
  onSave,
}: {
  artist: SearchArtist;
  width: number;
  onOpen: () => void;
  onSave: () => void;
}) {
  const [failed, setFailed] = useState<SearchArtist["image"]>();
  const avatar = Math.min(125, width - 24);
  const hasRating =
    typeof a.rating === "number" &&
    Number.isFinite(a.rating) &&
    a.rating >= 0 &&
    a.rating <= 5 &&
    typeof a.reviews === "number" &&
    Number.isInteger(a.reviews) &&
    a.reviews > 0;
  return (
    <View testID={`search-artist-${a.id}`} style={[s.artist, { width }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${a.name}`}
        onPress={onOpen}
        style={s.artistBody}
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: avatar,
              height: (avatar * 124) / 125,
              overflow: "hidden",
              borderRadius: 100,
              backgroundColor: "#61202e",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {a.image && failed !== a.image ? (
              <Image
                testID={`search-artist-avatar-${a.id}`}
                source={a.image}
                accessible={false}
                cachePolicy="memory"
                contentFit="cover"
                onError={() => setFailed(a.image)}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <Text style={s.avatarInitial}>
                {a.name.trim().charAt(0).toUpperCase() || "?"}
              </Text>
            )}
          </View>
          <View style={s.badge}>
            <LinearGradient
              colors={["#ff517f", "#99314c"]}
              locations={[0.39548, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 100 }]}
            />
            <Text style={s.badgeText}>{a.kind}</Text>
          </View>
        </View>
        <View style={s.artistInfo}>
          <Text
            style={[s.artistName, a.kind === "NAIL ARTIST" && { width: 124 }]}
          >
            {a.name}
          </Text>
          <View style={s.artistMeta}>
            {!!a.username && <Text style={s.metaText}>@{a.username}</Text>}
            {!!a.location && (
              <View style={s.metadata}>
                <HomeIcon source={searchAssets.location} size={12} />
                <Text numberOfLines={1} style={s.metaText}>
                  {a.location}
                </Text>
              </View>
            )}
            {hasRating && (
              <View style={s.metadata}>
                <HomeIcon source={searchAssets.rating} size={12} />
                <Text style={s.metaText}>
                  {a.rating} ({a.reviews})
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
      <ArtistSaveButton artist={a} onPress={onSave} />
    </View>
  );
}
export function SearchView(p: SearchViewProps) {
  const window = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const width = p.width ?? window.width;
  const scroll = useRef<ScrollView>(null);
  const [draft, setDraft] = useState<SearchFilters | null>(null),
    [sorting, setSorting] = useState(false);
  const closeFilters = () => {
    setDraft(null);
    p.onDraft(null);
  };
  const changeDraft = (next: SearchFilters) => {
    setDraft(next);
    p.onDraft(next);
  };
  const resultsTop = insets.top + 24;
  return (
    <View testID="search-screen" style={s.screen}>
      {p.active !== false && <StatusBar style="light" />}
      <SearchBackground width={width} />
      <View
        testID="search-fixed-header"
        style={[s.searchHeader, { paddingTop: resultsTop }]}
      >
        <View style={{ gap: 2 }}>
          <Text accessibilityRole="header" style={s.heading}>
            Search
          </Text>
          <Text style={s.subtitle}>Find designs, people & salons</Text>
        </View>
        <View style={s.tabs}>
          {(["Designs", "Artists"] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityLabel={
                mode === "Designs" ? "Designs" : "People & Salons"
              }
              accessibilityState={{ selected: p.mode === mode }}
              onPress={() => {
                p.onMode(mode);
                scroll.current?.scrollTo({ y: 0, animated: false });
              }}
              hitSlop={{ top: 7, bottom: 7 }}
              style={s.tab}
            >
              <Text style={[s.tabText, p.mode === mode && s.selectedTab]}>
                {mode === "Designs" ? "Designs" : "People & Salons"}
              </Text>
              <View
                style={[s.underline, { opacity: p.mode === mode ? 1 : 0 }]}
              />
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView
        style={s.scroll}
        ref={scroll}
        testID="search-scroll"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{
          minHeight: "100%",
          paddingBottom: 140 + insets.bottom,
        }}
      >
        <View style={[s.content, p.mode === "Artists" && { gap: 19.2 }]}>
          <View style={s.searchInput}>
            <View style={s.searchIcon}>
              <HomeIcon source={homeAssets.searchPink} size={16} />
            </View>
            <TextInput
              accessibilityLabel="Search designs, nail artists, salons"
              placeholder="Search designs, nail artists, salons.."
              placeholderTextColor={c.placeholder}
              value={p.input}
              onChangeText={p.onInput}
              onSubmitEditing={p.onSubmit}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              style={s.input}
            />
          </View>
          {p.mode === "Designs" && p.onSource && <View style={{ flexDirection: "row", gap: 12 }}>
            {(["LaQue", "Pinterest"] as const).map(source => <Pressable key={source} accessibilityRole="button"
              accessibilityLabel={`Design source: ${source}`} accessibilityState={{ selected: (p.source || "LaQue") === source }}
              onPress={() => p.onSource?.(source)} style={[s.stateButton, { flex: 1, backgroundColor: (p.source || "LaQue") === source ? "#85213e" : "#ffffff15" }]}>
              <Text style={s.total}>{source}</Text></Pressable>)}
          </View>}
          <View style={s.results}>
            <View style={[s.resultHeader, { marginBottom: -4 }]}>
              <Text accessibilityLiveRegion="polite" style={s.total}>
                {p.source === "Pinterest" && p.mode === "Designs" ? "Loaded selection" : p.loading
                  ? "Searching…"
                  : p.error || p.total === undefined
                    ? "Results"
                    : `${p.total} ${p.mode === "Designs" ? (p.total === 1 ? "design" : "designs") : p.total === 1 ? "item" : "items"}`}
              </Text>
              <View style={s.resultActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    filterCount(p.filters)
                      ? `Filters, ${filterCount(p.filters)} selected`
                      : "Filters"
                  }
                  accessibilityHint={
                    p.mode === "Artists"
                      ? "Filters apply to designs"
                      : "Filter designs"
                  }
                  onPress={() => {
                    Keyboard.dismiss();
                    if (p.mode !== "Designs") p.onMode("Designs");
                    changeDraft(p.filters);
                  }}
                  hitSlop={10}
                >
                  <HomeIcon source={searchAssets.filter} size={24} />
                  {!!filterCount(p.filters) && <View style={s.filterDot} />}
                </Pressable>
                {!(p.source === "Pinterest" && p.mode === "Designs") && <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sort results"
                  onPress={() => {
                    Keyboard.dismiss();
                    setSorting(true);
                  }}
                  hitSlop={10}
                >
                  <HomeIcon source={searchAssets.sort} size={24} />
                </Pressable>}
              </View>
            </View>
            {!!p.saveError && (
              <Text accessibilityRole="alert" style={s.message}>
                {p.saveError}
              </Text>
            )}
            {p.source === "Pinterest" && p.mode === "Designs" ? p.pinterest : <>{p.loading ? (
              <ActivityIndicator
                accessibilityLabel="Loading search results"
                color="white"
                style={{ marginVertical: 40 }}
              />
            ) : p.error ? (
              <View style={s.state}>
                <Text accessibilityRole="alert" style={s.message}>
                  {p.error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={p.onRetry}
                  style={s.stateButton}
                >
                  <Text style={s.total}>Try again</Text>
                </Pressable>
              </View>
            ) : !(p.mode === "Designs"
                ? p.designs.length
                : p.artists.length) ? (
              <View style={s.state}>
                <Text style={s.message}>
                  No matches yet. Try another search or clear your filters.
                </Text>
              </View>
            ) : p.mode === "Designs" ? (
              p.designs.map((d) => (
                <DesignResult
                  key={d.id}
                  design={d}
                  width={width - 48}
                  onOpen={() => p.onDesign(d.id)}
                  onSave={() => p.onSave(d.id)}
                />
              ))
            ) : (
              <View style={s.artistGrid}>
                {p.artists.map((a) => (
                  <ArtistResult
                    key={a.id}
                    artist={a}
                    width={
                      window.fontScale > 1.3 ? width - 48 : (width - 61) / 2
                    }
                    onOpen={() => p.onArtist(a.id)}
                    onSave={() => p.onSaveArtist(a.id)}
                  />
                ))}
              </View>
            )}
            {!!p.moreError && (
              <Text accessibilityRole="alert" style={s.message}>
                {p.moreError}
              </Text>
            )}
            {p.hasMore && !p.error && (
              <Pressable
                accessibilityRole="button"
                disabled={p.loadingMore}
                onPress={p.onMore}
                style={s.stateButton}
              >
                <Text style={s.total}>
                  {p.loadingMore
                    ? "Loading…"
                    : p.moreError
                      ? "Retry more results"
                      : "Load more"}
                </Text>
              </Pressable>
            )}
            </>}
          </View>
        </View>
      </ScrollView>
      {draft && (
        <FilterSheet
          width={width}
          value={draft}
          onChange={changeDraft}
          onClose={closeFilters}
          onApply={() => {
            p.onApply(draft);
            closeFilters();
            scroll.current?.scrollTo({ y: 0, animated: false });
          }}
          total={p.draftTotal}
          loading={p.counting}
          error={p.countError}
          onRetry={p.onRetryCount}
        />
      )}
      <Modal
        transparent
        visible={sorting}
        animationType="fade"
        onRequestClose={() => setSorting(false)}
      >
        <View style={s.sortBackdrop}>
          <View style={[s.sortSheet, { width: Math.min(width - 48, 360) }]}>
            <View style={s.resultHeader}>
              <Text accessibilityRole="header" style={s.designTitle}>
                Sort results
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close sort"
                onPress={() => setSorting(false)}
                hitSlop={10}
              >
                <HomeIcon source={searchAssets.close} size={24} />
              </Pressable>
            </View>
            {(p.mode === "Designs"
              ? ["Newest", "Most saved"]
              : ["Name A–Z"]
            ).map((sort) => (
              <Pressable
                key={sort}
                accessibilityRole="button"
                accessibilityState={{
                  selected: p.mode === "Artists" || p.sort === sort,
                }}
                onPress={() => {
                  if (p.mode === "Designs") p.onSort(sort as SearchSort);
                  setSorting(false);
                }}
                style={s.stateButton}
              >
                <Text style={s.total}>
                  {sort}
                  {p.sort === sort ? " ✓" : ""}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#21090f", overflow: "hidden" },
  content: { paddingHorizontal: 24, gap: 32 },
  scroll: { flex: 1, overflow: "hidden" },
  searchHeader: {
    flexShrink: 0,
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 20,
  },
  heading: {
    ...typography.heading,
    color: "white",
  },
  subtitle: {
    fontFamily: f.regular,
    fontSize: 16,
    lineHeight: 19.2,
    color: "rgba(255,255,255,.8)",
  },
  tabs: { flexDirection: "row" },
  tab: { flex: 1, gap: 8, alignItems: "center" },
  tabText: {
    fontFamily: f.light,
    fontSize: 16,
    lineHeight: 19.2,
    color: "rgba(255,255,255,.5)",
  },
  selectedTab: { fontFamily: f.regular, color: "white" },
  underline: {
    width: "100%",
    height: 2,
    borderRadius: 1,
    backgroundColor: "#d98cab",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#b36177",
    borderRadius: 100,
    backgroundColor: "white",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 48,
  },
  searchIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: f.light,
    fontSize: 14,
    lineHeight: 16.8,
    paddingVertical: 12,
    color: c.roseText,
  },
  results: { gap: 24 },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  resultActions: { flexDirection: "row", gap: 12 },
  total: {
    fontFamily: f.regular,
    fontSize: 16,
    lineHeight: 19.2,
    color: "white",
  },
  filterDot: {
    position: "absolute",
    right: -3,
    top: -3,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#ff517f",
  },
  design: { gap: 16 },
  photo: {
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#61202e",
    boxShadow: "4px 4px 15px 0px rgba(146,107,0,.1)",
  },
  saveTarget: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  saveCircle: {
    width: 28,
    height: 28,
    borderRadius: 100,
    backgroundColor: "transparent",
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  savedCircle: { width: 42, height: 42, borderWidth: 0 },
  savedCount: {
    fontFamily: f.light,
    fontSize: 16,
    lineHeight: 16,
    color: "white",
  },
  caption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  designTitle: {
    fontFamily: f.regular,
    fontSize: 18,
    lineHeight: 21.6,
    color: "white",
  },
  review: {
    fontFamily: f.light,
    fontSize: 14,
    lineHeight: 15.4,
    textDecorationLine: "underline",
    color: "white",
  },
  attributes: {
    fontFamily: f.light,
    fontSize: 15,
    lineHeight: 16.5,
    color: "rgba(255,255,255,.8)",
  },
  fallback: { color: c.rose, alignSelf: "center", marginTop: 90 },
  message: {
    fontFamily: f.regular,
    fontSize: 15,
    lineHeight: 21,
    color: c.rose,
    textAlign: "center",
  },
  state: { paddingVertical: 36, gap: 16, alignItems: "center" },
  stateButton: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 44,
    backgroundColor: "rgba(190,117,122,.2)",
    borderRadius: 100,
    alignItems: "center",
  },
  artistGrid: { flexDirection: "row", flexWrap: "wrap", gap: 13 },
  artist: {
    minHeight: 218,
    borderRadius: 32,
    backgroundColor: c.burgundy,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  artistBody: { gap: 12, alignItems: "center" },
  artistInfo: { gap: 8, alignItems: "center", width: "100%" },
  artistSaveTarget: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 44,
    height: 44,
  },
  artistHeart: {
    position: "absolute",
    top: 0,
    right: -3,
    width: 28,
    height: 28,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  artistSavedHeart: {
    right: 1,
    width: 24,
    height: 24,
    backgroundColor: "#d15e7a",
  },
  badge: {
    marginTop: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 100,
    overflow: "hidden",
  },
  badgeText: {
    fontFamily: f.regular,
    fontSize: 10,
    lineHeight: 10,
    color: "white",
  },
  artistName: {
    maxWidth: "100%",
    fontFamily: f.regular,
    fontSize: 16,
    lineHeight: 17.6,
    color: "white",
    textAlign: "center",
  },
  artistMeta: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  metadata: {
    flexDirection: "row",
    gap: 2,
    alignItems: "center",
    maxWidth: "100%",
  },
  metaText: {
    fontFamily: f.light,
    fontSize: 12,
    lineHeight: 14.4,
    color: "white",
    flexShrink: 1,
  },
  avatarInitial: {
    fontFamily: f.regular,
    fontSize: 44,
    color: c.rose,
    textAlign: "center",
  },
  sortBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  sortSheet: {
    backgroundColor: c.burgundy,
    borderRadius: 32,
    padding: 24,
    gap: 16,
  },
});
