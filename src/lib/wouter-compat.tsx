// Thin adapter so pages ported from the original wouter-based site use TanStack Router.
import { Link as RouterLink, useNavigate, useRouterState } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ReactNode } from "react";

export type AppPath = "/" | "/admissions" | "/hostel" | "/gallery" | "/fees" | "/learner-portal" | "/admin";
const appPaths = new Set<string>(["/", "/admissions", "/hostel", "/gallery", "/fees", "/learner-portal", "/admin"]);

type LinkProps = Pick<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "onClick" | "aria-label"> & { href: string; children?: ReactNode };

export function Link({ href, children, ...rest }: LinkProps) {
  // Spread only the attributes we pass through.
  if (appPaths.has(href)) {
    return (
      <RouterLink to={href as AppPath} {...rest}>
        {children}
      </RouterLink>
    );
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

export function useLocation(): [string, (to: string) => void] {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  return [pathname, (to: string) => void navigate({ href: to })];
}
