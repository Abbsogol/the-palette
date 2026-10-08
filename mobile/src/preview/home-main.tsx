import { PinterestInspiration, usePinterestFeed } from "../features/pinterest/inspiration";
import { ReportPreview } from "./report";
import { NotificationsPreview } from "./notifications";
import { CommunityFeed } from "../features/social/feed";
import { SocialComposerPreview } from "./social";
import type { SocialPost } from "../features/social/data";
import { PreviewCalendarProvider } from "./calendar";
import { PreviewMessagesProvider } from "./message-store";
// Development-only Figma records. Never imported into or written to the real catalog.
import { useState } from "react";
import FavoritesPreview from "./favorites";
import {
  PreviewFavoritesProvider,
  usePreviewFavorites,
} from "./favorites-store";
import {
  Alert,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { StoryViewer, type StoryItem } from "../features/stories/story-ui";
import { StoryComposerPreview } from "./stories";
import { UpdateComposer } from "../features/home/update-composer";
import { UpdatesFeed } from "../features/home/updates-view";
import type { HomeUpdate } from "../features/home/data";
import LabPreview from "./lab";
import ProfilePreview from "./profile-booking";
import MessagesPreview from "./messages";
import SearchDesignPreview from "./search-main";
import { DesignDetailPreview, previewDetail } from "./design-detail";
import { HomeNavigation } from "../components/home-tab-bar";
import {
  HomeMainView,
  type HomeDesign,
  type HomeStory,
  type HomeTab,
  type HomeCategory,
  type HomeSort,
} from "../features/home/home-main-view";

export const homeFixtureTrending: HomeDesign[] = [
  {
    id: "rosewood",
    title: "Rosewood Bride",
    saves: 2000,
    image: require("../../assets/figma/home-main/f24ce.png"),
    category: "Minimal",
  },
  {
    id: "cathedral",
    title: "Cathedral",
    saves: 1800,
    image: require("../../assets/figma/home-main/6cdce.png"),
    category: "Glam",
  },
  {
    id: "velvet",
    title: "Velvet Noir",
    saves: 1500,
    image: require("../../assets/figma/home-main/3716c.png"),
    category: "Dark",
  },
];
export const homeFixtureLibrary: HomeDesign[] = [
  {
    id: "matte",
    title: "Matte Black",
    image: require("../../assets/figma/home-main/e8424.png"),
    saves: 1400,
    shape: "Coffin",
    category: "Edgy",
  },
  {
    id: "mossy",
    title: "Mossy Oak",
    image: require("../../assets/figma/home-main/008f8.png"),
    saves: 1200,
    shape: "Oval",
    category: "Nature",
  },
  {
    id: "milk",
    title: "Milk Glass",
    image: require("../../assets/figma/home-main/f24ce.png"),
    saves: 900,
    shape: "Square",
    category: "Everyday",
    crop: { left: -0.2656, top: -45.57, width: 166, height: 207.12 },
    cropFit: "fill",
  },
  {
    id: "retro",
    title: "Retro Checker",
    image: require("../../assets/figma/home-v2/b6228.png"),
    saves: 700,
    shape: "Almond",
    category: "Funky",
  },
];
export const homeFixtureWeek: HomeDesign[] = [
  {
    id: "week-rosewood",
    title: "Rosewood Bride",
    saves: 2000,
    category: "Dark",
    image: require("../../assets/figma/home-main/e8424.png"),
    crop: { left: -41.083, top: -52.2032, width: 220.1925, height: 339.6512 },
    cropFit: "fill",
  },
  {
    id: "week-cathedral",
    title: "Cathedral",
    saves: 1800,
    category: "Colourful",
    image: require("../../assets/figma/home-main/008f8.png"),
    crop: { left: -12.668, top: 0, width: 199.2, height: 236 },
    cropFit: "fill",
  },
  {
    id: "week-velvet",
    title: "Velvet Noir",
    saves: 1500,
    category: "Glam",
    image: require("../../assets/figma/home-main/58482.png"),
    crop: { left: 0, top: 0, width: 165, height: 236 },
    cropFit: "cover",
  },
];
const stories: HomeStory[] = [
  {
    id: "anelia",
    name: "Anelia Cafe",
    image: require("../../assets/figma/home-v2/8062b.png"),
  },
  {
    id: "sarah",
    name: "Sarah M.",
    image: require("../../assets/figma/home-main/6ca80.png"),
  },
  {
    id: "elena-1",
    name: "Elena R.",
    image: require("../../assets/figma/home-main/d20fb.png"),
  },
  {
    id: "elena-2",
    name: "Elena R.",
    image: require("../../assets/figma/home-main/e8424.png"),
  },
  {
    id: "elena-3",
    name: "Elena R.",
    image: require("../../assets/figma/home-v2/79f04.png"),
  },
];
type PreviewProps = {
  guest?: boolean;
  onRequireSignIn?: () => void;
  onExitDemo?: () => void;
};
export default function HomeDesignPreview(props: PreviewProps) {
  return (
    <PreviewFavoritesProvider>
      <PreviewCalendarProvider>
        <PreviewMessagesProvider>
          <HomePreview {...props} />
        </PreviewMessagesProvider>
      </PreviewCalendarProvider>
    </PreviewFavoritesProvider>
  );
}
function HomePreview({
  guest = false,
  onRequireSignIn = () => undefined,
  onExitDemo,
}: {
  guest?: boolean;
  onRequireSignIn?: () => void;
  onExitDemo?: () => void;
}) {
  const pinterest = usePinterestFeed(false, false, true);
  const window = useWindowDimensions();
  const width =
    Platform.OS === "web" ? Math.min(393, window.width) : window.width;
  const [postComposer, setPostComposer] = useState(false);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([
    {
      id: "demo-post-1",
      userId: "anelia",
      name: "Anelia Cafe",
      username: "anelia.cafe",
      caption:
        "A fresh set, a quiet moment. Obsessed with these tiny details ✨",
      createdAt: new Date().toISOString(),
      media: [{ type: "image", uri: homeFixtureTrending[0].image! }],
      tags: ["nailart", "newset"],
      people: [],
    },
  ]);
  const [storyMode, setStoryMode] = useState<
    null | "compose" | { userId: string; initialStoryId?: string }
  >(null);
  const [demoStories, setDemoStories] = useState<StoryItem[]>(() =>
    stories.flatMap((story, index) => [
      {
        id: `${story.id}-first`,
        userId: story.id,
        name: story.name,
        image: story.image!,
        caption: [
          "A little detail makes all the difference.",
          "Today's inspiration: a touch of chrome.",
          "A fresh set for a fresh week.",
        ][index % 3],
        createdAt: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
      },
      {
        id: `${story.id}-second`,
        userId: story.id,
        name: story.name,
        image: homeFixtureTrending[index % 3].image!,
        caption: "The finishing touches ✨",
        createdAt: new Date(Date.now() - index * 3600000).toISOString(),
      },
    ]),
  );
  const [updateComposer, setUpdateComposer] = useState(false);
  const [updates, setUpdates] = useState<HomeUpdate[]>(() =>
    [
      {
        id: "update-1",
        creator_id: "anelia",
        name: "Anelia Cafe",
        body: "A little studio note 🌷\n\nSoft rose, sheer layers and the tiniest gold details. This week I’m taking inspiration from slow mornings and fresh flowers. What colour are you wearing right now?",
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: "update-2",
        creator_id: "sarah",
        name: "Sarah M.",
        body: "The details behind the design.\n\nFor this set, I wanted to combine a soft nude base with sculptural chrome. Each accent is placed by hand, so every nail feels a little different while still belonging to the same story.\n\nSave your favourites and bring them along to your next appointment. I love seeing the little things that inspire you.",
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: "update-3",
        creator_id: "elena-1",
        name: "Elena R.",
        body: "New in my portfolio: deep burgundy, glossy finishes and a few unexpected details. Come take a look ♡",
        created_at: new Date(Date.now() - 18000000).toISOString(),
      },
    ].map((post, index) => ({
      ...post,
      username: ["anelia.cafe", "sarah.nails", "elena.r"][index],
      avatar: stories[index].image,
    })),
  );
  const [publicProfile, setPublicProfile] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"Designs" | "Artists">(
    "Designs",
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = [
    ...homeFixtureTrending,
    ...homeFixtureLibrary,
    ...homeFixtureWeek,
  ].find((d) => d.id === detailId);
  const favorites = usePreviewFavorites()!;
  const saved = favorites.library.savedIds;
  const toggleSaved = (id: string) => {
    const design = [
      ...homeFixtureTrending,
      ...homeFixtureLibrary,
      ...homeFixtureWeek,
    ].find((d) => d.id === id);
    if (design)
      favorites.toggleDesign({
        ...design,
        attributes: [design.shape, design.category].filter(
          (v): v is string => !!v,
        ),
      });
  };
  const [selected, setSelected] = useState("index");
  const [tab, setTab] = useState<HomeTab>("Explore"),
    [category, setCategory] = useState<HomeCategory>("All"),
    [sort, setSort] = useState<HomeSort>("For you");
  const explain = (action: string) =>
    Alert.alert(
      "Figma visual preview",
      `${action} is not connected in this visual preview. Home, Search, filters and design details use local sample data.`,
    );
  const allowed = () => {
    if (!guest) return true;
    onRequireSignIn();
    return false;
  };
  const selectTab = (name: string) => {
    setSearchMode(name === "search-artists" ? "Artists" : "Designs");
    if (name === "search-artists") name = "search";
    if (name !== "index" && !allowed()) return;
    if (
      !["index", "search", "lab", "profile", "messages", "saved"].includes(
        name,
      ) ||
      (name === "profile" && !onExitDemo)
    ) {
      explain(
        name === "lab"
          ? "Lab"
          : name === "messages"
            ? "Messages"
            : name === "saved"
              ? "Saved collections"
              : "Profile",
      );
      return;
    }
    setDetailId(null);
    setSelected(name);
  };
  const records = (designs: HomeDesign[]) =>
    designs
      .filter(
        (d) =>
          category === "All" ||
          (category === "Dark"
            ? ["Dark", "Edgy"].includes(d.category || "")
            : category === "Minimal"
              ? ["Minimal", "Everyday"].includes(d.category || "")
              : category === "Colourful"
                ? ["Nature", "Funky"].includes(d.category || "")
                : d.category === category),
      )
      .map((d) => ({
        ...d,
        saved: saved.includes(d.id),
        ...(d.crop && d.id === "milk"
          ? {
              crop: {
                ...d.crop,
                width: (width - 61) / 2,
                left: (-0.0016 * (width - 61)) / 2,
              },
            }
          : {}),
      }))
      .sort((a, b) =>
        sort === "Most saved"
          ? b.saves - a.saves
          : sort === "Newest"
            ? a.id.localeCompare(b.id)
            : 0,
      );
  return (
    <View style={{ flex: 1, backgroundColor: "#21090f", alignItems: "center" }}>
      <View style={{ flex: 1, width }}>
        <View
          style={{ flex: 1 }}
          accessibilityElementsHidden={
            updateComposer ||
            postComposer ||
            !!storyMode ||
            !!publicProfile ||
            notificationsOpen
          }
          importantForAccessibility={
            updateComposer ||
            postComposer ||
            storyMode ||
            publicProfile ||
            notificationsOpen
              ? "no-hide-descendants"
              : "auto"
          }
          aria-hidden={
            updateComposer ||
            postComposer ||
            !!storyMode ||
            !!publicProfile ||
            notificationsOpen
          }
        >
          {selected === "profile" && onExitDemo ? (
            <ProfilePreview
              width={width}
              onBack={() => selectTab("index")}
              onExitDemo={onExitDemo}
              onNavigate={selectTab}
            />
          ) : selected === "saved" ? (
            <FavoritesPreview width={width} onNavigate={selectTab} />
          ) : selected === "lab" ? (
            <LabPreview width={width} />
          ) : selected === "messages" ? (
            <MessagesPreview
              width={width}
              onFind={() => selectTab("search-artists")}
              onChatOpenChange={setChatOpen}
            />
          ) : selected === "search" ? (
            <SearchDesignPreview
              width={width}
              initialQuery={searchQuery}
              initialMode={searchMode}
              onNavigate={selectTab}
            />
          ) : (
            <HomeMainView
              pinterest={<PinterestInspiration feed={pinterest} preview />}
              viewportWidth={width}
              tab={tab}
              category={category}
              sort={sort}
              onTab={(value) => {
                if (!allowed()) return;
                if (
                  value === "Explore" ||
                  value === "Community" ||
                  value === "Updates"
                )
                  setTab(value);
                else explain(`${value} feed`);
              }}
              onCategory={(value) => {
                if (allowed()) setCategory(value);
              }}
              onSort={(value) => {
                if (allowed()) setSort(value);
              }}
              trending={{
                title: "TRENDING",
                designs: records(homeFixtureTrending),
                retry: () => undefined,
              }}
              week={{
                title: "New This Week",
                designs: records(homeFixtureWeek),
                retry: () => undefined,
                emptyMessage: "No new sample designs match this filter.",
              }}
              community={{
                stats: {
                  artists: 2500,
                  posts: 550,
                  approximate: true,
                  likes: 12100,
                  comments: 24,
                },
                retry: () => undefined,
              }}
              library={{
                title: tab === "Community" ? "Community" : "Explore Library",
                designs: records(homeFixtureLibrary),
                retry: () => undefined,
                emptyMessage: "No sample designs match this filter.",
              }}
              stories={[
                ...demoStories
                  .filter((story) => story.userId === "preview-self")
                  .slice(-1)
                  .map((story) => ({
                    id: story.userId,
                    name: "You",
                    isOwn: true,
                    image: story.image,
                  })),
                ...stories,
              ]}
              onStory={(id) => {
                if (allowed()) setStoryMode({ userId: id });
              }}
              onAddStory={() => {
                if (allowed()) setStoryMode("compose");
              }}
              communityFeed={
                <CommunityFeed
                  posts={socialPosts}
                  preview
                  onRetry={() => undefined}
                  onCompose={() => setPostComposer(true)}
                  onProfile={(id) =>
                    setPublicProfile({
                      id,
                      name:
                        socialPosts.find((p) => p.userId === id)?.name ||
                        "LaQue member",
                    })
                  }
                />
              }
              updates={
                <UpdatesFeed
                  currentUserId="preview-self"
                  onCompose={() => {
                    if (allowed()) setUpdateComposer(true);
                  }}
                  posts={updates}
                  preview
                  onRetry={() => undefined}
                  onProfile={(id) =>
                    setPublicProfile({
                      id,
                      name:
                        updates.find((post) => post.creator_id === id)?.name ||
                        "Creator",
                    })
                  }
                  onDiscover={() => selectTab("search-artists")}
                  onNotifications={() => setNotificationsOpen(true)}
                />
              }
              onSave={(id) => {
                if (!allowed()) return;
                toggleSaved(id);
              }}
              onDesign={(id) => {
                if (allowed()) setDetailId(id);
              }}
              searchLocked={guest}
              onSearch={(query) => {
                if (!allowed()) return;
                setSearchQuery(query);
                setSelected("search");
              }}
              onFavorites={() => selectTab("saved")}
              onNotifications={() => {
                if (allowed()) setNotificationsOpen(true);
              }}
            />
          )}
          {!storyMode &&
            !publicProfile &&
            !notificationsOpen &&
            !(selected === "messages" && chatOpen) && (
              <HomeNavigation selected={selected} onSelect={selectTab} />
            )}
        </View>
        {updateComposer && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 26 }]}>
            <UpdateComposer
              preview
              onClose={() => setUpdateComposer(false)}
              onPublish={async (body) => {
                setUpdates((p) => [
                  {
                    id: `demo-update-${Date.now()}`,
                    creator_id: "preview-self",
                    name: "You",
                    body,
                    created_at: new Date().toISOString(),
                  },
                  ...p,
                ]);
              }}
            />
          </View>
        )}
        {postComposer && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 25 }]}>
            <SocialComposerPreview
              kind="post"
              onClose={() => setPostComposer(false)}
              onPost={(d) => {
                setSocialPosts((p) => [
                  {
                    id: `demo-post-${Date.now()}`,
                    userId: "preview-self",
                    name: "You",
                    username: "sarah.nails",
                    createdAt: new Date().toISOString(),
                    ...d,
                  },
                  ...p,
                ]);
                setPostComposer(false);
              }}
            />
          </View>
        )}
        {storyMode && (
          <View
            style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
            accessibilityElementsHidden={!!publicProfile || reportOpen}
            importantForAccessibility={
              publicProfile || reportOpen ? "no-hide-descendants" : "auto"
            }
            aria-hidden={!!publicProfile || reportOpen}
          >
            {storyMode === "compose" ? (
              <StoryComposerPreview
                width={width}
                onClose={() => setStoryMode(null)}
                onPost={(story) => {
                  setDemoStories((current) => [...current, story]);
                  setStoryMode({
                    userId: story.userId,
                    initialStoryId: story.id,
                  });
                }}
              />
            ) : (
              <StoryViewer
                key={storyMode.userId}
                initialStoryId={storyMode.initialStoryId}
                width={width}
                stories={demoStories.filter(
                  (story) => story.userId === storyMode.userId,
                )}
                onRetry={() => undefined}
                viewerId="preview-self"
                preview
                onReport={() => setReportOpen(true)}
                onClose={() => setStoryMode(null)}
                onProfile={(story) =>
                  setPublicProfile({ id: story.userId, name: story.name })
                }
              />
            )}
          </View>
        )}
        {reportOpen && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
            <ReportPreview onClose={() => setReportOpen(false)} />
          </View>
        )}
        {notificationsOpen && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 20 }]}>
            <NotificationsPreview
              width={width}
              onBack={() => setNotificationsOpen(false)}
            />
          </View>
        )}
        {publicProfile && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 30 }]}>
            <ProfilePreview
              width={width}
              publicProfile
              publicIdentity={{
                ...publicProfile,
                role: publicProfile.id === "preview-self" ? "user" : "creator",
              }}
              onBack={() => setPublicProfile(null)}
            />
          </View>
        )}
        {detail && (
          <DesignDetailPreview
            key={detail.id}
            design={previewDetail(detail)}
            width={width}
            saved={saved.includes(detail.id)}
            onSave={() => toggleSaved(detail.id)}
            from="index"
            onNavigate={selectTab}
            onClose={() => setDetailId(null)}
          />
        )}
      </View>
    </View>
  );
}
