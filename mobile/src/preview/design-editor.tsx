import { useState } from "react";
import { Screen, Button } from "../features/secondary/primitives";
import {
  DesignEditor,
  draftDetail,
  type DesignDraft,
} from "../features/design-detail/editor";
import { DesignDetailPreview } from "./design-detail";
import type { DetailModel } from "../features/design-detail/model";
export function DesignEditorPreview({
  width,
  onClose,
  initial,
  from = "profile",
}: {
  width: number;
  onClose: () => void;
  initial?: Partial<DesignDraft>;
  from?: string;
}) {
  const [detail, setDetail] = useState<DetailModel>();
  const [draft, setDraft] = useState(initial);
  if (detail)
    return (
      <DesignDetailPreview
        design={detail}
        width={width}
        saved={false}
        onSave={() => {}}
        from={from}
        onClose={() => setDetail(undefined)}
        onEdit={() => setDetail(undefined)}
      />
    );
  return (
    <Screen
      title="Your design"
      onBack={onClose}
      subtitle="Local preview · your sample details stay in this session."
    >
      <DesignEditor
        imageLocked={from === "lab"}
        initial={draft}
        onPick={async () => ({
          value: `sample-${Date.now()}`,
          preview: require("../../assets/figma/design-detail/cbf13.png"),
        })}
        onPreview={(d) => {
          setDraft(d);
          setDetail(draftDetail(d));
        }}
        onSave={async (d) => {
          setDraft(d);
          setDetail(draftDetail(d));
        }}
      />
      <Button title="Back to designs" secondary onPress={onClose} />
    </Screen>
  );
}
