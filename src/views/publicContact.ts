// @ts-nocheck -- ported verbatim from the original site; data comes from the untyped RPC shim (src/lib/trpc.ts).
import { trpc } from "@/lib/trpc";

export type PublicContact = {
  phone: string;
  whatsapp: string;
  email: string;
  location: string;
  postalBox: string;
  registrationNumber: string;
  nextTermDate: string;
};

export const DEFAULT_PUBLIC_CONTACT: PublicContact = {
  phone: "Phone number to be confirmed",
  whatsapp: "Phone number to be confirmed",
  email: "Email to be confirmed",
  location: "Okahao, Omusati Region, Namibia",
  postalBox: "Postal address to be confirmed",
  registrationNumber: "Private, English-medium school",
  nextTermDate: "Current grades and subjects to be confirmed",
};

export function usePublicContact(): PublicContact {
  const contactProcedure = trpc.publicSite?.contact;
  const query = contactProcedure?.useQuery ? contactProcedure.useQuery() : { data: undefined };
  return {
    ...DEFAULT_PUBLIC_CONTACT,
    ...(query.data ?? {}),
  } satisfies PublicContact;
}
