// SEC-03 — session-aware authentication.
//
// The signed JWT is only half of the credential: every request is also
// checked against the server-side session store, so a revoked session (logout,
// rotation, password change, account deletion) invalidates every token that
// was minted for it.
import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler";
import { getSession } from "../utils/session";
import { verifyAccessToken } from "../utils/jwt";

// Middleware to check if the user is authenticated
export const isAuthenticated = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken =
      req.cookies?.["access_token"] || req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      throw new ErrorHandler(401, "Please login to access this resource");
    }

    let decoded: JwtPayload;
    try {
      decoded = verifyAccessToken(accessToken) as JwtPayload;
    } catch {
      // Bad signature, expired token, malformed token: all unauthenticated.
      throw new ErrorHandler(401, "Invalid or expired access token");
    }

    if (!decoded?.id || !decoded?.sid) {
      throw new ErrorHandler(401, "Invalid access token");
    }

    // The session store is the authoritative revocation point.
    const session = await getSession(String(decoded.sid));
    if (!session) {
      throw new ErrorHandler(401, "Please login to access this resource");
    }
    if (String(session.userId) !== String(decoded.id)) {
      throw new ErrorHandler(401, "Invalid access token");
    }

    req.user = session.user;
    req.sessionId = String(decoded.sid);
    next();
  } catch (error) {
    next(error); // Pass the error to the error handling middleware
  }
};

// Middleware to authorize roles
// SEC-02: authorization depends ONLY on the persisted role loaded server-side.
// There is no e-mail bypass; platform-admin bootstrap lives in utils/bootstrap.ts
// and is applied only after a verified login, never inside this gate.
export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || "";

    if (!roles.includes(userRole)) {
      return next(new ErrorHandler(403, "You are not authorized to access this resource"));
    }
    next();
  };
};
