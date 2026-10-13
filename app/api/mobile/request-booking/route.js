import { CalendarError, checkBooking, enabled } from "@/lib/calendar/google";
import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  if (
    !["id", "creatorId", "serviceId"].every((key) =>
      uuidPattern.test(body[key] || ""),
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date || "") ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(body.start || "") ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(body.end || "") ||
    typeof body.timeZone !== "string" ||
    !Number.isFinite(body.price) ||
    !Number.isFinite(body.deposit) ||
    typeof body.location !== "string" ||
    (body.designId && !uuidPattern.test(body.designId))
  )
    return mobileJson({ error: "Invalid booking request" }, 400);
  const values = {
    id: body.id,
    client_id: user.id,
    creator_id: body.creatorId,
    service_id: body.serviceId,
    booking_date: body.date,
    start_time: body.start,
    end_time: body.end,
    time_zone: body.timeZone,
    price_snapshot: body.price,
    deposit_snapshot: body.deposit,
    location_snapshot: body.location,
    status: "pending",
    notes:
      typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : null,
    reference_design_id: body.designId || null,
  };
  const client = mobileUserClient(request);
  if (enabled()) {
    // Resolve retries before availability: the original pending booking now occupies its slot.
    const { data: existing, error: lookupError } = await client
      .from("bookings")
      .select("*")
      .eq("id", body.id)
      .eq("client_id", user.id)
      .maybeSingle();
    if (lookupError)
      return mobileJson(
        {
          error: "Booking status could not be checked. Retry the same request.",
        },
        503,
      );
    if (existing) {
      if (
        existing.creator_id === body.creatorId &&
        existing.service_id === body.serviceId &&
        existing.booking_date === body.date &&
        existing.start_time.slice(0, 5) === body.start.slice(0, 5) &&
        existing.time_zone === body.timeZone
      )
        return mobileJson({ booking: existing });
      return mobileJson(
        { error: "This request ID belongs to another appointment." },
        409,
      );
    }
    const { data: slots, error: slotsError } = await client.rpc(
      "booking_available_slots",
      {
        p_creator_id: body.creatorId,
        p_service_id: body.serviceId,
        p_date: body.date,
      },
    );
    const slot = slots?.find(
      (s) =>
        s.available &&
        s.start_time.slice(0, 5) === body.start.slice(0, 5) &&
        s.end_time.slice(0, 5) === body.end.slice(0, 5),
    );
    if (slotsError || !slot)
      return mobileJson(
        {
          error:
            "This appointment time is no longer available. Choose another time.",
        },
        409,
      );
    try {
      await checkBooking(
        serviceClient,
        { ...values, starts_at: slot.starts_at, ends_at: slot.ends_at },
        "request",
        body.allowCalendarConflict === true,
      );
    } catch (e) {
      return mobileJson(
        {
          error:
            e instanceof CalendarError
              ? e.message
              : "Calendars could not be checked. Please retry.",
          code: e.code || "CALENDAR_UNAVAILABLE",
        },
        e.status || 503,
      );
    }
  }
  const { data, error } = await client
    .from("bookings")
    .insert(values)
    .select("*")
    .single();
  if (error?.code === "23505") {
    const { data: existing } = await client
      .from("bookings")
      .select("*")
      .eq("id", body.id)
      .eq("client_id", user.id)
      .single();
    if (
      existing &&
      existing.creator_id === values.creator_id &&
      existing.service_id === values.service_id &&
      existing.booking_date === values.booking_date &&
      existing.start_time.slice(0, 5) === values.start_time.slice(0, 5) &&
      existing.time_zone === values.time_zone
    )
      return mobileJson({ booking: existing });
  }
  if (error || !data)
    return mobileJson(
      {
        error:
          "The selected appointment or service terms changed. Refresh availability and review again.",
      },
      409,
    );
  return mobileJson({ booking: data });
}
