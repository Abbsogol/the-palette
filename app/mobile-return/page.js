import { depositReturnContext } from "@/lib/mobile-return";
export default async function MobileReturn({ searchParams }) {
  const params = await searchParams;
  let context;
  try {
    context = depositReturnContext(params.context);
  } catch {
    return (
      <main style={{ padding: 32 }}>This app return link is unavailable.</main>
    );
  }
  if (context === "web" || !/^[0-9a-f-]{36}$/i.test(params.booking || ""))
    return <main style={{ padding: 32 }}>Invalid appointment link.</main>;
  const query = new URLSearchParams({ booking: params.booking });
  if (
    typeof params.session_id === "string" &&
    /^cs_[a-zA-Z0-9_]+$/.test(params.session_id)
  )
    query.set("session_id", params.session_id);
  return (
    <main style={{ padding: 32, maxWidth: 480, margin: "auto" }}>
      <h1>Return to LaQue</h1>
      <p>
        The app will check the payment status with the server. Closing checkout
        does not confirm payment.
      </p>
      <a href={`${context}://checkout-return?${query}`}>
        Open appointment in LaQue
      </a>
    </main>
  );
}
