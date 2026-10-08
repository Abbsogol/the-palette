import { PinterestInspiration, usePinterestFeed } from "../features/pinterest/inspiration";
import { useState } from "react";
import { usePreviewFavorites } from "./favorites-store";
import ProfilePreview from "./profile-booking";
import { DesignDetailPreview, previewDetail } from "./design-detail";
import {
  SearchView,
  type SearchArtist,
  type SearchDesign,
} from "../features/search/search-view";
import {
  COLOR_TERMS,
  VIBE_TERMS,
  emptyFilters,
  type SearchFilters,
  type SearchMode,
  type SearchSort,
} from "../features/search/filters";
export const searchFixtureDesigns: SearchDesign[] = [
  {
    id: "search-cathedral",
    title: "Cathedral",
    image: require("../../assets/figma/search/81f07.png"),
    attributes: [
      "Stiletto",
      "Long",
      "Gel",
      "3D Design",
      "Gothic",
      "Ivory",
      "Fashion",
    ],
    reviewCount: 24,
  },
  {
    id: "search-rosewood",
    title: "Rosewood Bride",
    image: require("../../assets/figma/search/962ba.png"),
    attributes: [
      "Stiletto",
      "Long",
      "Gel",
      "3D Design",
      "Gothic",
      "Ivory",
      "Fashion",
    ],
    reviewCount: 24,
  },
  {
    id: "search-pistachio",
    title: "Pistachio",
    image: require("../../assets/figma/search/0c8e7.png"),
    attributes: ["Oval", "Short", "Gel", "Minimal", "Sage", "Everyday"],
    reviewCount: 24,
    saved: true,
    saves: 5,
    compactCaption: true,
  },
];
const artistImages = [
  require("../../assets/figma/search/artist-avatar-4284.png"),
  require("../../assets/figma/search/artist-avatar-4306.png"),
  require("../../assets/figma/search/artist-avatar-4329.png"),
  require("../../assets/figma/search/artist-avatar-4351.png"),
  require("../../assets/figma/search/artist-avatar-4374.png"),
  require("../../assets/figma/search/artist-avatar-4396.png"),
  require("../../assets/figma/search/artist-avatar-4419.png"),
  require("../../assets/figma/search/artist-avatar-4441.png"),
];
const fixtureArtists: SearchArtist[] = [
  "Kimia Kimia",
  "Valeriia Valeriia",
  "Kimia Kimia",
  "Valeriia Valeriia",
  "Nail Bar Studio",
  "Nail Moxie Lounge",
  "Nails by nuit",
  "Neli Nails",
].map((name, i) => ({
  id: `search-artist-${i}`,
  name,
  username:`${name.toLowerCase().replace(/[^a-z0-9]+/g,".")}.${i}`,
  image: artistImages[i],
  kind: i < 4 ? "NAIL ARTIST" : "SALON",
  location: i === 4 || i === 6 ? "Kyiv" : "Dubai",
  rating: 4.9,
  reviews: 124,
}));
fixtureArtists.push({id:"preview-self",name:"Sarah",username:"sarah.nails",image:artistImages[0],kind:"MEMBER",location:"Dubai"});
function filtered(filters: SearchFilters, query: string) {
  return searchFixtureDesigns.filter((d) => {
    if (!d.title.toLowerCase().includes(query.trim().toLowerCase()))
      return false;
    const text = d.attributes.join(" ").toLowerCase();
    return Object.entries(filters).every(
      ([group, selected]) =>
        !selected.length ||
        selected.some((value) =>
          (group === "vibe"
            ? VIBE_TERMS[value]
            : group === "color"
              ? COLOR_TERMS[value]
              : [value.toLowerCase()]
          ).some((term) => text.includes(term)),
        ),
    );
  });
}
export default function SearchDesignPreview({
  width,
  initialQuery = "",
  initialMode = "Designs",
  onNavigate,
}: {
  width: number;
  initialQuery?: string;
  initialMode?: SearchMode;
  onNavigate?: (name: string) => void;
}) {
  const [source, setSource] = useState<"LaQue" | "Pinterest">("LaQue");
  const pinterest = usePinterestFeed(false, false, true);
  const [input, setInput] = useState(initialQuery),
    [query, setQuery] = useState(initialQuery),
    [mode, setMode] = useState<SearchMode>(initialMode),
    [sort, setSort] = useState<SearchSort>("Newest");
  const [filters, setFilters] = useState<SearchFilters>(emptyFilters),
    [draft, setDraft] = useState<SearchFilters | null>(null),
    [localSaved, setSaved] = useState(["search-pistachio"]);
  const favorites = usePreviewFavorites();
  const saved = favorites
    ? [
        ...favorites.library.savedIds,
        ...favorites.library.profiles.map((p) => p.id),
      ]
    : localSaved;
  const [artistId, setArtistId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = searchFixtureDesigns.find((d) => d.id === detailId);
  const selectedArtist = fixtureArtists.find((a) => a.id === artistId);
  const designs = filtered(filters, query).map((d) => ({
    ...d,
    saved: saved.includes(d.id),
  }));
  if (sort === "Most saved")
    designs.sort((a, b) => (b.saves || 0) - (a.saves || 0));
  const artists = fixtureArtists
    .filter((a) => `${a.name} ${a.username||""}`.toLowerCase().includes(query.replace(/^@/,"").toLowerCase()))
    .map((a) => ({ ...a, saved: saved.includes(a.id) }));
  const toggle = (id: string) => {
    if (favorites) {
      const design = searchFixtureDesigns.find((d) => d.id === id);
      const profile = fixtureArtists.find((p) => p.id === id);
      if (design) favorites.toggleDesign(design);
      else if (profile) favorites.toggleProfile(profile);
    } else
      setSaved((current) =>
        current.includes(id)
          ? current.filter((x) => x !== id)
          : [...current, id],
      );
  };
  if (selectedArtist)
    return (
      <ProfilePreview
        width={width}
        publicProfile
        publicIdentity={{
          id: selectedArtist.id,
          name: selectedArtist.name,
          avatar:
            typeof selectedArtist.image === "string"
              ? { uri: selectedArtist.image }
              : selectedArtist.image,
          location: selectedArtist.location,
          role: selectedArtist.kind === "SALON" ? "salon" : selectedArtist.kind === "MEMBER" ? "user" : "creator",
        }}
        onBack={() => setArtistId(null)}
        onNavigate={onNavigate}
      />
    );
  return (
    <>
      <SearchView
        width={width}
        source={source}
        onSource={setSource}
        pinterest={<PinterestInspiration feed={pinterest} preview />}
        input={input}
        onInput={(text) => {
          setInput(text);
          setQuery(text);
        }}
        onSubmit={() => setQuery(input.trim())}
        mode={mode}
        onMode={setMode}
        sort={sort}
        onSort={setSort}
        filters={filters}
        onApply={setFilters}
        onDraft={setDraft}
        draftTotal={source === "Pinterest" ? 0 : draft ? filtered(draft, query).length : undefined}
        onRetryCount={() => undefined}
        total={
          mode === "Designs" &&
          !query &&
          !Object.values(filters).some((v) => v.length)
            ? 177
            : mode === "Designs"
              ? designs.length
              : artists.length
        }
        designs={designs}
        artists={artists}
        onRetry={() => undefined}
        onDesign={setDetailId}
        onArtist={setArtistId}
        onSave={toggle}
        onSaveArtist={toggle}
        onMore={() => undefined}
      />
      {detail && (
        <DesignDetailPreview
          key={detail.id}
          design={previewDetail(detail)}
          width={width}
          saved={saved.includes(detail.id)}
          onSave={() => toggle(detail.id)}
          from="search"
          onNavigate={onNavigate}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  );
}
