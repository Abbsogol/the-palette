import type { SearchArtist, SearchDesign } from "../search/search-view";
export type FavoriteFolder = { id: string; name: string; designIds: string[] };
export type FavoritesLibrary = {
  designs: SearchDesign[];
  savedIds: string[];
  profiles: SearchArtist[];
  folders: FavoriteFolder[];
};
export type FavoriteAction =
  | { kind: "create"; id: string; name: string }
  | { kind: "rename"; folderId: string; name: string }
  | { kind: "delete"; folderId: string }
  | { kind: "add"; folderId: string; designIds: string[] }
  | { kind: "remove"; folderId: string; designId: string }
  | { kind: "save-design"; designId: string; saved: boolean }
  | { kind: "remove-profile"; profileId: string };
export const emptyLibrary: FavoritesLibrary = {
  designs: [],
  savedIds: [],
  profiles: [],
  folders: [],
};
export function folderName(name: string) {
  const value = name.trim();
  if (!value) throw new Error("Enter a folder name.");
  if (value.length > 80) throw new Error("Use 80 characters or fewer.");
  return value;
}
