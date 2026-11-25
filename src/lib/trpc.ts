// Small tRPC-shaped client so the pages ported from the original site keep their
// `trpc.x.y.useQuery()` / `useMutation()` / `useUtils()` calls. Every call goes
// through one server function (callRpc) that dispatches by path.
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "./rpc.functions";

async function rpc(path: string, input?: unknown): Promise<any> {
  const res = await callRpc({ data: { path, input } });
  return JSON.parse(res.json);
}

// Admin sign-in uses Lovable Cloud accounts; the server then checks the admin role.
const clientOverrides: Record<string, (input: any) => Promise<any>> = {
  "admin.login": async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error("The administrator email or password is incorrect.");
    const me = await rpc("auth.me");
    if (!me) {
      await supabase.auth.signOut();
      throw new Error("This account does not have administrator access.");
    }
    return { success: true, email };
  },
  "admin.bootstrap": async ({ email, password }: { email: string; password: string }) => {
    await rpc("admin.bootstrap", { email: email.trim(), password });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    return { success: true, email };
  },
  "admin.logout": async () => {
    await supabase.auth.signOut();
    return { success: true };
  },
};

const call = (path: string, input?: unknown) => (clientOverrides[path] ? clientOverrides[path](input) : rpc(path, input));

function node(segments: string[]): any {
  const path = segments.join(".");
  return new Proxy(() => undefined, {
    get(_t, key: string) {
      if (key === "useQuery")
        return (input?: unknown, opts?: Record<string, unknown>) =>
          useQuery({ queryKey: [...segments, input ?? null], queryFn: () => call(path, input), ...(opts ?? {}) });
      if (key === "useMutation")
        return (opts?: Record<string, unknown>) => useMutation({ mutationFn: (input?: unknown) => call(path, input), ...(opts ?? {}) });
      return node([...segments, key]);
    },
  });
}

function utilsNode(qc: QueryClient, segments: string[]): any {
  const keyFor = (input?: unknown) => (input === undefined ? segments : [...segments, input]);
  return new Proxy(() => undefined, {
    get(_t, key: string) {
      if (key === "invalidate") return (input?: unknown) => qc.invalidateQueries({ queryKey: keyFor(input) });
      if (key === "reset") return (input?: unknown) => qc.resetQueries({ queryKey: keyFor(input) });
      if (key === "setData") return (input: unknown, value: unknown) => qc.setQueryData([...segments, input ?? null], value);
      return utilsNode(qc, [...segments, key]);
    },
  });
}

const root = node([]);
export const trpc: any = new Proxy(
  {},
  {
    get(_t, key: string) {
      if (key === "useUtils") return () => utilsNode(useQueryClient(), []);
      return root[key];
    },
  },
);

// Keep admin queries fresh when the Cloud session changes.
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(() => undefined);
}
