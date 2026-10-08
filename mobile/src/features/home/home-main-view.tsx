import { useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image, type ImageSource } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { homeAssets as a } from "./assets";
import { homeColors as c, homeFonts as f } from "./tokens";
import { HomeScrollSheet, type HomeScrollHandle } from "./home-scroll-sheet";
import { HomeCommunity, type HomeCommunityState } from "./home-community";
import { HomeBackground } from "./home-background";
import { HomeHero } from "./home-hero";
import { HomeIcon, compactCount } from "./home-primitives";
export { HomeIcon, HomeGlass, compactCount } from "./home-primitives";

export const HOME_TABS = [
  "Explore",
  "Community",
  "Following",
  "Updates",
] as const;
export const HOME_CATEGORIES = [
  "All",
  "Dark",
  "Minimal",
  "Glam",
  "Y2K",
  "Colourful",
] as const;
export const HOME_SORTS = ["For you", "Newest", "Most saved"] as const;
export type HomeTab = (typeof HOME_TABS)[number];
export type HomeCategory = (typeof HOME_CATEGORIES)[number];
export type HomeSort = (typeof HOME_SORTS)[number];
export type HomeDesign = {
  id: string;
  title: string;
  image: ImageSource | string | number | null;
  saves: number;
  saved?: boolean;
  saving?: boolean;
  shape?: string | null;
  category?: string | null;
  crop?: { left: number; top?: number; width: number; height: number };
  cropFit?: "cover" | "fill";
};
export type HomeStory = {
  id: string;
  name: string;
  image: HomeDesign["image"];
  viewed?: boolean;
  isOwn?: boolean;
};
export type HomeSection = {
  title: string;
  designs: HomeDesign[];
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  retry: () => void;
  action?: { title: string; onPress: () => void };
  loadMore?: () => void;
  loadingMore?: boolean;
};
export type HomeMainProps = {
  heroes?: import("./published-content").PublishedHero[];
  featured?: HomeSection;
  announcements?: import("./published-content").HomeContent["announcements"];
  onRefresh?: () => void;
  refreshing?: boolean;
  active?: boolean;
  viewportWidth?: number;
  trending: HomeSection;
  week: HomeSection;
  community: HomeCommunityState;
  library: HomeSection;
  tab: HomeTab;
  category: HomeCategory;
  sort: HomeSort;
  onTab: (tab: HomeTab) => void;
  onCategory: (category: HomeCategory) => void;
  onSort: (sort: HomeSort) => void;
  stories: HomeStory[];
  storiesLoading?: boolean;
  storiesError?: string;
  onRetryStories?: () => void;
  onStory: (id: string) => void;
  onAddStory: () => void;
  onSearch: (query: string) => void;
  searchLocked?: boolean;
  onNotifications: () => void;
  onFavorites: () => void;
  onDesign: (id: string) => void;
  onSave: (id: string) => void;
  saveError?: string;
  updates?: ReactNode;
  communityFeed?: ReactNode;
  pinterest?: ReactNode;
};

