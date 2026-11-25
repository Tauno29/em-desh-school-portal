import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Single RPC entry point used by the ported pages (see src/lib/trpc.ts).
export const callRpc = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string; input?: unknown }) =>
    z.object({ path: z.string().min(1).max(100), input: z.unknown().optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { dispatch } = await import("./rpc.server");
    const result = await dispatch(data.path, data.input);
    return { json: result === undefined ? "null" : JSON.stringify(result) };
  });
