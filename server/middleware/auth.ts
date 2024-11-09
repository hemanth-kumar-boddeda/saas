import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";
import ErrorHandler from "../utils/ErrorHandler";

interface AuthenticatedRequest extends Request {
  user?: any;
}

// Middleware to check if the user is authenticated
export const isAuthenticated = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const accessToken = req.cookies["access_token"] || req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      throw new ErrorHandler(401, "Please login to access this resource");
    }

    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN as string) as JwtPayload;

    if (!decoded) {
      throw new ErrorHandler(401, "Invalid access token");
    }

    const user = await redis.get(decoded.id);

    if (!user) {
      throw new ErrorHandler(401, "Please login to access this resource");
    }

    req.user = JSON.parse(user);
    next();
  } catch (error) {
    next(error); // Pass the error to the error handling middleware
  }
};

// Middleware to authorize roles
export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(new ErrorHandler(403, "You are not authorized to access this resource"));
    }
    next();
  };
};
