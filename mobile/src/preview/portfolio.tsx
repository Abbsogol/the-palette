import { useState } from "react";
import { Modal } from "react-native";
import { Screen } from "../features/secondary/primitives";
import { useDraftExit } from "../features/secondary/profile-exit";
import {
  PortfolioManager,
  type PortfolioFilter,
} from "../features/portfolio/manager";
import {
  DesignEditor,
  draftDetail,
  type DesignDraft,
} from "../features/design-detail/editor";
import { DesignDetailPreview } from "./design-detail";
type Record = { id: string; draft: DesignDraft; published: boolean };
const sample: DesignDraft = {
  title: "Cathedral",
  description: "Glossy ivory arches with sculpted gel details.",
  shape: "Stiletto",
  length: "Long",
  category: "Glam",
  technique: "Gel, 3D gel",
  occasion: "Editorial",
  tags: "#ivory #gothic",
  colours: [],
  photos: [
    {
      value: "sample-cathedral",
      preview: require("../../assets/figma/design-detail/cbf13.png"),
    },
  ],
};
export function PortfolioPreview({
  width,
  onClose,
  startNew = false,
}: {
  width: number;
  onClose: () => void;
  startNew?: boolean;
}) {
  const [records, setRecords] = useState<Record[]>([
    { id: "sample-published", draft: sample, published: true },
    {
      id: "sample-draft",
      draft: { ...sample, title: "Ivory study" },
      published: false,
    },
  ]);
  const [editing, setEditing] = useState<string | null>(
      startNew ? "new" : null,
    ),
    [filter, setFilter] = useState<PortfolioFilter>("All"),
    [detail, setDetail] = useState<DesignDraft>(),
    [used, setUsed] = useState(2);
  const exit = useDraftExit("Unsaved design changes"),
    record = records.find((r) => r.id === editing);
  return (
    <>
      <Screen
        resetScrollKey={editing || "manager"}
        title={editing ? (record ? "Edit design" : "New design") : "My designs"}
        subtitle="Local preview · sample designs stay in this session."
        onBack={() =>
          exit.requestExit(editing ? () => setEditing(null) : onClose)
        }
      >
        {editing ? (
          <DesignEditor
            key={editing}
            initial={record?.draft}
            initialPublished={record?.published}
            onStatusChange={exit.onStatusChange}
            allowance={{
              used,
              limit: 5,
              remaining: Math.max(0, 5 - used),
              resetsAt: null,
            }}
            onPick={async (stage) => {
              stage?.("uploading");
              return {
                value: `sample-${Date.now()}`,
                preview: require("../../assets/figma/design-detail/cbf13.png"),
              };
            }}
            onSave={async (d, published) => {
              if (!record) setUsed((value) => value + 1);
              setRecords((rows) => [
                ...rows.filter((r) => r.id !== editing),
                { id: editing, draft: d, published },
              ]);
              return d;
            }}
            onPreview={setDetail}
            onOpenSaved={() => {
              const saved = records.find((r) => r.id === editing);
              if (saved) setDetail(saved.draft);
            }}
            onDelete={
              record
                ? async () => {
                    setRecords((rows) => rows.filter((r) => r.id !== editing));
                    setEditing(null);
                  }
                : undefined
            }
          />
        ) : (
          <PortfolioManager
            filter={filter}
            onFilter={setFilter}
            items={records
              .filter(
                (r) =>
                  filter === "All" || r.published === (filter === "Published"),
              )
              .map((r) => ({
                id: r.id,
                title: r.draft.title,
                image: r.draft.photos[0]?.preview || null,
                published: r.published,
                shape: r.draft.shape,
                length: r.draft.length,
                category: r.draft.category,
              }))}
            allowance={{
              used,
              limit: 5,
              remaining: Math.max(0, 5 - used),
              resetsAt: null,
            }}
            onStatusChange={exit.onStatusChange}
            onRetry={() => {}}
            onUpload={() => setEditing(`new-${Date.now()}`)}
            onEdit={setEditing}
            onView={(id) => setDetail(records.find((r) => r.id === id)?.draft)}
            onDelete={async (item) =>
              setRecords((rows) => rows.filter((r) => r.id !== item.id))
            }
          />
        )}
        {exit.dialog}
      </Screen>
      <Modal visible={!!detail} onRequestClose={() => setDetail(undefined)}>
        {detail && (
          <DesignDetailPreview
            design={draftDetail(detail)}
            width={width}
            saved={false}
            onSave={() => {}}
            from="profile"
            onClose={() => setDetail(undefined)}
            onEdit={() => setDetail(undefined)}
          />
        )}
      </Modal>
    </>
  );
}