function DesignCard({
  design,
  index,
  width = 140,
  library = false,
  week = false,
  onDesign,
  onSave,
}: {
  design: HomeDesign;
  index: number;
  width?: number;
  library?: boolean;
  week?: boolean;
  onDesign: HomeMainProps["onDesign"];
  onSave: HomeMainProps["onSave"];
}) {
  const [failed, setFailed] = useState<HomeDesign["image"]>();
  const height = library
    ? index % 4 === 0 || index % 4 === 3
      ? 190
      : 150
    : week
      ? 222
      : 160;
  return (
    <View style={{ width, gap: 8 }} testID={`home-design-${design.id}`}>
      <View
        style={[
          s.cardImage,
          { height, borderRadius: library ? 32 : week && index > 0 ? 20 : 24 },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${design.title}`}
          style={StyleSheet.absoluteFill}
          onPress={() => onDesign(design.id)}
        >
          {design.image && failed !== design.image ? (
            <Image
              source={design.image}
              accessible={false}
              cachePolicy="memory"
              style={
                design.crop ? [s.crop, design.crop] : StyleSheet.absoluteFill
              }
              contentFit={design.cropFit || "cover"}
              onError={() => setFailed(design.image)}
            />
          ) : (
            <Text style={s.imageFallback}>Image unavailable</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${design.saved ? "Unsave" : "Save"} ${design.title}`}
          accessibilityState={{
            disabled: !!design.saving,
            busy: !!design.saving,
            selected: !!design.saved,
          }}
          disabled={design.saving}
          onPress={() => onSave(design.id)}
          style={s.saveHitTarget}
        >
          <View
            style={[
              s.saveCircle,
              !library && (week || index === 2) && s.glassSave,
            ]}
          >
            {design.saving ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <HomeIcon
                source={design.saved ? a.heartFilled : a.heart}
                size={14}
              />
            )}
          </View>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Details for ${design.title}`}
        onPress={() => onDesign(design.id)}
        style={{ gap: library ? 4 : 2 }}
      >
        <Text style={s.cardTitle} numberOfLines={1}>
          {design.title}
        </Text>
        <Text style={library ? s.tags : s.saves}>
          {library
            ? [design.shape, design.category]
                .filter(Boolean)
                .join(" · ")
                .toUpperCase()
            : `${compactCount(design.saves)} saves`}
        </Text>
      </Pressable>
    </View>
  );
}

function SectionState({ section }: { section: HomeSection }) {
  return (
    <View style={s.sectionState}>
      {section.loading ? (
        <ActivityIndicator
          color="white"
          accessibilityLabel={`Loading ${section.title}`}
        />
      ) : (
        <>
          <Text
            accessibilityRole={section.error ? "alert" : undefined}
            style={s.stateText}
          >
            {section.error ||
              section.emptyMessage ||
              "New designs are on their way."}
          </Text>
          {section.error ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry ${section.title}`}
              onPress={section.retry}
              style={s.stateAction}
            >
              <Text style={s.stateText}>Try again</Text>
            </Pressable>
          ) : (
            section.action && (
              <Pressable
                accessibilityRole="button"
                onPress={section.action.onPress}
                style={s.stateAction}
              >
                <Text style={s.stateText}>{section.action.title}</Text>
              </Pressable>
            )
          )}
        </>
      )}
    </View>
  );
}

