// Typed confirmation for account deletion. Shared by the dialog (to enable the
// button) and the server action (to refuse a forged call), so both agree.
export const DELETE_PHRASE = "delete my all data";

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export function isDeleteConfirmed(
  input: string,
  email: string | null | undefined,
): boolean {
  const typed = norm(input);
  if (!typed) return false;
  return typed === DELETE_PHRASE || (!!email && typed === norm(email));
}
