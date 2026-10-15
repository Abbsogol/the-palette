"use client";
import { useState } from "react";
import styles from "./admin.module.css";
import { useCurrentTime } from "@/lib/use-current-time";
const date = (v) => (v ? new Date(v).toLocaleString() : "—");
const empty = {
  title: "",
  theme: "",
  description: "",
  prizeType: "cash",
  prizeLabel: "",
  rules: "",
  countryCodes: [],
  opensAt: "",
  entriesCloseAt: "",
  votesCloseAt: "",
  awardAt: "",
  winnerCount: 1,
};
const draftOf = (r) => ({
  title: r.title,
  theme: r.theme,
  description: r.description,
  prizeType: r.prize_type,
  prizeLabel: r.prize_label,
  rules: r.rules,
  countryCodes: r.country_codes,
  opensAt: r.opens_at,
  entriesCloseAt: r.entries_close_at,
  votesCloseAt: r.votes_close_at,
  awardAt: r.award_at,
  winnerCount: r.winner_count,
  body: r.body,
});
const countryName = (code) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code);
  } catch {
    return code;
  }
};
export default function RewardsPanel({
  section,
  data,
  request,
  action,
  owner,
}) {
  const news = section === "updates",
    now = useCurrentTime();
  const [view, setView] = useState(data),
    [detail, setDetail] = useState(null),
    [form, setForm] = useState(null),
    [draft, setDraft] = useState(empty),
    [search, setSearch] = useState(""),
    [country, setCountry] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [review, setReview] = useState("");
  const field = (key, value) => setDraft({ ...draft, [key]: value });
  async function load(page = 0) {
    setBusy(true);
    setError("");
    setDetail(null);
    try {
      setView(
        await request(
          `${section}?q=${encodeURIComponent(search)}&country=${country}&filter=${status}&page=${page}`,
        ),
      );
    } catch (e) {
      setView(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function inspect(id, page = 0) {
    setBusy(true);
    setError("");
    try {
      setDetail(await request(`${section}/${id}?page=${page}`));
      setForm(null);
    } catch (e) {
      setDetail(null);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const record = detail?.record;
  return (
    <section
      className={styles.detail}
      aria-label={
        news ? "Official Updates management" : "Rewards competition management"
      }
    >
      <p className={styles.context}>
        {news
          ? "Official news is published only by assigned Owners and Moderators. Community posts remain separate."
          : "Subscriber promotion: up to three existing confirmed Lab designs per account. No additional credits, entry fees or mandatory referrals."}
      </p>
      {!news && (
        <p className={view?.enabled ? styles.notice : styles.context}>
          {view?.enabled
            ? "Prize competitions activated."
            : "Prize competitions are inactive. Draft and preview are available; publishing requires documented review and separate backend activation."}
        </p>
      )}
      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <input
          aria-label="Search titles"
          placeholder="Search titles"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Country filter"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="">All countries and worldwide</option>
          {data.countryCodes.map((c) => (
            <option key={c} value={c}>
              {countryName(c)} ({c})
            </option>
          ))}
        </select>
        <select
          aria-label="Publication status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Every status</option>
          {(news
            ? ["draft", "published", "archived"]
            : ["draft", "published", "paused", "results", "archived"]
          ).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button disabled={busy}>Apply filters</button>
      </form>
      <button
        disabled={busy || !!form}
        onClick={() => {
          setForm({ id: crypto.randomUUID(), version: 0 });
          setDraft({ ...empty, body: "" });
          setDetail(null);
        }}
      >
        Create {news ? "update" : "competition"}
      </button>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {busy && <p role="status">Loading…</p>}
      {view && (
        <>
          <div className={styles.tableWrap}>
            <table>
              <caption className={styles.srOnly}>
                {news ? "Official updates" : "All regional competitions"}
              </caption>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {view.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.title}</strong>
                      {!news && <small>{r.prize_label}</small>}
                    </td>
                    <td>
                      {r.country_codes.length
                        ? r.country_codes.map(countryName).join(", ")
                        : "Worldwide"}
                    </td>
                    <td>{r.status}</td>
                    <td>{date(r.published_at)}</td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() => void inspect(r.id)}
                      >
                        Inspect / preview
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!view.items.length && (
            <p>
              No matching {news ? "updates" : "competitions"}. Create a draft to
              begin.
            </p>
          )}
          <div className={styles.pagination}>
            <button
              disabled={busy || !view.page}
              onClick={() => void load(view.page - 1)}
            >
              Previous
            </button>
            <span>Page {view.page + 1}</span>
            <button
              disabled={busy || !view.hasMore}
              onClick={() => void load(view.page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
      {record && (
        <article>
          <header>
            <h2>{record.title}</h2>
            <button onClick={() => setDetail(null)}>Close preview</button>
          </header>
          <span className={styles.badge}>{record.status}</span>
          <p>
            Audience:{" "}
            {record.country_codes.length
              ? record.country_codes.map(countryName).join(", ")
              : "Worldwide"}
          </p>
          {news ? (
            <p style={{ whiteSpace: "pre-wrap" }}>{record.body}</p>
          ) : (
            <>
              <h3>{record.prize_label}</h3>
              <p>
                {record.theme} · {record.description}
              </p>
              <p>
                Opens {date(record.opens_at)} · entries close{" "}
                {date(record.entries_close_at)} · voting closes{" "}
                {date(record.votes_close_at)} · awards {date(record.award_at)}
              </p>
              <p>
                {record.winner_count} winner(s) · maximum three entries per
                person · earlier submission breaks vote ties · one winning
                design per person
              </p>
              <h3>Official rules</h3>
              <p style={{ whiteSpace: "pre-wrap" }}>{record.rules}</p>
              <p>Review: {record.review_reference || "Not recorded"}</p>
            </>
          )}
          <div className={styles.inline}>
            {record.status === "draft" && (
              <>
                <button
                  onClick={() => {
                    setForm({ id: record.id, version: record.version });
                    setDraft(draftOf(record));
                    setDetail(null);
                  }}
                >
                  Edit draft
                </button>
                <button
                  disabled={!news && (!view?.enabled || !record.reviewed_at)}
                  onClick={() =>
                    action(
                      `Publish ${news ? "update" : "competition"}`,
                      `${section}/${record.id}`,
                      { action: "publish", version: record.version },
                    )
                  }
                >
                  Publish
                </button>
              </>
            )}
            {!news && record.status === "published" && (
              <button
                onClick={() =>
                  action("Pause competition", `${section}/${record.id}`, {
                    action: "pause",
                    version: record.version,
                  })
                }
              >
                Pause entries and voting
              </button>
            )}
            {!news && record.status === "paused" && (
              <button
                disabled={!view?.enabled}
                onClick={() =>
                  action("Resume competition", `${section}/${record.id}`, {
                    action: "resume",
                    version: record.version,
                  })
                }
              >
                Resume
              </button>
            )}
            {record.status !== "archived" && (
              <button
                onClick={() =>
                  action("Archive content", `${section}/${record.id}`, {
                    action: "archive",
                    version: record.version,
                  })
                }
              >
                Archive
              </button>
            )}
          </div>
          {!news && owner && record.status === "draft" && (
            <label className={styles.field}>
              Platform and regional review reference
              <input
                value={review}
                onChange={(e) => setReview(e.target.value)}
                maxLength={1000}
                placeholder="Reference to the completed review and approved territories"
              />
              <button
                disabled={review.trim().length < 10}
                onClick={() =>
                  action("Record completed review", `${section}/${record.id}`, {
                    action: "review",
                    version: record.version,
                    reference: review,
                  })
                }
              >
                Record review evidence
              </button>
              <small>
                This records evidence; it does not request or guarantee platform
                approval.
              </small>
            </label>
          )}
          {!news && (
            <>
              <h3>Submitted entries</h3>
              {!detail.entries.length && <p>No submitted entries.</p>}
              {detail.entries.map((e) => (
                <article key={e.id}>
                  {e.snapshot.image_url && (
                    <img
                      src={e.snapshot.image_url}
                      alt={e.snapshot.title}
                      style={{ width: 160, maxWidth: "100%", borderRadius: 16 }}
                    />
                  )}
                  <strong>{e.snapshot.title}</strong>
                  <p>
                    {e.display_name || "Unavailable profile"}{" "}
                    {e.username ? "@" + e.username : ""} · {e.votes} valid votes
                  </p>
                  <p>
                    Profile {e.user_id || "Deleted"} · submitted{" "}
                    {date(e.created_at)}
                  </p>
                  <p>
                    {e.disqualified
                      ? "Disqualified: " + e.disqualification_reason
                      : "Entered"}
                  </p>
                  {["published", "paused"].includes(record.status) && (
                    <button
                      onClick={() =>
                        action(
                          e.disqualified ? "Restore entry" : "Disqualify entry",
                          `${section}/${record.id}`,
                          {
                            action: e.disqualified
                              ? "restore-entry"
                              : "disqualify",
                            entryId: e.id,
                            version: record.version,
                          },
                        )
                      }
                    >
                      {e.disqualified
                        ? "Restore entry"
                        : "Disqualify with reason"}
                    </button>
                  )}
                </article>
              ))}
              <div className={styles.inline}>
                <button
                  disabled={!detail.page || busy}
                  onClick={() => void inspect(record.id, detail.page - 1)}
                >
                  Previous entries
                </button>
                <button
                  disabled={!detail.hasMore || busy}
                  onClick={() => void inspect(record.id, detail.page + 1)}
                >
                  More entries
                </button>
              </div>
              <h3>Results</h3>
              <p>
                Review suspicious activity before publishing. Results freeze
                valid vote counts and promote winners for 30 days. This does not
                send prizes or payments.
              </p>
              {detail.results.map((r) => (
                <p key={r.entry_id}>
                  #{r.rank} · entry {r.entry_id} · {r.votes} votes
                </p>
              ))}
              {owner && record.status === "published" && (
                <button
                  disabled={
                    !view?.enabled ||
                    !now ||
                    Date.parse(record.votes_close_at) > now
                  }
                  onClick={() =>
                    action(
                      "Freeze votes and publish winners",
                      `${section}/${record.id}`,
                      { action: "results", version: record.version },
                    )
                  }
                >
                  Publish results
                </button>
              )}
            </>
          )}
        </article>
      )}
      {form && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            action(
              `Save ${news ? "update" : "competition"} draft`,
              `${section}/${form.id}`,
              { action: "save", version: form.version, ...draft },
            );
          }}
        >
          <h2>{form.version ? "Edit draft" : "New draft"}</h2>
          <label className={styles.field}>
            Title
            <input
              required
              maxLength={120}
              value={draft.title}
              onChange={(e) => field("title", e.target.value)}
            />
          </label>
          <label className={styles.field}>
            Audience
            <select
              aria-label="Audience"
              multiple
              value={draft.countryCodes}
              onChange={(e) =>
                field(
                  "countryCodes",
                  [...e.target.selectedOptions].map((o) => o.value),
                )
              }
            >
              {data.countryCodes.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)} ({c})
                </option>
              ))}
            </select>
            <small>
              No selection means worldwide. Select one or more countries for a
              regional round.
            </small>
          </label>
          {news ? (
            <label className={styles.field}>
              Update text
              <textarea
                required
                maxLength={2200}
                value={draft.body || ""}
                onChange={(e) => field("body", e.target.value)}
              />
            </label>
          ) : (
            <>
              <label className={styles.field}>
                Theme
                <input
                  required
                  maxLength={120}
                  value={draft.theme}
                  onChange={(e) => field("theme", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                Description
                <textarea
                  required
                  maxLength={2200}
                  value={draft.description}
                  onChange={(e) => field("description", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                Prize type
                <select
                  value={draft.prizeType}
                  onChange={(e) => field("prizeType", e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="products">Brand products</option>
                  <option value="gift_cards">Gift cards / codes</option>
                </select>
              </label>
              <label className={styles.field}>
                Prize pool and allocation
                <input
                  required
                  maxLength={240}
                  placeholder="$2,000: 1st $1,000, 2nd $600, 3rd $400"
                  value={draft.prizeLabel}
                  onChange={(e) => field("prizeLabel", e.target.value)}
                />
              </label>
              <label className={styles.field}>
                Number of winners
                <input
                  type="number"
                  required
                  min={1}
                  max={10}
                  value={draft.winnerCount}
                  onChange={(e) => field("winnerCount", Number(e.target.value))}
                />
              </label>
              {[
                ["opensAt", "Opening"],
                ["entriesCloseAt", "Entry deadline"],
                ["votesCloseAt", "Voting deadline"],
                ["awardAt", "Prize award date"],
              ].map(([key, label]) => (
                <label className={styles.field} key={key}>
                  {label} (local time)
                  <input
                    type="datetime-local"
                    required
                    value={
                      draft[key]
                        ? new Date(
                            Date.parse(draft[key]) -
                              new Date(draft[key]).getTimezoneOffset() * 60000,
                          )
                            .toISOString()
                            .slice(0, 16)
                        : ""
                    }
                    onChange={(e) =>
                      field(
                        key,
                        e.target.value
                          ? new Date(e.target.value).toISOString()
                          : "",
                      )
                    }
                  />
                </label>
              ))}
              <label className={styles.field}>
                Official rules
                <textarea
                  required
                  minLength={20}
                  maxLength={12000}
                  value={draft.rules}
                  onChange={(e) => field("rules", e.target.value)}
                  placeholder="Sponsor, eligible countries, age 18+, subscription eligibility, entry limits, prize allocation, voting/tie rules, fraud review, claim deadline, privacy and Apple not being a sponsor."
                />
              </label>
              <p>
                Entry limit: three existing confirmed Lab designs. No bonus
                credits. Referrals optional. Votes never require a subscription.
                Rules and targeting lock on publication.
              </p>
            </>
          )}
          <div className={styles.inline}>
            <button>Save draft</button>
            <button type="button" onClick={() => setForm(null)}>
              Discard form
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
