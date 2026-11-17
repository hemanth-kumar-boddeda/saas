// Machine auth for the developer API and MCP. Only a SHA-256 hash is stored; the raw token is shown once.
import crypto from "crypto";
import { ApiToken } from "./models";

export const SCOPES = ["reel:read", "reel:write", "reel:render"] as const;
export type Scope = (typeof SCOPES)[number];
export const hashToken = (raw: string) => crypto.createHash("sha256").update(raw).digest("hex");

export const createApiToken = async (owner: string, name: string, scopes: Scope[], expiresAt?: Date) => {
  const raw = `rf_${crypto.randomBytes(24).toString("base64url")}`;
  const row = await ApiToken.create({ owner, name, scopes, tokenHash: hashToken(raw), prefix: raw.slice(0, 8), expiresAt });
  return { raw, id: String(row._id), prefix: raw.slice(0, 8) }; // raw is never stored
};

export interface TokenPrincipal { userId: string; scopes: Scope[]; tokenId: string }
export const verifyApiToken = async (raw: string | undefined): Promise<TokenPrincipal | null> => {
  if (!raw || !raw.startsWith("rf_")) return null;
  const row: any = await ApiToken.findOne({ tokenHash: hashToken(raw) });
  if (!row || row.revoked || (row.expiresAt && new Date(row.expiresAt) < new Date())) return null;
  void ApiToken.updateOne({ _id: row._id }, { lastUsedAt: new Date() }).catch(() => undefined);
  return { userId: String(row.owner), scopes: row.scopes, tokenId: String(row._id) };
};
