// SHA-256 hex, identical to the original site's hashParentAccessCode so imported PINs keep working.
export async function hashAccessCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code.trim());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hasValidLearnerCredentials(
  record: { studentId: string | null; parentPinHash: string | null } | null | undefined,
  studentId: string,
  pin: string,
): Promise<boolean> {
  if (!record || record.studentId !== studentId.trim() || !record.parentPinHash || !/^\d{4}$/.test(pin)) return false;
  return (await hashAccessCode(pin)) === record.parentPinHash;
}
