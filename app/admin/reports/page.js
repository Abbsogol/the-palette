"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
export default function Reports() {
  const [reports, setReports] = useState([]),
    [status, setStatus] = useState("open"),
    [offset, setOffset] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(true);
  const request = useCallback(
    async (method = "GET", body) => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in with an administrator account.");
      const response = await fetch(
        `/api/mobile/admin-reports?status=${status}&offset=${offset}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    },
    [status, offset],
  );
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const data = await request();
      setReports(data.reports);
    } catch (e) {
      setReports([]);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [request]);
  useEffect(() => {
    let active = true;
    request().then((data) => {
      if (active) setReports(data.reports);
    }).catch((e) => {
      if (active) {
        setReports([]);
        setError(e.message);
      }
    }).finally(() => {
      if (active) setBusy(false);
    });
    return () => { active = false; };
  }, [request]);
  const update = async (id, next) => {
    setBusy(true);
    try {
      await request("PATCH", { id, status: next });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main style={{ maxWidth: 720, margin: "auto", padding: 24 }}>
      <Link href="/admin">← Administration</Link>
      <h1>Safety reports</h1>
      <p>
        Review reported content, follow the support process, and record the
        outcome. A report does not automatically remove content.
      </p>
      <label>
        Status{" "}
        <select
          value={status}
          onChange={(e) => {
            setBusy(true);
            setError("");
            setReports([]);
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          {["open", "reviewed", "resolved"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <button disabled={busy} onClick={() => void refresh()}>
        Refresh
      </button>
      {error && <p role="alert">{error}</p>}
      {busy && <p role="status">Loading…</p>}
      {!busy && !error && !reports.length && <p>No reports in this queue.</p>}
      {reports.map((report) => (
        <article
          key={report.id}
          style={{
            padding: 20,
            marginTop: 16,
            border: "1px solid currentColor",
            borderRadius: 16,
          }}
        >
          <h2>{report.target_type} report</h2>
          <p>{report.reason}</p>
          <p>Target: {report.target_id}</p>
          <p>Reporter: {report.reporter_id || "Deleted account"}</p>
          <p>Received {new Date(report.created_at).toLocaleString()}</p>
          {["open", "reviewed", "resolved"]
            .filter((s) => s !== report.status)
            .map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => void update(report.id, s)}
              >
                Mark {s}
              </button>
            ))}
        </article>
      ))}
      <nav style={{ marginTop: 24 }}>
        <button
          disabled={busy || offset === 0}
          onClick={() => { setBusy(true); setError(""); setReports([]); setOffset(Math.max(0, offset - 50)); }}
        >
          Previous page
        </button>
        <button
          disabled={busy || reports.length < 50}
          onClick={() => { setBusy(true); setError(""); setReports([]); setOffset(offset + 50); }}
        >
          Next page
        </button>
      </nav>
    </main>
  );
}
