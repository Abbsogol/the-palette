import { processAccountCleanup } from "@/lib/account-cleanup";
import Stripe from "stripe";
import { verifyStripeEnvironment } from '@/lib/stripe-environment';
import { serviceClient } from "@/lib/auth";
import { processMobileJobs } from "@/lib/mobile-jobs";
export const maxDuration = 300;
export async function GET(request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret)
    return Response.json(
      { error: "Worker is not configured" },
      { status: 503 },
    );
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return new Response("Unauthorized", { status: 401 });
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    await verifyStripeEnvironment(stripe);
    const result = await processMobileJobs(
      serviceClient,
      stripe,
    );
    const cleanup = await processAccountCleanup(serviceClient, stripe);
    return Response.json({ ...result, ...cleanup, failed: result.failed + cleanup.failed }, { status: result.failed + cleanup.failed ? 503 : 200 });
  } catch {
    return Response.json(
      { error: "Some jobs remain pending. Retry is safe." },
      { status: 503 },
    );
  }
}
