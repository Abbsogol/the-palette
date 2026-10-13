import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
import { CalendarError, checked, filterSlots } from "@/lib/calendar/google";
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const q = new URL(request.url).searchParams,
    creatorId = q.get("creatorId"),
    serviceId = q.get("serviceId"),
    date = q.get("date");
  if (
    !uuidPattern.test(creatorId || "") ||
    !uuidPattern.test(serviceId || "") ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "")
  )
    return mobileJson({ error: "Invalid availability request" }, 400);
  try {
    const client = mobileUserClient(request);
    const creator = await checked(
      client.from("profiles").select("id").eq("id", creatorId).maybeSingle(),
    );
    if (!creator)
      return mobileJson({ error: "This artist is unavailable." }, 404);
    const slots = await checked(
      client.rpc("booking_available_slots", {
        p_creator_id: creatorId,
        p_service_id: serviceId,
        p_date: date,
      }),
    );
    return mobileJson({
      slots: await filterSlots(serviceClient, user.id, creatorId, slots || []),
    });
  } catch (e) {
    return mobileJson(
      {
        error:
          e instanceof CalendarError
            ? e.message
            : "Available times could not be checked. Please retry.",
        code: e.code || "CALENDAR_UNAVAILABLE",
      },
      503,
    );
  }
}
