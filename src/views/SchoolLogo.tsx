// @ts-nocheck -- ported verbatim from the original site; data comes from the untyped RPC shim (src/lib/trpc.ts).
type SchoolLogoProps = {
  className?: string;
  alt?: string;
};

export function SchoolLogo({ className = "h-12 w-12", alt = "Em-Desh English Medium Private School logo" }: SchoolLogoProps) {
  return <img src="/emdeshlogo.jpg" alt={alt} className={`object-contain ${className}`} />;
}
