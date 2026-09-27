import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { AppState } from "react-native";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Image } from "expo-image";
import { supabase } from "./supabase";
import { accountScope } from "./account-scope";
import { checked } from "./api";
import type { Profile } from "./types";
import { clearPending } from "./pending";
import { clearStoreIdentity } from "./purchases";
import { secureStorage } from "./secure-storage";

const AuthContext = createContext<{
  session: Session | null;
  ready: boolean;
  epoch: number;
  error: string | null;
}>({ session: null, ready: false, epoch: 0, error: null });
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000, gcTime: 300000 },
    mutations: { retry: false },
  },
});
export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState({
    session: null as Session | null,
    ready: false,
    epoch: 0,
    error: null as string | null,
  });
  useEffect(() => {
    let active = true,
      revision = 0;
    const update = (session: Session | null) => {
      if (!active) return;
      const before = accountScope.capture();
      accountScope.change(session?.user.id || null);
      if (!accountScope.isCurrent(before)) {
        if (before.id) {
          void clearPending(before.id);
          void secureStorage.removeItem("laque.auth-intent");
          void clearStoreIdentity().catch(() => undefined);
        }
        void queryClient.cancelQueries();
        queryClient.clear();
        void supabase.removeAllChannels();
        void Image.clearMemoryCache();
        // Private images use memory-only/no cache, never shared disk entries.
      }
      setState({
        session,
        ready: true,
        epoch: accountScope.capture().epoch,
        error: null,
      });
    };
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      revision++;
      update(session);
    });
    const initial = revision;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || revision !== initial) return;
        if (error)
          setState({
            session: null,
            ready: true,
            epoch: 0,
            error:
              "Your secure session could not be loaded. Please sign in again.",
          });
        else update(data.session);
      })
      .catch(() => {
        if (active)
          setState({
            session: null,
            ready: true,
            epoch: 0,
            error: "Your secure session could not be loaded.",
          });
      });
    const refresh = (value: string) => {
      if (value === "active") supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    refresh(AppState.currentState);
    const listener = AppState.addEventListener("change", refresh);
    return () => {
      active = false;
      subscription.unsubscribe();
      listener.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  return (
    <AuthContext.Provider value={state}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
export function useProfile() {
  const { session, epoch } = useAuth();
  return useQuery({
    queryKey: ["profile", session?.user.id, epoch],
    enabled: !!session,
    queryFn: () =>
      checked<Profile | null>(
        supabase
          .from("profiles")
          .select("*")
          .eq("id", session!.user.id)
          .single(),
      ),
  });
}
export function useAccountQuery<T>(
  key: readonly unknown[],
  query: (signal: AbortSignal) => Promise<T>,
  enabled = true,
) {
  const { session, epoch } = useAuth();
  return useQuery({
    queryKey: [session?.user.id || "public", epoch, ...key],
    enabled,
    queryFn: async ({ signal }) => {
      const ticket = accountScope.capture();
      const result = await query(signal);
      accountScope.assert(ticket);
      return result;
    },
  });
}
export async function signOut() {
  // Unregister this device while its session is still valid. Failure is visible
  // and a fresh registration is required after a later sign-in.
  const { unregisterPush } = await import("./notifications");
  await unregisterPush().catch(() => undefined);
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
  queryClient.clear();
}
