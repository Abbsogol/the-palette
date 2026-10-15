import type { PropsWithChildren } from "react";
import {
  Redirect,
  router,
  usePathname,
  useGlobalSearchParams,
} from "expo-router";
import { useAuth } from "../../lib/auth";
import { protectedReturnPath, safeReturnPath } from "../../lib/links";
import { Loading } from "../../components/ui";
import { IntroView } from "./welcome-view";
import { useFirstLaunch } from "./first-launch";

export function routeAccessPath(
  name: string,
  params: Record<string, unknown> = {},
) {
  if (name === "(tabs)" || name === "index") return "/";
  if (name === "auth/index") return "/auth";
  return `/${name.replace(/\[([^\]]+)\]/g, (_, key: string) => encodeURIComponent(typeof params[key] === "string" ? (params[key] as string) : ""))}`;
}
// Only authentication and the account-closure receipt are accessible signed out.
// Public profiles are public to other LaQue members, not anonymous visitors.
export const signedOutRoute = (path: string) =>
  ["/auth", "/auth/callback", "/account-closed"].includes(path);
export function RouteAccess({
  children,
  name,
  params = {},
  introduction = false,
}: PropsWithChildren<{
  name: string;
  params?: object;
  introduction?: boolean;
}>) {
  const auth = useAuth(),
    launch = useFirstLaunch();
  const activePath = usePathname(),
    activeParams = useGlobalSearchParams();
  const values = params as Record<string, unknown>;
  const path = routeAccessPath(name, values);
  if (!auth.ready || !launch.ready) return <Loading />;
  if (
    !auth.session &&
    introduction &&
    !launch.seen &&
    path !== "/auth/callback" &&
    path !== "/account-closed"
  )
    return (
      <IntroView
        onFinish={async () => {
          await launch.complete();
          router.replace({
            pathname: "/auth",
            params: {
              returnTo: path === "/auth" ? safeReturnPath(values.returnTo) : protectedReturnPath(
                name === "(tabs)" ? activePath : path,
                name === "(tabs)" ? activeParams : values,
              ),
            },
          });
        }}
      />
    );
  // The child screen is never mounted while blocked: no protected query or UI flash.
  if (!auth.session && !signedOutRoute(path))
    return (
      <Redirect
        href={{
          pathname: "/auth",
          params: { returnTo: protectedReturnPath(path, values) },
        }}
      />
    );
  return <>{children}</>;
}
