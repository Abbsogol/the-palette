import { useState } from "react";
import { View } from "react-native";
import type { SearchArtist } from "../features/search/search-view";
import { FavoritesView } from "../features/favorites/favorites-view";
import { usePreviewFavorites } from "./favorites-store";
import ProfilePreview from "./profile-booking";
import { DesignDetailPreview, previewDetail } from "./design-detail";
export default function FavoritesPreview({
  width,
  onNavigate,
}: {
  width: number;
  onNavigate: (name: string) => void;
}) {
  const store = usePreviewFavorites()!;
  const [profile, setProfile] = useState<SearchArtist | null>(null),
    [designId, setDesignId] = useState<string | null>(null);
  const design = store.library.designs.find((d) => d.id === designId);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, display: profile ? "none" : "flex" }}>
        <FavoritesView
          width={width}
          library={store.library}
          onRetry={() => undefined}
          onAction={store.act}
          onDesign={setDesignId}
          onProfile={(id) =>
            setProfile(store.library.profiles.find((p) => p.id === id) || null)
          }
          onDiscover={(tab) =>
            onNavigate(tab === "profiles" ? "search-artists" : "search")
          }
        />
      </View>
      {profile && (
        <ProfilePreview
          width={width}
          publicProfile
          publicIdentity={{
            id: profile.id,
            name: profile.name,
            avatar:
              typeof profile.image === "string"
                ? { uri: profile.image }
                : profile.image,
            location: profile.location,
            role:
              profile.kind === "SALON"
                ? "salon"
                : profile.kind === "MEMBER"
                  ? "user"
                  : "creator",
          }}
          onBack={() => setProfile(null)}
          onNavigate={onNavigate}
        />
      )}

      {design && (
        <DesignDetailPreview
          design={previewDetail(design)}
          saved={store.library.savedIds.includes(design.id)}
          onSave={() => store.toggleDesign(design)}
          width={width}
          onClose={() => setDesignId(null)}
          from="saved"
          onNavigate={onNavigate}
        />
      )}
    </View>
  );
}
