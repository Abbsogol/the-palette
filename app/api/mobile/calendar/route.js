import { after } from "next/server";
import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, uuidPattern } from "@/lib/mobile-auth";
import {
  CalendarError,
  checked,
  enabled,
  finalizeConnection,
  saveSources,
  startConnection,
  status,
  syncJobs,
} from "@/lib/calendar/google";
export const maxDuration = 300;
const failure = (e) =>
  mobileJson(
    {
      error:
        e instanceof CalendarError
          ? e.message
          : "Calendar changes could not be completed. Please retry.",
      code: e.code || "CALENDAR_UNAVAILABLE",
    },
    e.status || 503,
  );
export async function GET(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  try {
    return mobileJson(
      await status(
        serviceClient,
        user.id,
        new URL(request.url).searchParams.get("calendars") === "1",
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  try {
    if (!enabled())
      throw new CalendarError(
        "Google Calendar connection is not available yet.",
        "CALENDAR_NOT_CONFIGURED",
      );
    if (body.action === "connect")
      return mobileJson(
        await startConnection(serviceClient, user.id, body.returnUrl),
      );
    if (body.action === "finish" && uuidPattern.test(body.attemptId || "")) {
      await finalizeConnection(serviceClient, user.id, body.attemptId);
      after(() => syncJobs(serviceClient, user.id).catch(() => undefined));
    } else if (body.action === "sources")
      await saveSources(serviceClient, user.id, body.ids);
    else if (body.action === "disconnect")
      await checked(
        serviceClient.rpc("disconnect_google_calendar", { p_user_id: user.id }),
      );
    else if (body.action === "sync") {
      // Retry only this account's jobs, including a previously failed provider call.
      await checked(
        serviceClient
          .from("google_calendar_jobs")
          .update({ retry_at: new Date().toISOString() })
          .eq("user_id", user.id),
      );
      await syncJobs(serviceClient, user.id);
    } else return mobileJson({ error: "Invalid calendar action" }, 400);
    return mobileJson(await status(serviceClient, user.id));
  } catch (e) {
    return failure(e);
  }
}
