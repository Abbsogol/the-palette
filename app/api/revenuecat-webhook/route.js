import { serviceClient } from "@/lib/auth";
import {
  normalizeStoreEvent,
  reconcileMobileBilling,
  validRevenueCatAuthorization,
} from "@/lib/mobile-billing";
export async function POST(request) {
  if (!validRevenueCatAuthorization(request.headers.get("authorization")))
    return new Response("Unauthorized", { status: 401 });
  const raw = await request.text();
  if (raw.length > 65536)
    return new Response("Payload too large", { status: 413 });
  let event;
  try {
    event = normalizeStoreEvent(JSON.parse(raw).event);
  } catch {
    return Response.json(
      { error: "Store event could not be verified" },
      { status: 400 },
    );
  }
  try {
    const { data: pending, error } = await serviceClient.rpc(
      "stage_mobile_store_event",
      { p_id: event.id, p_user_id: event.app_user_id, p_payload: event },
    );
    if (error) throw error;
    if (pending) await reconcileMobileBilling(serviceClient, event.app_user_id);
    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Store event remains unconfirmed. Retry is required." },
      { status: 503 },
    );
  }
}
