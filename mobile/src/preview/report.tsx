import { ReportView } from "../features/safety/report-view";
export function ReportPreview({ onClose }: { onClose: () => void }) {
  return (
    <ReportView
      preview
      target={{ type: "profile", id: "00000000-0000-4000-8000-000000000001" }}
      onClose={onClose}
      onSubmit={async () => undefined}
    />
  );
}
