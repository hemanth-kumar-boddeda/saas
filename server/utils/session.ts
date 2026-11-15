// SEC-03 / SEC-04 — server-side session store.
//
// A session is the authoritative revocation point: access tokens carry the
// session id, and the middleware refuses a token whose session is gone
// (logged out, rotated or expired). Redis holds ONLY safe user fields —
// never the password hash (SEC-04, B-7).
//
// Keys are namespaced (`sess:{sha256(sessionId)}`) so session data can never
// collide with the video cache (V22). `sessidx:{sha256(userId)}` holds the
// session ids of one user so that a password change or an account deletion
// can revoke every session at once.
import crypto from "crypto";
import { redis } from "./redis";
import { sessionTtlSeconds } from "../config/auth";
import { ISafeUser, toSafeUser } from "./safeUser";

export interface ISession {
  userId: string;
  user: ISafeUser;
  /** Id of the refresh token currently valid for this session. */
  refreshTokenId: string;
}

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");

export const sessionKey = (sessionId: string) => `sess:${sha256(sessionId)}`;

const userSessionIndexKey = (userId: string) => `sessidx:${sha256(userId)}`;

export const createSessionId = () => crypto.randomBytes(32).toString("hex");

export const createSession = async (user: any, refreshTokenId: string): Promise<string> => {
  const sessionId = createSessionId();
  const userId = String(user._id);
  const payload: ISession = {
    userId,
    user: toSafeUser(user),
    refreshTokenId,
  };
  // TTL is set on EVERY write path (B-3).
  await redis.set(sessionKey(sessionId), JSON.stringify(payload), "EX", sessionTtlSeconds);
  await redis.sadd(userSessionIndexKey(userId), sessionId);
  await redis.expire(userSessionIndexKey(userId), sessionTtlSeconds);
  return sessionId;
};

export const getSession = async (sessionId: string): Promise<ISession | null> => {
  if (!sessionId) return null;
  const raw = await redis.get(sessionKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ISession;
  } catch {
    return null;
  }
};

// Revocation: removing the session kills every token minted for it.
export const revokeSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  const session = await getSession(sessionId);
  await redis.del(sessionKey(sessionId));
  if (session) {
    await redis.srem(userSessionIndexKey(session.userId), sessionId);
  }
};

// Revoke every session of a user (password change, role change, deletion).
// `exceptSessionId` keeps the caller's own session alive when required.
export const revokeAllSessions = async (
  userId: string,
  exceptSessionId?: string
): Promise<void> => {
  if (!userId) return;
  const indexKey = userSessionIndexKey(userId);
  const sessionIds: string[] = await redis.smembers(indexKey);
  const doomed = sessionIds.filter((id) => id !== exceptSessionId);
  if (doomed.length) {
    await redis.del(...doomed.map(sessionKey));
  }
  if (exceptSessionId) {
    // Keep the surviving session in the index.
    if (doomed.length) {
      await redis.srem(indexKey, ...doomed);
    }
  } else {
    await redis.del(indexKey);
  }
};

/**
 * Rotates the refresh token of a session: the new token id replaces the old
 * one, so a replayed (old) refresh token is detected and rejected.
 */
export const rotateSessionToken = async (
  sessionId: string,
  newRefreshTokenId: string
): Promise<void> => {
  const session = await getSession(sessionId);
  if (!session) return;
  const payload: ISession = {
    userId: session.userId,
    user: session.user,
    refreshTokenId: newRefreshTokenId,
  };
  await redis.set(sessionKey(sessionId), JSON.stringify(payload), "EX", sessionTtlSeconds);
};

// Refresh the cached projection after a profile change (keeps the TTL).
export const updateSessionUser = async (
  sessionId: string,
  user: any
): Promise<void> => {
  const session = await getSession(sessionId);
  if (!session) return;
  const payload: ISession = {
    userId: session.userId,
    user: toSafeUser(user),
    refreshTokenId: session.refreshTokenId,
  };
  await redis.set(sessionKey(sessionId), JSON.stringify(payload), "EX", sessionTtlSeconds);
};
