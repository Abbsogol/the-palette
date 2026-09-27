import { accountScope } from "./account-scope";
import { configurationError, environment } from "./config";
import { supabase } from "./supabase";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  if (configurationError) throw new Error(configurationError);
  if (!/^\/[a-z0-9/-]+(?:\?[^#]*)?$/i.test(path))
    throw new Error("Invalid API path");
  const ticket = accountScope.capture();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  accountScope.assert(ticket);
  if (error || !session || session.user.id !== ticket.id)
    throw new ApiError("Sign in to continue.", 401);
  const controller = new AbortController();
  const detach = accountScope.onChange(() => controller.abort());
  const timeout = setTimeout(
    () => controller.abort(),
    path.includes("generate-nail-design") ? 65000 : 25000,
  );
  try {
    const multipart = body instanceof FormData;
    const response = await fetch(`${environment.apiUrl}/api${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(multipart ? {} : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : multipart
            ? body
            : JSON.stringify(body),
    });
    const data = await response.json();
    accountScope.assert(ticket);
    if (!response.ok)
      throw new ApiError(
        data.error || "Unable to complete this request.",
        response.status,
      );
    return data as T;
  } finally {
    clearTimeout(timeout);
    detach();
  }
}
export async function checked<T>(
  request: PromiseLike<{ data: T | null; error: { message: string } | null }>,
): Promise<NonNullable<T>> {
  const ticket = accountScope.capture();
  const { data, error } = await request;
  accountScope.assert(ticket);
  if (error) throw new Error(error.message);
  if (data === null)
    throw new Error(
      "This content is unavailable or you no longer have access.",
    );
  return data as NonNullable<T>;
}
