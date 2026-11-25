export function application(deps: {
  db: unknown;
  storage: unknown;
  BackendError: unknown;
  env: { get: (name: string) => string | undefined };
}): (ctx: { request: Request }) => Promise<Response>;
