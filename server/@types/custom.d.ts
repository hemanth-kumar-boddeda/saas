import { ISafeUser } from "../utils/safeUser";

declare global {
    namespace Express {
        interface Request {
            // Session-scoped safe projection. Never the mongoose document:
            // it must not carry the password hash (SEC-04).
            user?: ISafeUser;
            // Session id carried by the verified access token — the revocation
            // handle used by logout (SEC-03).
            sessionId?: string;
            // Correlation id echoed in the X-Request-Id header, in the error
            // response and in the structured access log (SEC-16).
            requestId?: string;
        }
    }
}

export {};
