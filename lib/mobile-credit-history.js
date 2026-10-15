// Read-only display data. Balances and grants remain owned by the financial ledger.
export async function readMobileCreditHistory(db, userId) {
  const result = await db
    .from("mobile_store_transactions")
    .select(
      "store,environment,product_id,credits,purchased_at,granted,refunded",
    )
    .eq("user_id", userId)
    .eq("kind", "credits")
    .order("purchased_at", { ascending: false })
    .order("store")
    .order("environment")
    .order("transaction_id")
    .limit(21);
  // Do not turn a failed history read into a false "no purchases" state.
  if (result.error || !Array.isArray(result.data)) return null;
  return {
    items: result.data.slice(0, 20).map((row) => {
      const timestamp = Number(row.purchased_at);
      const date = new Date(timestamp);
      return {
        store: row.store,
        environment: row.environment,
        productId: row.product_id,
        credits: row.credits,
        purchasedAt:
          Number.isSafeInteger(timestamp) &&
          timestamp >= 0 &&
          Number.isFinite(date.getTime())
            ? date.toISOString()
            : null,
        // A refund wins over a previously granted or subsequently replayed purchase.
        status: row.refunded
          ? "refunded"
          : row.granted
            ? "credited"
            : "verifying",
      };
    }),
    hasMore: result.data.length > 20,
  };
}
