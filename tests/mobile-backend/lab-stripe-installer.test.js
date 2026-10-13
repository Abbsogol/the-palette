import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createSecurityDatabase } from "../helpers/security-database";
it("rehearses the guarded Stripe installer twice without creating customers or changing balances", async () => {
  const db = await createSecurityDatabase();
  try {
    await db.exec(
      "alter table auth.users add column email text,add column email_confirmed_at timestamptz",
    );
    for (const n of [
      "202610080027_pinterest_budget.sql",
      "202610080028_pinterest_budget_recovery.sql",
      "202610080029_pinterest_pilot_allowance.sql",
      "202610080030_admin_operations.sql",
      "202610080035_lab_subscription.sql",
      "202610080036_lab_play_base_plan.sql",
      "202610080037_members_only_app.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../../supabase/migrations/" + n, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      "create schema supabase_migrations;create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])",
    );
    const owner = "a92d4175-0da7-463a-a58e-7f067d5057e9";
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [owner],
    );
    await db.query("insert into admin_staff(user_id,role) values($1,'owner')", [
      owner,
    ]);
    const installer = await readFile(new URL('../../supabase/beta-install-lab-stripe.sql',import.meta.url),'utf8');
    await db.exec(installer);
    await db.query('update profiles_data set credit_balance=17 where id=$1',[owner]);
    await db.exec(installer);
    expect((await db.query("select count(*)::int n from supabase_migrations.schema_migrations where version='202610090040'")).rows[0].n).toBe(1);
    expect((await db.query('select credit_balance from profiles_data where id=$1',[owner])).rows[0].credit_balance).toBe(17);
    expect((await db.query('select count(*)::int n from lab_stripe_customers')).rows[0].n).toBe(0);
  } finally { await db.close(); }
},30000);