function DesignSection({
  section,
  library,
  week,
  width,
  onDesign,
  onSave,
}: {
  section: HomeSection;
  library?: boolean;
  week?: boolean;
  width: number;
  onDesign: HomeMainProps["onDesign"];
  onSave: HomeMainProps["onSave"];
}) {
  return (
    <View
      style={{ gap: library ? 16 : 12 }}
      testID={library ? "home-library" : week ? "home-week" : "home-trending"}
    >
      <Text
        accessibilityRole="header"
        style={[s.sectionTitle, week && { fontSize: 20, lineHeight: 24 }]}
      >
        {section.title}
      </Text>
      {section.loading || section.error || !section.designs.length ? (
        <SectionState section={section} />
      ) : library ? (
        <View style={s.grid}>
          {[0, 1].map((column) => (
            <View key={column} style={s.column}>
              {section.designs.map(
                (design, index) =>
                  index % 2 === column && (
                    <DesignCard
                      key={design.id}
                      design={design}
                      index={index}
                      library
                      width={(width - 61) / 2}
                      onDesign={onDesign}
                      onSave={onSave}
                    />
                  ),
              )}
            </View>
          ))}
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.cards, week && { gap: 8 }]}
          accessibilityLabel={section.title}
        >
          {section.designs.map((design, index) => (
            <DesignCard
              key={design.id}
              design={design}
              index={index}
              week={week}
              onDesign={onDesign}
              onSave={onSave}
            />
          ))}
        </ScrollView>
      )}
      {section.loadMore && !section.error && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Load more ${section.title}`}
          disabled={section.loadingMore}
          onPress={section.loadMore}
          style={[s.stateAction, { alignSelf: "center" }]}
        >
          <Text style={s.stateText}>
            {section.loadingMore ? "Loading…" : "Load more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function HomeMainView(props: HomeMainProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = props.viewportWidth ?? windowWidth;
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const sheet = useRef<HomeScrollHandle>(null);
  const scale = width / 393;
  // Keep the photograph behind the system status bar; inset only its controls.
  const heroHeaderTop = Math.max(24, insets.top + 12);
  const heroHeight = 491 * scale;
  const header = (
    <View testID="home-controls" style={s.controls}>
      <HomeBackground width={width} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[s.tabs, { minWidth: width }]}
      >
        {HOME_TABS.map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityLabel={tab}
            accessibilityState={{ selected: props.tab === tab }}
            hitSlop={{ top: 8, bottom: 8 }}
            onPress={() => props.onTab(tab)}
            style={s.topTab}
          >
            <Text style={[s.tabText, props.tab === tab && s.selectedText]}>
              {tab}
            </Text>
            {props.tab === tab && <View style={s.indicator} />}
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.stories}
        accessibilityLabel="Stories"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add your story"
          onPress={props.onAddStory}
          style={s.story}
        >
          <View style={[s.storyRing, s.yourStory]}>
            <View style={s.addStory}>
              <HomeIcon source={a.plus} size={18} />
            </View>
          </View>
          <Text style={s.storyName}>Your story</Text>
        </Pressable>
        {props.stories.map((story) => (
          <Pressable
            key={story.id}
            accessibilityRole="button"
            accessibilityLabel={
              story.isOwn ? "View your story" : `View ${story.name}’s story`
            }
            onPress={() => props.onStory(story.id)}
            style={s.story}
          >
            <View style={[s.storyRing, story.viewed && s.viewedStory]}>
              {story.image ? (
                <Image
                  source={story.image}
                  style={s.storyImage}
                  contentFit="cover"
                  cachePolicy="memory"
                  accessible={false}
                />
              ) : (
                <Text style={s.storyInitial}>{story.name[0]}</Text>
              )}
            </View>
            <Text style={s.storyName} numberOfLines={1}>
              {story.name}
            </Text>
          </Pressable>
        ))}
        {props.storiesLoading && (
          <ActivityIndicator
            color="white"
            accessibilityLabel="Loading stories"
          />
        )}
        {props.storiesError && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry stories"
            onPress={props.onRetryStories}
            style={s.storyRetry}
          >
            <Text style={s.stateText}>Stories unavailable · Retry</Text>
          </Pressable>
        )}
      </ScrollView>
      <View style={s.search} testID="home-search">
        <View style={s.searchIcon}>
          <HomeIcon source={a.searchPink} size={16} />
        </View>
        {props.searchLocked ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in to search"
            style={[s.searchInput, { justifyContent: "center" }]}
            onPress={() => props.onSearch("")}
          >
            <Text
              style={{
                color: c.placeholder,
                fontFamily: f.regular,
                fontSize: 14,
              }}
            >
              Search designs, nail artists, salons..
            </Text>
          </Pressable>
        ) : (
          <TextInput
            accessibilityLabel="Search designs, nail artists, salons"
            placeholder="Search designs, nail artists, salons.."
            placeholderTextColor={c.placeholder}
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            onSubmitEditing={() => props.onSearch(query.trim())}
          />
        )}
      </View>
      {props.tab !== "Updates" && props.tab !== "Community" && (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categories}
            accessibilityLabel="Design categories"
          >
            {HOME_CATEGORIES.map((category) => (
              <Pressable
                key={category}
                accessibilityRole="button"
                accessibilityLabel={`Category: ${category}`}
                accessibilityState={{
                  selected: props.category === category,
                }}
                onPress={() => props.onCategory(category)}
                hitSlop={{ top: 6, bottom: 6 }}
                style={[s.chip, props.category === category && s.activeChip]}
              >
                <Text
                  style={[
                    s.chipText,
                    props.category === category && s.selectedText,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.sorts}
            accessibilityLabel="Sort designs"
          >
            <Text style={s.chipText}>Sort:</Text>
            {HOME_SORTS.map((sort) => (
              <Pressable
                key={sort}
                accessibilityRole="button"
                accessibilityLabel={`Sort: ${sort}`}
                accessibilityState={{
                  selected: props.sort === sort,
                }}
                hitSlop={{ top: 8, bottom: 8 }}
                onPress={() => props.onSort(sort)}
                style={[s.sort, props.sort === sort && s.activeSort]}
              >
                <Text
                  style={[s.chipText, props.sort === sort && s.selectedText]}
                >
                  {sort === "For you" ? "✦ For you" : sort}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
  return (
    <HomeScrollSheet
      ref={sheet}
      active={props.active}
      onRefresh={props.onRefresh}
      refreshing={props.refreshing}
      initialHeroHeight={heroHeight}
      header={header}
      background={<HomeBackground width={width} />}
      hero={
        <HomeHero
          heroes={props.heroes}
          width={width}
          height={heroHeight}
          headerTop={heroHeaderTop}
          onNotifications={props.onNotifications}
          onFavorites={props.onFavorites}
        />
      }
    >
      <View style={[s.feed, { paddingBottom: 120 + insets.bottom }]}>
        {props.saveError && (
          <Text accessibilityRole="alert" style={s.saveError}>
            {props.saveError}
          </Text>
        )}
        {props.tab === "Updates" ? (
          <>
            {props.announcements?.map(a=><View key={a.id} style={{margin:24,padding:24,borderRadius:24,backgroundColor:"rgba(255,255,255,.08)"}}><Text style={{fontFamily:f.regular,color:"#ffafc7",fontSize:13}}>LaQue announcement</Text><Text accessibilityRole="header" style={{fontFamily:f.display,color:"white",fontSize:24,marginTop:8}}>{a.title}</Text><Text style={{fontFamily:f.regular,color:"white",fontSize:16,marginTop:8}}>{a.body}</Text></View>)}
            {props.updates}
          </>
        ) : props.tab === "Community" ? (props.communityFeed) : (
          <>
            {props.tab === "Explore" && (
              <>
                {!!props.featured?.designs.length && <DesignSection section={props.featured} width={width} onDesign={props.onDesign} onSave={props.onSave} />}
                <DesignSection
                  section={props.trending}
                  width={width}
                  onDesign={props.onDesign}
                  onSave={props.onSave}
                />
                <View style={{ gap: 32, marginTop: 8 }}>
                  <DesignSection
                    section={props.week}
                    week
                    width={width}
                    onDesign={props.onDesign}
                    onSave={props.onSave}
                  />
                  <HomeCommunity
                    width={width}
                    state={props.community}
                    onPress={() => {
                      props.onTab("Community");
                      sheet.current?.scrollToFeed();
                    }}
                  />
                </View>
              </>
            )}
            {props.tab === "Explore" && props.pinterest && <View style={{ paddingHorizontal: 24 }}>{props.pinterest}</View>}
            <DesignSection
              section={props.library}
              library
              width={width}
              onDesign={props.onDesign}
              onSave={props.onSave}
            />
          </>
        )}
      </View>
    </HomeScrollSheet>
  );
}

const s = StyleSheet.create({
  controls: { paddingVertical: 24, gap: 24, overflow: "hidden" },
  tabs: {
    paddingHorizontal: 24,
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 24,
  },
  topTab: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 26,
    gap: 6,
  },
  tabText: {
    fontFamily: f.light,
    fontSize: 15,
    lineHeight: 18,
    color: "rgba(255,255,255,.8)",
  },
  selectedText: { fontFamily: f.regular, color: "white" },
  indicator: {
    width: 24,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#ff517f",
  },
  stories: { paddingHorizontal: 24, gap: 14, alignItems: "center" },
  story: { width: 58, alignItems: "center", gap: 8 },
  storyRing: {
    width: 58,
    height: 58,
    padding: 2,
    borderWidth: 1.5,
    borderRadius: 100,
    borderColor: "rgba(255,255,255,.53)",
    alignItems: "center",
    justifyContent: "center",
  },
  yourStory: { borderColor: "#ff517f" },
  viewedStory: { borderColor: "rgba(255,255,255,.2)" },
  addStory: {
    width: 52,
    height: 52,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  storyImage: { width: 52, height: 52, borderRadius: 100 },
  storyInitial: { fontFamily: f.regular, color: "white", fontSize: 24 },
  storyName: {
    fontFamily: f.light,
    fontSize: 11,
    lineHeight: 13,
    color: "rgba(255,255,255,.8)",
  },
  storyRetry: { minHeight: 44, maxWidth: 170, justifyContent: "center" },
  search: {
    marginHorizontal: 24,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#b36177",
    borderRadius: 100,
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
  },
  searchIcon: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: f.light,
    fontSize: 14,
    lineHeight: 17,
    paddingVertical: 12,
    color: c.roseText,
  },
  categories: { paddingHorizontal: 24, gap: 8, alignItems: "center" },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    minHeight: 32,
    borderWidth: 1,
    borderRadius: 100,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.1)",
    justifyContent: "center",
  },
  activeChip: { backgroundColor: "#ff517f", borderColor: "#ff517f" },
  chipText: {
    fontFamily: f.light,
    fontSize: 13,
    lineHeight: 16,
    color: "rgba(255,255,255,.8)",
  },
  sorts: { paddingHorizontal: 24, gap: 12, alignItems: "center" },
  sort: { minHeight: 28, justifyContent: "center" },
  activeSort: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.1)",
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  feed: { gap: 24 },
  sectionTitle: {
    marginHorizontal: 24,
    fontFamily: f.regular,
    fontSize: 18,
    lineHeight: 22,
    color: "white",
  },
  cards: { paddingHorizontal: 24, gap: 13 },
  grid: { paddingHorizontal: 24, flexDirection: "row", gap: 13 },
  column: { flex: 1, gap: 16 },
  cardImage: { overflow: "hidden", backgroundColor: "#4d242e" },
  crop: { position: "absolute", top: 0 },
  cardTitle: {
    fontFamily: f.regular,
    fontSize: 18,
    lineHeight: 22,
    color: "white",
  },
  saves: {
    fontFamily: f.light,
    fontSize: 11,
    lineHeight: 13,
    color: "rgba(255,255,255,.8)",
  },
  tags: {
    fontFamily: f.regular,
    fontSize: 10,
    lineHeight: 12,
    color: "rgba(255,255,255,.8)",
  },
  saveHitTarget: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  saveCircle: {
    width: 28,
    height: 28,
    borderRadius: 100,
    backgroundColor: "rgba(190,117,122,.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  glassSave: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(255,255,255,.1)",
  },
  sectionState: {
    marginHorizontal: 24,
    minHeight: 160,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  stateText: {
    fontFamily: f.regular,
    color: "white",
    fontSize: 14,
    textAlign: "center",
  },
  stateAction: {
    minHeight: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#662737",
    borderRadius: 24,
  },
  imageFallback: {
    fontFamily: f.regular,
    color: c.rose,
    fontSize: 13,
    textAlign: "center",
    marginTop: 60,
    marginHorizontal: 12,
  },
  saveError: {
    color: c.rose,
    fontFamily: f.regular,
    marginHorizontal: 24,
    fontSize: 14,
  },
});
