// Case-insensitive e-mail lookup.
//
// Legacy rows were written with whatever casing the user typed, so an exact
// match would let the same person hold two accounts ("Alice@x.com" and
// "alice@x.com"). Every lookup normalises to lower case and matches case
// insensitively; the value is escaped so it can never act as a regex.
export const normalizeEmail = (email: unknown): string =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const emailQuery = (email: unknown) => {
  const normalized = normalizeEmail(email);
  return { email: new RegExp(`^${escapeRegex(normalized)}$`, "i") };
};
