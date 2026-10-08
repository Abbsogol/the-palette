import { router, useLocalSearchParams } from "expo-router";
import { RequireAuth } from "../components/ui";
import { useAuth } from "../lib/auth";
import { ReportView } from "../features/safety/report-view";
import { reportTarget, sendReport } from "../features/safety/data";
export default function Report() {
  const { targetType, targetId } = useLocalSearchParams<{
    targetType: string;
    targetId: string;
  }>();
  const { session, epoch } = useAuth();
  const target = reportTarget(targetType, targetId);
  return (
    <RequireAuth>
      <ReportView
        key={`${session?.user.id}:${epoch}:${targetType}:${targetId}`}
        target={target}
        onSubmit={async (reason) => {
          if (!target) throw new Error("Choose a report target.");
          await sendReport(target, reason);
        }}
        onClose={() =>
          router.canGoBack() ? router.back() : router.replace("/")
        }
        onSafety={() => router.push("/privacy")}
      />
    </RequireAuth>
  );
}
