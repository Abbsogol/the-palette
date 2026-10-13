"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
export default function RewardLink({ id, entry, appScheme }) {
  const [record, setRecord] = useState(null),
    [error, setError] = useState(""),
    [signedIn, setSignedIn] = useState(false);
  const path = `/rewards/${id}${entry ? "?entry=" + entry : ""}`;
  useEffect(() => {
    let active = true,
      version = 0;
    const controller = new AbortController();
    async function load() {
      const ticket = ++version;
      setRecord(null);
      setError("");
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!active || ticket !== version) return;
        setSignedIn(!!session);
        setRecord(null);
        if (!session) return;
        const r = await fetch(
          `/api/mobile/rewards/campaigns/${id}${entry ? "?entry=" + entry : ""}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (active && ticket === version) {
          setRecord(data);
          setError("");
        }
      } catch (e) {
        if (active && ticket === version) setError(e.message);
      }
    }
    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      ++version;
      setRecord(null);
      setError("");
      setTimeout(() => void load(), 0);
    });
    return () => {
      active = false;
      controller.abort();
      subscription.unsubscribe();
    };
  }, [id, entry]);
  return (
    <main
      style={{
        maxWidth: 640,
        margin: "40px auto",
        padding: 28,
        borderRadius: 28,
        background: "#4a1222",
        color: "#fff4f8",
      }}
    >
      <p>LAQUE · REWARDS</p>
      <h1>{record?.campaign.title || "Support independent designers"}</h1>
      <p>
        {signedIn
          ? "Open this competition in LaQue to view the full design and vote."
          : "Sign in to LaQue to view this competition. Regional eligibility uses your profile country."}
      </p>
      {error && <p role="alert">{error}</p>}
      {record?.items.map((e) => (
        <article key={e.id}>
          {e.snapshot.image_url && (
            <img
              src={e.snapshot.image_url}
              alt={e.snapshot.title}
              style={{ width: "100%", borderRadius: 20 }}
            />
          )}
          <h2>{e.snapshot.title}</h2>
          <p>
            {e.display_name} · {e.rank ? e.final_votes : e.votes} votes
          </p>
        </article>
      ))}
      <p>
        <a href={`${appScheme}:/${path}`} style={{ color: "#ffbdd3" }}>
          Open in LaQue
        </a>
      </p>
      <p>
        <Link href="/">LaQue home</Link>
      </p>
      <p>
        Have the app installed? This link keeps the shared entry selected after
        you sign in.
      </p>
    </main>
  );
}
