import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const scopes = [
  "https://www.googleapis.com/auth/calendar.events.freebusy",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
];
export class CalendarError extends Error {
  constructor(message, code = "CALENDAR_UNAVAILABLE", status = 503) {
    super(message);
    this.code = code;
    this.status = status;
  }
}
export const enabled = () => process.env.GOOGLE_CALENDAR_ENABLED === "true";
export function config() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;
  const key = Buffer.from(
    process.env.GOOGLE_CALENDAR_TOKEN_KEY || "",
    "base64",
  );
  if (
    !enabled() ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    key.length !== 32
  )
    throw new CalendarError(
      "Google Calendar connection is not available yet. Please try again later.",
      "CALENDAR_NOT_CONFIGURED",
    );
  const url = new URL(redirectUri);
  if (
    (url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)) ||
    url.pathname !== "/api/calendar/google/callback"
  )
    throw new CalendarError(
      "Google Calendar connection is not configured correctly.",
    );
  return { clientId, clientSecret, redirectUri, key };
}
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export function seal(value, userId) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", config().key, iv);
  cipher.setAAD(Buffer.from(userId));
  return Buffer.concat([
    iv,
    cipher.update(JSON.stringify(value)),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");
}
export function unseal(value, userId) {
  const bytes = Buffer.from(value, "base64");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    config().key,
    bytes.subarray(0, 12),
  );
  cipher.setAAD(Buffer.from(userId));
  cipher.setAuthTag(bytes.subarray(-16));
  return JSON.parse(
    Buffer.concat([
      cipher.update(bytes.subarray(12, -16)),
      cipher.final(),
    ]).toString(),
  );
}
export async function checked(result) {
  const { data, error } = await result;
  if (error)
    throw new CalendarError(
      "Calendar changes could not be saved. Please retry.",
    );
  return data;
}
export function permittedReturn(value) {
  const allowed = (process.env.GOOGLE_CALENDAR_RETURN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (typeof value !== "string" || !allowed.includes(value))
    throw new CalendarError(
      "This app cannot receive a calendar connection yet.",
      "CALENDAR_RETURN_NOT_CONFIGURED",
      400,
    );
  const url = new URL(value);
  if (
    !["https:", "laque:", "laque-dev:"].includes(url.protocol) &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new CalendarError(
      "Invalid calendar return address.",
      "INVALID_RETURN",
      400,
    );
  if (url.search || url.hash || url.username || url.password)
    throw new CalendarError(
      "Invalid calendar return address.",
      "INVALID_RETURN",
      400,
    );
  return url.href;
}
export async function startConnection(db, userId, returnUrl) {
  const c = config(),
    destination = permittedReturn(returnUrl),
    state = randomBytes(32).toString("base64url");
  await checked(
    db.from("google_calendar_oauth").delete().eq("user_id", userId),
  );
  const row = await checked(
    db
      .from("google_calendar_oauth")
      .insert({
        user_id: userId,
        state_hash: hash(state),
        return_url: destination,
      })
      .select("id")
      .single(),
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent select_account",
    state,
  }).toString();
  return { url: url.href, attemptId: row.id };
}
async function tokenRequest(body, send) {
  const c = config();
  let response;
  try {
    response = await send("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        ...body,
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new CalendarError(
      "Google Calendar could not be reached. Please retry.",
    );
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token)
    throw new CalendarError(
      payload.error === "invalid_grant"
        ? "Reconnect Google Calendar to check your schedule."
        : "Google Calendar could not be reached. Please retry.",
      payload.error === "invalid_grant"
        ? "CALENDAR_RECONNECT"
        : "CALENDAR_UNAVAILABLE",
    );
  return payload;
}
export async function receiveCallback(db, params, send = fetch) {
  const state = params.get("state");
  if (!state || state.length > 200)
    throw new CalendarError(
      "This calendar link has expired. Start again in LaQue.",
      "CALENDAR_AUTH_EXPIRED",
      400,
    );
  const attempt = await checked(
    db.rpc("claim_google_calendar_oauth", { p_hash: hash(state) }),
  );
  if (!attempt?.id)
    throw new CalendarError(
      "This calendar link has expired or was already used. Start again in LaQue.",
      "CALENDAR_AUTH_EXPIRED",
      400,
    );
  const destination = new URL(permittedReturn(attempt.return_url));
  destination.searchParams.set("attempt", attempt.id);
  let errorCode = null;
  try {
    if (params.get("error") || !params.get("code"))
      throw new CalendarError(
        "Calendar connection was cancelled.",
        "CALENDAR_DENIED",
        400,
      );
    const grant = await tokenRequest(
      {
        grant_type: "authorization_code",
        code: params.get("code"),
        redirect_uri: config().redirectUri,
      },
      send,
    );
    if (
      !grant.refresh_token ||
      !scopes.every((scope) => (grant.scope || "").split(" ").includes(scope))
    )
      throw new CalendarError(
        "Allow all requested calendar permissions to enable schedule checks.",
        "CALENDAR_PERMISSIONS",
        400,
      );
    await checked(
      db
        .from("google_calendar_oauth")
        .update({
          grant_encrypted: seal(
            { refreshToken: grant.refresh_token },
            attempt.user_id,
          ),
        })
        .eq("id", attempt.id),
    );
  } catch (e) {
    errorCode = e instanceof CalendarError ? e.code : "CALENDAR_UNAVAILABLE";
    await checked(
      db
        .from("google_calendar_oauth")
        .update({ error_code: errorCode })
        .eq("id", attempt.id),
    );
  }
  destination.searchParams.set("calendar", errorCode ? "failed" : "authorized");
  return destination.href;
}
export async function connection(db, userId) {
  return checked(
    db
      .from("google_calendar_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  );
}
async function access(db, c, send) {
  if (c.status !== "connected")
    throw new CalendarError(
      "Reconnect Google Calendar to check your schedule.",
      "CALENDAR_RECONNECT",
    );
  try {
    return (
      await tokenRequest(
        {
          grant_type: "refresh_token",
          refresh_token: unseal(c.refresh_token_encrypted, c.user_id)
            .refreshToken,
        },
        send,
      )
    ).access_token;
  } catch (e) {
    if (e.code === "CALENDAR_RECONNECT")
      await checked(
        db
          .from("google_calendar_connections")
          .update({ status: "reconnect_required" })
          .eq("id", c.id),
      );
    throw e;
  }
}
export async function googleRequest(
  token,
  path,
  { method = "GET", body, allowed = [] } = {},
  send = fetch,
) {
  let response;
  try {
    response = await send(`https://www.googleapis.com/calendar/v3${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new CalendarError(
      "Google Calendar could not be reached. Please retry.",
    );
  }
  if (!response.ok && !allowed.includes(response.status))
    throw new CalendarError(
      "Google Calendar could not be checked or updated. Reconnect if this continues.",
      response.status === 401 ? "CALENDAR_RECONNECT" : "CALENDAR_UNAVAILABLE",
    );
  return {
    status: response.status,
    data:
      response.status === 204 ? null : await response.json().catch(() => null),
  };
}
export async function listCalendars(token, send = fetch) {
  let pageToken,
    records = [];
  do {
    const query = new URLSearchParams({
      maxResults: "250",
      minAccessRole: "freeBusyReader",
    });
    if (pageToken) query.set("pageToken", pageToken);
    const { data } = await googleRequest(
      token,
      `/users/me/calendarList?${query}`,
      {},
      send,
    );
    if (!Array.isArray(data?.items))
      throw new CalendarError("Your calendar list could not be loaded.");
    records.push(...data.items);
    pageToken = data.nextPageToken;
    if (records.length > 1000)
      throw new CalendarError("Too many calendars to load. Contact support.");
  } while (pageToken);
  return records
    .filter((c) => !c.deleted)
    .map((c) => ({
      id: c.id,
      name: c.summary || "Calendar",
      primary: !!c.primary,
    }));
}
export async function finalizeConnection(db, userId, attemptId, send = fetch) {
  const attempt = await checked(
    db
      .from("google_calendar_oauth")
      .select("*")
      .eq("id", attemptId)
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle(),
  );
  if (
    !attempt &&
    (await connection(db, userId))?.last_oauth_attempt === attemptId
  )
    return;
  if (!attempt?.grant_encrypted || attempt.error_code)
    throw new CalendarError(
      "Google Calendar was not connected. Try again and allow calendar access.",
      "CALENDAR_AUTH_EXPIRED",
      400,
    );
  const grant = unseal(attempt.grant_encrypted, userId),
    token = (
      await tokenRequest(
        { grant_type: "refresh_token", refresh_token: grant.refreshToken },
        send,
      )
    ).access_token;
  const calendars = await listCalendars(token, send),
    primary = calendars.find((c) => c.primary);
  if (!primary)
    throw new CalendarError("A primary Google calendar is required.");
  const old = await connection(db, userId);
  if (old && old.account_label !== primary.id)
    throw new CalendarError(
      "Disconnect the current calendar before choosing another Google account.",
      "CALENDAR_ACCOUNT_CHANGED",
      409,
    );
  let calendarId = old?.calendar_id || attempt.calendar_id;
  if (!calendarId) {
    const { data } = await googleRequest(
      token,
      "/calendars",
      {
        method: "POST",
        body: {
          summary: "LaQue appointments",
          description:
            "Confirmed LaQue bookings. Manage or cancel appointments in LaQue.",
        },
      },
      send,
    );
    if (!data?.id)
      throw new CalendarError("The LaQue calendar could not be created.");
    calendarId = data.id;
    await checked(
      db
        .from("google_calendar_oauth")
        .update({ calendar_id: calendarId })
        .eq("id", attempt.id),
    );
  }
  await checked(
    db.rpc("finish_google_calendar_connection", {
      p_user_id: userId,
      p_attempt: attemptId,
      p_account: primary.id,
      p_token: seal(grant, userId),
      p_calendar: calendarId,
      p_sources: old?.source_calendars || [
        { id: primary.id, name: primary.name },
      ],
    }),
  );
}
export async function status(db, userId, withCalendars = false, send = fetch) {
  try {
    config();
  } catch {
    return {
      configured: false,
      status: "disconnected",
      calendars: [],
      sources: [],
      pending: 0,
    };
  }
  const c = await connection(db, userId);
  if (!c)
    return {
      configured: true,
      status: "disconnected",
      calendars: [],
      sources: [],
      pending: 0,
    };
  const sync = await checked(
    db.rpc("google_calendar_sync_status", { p_user_id: userId }),
  );
  let calendars = [],
    calendarError;
  if (withCalendars && c.status === "connected") {
    try {
      calendars = (await listCalendars(await access(db, c, send), send)).filter(
        (v) => v.id !== c.calendar_id,
      );
    } catch (e) {
      calendarError =
        "Your calendar list could not be loaded. Retry or reconnect Google Calendar.";
      if (e.code === "CALENDAR_RECONNECT") c.status = "reconnect_required";
    }
  }
  return {
    configured: true,
    status: c.status,
    accountLabel: c.account_label,
    sources: c.source_calendars,
    calendars,
    calendarError,
    lastCheckedAt: c.last_checked_at,
    pending: sync.pending,
    syncFailed: sync.syncFailed,
  };
}
export async function saveSources(db, userId, ids, send = fetch) {
  if (
    !Array.isArray(ids) ||
    !ids.length ||
    ids.length > 10 ||
    ids.some((id) => typeof id !== "string") ||
    new Set(ids).size !== ids.length
  )
    throw new CalendarError(
      "Choose between one and ten calendars.",
      "INVALID_CALENDARS",
      400,
    );
  const c = await connection(db, userId);
  if (!c)
    throw new CalendarError(
      "Connect Google Calendar first.",
      "CALENDAR_DISCONNECTED",
      409,
    );
  const calendars = await listCalendars(await access(db, c, send), send);
  if (
    ids.some(
      (id) => id === c.calendar_id || !calendars.some((v) => v.id === id),
    )
  )
    throw new CalendarError(
      "Choose calendars from your connected account.",
      "INVALID_CALENDARS",
      400,
    );
  await checked(
    db
      .from("google_calendar_connections")
      .update({
        source_calendars: calendars.filter((v) => ids.includes(v.id)),
        revision: c.revision + 1,
      })
      .eq("id", c.id)
      .eq("revision", c.revision)
      .select("id")
      .single(),
  );
}
export const overlaps = (a, b) =>
  Date.parse(a.start) < Date.parse(b.end) &&
  Date.parse(b.start) < Date.parse(a.end);
export async function freeBusy(db, c, start, end, send = fetch) {
  const sources = c.source_calendars;
  if (!Array.isArray(sources) || !sources.length || sources.length > 10)
    throw new CalendarError("Choose calendars to check before booking.");
  const token = await access(db, c, send);
  const { data } = await googleRequest(
    token,
    "/freeBusy",
    {
      method: "POST",
      body: {
        timeMin: start,
        timeMax: end,
        items: sources.map((s) => ({ id: s.id })),
        calendarExpansionMax: 10,
      },
    },
    send,
  );
  const busy = [];
  for (const source of sources) {
    const calendar = data?.calendars?.[source.id];
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy))
      throw new CalendarError(
        "A connected calendar could not be checked. Retry or reconnect it.",
      );
    for (const slot of calendar.busy) {
      if (
        !Number.isFinite(Date.parse(slot.start)) ||
        !Number.isFinite(Date.parse(slot.end)) ||
        Date.parse(slot.start) >= Date.parse(slot.end)
      )
        throw new CalendarError(
          "Google returned an invalid calendar interval. Please retry.",
        );
      busy.push({ start: slot.start, end: slot.end });
    }
  }
  await checked(
    db
      .from("google_calendar_connections")
      .update({ last_checked_at: new Date().toISOString() })
      .eq("id", c.id),
  );
  return busy;
}
export async function filterSlots(db, userId, creatorId, slots, send = fetch) {
  if (!enabled() || !slots.length) return slots;
  const start = slots.reduce(
      (v, s) => (Date.parse(s.starts_at) < Date.parse(v) ? s.starts_at : v),
      slots[0].starts_at,
    ),
    end = slots.reduce(
      (v, s) => (Date.parse(s.ends_at) > Date.parse(v) ? s.ends_at : v),
      slots[0].ends_at,
    );
  const [creator, client] = await Promise.all([
    connection(db, creatorId),
    connection(db, userId),
  ]);
  const creatorBusy = creator
    ? await freeBusy(db, creator, start, end, send)
    : [];
  let clientBusy = [],
    clientState = client ? "checked" : "disconnected";
  if (client) {
    try {
      clientBusy = await freeBusy(db, client, start, end, send);
    } catch {
      clientState = "unavailable";
    }
  }
  return slots.map((s) => ({
    ...s,
    available:
      s.available &&
      !creatorBusy.some((b) =>
        overlaps({ start: s.starts_at, end: s.ends_at }, b),
      ),
    client_calendar_state: clientState,
    client_calendar_conflict: clientBusy.some((b) =>
      overlaps({ start: s.starts_at, end: s.ends_at }, b),
    ),
  }));
}
export async function checkBooking(
  db,
  booking,
  action,
  allowClientConflict = false,
  send = fetch,
) {
  if (!enabled()) return;
  const [creator, client] = await Promise.all([
    connection(db, booking.creator_id),
    connection(db, booking.client_id),
  ]);
  const interval = { start: booking.starts_at, end: booking.ends_at };
  if (
    !Number.isFinite(Date.parse(interval.start)) ||
    !Number.isFinite(Date.parse(interval.end))
  )
    throw new CalendarError(
      "Refresh the appointment time before continuing.",
      "INVALID_CALENDAR_TIME",
      409,
    );
  if (creator) {
    const busy = await freeBusy(
      db,
      creator,
      interval.start,
      interval.end,
      send,
    );
    if (busy.some((b) => overlaps(interval, b)))
      throw new CalendarError(
        "This time overlaps the nail tech’s Google Calendar. Choose another time.",
        "CREATOR_CALENDAR_CONFLICT",
        409,
      );
  }
  // Clients see only their own conflict; no event details are shared with a tech.
  if (action === "request" && client) {
    let busy;
    try {
      busy = await freeBusy(db, client, interval.start, interval.end, send);
    } catch {
      if (!allowClientConflict)
        throw new CalendarError(
          "Your Google Calendar could not be checked. Reconnect it or explicitly continue without a calendar check.",
          "CLIENT_CALENDAR_UNCHECKED",
          409,
        );
    }
    if (busy?.some((b) => overlaps(interval, b)) && !allowClientConflict)
      throw new CalendarError(
        "You have another event at this time. Choose another slot or confirm that you want to book anyway.",
        "CLIENT_CALENDAR_CONFLICT",
        409,
      );
  }
  if (creator)
    await checked(
      db.from("google_calendar_checks").upsert(
        {
          booking_id: booking.id,
          action,
          client_id: booking.client_id,
          creator_id: booking.creator_id,
          service_id: booking.service_id,
          starts_at: interval.start,
          ends_at: interval.end,
          connection_id: creator.id,
          connection_revision: creator.revision,
          expires_at: new Date(Date.now() + 20000).toISOString(),
        },
        { onConflict: "booking_id,action" },
      ),
    );
}
export async function syncJobs(db, userId = null, send = fetch) {
  if (!enabled()) return { synced: 0, failed: 0 };
  config();
  const jobs = await checked(
    db.rpc("claim_google_calendar_jobs", { p_user_id: userId, p_limit: 5 }),
  );
  const result = { synced: 0, failed: 0 };
  await Promise.all(
    (jobs || []).map(async (job) => {
      let error = null;
      try {
        const c = await connection(db, job.user_id);
        if (!c) return;
        const token = await access(db, c, send);
        const b = await checked(
          db
            .from("bookings")
            .select(
              "id,client_id,creator_id,status,starts_at,ends_at,time_zone,location_snapshot",
            )
            .eq("id", job.booking_id)
            .maybeSingle(),
        );
        const eventId = `laque${hash(`${c.id}:${job.booking_id}`).slice(0, 40)}`,
          path = `/calendars/${encodeURIComponent(c.calendar_id)}/events`;
        if (
          b?.status === "confirmed" &&
          [b.client_id, b.creator_id].includes(job.user_id)
        ) {
          const body = {
            status: "confirmed",
            summary: "LaQue nail appointment",
            description:
              "Manage, reschedule or cancel this booking in LaQue. Moving this calendar copy does not change your appointment.",
            location: b.location_snapshot || "",
            start: { dateTime: b.starts_at, timeZone: b.time_zone },
            end: { dateTime: b.ends_at, timeZone: b.time_zone },
            visibility: "private",
            transparency: "opaque",
            extendedProperties: { private: { laqueBookingId: b.id } },
          };
          const write = await googleRequest(
            token,
            `${path}/${eventId}`,
            { method: "PUT", body, allowed: [404, 410] },
            send,
          );
          if ([404, 410].includes(write.status)) {
            const insert = await googleRequest(
              token,
              path,
              {
                method: "POST",
                body: { ...body, id: eventId },
                allowed: [409],
              },
              send,
            );
            if (insert.status === 409)
              await googleRequest(
                token,
                `${path}/${eventId}`,
                { method: "PUT", body },
                send,
              );
          }
        } else
          await googleRequest(
            token,
            `${path}/${eventId}`,
            { method: "DELETE", allowed: [404, 410] },
            send,
          );
      } catch (e) {
        error =
          e.code === "CALENDAR_RECONNECT"
            ? "Reconnect Google Calendar."
            : "Calendar update pending. Retry is safe.";
        result.failed++;
      }
      const saved = await checked(
        db.rpc("finish_google_calendar_job", {
          p_user_id: job.user_id,
          p_booking_id: job.booking_id,
          p_claim: job.claim_token,
          p_revision: job.revision,
          p_error: error,
        }),
      );
      if (!saved) result.failed++;
      else if (!error) result.synced++;
    }),
  );
  return result;
}
