import { AdminError } from "@/lib/admin/auth";
export const countryCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
export const validCountry = (code) =>
  typeof code === "string" && countryCodes.includes(code);
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const rewardsEnabled = () =>
  process.env.LAQUE_REWARDS_ENABLED === "true";
const messages = {
  EDIT_CONFLICT: [
    "Another editor changed this record. Reload before saving.",
    409,
  ],
  ADMIN_FORBIDDEN: ["Your role cannot make this change.", 403],
  ACTIVATION_DISABLED: [
    "Prize competitions are not activated. Complete platform and regional review first.",
    409,
  ],
  CAMPAIGN_UNAVAILABLE: [
    "This competition is unavailable for your account or country.",
    404,
  ],
  ENTRY_UNAVAILABLE: ["This entry is no longer available.", 404],
  ENTRY_LIMIT: ["You have already submitted three designs to this round.", 409],
  SUBSCRIPTION_REQUIRED: [
    "An active, verified Nail Lab subscription is required.",
    403,
  ],
  COMPLETE_PUBLIC_PROFILE_REQUIRED: [
    "Complete your profile and make it public before entering.",
    403,
  ],
  VERIFIED_ACCOUNT_REQUIRED: [
    "Verify your LaQue account before participating.",
    403,
  ],
  RULES_ACCEPTANCE_REQUIRED: [
    "Read and accept the current competition rules.",
    409,
  ],
  ENTRIES_CLOSED: ["Entry submission is closed.", 409],
  VOTING_CLOSED: ["Voting is closed.", 409],
  SELF_VOTE: ["You cannot vote for your own design.", 403],
  COUNTRY_LOCKED: [
    "Your profile country cannot change while you have an entry in an unfinished round.",
    409,
  ],
  PUBLISHED_LAB_DESIGN_REQUIRED: [
    "Choose your own published Lab design with complete design details.",
    400,
  ],
  CONFIRMED_GENERATION_REQUIRED: ["Choose a confirmed Lab generation.", 400],
  RESULTS_NOT_READY: [
    "Close voting and complete review before publishing results.",
    409,
  ],
  INSUFFICIENT_ELIGIBLE_ENTRIES: [
    "There are fewer eligible entrants than the published winner count. Resolve the round under its official rules before awarding.",
    409,
  ],
  DRAFT_REQUIRED: [
    "Published content is locked. Archive it or create a new draft.",
    409,
  ],
};
export function rewardsFailure(error) {
  const key = Object.keys(messages).find((k) =>
    String(error?.message || "").includes(k),
  );
  if (key) throw new AdminError(messages[key][0], messages[key][1], key);
  throw new AdminError(
    "Rewards could not load or save. Check the record and retry.",
    503,
    "REWARDS_UNAVAILABLE",
  );
}
export async function checkedRewards(query) {
  const r = await query;
  if (r.error) rewardsFailure(r.error);
  return r.data;
}
export function validateRewardDraft(section, body) {
  const value = (key, max, min = 1) => {
    const v = body[key];
    if (typeof v !== "string" || v.trim().length < min || v.length > max)
      throw new AdminError(`Check ${key}.`);
    return v.trim();
  };
  const countries = body.countryCodes;
  if (
    !Array.isArray(countries) ||
    countries.length > 30 ||
    countries.some((c) => !validCountry(c)) ||
    new Set(countries).size !== countries.length
  )
    throw new AdminError("Choose valid country codes or All countries.");
  const draft = { title: value("title", 120), countryCodes: countries };
  if (section === "updates") return { ...draft, body: value("body", 2200) };
  const dates = ["opensAt", "entriesCloseAt", "votesCloseAt", "awardAt"].map(
    (key) => {
      const t = value(key, 40);
      if (!Number.isFinite(Date.parse(t)))
        throw new AdminError("Enter valid dates with a time zone.");
      return new Date(t).toISOString();
    },
  );
  if (!(dates[0] < dates[1] && dates[1] <= dates[2] && dates[2] <= dates[3]))
    throw new AdminError(
      "Dates must run from opening to entry close, vote close and award.",
    );
  if (
    !["cash", "products", "gift_cards"].includes(body.prizeType) ||
    !Number.isInteger(body.winnerCount) ||
    body.winnerCount < 1 ||
    body.winnerCount > 10
  )
    throw new AdminError("Check the prizes and number of winners.");
  return {
    ...draft,
    theme: value("theme", 120),
    description: value("description", 2200),
    prizeType: body.prizeType,
    prizeLabel: value("prizeLabel", 240),
    rules: value("rules", 12000, 20),
    opensAt: dates[0],
    entriesCloseAt: dates[1],
    votesCloseAt: dates[2],
    awardAt: dates[3],
    winnerCount: body.winnerCount,
  };
}
export async function rewardsAdminGet(db, section, id, params, identity) {
  const table = section === "updates" ? "official_updates" : "reward_campaigns";
  const page = Number(params.get("page") || 0),
    country = params.get("country") || "",
    status = params.get("filter") || "";
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    page > 4000 ||
    (country && !validCountry(country))
  )
    throw new AdminError("Invalid page or country.");
  if (id && !uuid.test(id)) throw new AdminError("Invalid record.");
  if (id) {
    const campaign = await checkedRewards(
      db.from(table).select("*").eq("id", id).single(),
    );
    if (section === "updates") return { record: campaign };
    // Admin sees submitted public entries, never an unrestricted private Lab gallery.
    const entries = await checkedRewards(
      db.rpc("rewards_admin_entries", {
        p_actor: identity.user.id,
        p_campaign: id,
        p_offset: page * 25,
      }),
    );
    const visibleEntries = await Promise.all(
      entries
        .slice(0, 25)
        .map(async (e) => ({
          ...e,
          snapshot: {
            ...e.snapshot,
            image_url: await submittedPreview(db, e.snapshot.image_url),
          },
        })),
    );
    return {
      record: campaign,
      entries: visibleEntries,
      hasMore: entries.length > 25,
      page,
      results: await checkedRewards(
        db
          .from("reward_results")
          .select("entry_id,rank,votes,published_at")
          .eq("campaign_id", id)
          .order("rank"),
      ),
    };
  }
  let query = db
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .order("id");
  const search = (params.get("q") || "").replace(/[%_]/g, "").slice(0, 100);
  if (search) query = query.ilike("title", `%${search}%`);
  if (country) query = query.contains("country_codes", [country]);
  if (status) {
    if (
      !["draft", "published", "paused", "results", "archived"].includes(status)
    )
      throw new AdminError("Invalid status.");
    query = query.eq("status", status);
  }
  const rows = await checkedRewards(query.range(page * 25, page * 25 + 25));
  const setting =
    section === "rewards"
      ? await checkedRewards(
          db.from("reward_settings").select("activation_enabled").single(),
        )
      : null;
  return {
    items: rows.slice(0, 25),
    hasMore: rows.length > 25,
    page,
    enabled: !!setting?.activation_enabled && rewardsEnabled(),
    countryCodes: [...new Set(countryCodes)],
  };
}
export async function rewardsAdminPost(db, section, id, body, identity) {
  if (
    typeof body.reason !== "string" ||
    body.reason.trim().length < 5 ||
    body.reason.length > 1000
  )
    throw new AdminError("Enter a reason of 5–1,000 characters.");
  if (!["owner", "moderator"].includes(identity.role))
    throw new AdminError("Your role cannot publish Updates or Rewards.", 403);
  if (
    !Number.isInteger(body.version) ||
    body.version < 0 ||
    (id && !uuid.test(id))
  )
    throw new AdminError("Reload the latest record.");
  let data = {};
  if (body.action === "save") data = validateRewardDraft(section, body);
  else if (!id) throw new AdminError("Save a draft first.");
  else if (body.action === "review") {
    if (
      identity.role !== "owner" ||
      typeof body.reference !== "string" ||
      body.reference.trim().length < 10 ||
      body.reference.length > 1000
    )
      throw new AdminError("Owner review evidence is required.", 403);
    data = { reference: body.reference.trim() };
  } else if (["disqualify", "restore-entry"].includes(body.action)) {
    if (!uuid.test(body.entryId || ""))
      throw new AdminError("Choose a valid entry.");
    data = { entryId: body.entryId };
  } else if (
    !["publish", "pause", "resume", "archive", "results"].includes(body.action)
  )
    throw new AdminError("Invalid action.");
  if (
    section === "rewards" &&
    ["publish", "resume", "results"].includes(body.action) &&
    !rewardsEnabled()
  )
    throw new AdminError(
      "Prize competitions remain inactive until platform and regional review is complete.",
      409,
      "ACTIVATION_DISABLED",
    );
  return {
    ok: true,
    record: await checkedRewards(
      db.rpc("rewards_admin_change", {
        p_actor: identity.user.id,
        p_section: section,
        p_id: id || null,
        p_action: body.action,
        p_version: body.version,
        p_reason: body.reason.trim(),
        p_data: data,
      }),
    ),
  };
}

async function submittedPreview(db, url) {
  if (!url) return null;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nail-lab/`;
  if (typeof url !== "string" || !url.startsWith(prefix)) return null;
  const path = url.slice(prefix.length);
  if (!path || path.includes("..") || /[%\\?#]/.test(path)) return null;
  const result = await db.storage.from("nail-lab").createSignedUrl(path, 60);
  return result.error ? null : result.data?.signedUrl || null;
}
