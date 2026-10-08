// Session-only demo state. No sample identities or folders reach Supabase.
import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
} from "react";
import {
  folderName,
  type FavoriteAction,
  type FavoritesLibrary,
} from "../features/favorites/model";
import type {
  SearchArtist,
  SearchDesign,
} from "../features/search/search-view";
export const favoriteSamples: FavoritesLibrary = {
  designs: [
    {
      id: "search-pistachio",
      title: "Pistachio",
      image: require("../../assets/figma/search/0c8e7.png"),
      attributes: ["Oval", "Short", "Minimal"],
    },
    {
      id: "rosewood",
      title: "Rosewood Bride",
      image: require("../../assets/figma/home-main/f24ce.png"),
      attributes: ["French", "Minimal"],
    },
    {
      id: "favorite-ivory",
      title: "Ivory Architecture",
      image: require("../../assets/figma/search/81f07.png"),
      attributes: ["Stiletto", "Gothic"],
    },
    {
      id: "mossy",
      title: "Mossy Oak",
      image: require("../../assets/figma/home-main/008f8.png"),
      attributes: ["Oval", "Nature"],
    },
  ],
  savedIds: ["search-pistachio", "rosewood", "favorite-ivory", "mossy"],
  profiles: [
    {
      id: "search-artist-0",
      name: "Kimia Kimia",
      image: require("../../assets/figma/search/artist-avatar-4284.png"),
      kind: "NAIL ARTIST",
      location: "Dubai",
      rating: 4.9,
      reviews: 124,
    },
    {
      id: "search-artist-4",
      name: "Nail Bar Studio",
      image: require("../../assets/figma/search/artist-avatar-4374.png"),
      kind: "SALON",
      location: "Kyiv",
      rating: 4.9,
      reviews: 124,
    },
  ],
  folders: [
    {
      id: "demo-next-set",
      name: "My next set",
      designIds: ["search-pistachio", "mossy"],
    },
    {
      id: "demo-occasion",
      name: "Special occasions",
      designIds: ["rosewood", "favorite-ivory"],
    },
  ],
};
export function updatePreviewFavorites(
  current: FavoritesLibrary,
  action: FavoriteAction,
): FavoritesLibrary {
  switch (action.kind) {
    case "create":
      return {
        ...current,
        folders: [
          {
            id: action.id,
            name: folderName(action.name),
            designIds:
              current.folders.find((f) => f.id === action.id)?.designIds || [],
          },
          ...current.folders.filter((f) => f.id !== action.id),
        ],
      };
    case "rename":
      return {
        ...current,
        folders: current.folders.map((f) =>
          f.id === action.folderId
            ? { ...f, name: folderName(action.name) }
            : f,
        ),
      };
    case "delete":
      return {
        ...current,
        folders: current.folders.filter((f) => f.id !== action.folderId),
      };
    case "add":
      return {
        ...current,
        folders: current.folders.map((f) =>
          f.id === action.folderId
            ? {
                ...f,
                designIds: [...new Set([...f.designIds, ...action.designIds])],
              }
            : f,
        ),
      };
    case "remove":
      return {
        ...current,
        folders: current.folders.map((f) =>
          f.id === action.folderId
            ? {
                ...f,
                designIds: f.designIds.filter((id) => id !== action.designId),
              }
            : f,
        ),
      };
    case "save-design":
      return {
        ...current,
        savedIds: action.saved
          ? [...new Set([...current.savedIds, action.designId])]
          : current.savedIds.filter((id) => id !== action.designId),
      };
    case "remove-profile":
      return {
        ...current,
        profiles: current.profiles.filter((p) => p.id !== action.profileId),
      };
  }
}
type Store = {
  library: FavoritesLibrary;
  act: (action: FavoriteAction) => Promise<boolean>;
  toggleDesign: (design: SearchDesign) => void;
  toggleProfile: (profile: SearchArtist) => void;
};
const Context = createContext<Store | null>(null);
export function PreviewFavoritesProvider({ children }: PropsWithChildren) {
  const [library, setLibrary] = useState(favoriteSamples);
  const act = async (action: FavoriteAction) => {
    setLibrary((v) => updatePreviewFavorites(v, action));
    return true;
  };
  const toggleDesign = (design: SearchDesign) =>
    setLibrary((v) => ({
      ...v,
      designs: [design, ...v.designs.filter((d) => d.id !== design.id)],
      savedIds: v.savedIds.includes(design.id)
        ? v.savedIds.filter((id) => id !== design.id)
        : [design.id, ...v.savedIds],
    }));
  const toggleProfile = (profile: SearchArtist) =>
    setLibrary((v) => ({
      ...v,
      profiles: v.profiles.some((p) => p.id === profile.id)
        ? v.profiles.filter((p) => p.id !== profile.id)
        : [profile, ...v.profiles],
    }));
  return (
    <Context.Provider value={{ library, act, toggleDesign, toggleProfile }}>
      {children}
    </Context.Provider>
  );
}
export const usePreviewFavorites = () => useContext(Context);
