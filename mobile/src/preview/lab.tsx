// Local Figma examples only. This preview never calls generation or billing services.
import { useState } from "react";
import { DesignEditorPreview } from "./design-editor";
import { DesignDetailPreview } from "./design-detail";
import { draftDetail, emptyDesign } from "../features/design-detail/editor";
import { CreditsPreview } from "./credits";
import { Alert } from "react-native";
import { LabView } from "../features/lab-ui/lab-view";
import {
  HistoryView,
  type GenerationCard,
} from "../features/lab-ui/history-view";
import { defaultLabSettings } from "../features/lab-ui/model";
const designs: GenerationCard[] = [
  {
    id: "sample-1",
    title: "Glam + Minimal + Moody",
    shape: "Square",
    length: "Long",
    date: "Jun 15",
    image: require("../../assets/figma/lab/3f4a6.png"),
  },
  {
    id: "sample-2",
    title: "Glam",
    shape: "Square",
    length: "Long",
    date: "Jun 15",
    image: require("../../assets/figma/lab/b88ae.png"),
  },
  {
    id: "sample-3",
    title: "Glam",
    shape: "Square",
    length: "Long",
    date: "Jun 15",
    image: require("../../assets/figma/lab/95407.png"),
  },
];
export default function LabPreview({ width }: { width: number }) {
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<GenerationCard>();
  const [settings, setSettings] = useState(defaultLabSettings);
  const [credits, setCredits] = useState(false);
  const [history, setHistory] = useState(false);
  const [message, setMessage] = useState("");
  const explain = () =>
    Alert.alert(
      "LaQue demo",
      "This preview uses sample designs. AI generation, credits and purchases are available in the connected app.",
    );
  if (editing && detail)
    return (
      <DesignEditorPreview
        width={width}
        from="lab"
        onClose={() => setEditing(false)}
        initial={{
          ...emptyDesign,
          title: detail.title,
          shape: detail.shape,
          length: detail.length,
          photos: detail.image
            ? [{ value: detail.id, preview: detail.image }]
            : [],
        }}
      />
    );
  if (detail)
    return (
      <DesignDetailPreview
        design={draftDetail(
          {
            ...emptyDesign,
            title: detail.title,
            shape: detail.shape,
            length: detail.length,
            photos: detail.image
              ? [{ value: detail.id, preview: detail.image }]
              : [],
          },
          detail.id,
        )}
        onEdit={() => setEditing(true)}
        saved={false}
        onSave={() => setMessage("Sample design saved in this preview.")}
        width={width}
        from="lab"
        onClose={() => setDetail(undefined)}
      />
    );
  return credits ? (
    <CreditsPreview width={width} onBack={() => setCredits(false)} />
  ) : history ? (
    <HistoryView
      width={width}
      designs={designs}
      total={3}
      onBack={() => {
        setHistory(false);
        setMessage("");
      }}
      onMore={() => undefined}
      onRetry={() => undefined}
      onOpen={(id) => setDetail(designs.find((d) => d.id === id))}
      onSave={() =>
        setMessage(
          "This is a Figma sample. Saving and publishing require a real generation in the connected app.",
        )
      }
      actionError={message}
    />
  ) : (
    <LabView
      width={width}
      settings={settings}
      onSettings={setSettings}
      credits={0}
      subscribed={false}
      onHistory={() => setHistory(true)}
      onCredits={() => setCredits(true)}
      onGenerate={explain}
    />
  );
}
