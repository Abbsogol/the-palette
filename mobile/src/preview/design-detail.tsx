import { ShareDesignPreview } from "./share-design";
// Figma-only example data. Never queried from or saved to the real catalog.
import { useState } from "react";
import { Modal, Share, View } from "react-native";
import { DetailView } from "../features/design-detail/detail-view";
import type { DetailModel } from "../features/design-detail/model";
import type { HomeDesign } from "../features/home/home-main-view";
import type { SearchDesign } from "../features/search/search-view";

const closeups = [
  {
    id: "ivory",
    source: require("../../assets/figma/design-detail/83e42.png"),
    thumbnail: require("../../assets/figma/design-detail/layer-6118.png"),
  },
  {
    id: "arch",
    source: require("../../assets/figma/design-detail/4cf54.png"),
    thumbnail: require("../../assets/figma/design-detail/layer-6120.png"),
  },
  {
    id: "cross",
    source: require("../../assets/figma/design-detail/cfecb.png"),
    thumbnailCrop: "cathedral-cross" as const,
  },
];
export const cathedralDetail: DetailModel = {
  id: "search-cathedral",
  title: "Cathedral",
  description:
    "Glossy ivory stiletto nails with 3D gothic arches, cross motifs, and sacred star accents. Clean, elegant, and architectural.",
  photos: [
    { id: "set", source: require("../../assets/figma/search/81f07.png") },
    {
      id: "hero",
      source: require("../../assets/figma/design-detail/cbf13.png"),
    },
    closeups[1],
  ],
  initialPhoto: 1,
  closeups,
  saves: 5,
  reviewCount: 24,
  techniques: [
    "Stiletto",
    "Long",
    "Gel",
    "3D Gel",
    "Gothic",
    "Ivory",
    "Editorial",
  ],
  colours: [
    {
      id: "ivory",
      name: "Cathedral Ivory",
      code: "#D8D4CC",
      hex: "#D8D4CC",
      image: require("../../assets/figma/design-detail/layer-6128.png"),
    },
  ],
  tags: [
    "gothic",
    "ivory",
    "editorial",
    "stiletto",
    "long",
    "gel",
    "3D Gel",
    "white",
    "aesthetic",
    "architectural",
  ],
};
export function previewDetail(design: HomeDesign | SearchDesign): DetailModel {
  if (design.id === "search-cathedral") return cathedralDetail;
  return {
    id: design.id,
    title: design.title,
    description: "",
    saves: design.saves || 0,
    photos: design.image ? [{ id: design.id, source: design.image }] : [],
    closeups: [],
    techniques:
      "attributes" in design
        ? design.attributes
        : [design.shape, design.category].filter((s): s is string => !!s),
    colours: [],
    tags: [],
    reviewCount: "reviewCount" in design ? design.reviewCount : undefined,
  };
}
export function DesignDetailPreview({
  design,
  saved,
  onSave,
  width,
  onClose,
  from,
  onNavigate,
  onEdit,
}: {
  design: DetailModel;
  saved: boolean;
  onSave: () => void;
  width: number;
  onClose: () => void;
  from: string;
  onNavigate?: (name: string) => void;
  onEdit?:()=>void;
}) {
  const [error, setError] = useState("");
  const [sharing, setSharing] = useState(false);
  return (
    <Modal
      testID="design-detail-preview"
      visible
      animationType="slide"
      onRequestClose={() => (sharing ? setSharing(false) : onClose())}
    >
      <View
        style={{ flex: 1, alignItems: "center", backgroundColor: "#21090f" }}
      >
        <View style={{ flex: 1, width }}>
          {sharing ? (
            <ShareDesignPreview
              width={width}
              design={{
                id: design.id,
                title: design.title,
                metadata: design.techniques.join(" · "),
                image: design.photos[0]?.source,
              }}
              onBack={() => setSharing(false)}
            />
          ) : (
            <DetailView
              design={design}
              actions={onEdit?[{label:"Edit design details",onPress:onEdit}]:undefined}
              width={width}
              saved={saved}
              onSave={onSave}
              onBack={onClose}
              onRetry={() => undefined}
              selectedTab={from}
              onNavigate={(name) => {
                onClose();
                onNavigate?.(name);
              }}
              actionError={error}
              onShare={() => {
                void Share.share({
                  message: `${design.title} · LaQue design preview`,
                }).catch(() => setError("Sharing is unavailable."));
              }}
              onShowTech={() => setSharing(true)}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
