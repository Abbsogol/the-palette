import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { randomUUID } from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  LabButton,
  LabMessage,
  LabSheet,
  LabShell,
} from "../lab-ui/primitives";
import {
  ArtistResult,
  DesignResult,
  type SearchDesign,
} from "../search/search-view";
import { HomeIcon } from "../home/home-primitives";
import { profileAssets } from "../profiles/assets";
import { typography } from "../../theme/typography";
import {
  folderName,
  type FavoriteAction,
  type FavoritesLibrary,
} from "./model";

type Sheet =
  | { kind: "create"; id: string; returnDesign?: string }
  | { kind: "rename" | "delete" | "add"; folderId: string }
  | { kind: "organize"; designId: string }
  | { kind: "unsave"; designId: string };
export type FavoritesViewProps = {
  library: FavoritesLibrary;
  width?: number;
  initialTab?: "designs" | "profiles";
  initialFolderId?: string;
  initialDesignId?: string;
  loading?: boolean;
  refreshing?: boolean;
  error?: string;
  onRetry: () => void;
  onAction: (action: FavoriteAction) => Promise<boolean>;
  onDesign: (id: string) => void;
  onProfile: (id: string) => void;
  onDiscover: (tab: "designs" | "profiles") => void;
  onBack?: () => void;
};
function SmallButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[s.smallButton, disabled && { opacity: 0.4 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
function Thumb({ design }: { design?: SearchDesign }) {
  return (
    <View style={s.thumb}>
      {design?.image ? (
        <Image
          source={design.image}
          cachePolicy="memory"
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <HomeIcon source={profileAssets.folder} size={24} />
      )}
    </View>
  );
}
export function FavoritesView({
  library,
  width: suppliedWidth,
  initialTab = "designs",
  initialFolderId,
  initialDesignId,
  loading,
  refreshing,
  error,
  onRetry,
  onAction,
  onDesign,
  onProfile,
  onDiscover,
  onBack,
}: FavoritesViewProps) {
  const window = useWindowDimensions(),
    insets = useSafeAreaInsets();
  const width =
    suppliedWidth ??
    (Platform.OS === "web" ? Math.min(393, window.width) : window.width);
  const [tab, setTab] = useState(initialTab),
    [folderId, setFolderId] = useState(initialFolderId),
    [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(
      initialDesignId ? { kind: "organize", designId: initialDesignId } : null,
    ),
    [name, setName] = useState(""),
    [selection, setSelection] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [localError, setLocalError] = useState(""),
    [notice, setNotice] = useState("");
  const latch = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const folder = library.folders.find((f) => f.id === folderId);
  const activeIds = folder
    ? folder.designIds
    : folderId
      ? []
      : library.savedIds;
  const available = library.designs.filter((d) => activeIds.includes(d.id));
  const needle = search.trim().toLocaleLowerCase();
  const designs = available.filter((d) =>
    `${d.title} ${d.attributes.join(" ")}`.toLocaleLowerCase().includes(needle),
  );
  const profiles = library.profiles.filter((p) =>
    `${p.name} ${p.location || ""} ${p.kind}`
      .toLocaleLowerCase()
      .includes(needle),
  );
  const open = (value: Sheet) => {
    if (latch.current) return;
    setLocalError("");
    setName(
      value.kind === "rename"
        ? library.folders.find((f) => f.id === value.folderId)?.name || ""
        : "",
    );
    setSelection([]);
    setSheet(value);
  };
  const close = () => {
    if (!latch.current) {
      setSheet(null);
      setLocalError("");
    }
  };
  const run = async (
    action: FavoriteAction,
    message: string,
    after?: () => void,
  ) => {
    if (latch.current) return;
    latch.current = true;
    setBusy(true);
    setLocalError("");
    try {
      const ok = await onAction(action);
      if (!mounted.current) return;
      if (!ok) {
        setLocalError("Could not save your changes. Please try again.");
        return;
      }
      setNotice(message);
      setSheet(null);
      after?.();
    } catch (e) {
      if (mounted.current)
        setLocalError(
          e instanceof Error
            ? e.message
            : "Could not save your changes. Please try again.",
        );
    } finally {
      latch.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const create = () => {
    if (!sheet || !["create", "rename"].includes(sheet.kind)) return;
    try {
      const value = folderName(name);
      if (sheet.kind === "create") {
        const current = sheet;
        void run(
          { kind: "create", id: sheet.id, name: value },
          "Folder created.",
          () => {
            if (current.returnDesign)
              setSheet({ kind: "organize", designId: current.returnDesign });
          },
        );
      } else if (sheet.kind === "rename")
        void run(
          { kind: "rename", folderId: sheet.folderId, name: value },
          "Folder renamed.",
        );
    } catch (e) {
      setLocalError((e as Error).message);
    }
  };
  const sheetFolder =
    sheet && "folderId" in sheet
      ? library.folders.find((f) => f.id === sheet.folderId)
      : undefined;
  const candidates = library.designs.filter(
    (d) =>
      library.savedIds.includes(d.id) && !sheetFolder?.designIds.includes(d.id),
  );
  const sheetTitle = !sheet
    ? ""
    : sheet.kind === "create"
      ? "New folder"
      : sheet.kind === "rename"
        ? "Rename folder"
        : sheet.kind === "delete"
          ? "Delete folder?"
          : sheet.kind === "add"
            ? "Add saved designs"
            : sheet.kind === "unsave"
              ? "Remove saved design?"
              : "Save to a folder";
  const tabs = (
    <View style={s.tabs}>
      {(["designs", "profiles"] as const).map((t) => (
        <Pressable
          key={t}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === t }}
          onPress={() => {
            setTab(t);
            setFolderId(undefined);
            setSearch("");
            setNotice("");
          }}
          style={[s.tab, tab === t && s.activeTab]}
        >
          <Text style={[s.tabText, tab === t && s.activeText]}>
            {t === "designs" ? "Saved Designs" : "Saved Profiles"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const header = (
    <View style={s.listHeader}>
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={s.notice}>
          {notice}
        </Text>
      ) : null}
      {error ? (
        <>
          <LabMessage error>{error}</LabMessage>
          <SmallButton title="Retry loading favorites" onPress={onRetry} />
        </>
      ) : null}
      {localError && !sheet ? (
        <LabMessage error>{localError}</LabMessage>
      ) : null}
      {loading ? (
        <ActivityIndicator
          color="white"
          accessibilityLabel="Loading favorites"
        />
      ) : null}
      {tab === "designs" && !folderId && !loading && (
        <>
          <View style={s.spread}>
            <Text style={s.section}>Your folders</Text>
            <Text style={s.meta}>
              {library.folders.length}{" "}
              {library.folders.length === 1 ? "folder" : "folders"}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.folders}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a folder"
              onPress={() => open({ kind: "create", id: randomUUID() })}
              style={s.newFolder}
            >
              <View style={s.plusCircle}>
                <Text style={s.plus}>+</Text>
              </View>
              <Text style={s.buttonText}>New folder</Text>
              <Text style={s.meta}>Make it yours</Text>
            </Pressable>
            {library.folders.map((f) => {
              const contents = library.designs.filter((d) =>
                f.designIds.includes(d.id),
              );
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open folder ${f.name}`}
                  onPress={() => {
                    setFolderId(f.id);
                    setSearch("");
                    setNotice("");
                  }}
                  style={s.folderCard}
                >
                  <View style={s.folderCover}>
                    {contents.length ? (
                      <>
                        {contents.slice(0, 2).map((d) => (
                          <Thumb key={d.id} design={d} />
                        ))}
                      </>
                    ) : (
                      <HomeIcon source={profileAssets.folder} size={32} />
                    )}
                  </View>
                  <Text numberOfLines={1} style={s.folderTitle}>
                    {f.name}
                  </Text>
                  <Text style={s.meta}>
                    {contents.length}{" "}
                    {contents.length === 1 ? "design" : "designs"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
      {folder && (
        <View style={s.folderActions}>
          <SmallButton
            title="Add designs"
            onPress={() => open({ kind: "add", folderId: folder.id })}
          />
          <SmallButton
            title="Rename"
            onPress={() => open({ kind: "rename", folderId: folder.id })}
          />
          <SmallButton
            title="Delete folder"
            onPress={() => open({ kind: "delete", folderId: folder.id })}
          />
        </View>
      )}
      {folderId && !folder && !loading ? (
        <LabMessage>This folder is no longer available.</LabMessage>
      ) : null}
      {!loading && (
        <View style={s.spread}>
          <Text style={s.section}>
            {tab === "profiles"
              ? "Profiles you love"
              : folder
                ? "In this folder"
                : "All saved designs"}
          </Text>
          <Text style={s.meta}>
            {tab === "profiles" ? profiles.length : designs.length}
          </Text>
        </View>
      )}
      {tab === "designs" && activeIds.length > available.length ? (
        <Text style={s.meta}>
          Some designs are private or no longer available.
        </Text>
      ) : null}
    </View>
  );
  const ids =
    tab === "designs" ? designs.map((d) => d.id) : profiles.map((p) => p.id);
  return (
    <LabShell width={width}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        {(folderId || onBack) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={folderId ? "Back to favorites" : "Back"}
            onPress={() => {
              if (folderId) {
                setFolderId(undefined);
                setSearch("");
                setNotice("");
              } else onBack?.();
            }}
            style={s.back}
          >
            <HomeIcon source={profileAssets.back} size={16} />
            <Text style={s.meta}>{folderId ? "Favorites" : "Back"}</Text>
          </Pressable>
        )}
        <Text accessibilityRole="header" style={s.title}>
          {folder?.name || "Favorites"}
        </Text>
        <Text style={s.subtitle}>
          {folder
            ? "A little collection of your inspiration."
            : "All the inspiration you want to keep."}
        </Text>
        {!folderId && tabs}
        <View style={s.search}>
          <TextInput
            accessibilityLabel={
              tab === "profiles"
                ? "Search saved profiles"
                : "Search saved designs"
            }
            placeholder={
              tab === "profiles"
                ? "Search your saved profiles…"
                : "Search your saved designs…"
            }
            value={search}
            onChangeText={setSearch}
            placeholderTextColor="#efbdc7"
            style={s.input}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        </View>
      </View>
      <FlatList
        key={`${tab}:${folderId || "all"}`}
        data={ids}
        numColumns={2}
        keyExtractor={(id) => id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 140 },
        ]}
        columnWrapperStyle={s.gridRow}
        ListHeaderComponent={header}
        refreshing={!!refreshing}
        onRefresh={onRetry}
        initialNumToRender={8}
        renderItem={({ item: id }) =>
          tab === "profiles" ? (
            <ArtistResult
              artist={{
                ...profiles.find((p) => p.id === id)!,
                saved: true,
                saving: busy,
              }}
              width={(width - 64) / 2}
              onOpen={() => onProfile(id)}
              onSave={() =>
                void run(
                  { kind: "remove-profile", profileId: id },
                  "Profile removed from favorites.",
                )
              }
            />
          ) : (
            <View style={s.designCell}>
              <DesignResult
                design={{
                  ...designs.find((d) => d.id === id)!,
                  saved: library.savedIds.includes(id),
                  saving: busy,
                  compactCaption: true,
                  reviewCount: undefined,
                  saves: undefined,
                }}
                width={width - 48}
                onOpen={() => onDesign(id)}
                onSave={() => {
                  if (library.savedIds.includes(id))
                    open({ kind: "unsave", designId: id });
                  else
                    void run(
                      { kind: "save-design", designId: id, saved: true },
                      "Design saved.",
                    );
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  folder
                    ? `Remove ${designs.find((d) => d.id === id)!.title} from folder`
                    : `Organize ${designs.find((d) => d.id === id)!.title}`
                }
                disabled={busy}
                onPress={() => {
                  if (folder)
                    void run(
                      { kind: "remove", folderId: folder.id, designId: id },
                      "Removed from folder. Your saved design is kept.",
                    );
                  else open({ kind: "organize", designId: id });
                }}
                style={s.organize}
              >
                <HomeIcon source={profileAssets.folder} size={16} />
                <Text style={s.meta}>
                  {folder ? "Remove from folder" : "Organize"}
                </Text>
              </Pressable>
            </View>
          )
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>♡</Text>
              <Text style={s.section}>
                {search
                  ? "No matches found"
                  : tab === "profiles"
                    ? "Your favorites, together"
                    : folder
                      ? "Make room for inspiration"
                      : "Start your inspiration library"}
              </Text>
              <Text style={s.emptyText}>
                {search
                  ? "Try a different name or clear your search."
                  : tab === "profiles"
                    ? "Tap the heart on a profile to keep artists, salons and people you love here."
                    : folder
                      ? "Add designs you have saved to this folder."
                      : "Tap the heart on a design to save it, then organize your favorites into folders."}
              </Text>
              {!search && (
                <LabButton
                  title={
                    folder
                      ? "Add saved designs"
                      : tab === "profiles"
                        ? "Discover profiles"
                        : "Discover designs"
                  }
                  onPress={() =>
                    folder
                      ? open({ kind: "add", folderId: folder.id })
                      : onDiscover(tab)
                  }
                />
              )}
            </View>
          ) : null
        }
      />
      <LabSheet visible={!!sheet} title={sheetTitle} onClose={close}>
        {localError && <LabMessage error>{localError}</LabMessage>}
        {(sheet?.kind === "create" || sheet?.kind === "rename") && (
          <>
            <Text style={s.subtitle}>A name for your next obsession.</Text>
            <TextInput
              accessibilityLabel="Folder name"
              autoFocus
              value={name}
              onChangeText={setName}
              maxLength={80}
              placeholder="e.g. My next set"
              placeholderTextColor="#bd939e"
              style={s.field}
              editable={!busy}
              onSubmitEditing={create}
            />
            <Text style={s.meta}>{name.length}/80</Text>
            <LabButton
              title={sheet.kind === "create" ? "Create folder" : "Save name"}
              onPress={create}
              busy={busy}
            />
          </>
        )}
        {sheet?.kind === "delete" && (
          <>
            <Text style={s.body}>
              Delete “{sheetFolder?.name}”? The folder will be removed. Your
              saved designs will stay in Saved Designs.
            </Text>
            <LabButton
              title="Delete folder permanently"
              busy={busy}
              onPress={() =>
                void run(
                  { kind: "delete", folderId: sheet.folderId },
                  "Folder deleted. Saved designs kept.",
                  () => setFolderId(undefined),
                )
              }
            />
            <LabButton
              secondary
              title="Keep folder"
              disabled={busy}
              onPress={close}
            />
          </>
        )}
        {sheet?.kind === "unsave" && (
          <>
            <Text style={s.body}>
              Remove this design from Saved Designs? Any copies in your folders
              will stay there.
            </Text>
            <LabButton
              title="Remove saved design"
              busy={busy}
              onPress={() =>
                void run(
                  {
                    kind: "save-design",
                    designId: sheet.designId,
                    saved: false,
                  },
                  "Design removed from Saved Designs.",
                )
              }
            />
            <LabButton
              secondary
              title="Keep design"
              disabled={busy}
              onPress={close}
            />
          </>
        )}
        {sheet?.kind === "organize" && (
          <>
            <Text style={s.subtitle}>Choose a folder for this design.</Text>
            {library.folders.map((f) => {
              const added = f.designIds.includes(sheet.designId);
              return (
                <Pressable
                  key={f.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Add to ${f.name}`}
                  disabled={busy || added}
                  onPress={() =>
                    void run(
                      {
                        kind: "add",
                        folderId: f.id,
                        designIds: [sheet.designId],
                      },
                      `Added to ${f.name}.`,
                    )
                  }
                  style={s.folderChoice}
                >
                  <HomeIcon source={profileAssets.folder} size={20} />
                  <Text style={[s.body, { flex: 1 }]}>{f.name}</Text>
                  <Text style={s.meta}>{added ? "Added ✓" : "+"}</Text>
                </Pressable>
              );
            })}
            <LabButton
              title="Create new folder"
              disabled={busy}
              onPress={() =>
                open({
                  kind: "create",
                  id: randomUUID(),
                  returnDesign: sheet.designId,
                })
              }
            />
          </>
        )}
        {sheet?.kind === "add" && (
          <>
            {candidates.length ? (
              <>
                <Text style={s.subtitle}>
                  Choose designs to add to “{sheetFolder?.name}”.
                </Text>
                {candidates.map((d) => (
                  <Pressable
                    key={d.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={d.title}
                    accessibilityState={{
                      checked: selection.includes(d.id),
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() =>
                      setSelection((current) =>
                        current.includes(d.id)
                          ? current.filter((id) => id !== d.id)
                          : [...current, d.id],
                      )
                    }
                    style={s.picker}
                  >
                    <View style={s.pickerThumb}>
                      <Thumb design={d} />
                    </View>
                    <Text style={[s.body, { flex: 1 }]}>{d.title}</Text>
                    <View
                      style={[
                        s.checkbox,
                        selection.includes(d.id) && s.checked,
                      ]}
                    >
                      <Text style={s.body}>
                        {selection.includes(d.id) ? "✓" : ""}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                <LabButton
                  title={`Add ${selection.length} ${selection.length === 1 ? "design" : "designs"}`}
                  disabled={!selection.length}
                  busy={busy}
                  onPress={() =>
                    void run(
                      {
                        kind: "add",
                        folderId: sheet.folderId,
                        designIds: selection,
                      },
                      "Designs added to folder.",
                    )
                  }
                />
              </>
            ) : (
              <>
                <Text style={s.body}>
                  All your available saved designs are already here, or you
                  haven’t saved any yet.
                </Text>
                <LabButton
                  title="Discover more designs"
                  onPress={() => {
                    close();
                    onDiscover("designs");
                  }}
                />
              </>
            )}
          </>
        )}
      </LabSheet>
    </LabShell>
  );
}
const s = StyleSheet.create({
  header: { paddingHorizontal: 24, gap: 8, paddingBottom: 14 },
  title: { ...typography.heading, color: "white" },
  subtitle: { ...typography.caption, color: "#efc8d0" },
  body: { ...typography.body, color: "white" },
  section: { ...typography.section, color: "white" },
  meta: {
    ...typography.caption,
    fontSize: 12,
    lineHeight: 18,
    color: "#e9bdc8",
  },
  buttonText: { ...typography.button, fontSize: 13, color: "white" },
  tabs: { flexDirection: "row", marginTop: 8 },
  tab: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,.16)",
  },
  activeTab: { borderColor: "#ffa4be", borderBottomWidth: 2 },
  tabText: { ...typography.caption, color: "#d4a6b0" },
  activeText: { color: "white" },
  search: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.2)",
    backgroundColor: "rgba(70,9,28,.15)",
    marginTop: 10,
  },
  input: {
    ...typography.caption,
    color: "white",
    paddingHorizontal: 18,
    paddingVertical: 12,
    minHeight: 46,
  },
  content: { paddingHorizontal: 24 },
  gridRow: { gap: 16, marginBottom: 22 },
  designCell: { width: "47.68%", gap: 6 },
  listHeader: { gap: 16, marginBottom: 18 },
  spread: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  folders: { gap: 12, paddingBottom: 4 },
  newFolder: {
    width: 132,
    height: 166,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,210,222,.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,.04)",
  },
  plusCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,175,200,.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  plus: { color: "white", fontSize: 27, fontWeight: "200" },
  folderCard: { width: 144, gap: 4 },
  folderCover: {
    height: 114,
    flexDirection: "row",
    gap: 2,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  folderTitle: { ...typography.button, color: "white", marginTop: 3 },
  organize: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  smallButton: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.24)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: "center",
  },
  folderActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  back: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
  },
  notice: { ...typography.caption, color: "#ffe2ea" },
  empty: { paddingVertical: 28, gap: 14 },
  emptyIcon: { color: "#ffd4e1", fontSize: 44 },
  emptyText: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 22,
    color: "#e9bdc8",
  },
  field: {
    ...typography.body,
    color: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,.25)",
    padding: 14,
    minHeight: 50,
  },
  folderChoice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 58,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,.06)",
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 6,
  },
  pickerThumb: { height: 64, width: 48, borderRadius: 10, overflow: "hidden" },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e8a9bd",
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: "#bf385e" },
});
