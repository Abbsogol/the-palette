import { serviceClient } from "@/lib/auth";
import { CalendarError, receiveCallback } from "@/lib/calendar/google";
export async function GET(request) {
  try {
    const destination = await receiveCallback(
      serviceClient,
      new URL(request.url).searchParams,
    );
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return new Response(
      e instanceof CalendarError
        ? e.message
        : "Calendar connection could not be completed. Return to LaQue and try again.",
      {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }
}
