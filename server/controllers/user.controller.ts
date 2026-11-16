import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import cloudinary from "cloudinary";
import sendMail from "../utils/sendMail";
import {
  ACCESS_COOKIE,
  accessTokenOptions,
  REFRESH_COOKIE,
  refreshTokenOptions,
  signAccessToken,
  signRefreshToken,
  newTokenId,
  sendToken,
  clearAuthCookies,
} from "../utils/jwt";
import {
  getSession,
  revokeSession,
  rotateSessionToken,
  updateSessionUser,
} from "../utils/session";
import { toSafeUser } from "../utils/safeUser";
import { redis } from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.service";
import { OAuth2Client } from "google-auth-library";
import { maybeBootstrapPlatformAdmin } from "../utils/bootstrap";

require("dotenv").config();

// SEC-01: one Google OAuth client, server-side. verifyIdToken checks the
// signature, issuer, audience and expiry of the ID token; we additionally
// require a provider-verified e-mail before any account is resolved.
const getGoogleClient = (): OAuth2Client => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return new OAuth2Client(clientId);
};

// SEC-02: audited platform-admin bootstrap after a verified login only.
const applyPlatformAdminBootstrap = async (user: any): Promise<void> => {
  if (user.role === "admin") return;
  if (!maybeBootstrapPlatformAdmin(user.email)) return;
  user.role = "admin";
  await user.save();
  // Audit trail until the Phase 2 audit_event table exists.
  console.log(
    JSON.stringify({
      event: "platform_admin_bootstrap",
      userId: String(user._id),
      at: new Date().toISOString(),
    })
  );
};

//register user
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}
export const registrationUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;

      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler( 400,"Email already exists!"));
      }

      const user: IRegistrationBody = {
        name,
        email,
        password,
      };

      const activeToken = createActiveToken(user);
      const activeCode = activeToken.activeCode;

      const data = {
        user: { name: user.name },
        activeCode,
        ttlMinutes: 5,
      };

      try {
        await sendMail({
          email: user.email,
          subject: "Active your account 🔑",
          template: "activation-mail.ejs",
          data,
        });
        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.email} to activate your account!`,
          activeToken: activeToken.token,
        });
      } catch (err: any) {
        return next(new ErrorHandler(400,err.message));
      }
    } catch (err:any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

interface IActiveToken {
  token: string;
  activeCode: string;
}

export const createActiveToken = (user: any): IActiveToken => {
  const activeCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    { user, activeCode },
    process.env.ACTIVE_TOKEN_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );
  return { token, activeCode };
};

//active user
interface IActiveRequest {
  active_token: string;
  active_code: string;
}

export const activeUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { active_token, active_code } = req.body as IActiveRequest;
      const newUser: { user: IUser; activeCode: string } = jwt.verify(
        active_token,
        process.env.ACTIVE_TOKEN_SECRET as string
      ) as { user: IUser; activeCode: string };

      if (newUser.activeCode !== active_code) {
        return next(new ErrorHandler(400,"Invalid active code"));
      }
      const { name, email, password } = newUser.user;
      const existUser = await userModel.findOne({ email });
      if (existUser) {
        return next(new ErrorHandler(400,"Email already exists"));
      }
      const user = await userModel.create({ name, email, password });
      res.status(201).json({ success: true, user: toSafeUser(user) });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

//login user
interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      if (!email || !password) {
        return next(new ErrorHandler(400,"Please enter email and password"));
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler(400,"Invalid email or password"));
      }

      const validPassword = await user.comparePassword(password);

      if (!validPassword) {
        return next(new ErrorHandler(400,"Invalid email or password"));
      }

      await applyPlatformAdminBootstrap(user);

      await sendToken(user, 200, res);
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

//logout user
export const logoutUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.sessionId) {
        return next(new ErrorHandler(401, "Please login to access this resource"));
      }

      await revokeSession(req.sessionId);
      clearAuthCookies(res);

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

//generate new access token
const createAccessTokenMiddleware = (forceRefresh = false) =>
  CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!forceRefresh) {
        const accessToken =
          req.cookies?.[ACCESS_COOKIE] ||
          req.headers.authorization?.split(" ")[1];
        if (accessToken) {
          try {
            jwt.verify(accessToken, process.env.ACCESS_TOKEN as string);
            return next();
          } catch {
            // Use the refresh token when the access token is invalid or expired.
          }
        }
      }

      const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      // Missing refresh token is an authentication failure, not a bad request.
      if (!refreshToken) {
        return next(new ErrorHandler(401, "Please login to access this resource"));
      }

      let decoded: JwtPayload;
      try {
        decoded = jwt.verify(
          refreshToken,
          process.env.REFRESH_TOKEN as string
        ) as JwtPayload;
      } catch {
        return next(new ErrorHandler(401, "Invalid or expired refresh token"));
      }

      if (!decoded.id || !decoded.sid || !decoded.jti) {
        return next(
          new ErrorHandler(401, "Invalid or expired refresh token")
        );
      }

      const sessionId = String(decoded.sid);
      const session = await getSession(sessionId);
      if (
        !session ||
        session.userId !== String(decoded.id) ||
        session.refreshTokenId !== String(decoded.jti)
      ) {
        return next(new ErrorHandler(401, "Invalid or expired refresh token"));
      }

      const tokenId = newTokenId();
      await rotateSessionToken(sessionId, tokenId);
      const accessToken = signAccessToken(session.userId, sessionId);
      const rotatedRefreshToken = signRefreshToken(
        session.userId,
        sessionId,
        tokenId
      );
      res.cookie(
        ACCESS_COOKIE,
        accessToken,
        accessTokenOptions
      );
      res.cookie(
        REFRESH_COOKIE,
        rotatedRefreshToken,
        refreshTokenOptions
      );
      req.cookies[ACCESS_COOKIE] = accessToken;
      req.cookies[REFRESH_COOKIE] = rotatedRefreshToken;
      req.user = session.user;
      req.sessionId = sessionId;

      next();
    } catch (err: any) {
      return next(err);
    }
    }
  );

export const generateAccessToken = createAccessTokenMiddleware();
export const refreshAccessToken = createAccessTokenMiddleware(true);

//get user info
export const getUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user?._id) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }

      return res.status(200).json({ success: true, user });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

//social auth — SEC-01: identity comes from a provider-verified Google ID
//token only. The browser can never assert an e-mail, name or avatar.
interface ISocialAuthBody {
  idToken?: string;
}

export const socialAuth = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { idToken } = req.body as ISocialAuthBody;

      if (!idToken || typeof idToken !== "string") {
        return next(new ErrorHandler(401, "Invalid social login request"));
      }
      if (!process.env.GOOGLE_CLIENT_ID) {
        // Fail closed while the owner has not configured Google credentials.
        return next(new ErrorHandler(503, "Social login is not configured"));
      }

      let payload;
      try {
        const ticket = await getGoogleClient().verifyIdToken({
          idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch {
        // Bad signature, wrong audience, expired token, malformed JWT, ...
        return next(new ErrorHandler(401, "Social login failed"));
      }

      if (!payload || !payload.sub || !payload.email) {
        return next(new ErrorHandler(401, "Social login failed"));
      }
      if (payload.email_verified !== true) {
        return next(new ErrorHandler(403, "E-mail not verified by provider"));
      }

      const email = payload.email.toLowerCase();

      // Resolve by provider subject first, then link to an existing account
      // that owns the same provider-verified e-mail.
      let user = await userModel.findOne({ googleId: payload.sub });
      if (!user) {
        const byEmail = await userModel.findOne({ email });
        if (byEmail) {
          if (byEmail.googleId && byEmail.googleId !== payload.sub) {
            return next(
              new ErrorHandler(403, "Social account conflict")
            );
          }
          byEmail.googleId = payload.sub;
          await byEmail.save();
          user = byEmail;
        }
      }

      if (!user) {
        // Never privileged: role comes from the schema default only.
        user = await userModel.create({
          name: payload.name || email,
          email,
          googleId: payload.sub,
          avatar: { url: payload.picture || "" },
          isVerified: true,
        });
      }

      await applyPlatformAdminBootstrap(user);

      await sendToken(user, 200, res);
    } catch (err: any) {
      return next(new ErrorHandler(401, "Social login failed"));
    }
  }
);

//update user info
interface IUpdateUserInfo {
  name?: string;
  email?: string;
}

export const updateUserInfo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as IUpdateUserInfo;
      const userId = req.user?._id;
      if (!userId || !req.sessionId) {
        return next(new ErrorHandler(401, "Please login to access this resource"));
      }
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler(404, "User not found"));
      }

      // if (email && user) {
      //   const isEmailExist = await userModel.findOne({ email });
      //   if (isEmailExist) {
      //     return next(new ErrorHandler("Email already exists", 400));
      //   }
      //   user.email = email;
      // }

      if (name && user) {
        user.name = name;
      }

      await user.save();
      await updateSessionUser(req.sessionId, user);

      res.status(201).json({ success: true, user: toSafeUser(user) });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

//update user password
interface IUpdateUserPassword {
  oldPassword: string;
  newPassword: string;
}

export const updateUserPassword = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdateUserPassword;
      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler(400,"Please enter old and new password"));
      }
      if (!req.user?._id || !req.sessionId) {
        return next(new ErrorHandler(401, "Please login to access this resource"));
      }
      const user = await userModel.findById(req.user._id).select("+password");
      if (user?.password === undefined) {
        return next(new ErrorHandler(400,"Invalid user"));
      }
      const isPasswordMatch = await user?.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler(400,"Invalid old password"));
      }
      user.password = newPassword;
      await user.save();
      await updateSessionUser(req.sessionId, user);

      res.status(201).json({ success: true, user: toSafeUser(user) });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);

//update user avatar
interface IUpdateUserAvatar {
  avatar: string;
}

export const updateUserAvatar = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body as IUpdateUserAvatar;
      const userId = req?.user?._id;
      if (!userId || !req.sessionId) {
        return next(new ErrorHandler(401, "Please login to access this resource"));
      }
      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler(404, "User not found"));
      }
      if (avatar && user) {
        //if user have one avatar then call this if
        if (user?.avatar?.public_id) {
          //first delete the old avatar
          await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        } else {
          const myCloud = await cloudinary.v2.uploader.upload(avatar, {
            folder: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myCloud.public_id,
            url: myCloud.secure_url,
          };
        }
      }
      await user.save();
      await updateSessionUser(req.sessionId, user);
      res.status(201).json({ success: true, user: toSafeUser(user) });
    } catch (err: any) {
      return next(new ErrorHandler(400, err.message));
    }
  }
);

//get all users
export const getAllUsers = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllUsersService(res);
    } catch (err: any) {
      return next(new ErrorHandler(400, err.message));
    }
  }
);

//update user role
export const updateUserRole = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.body;
      // SEC-02: role values are a closed set — no arbitrary privilege strings.
      if (!["admin", "user"].includes(role)) {
        return next(new ErrorHandler(400, "Invalid role"));
      }
      updateUserRoleService(res, id, role);
    } catch (err: any) {
      return next(new ErrorHandler(400, err.message));
    }
  }
);

//delete user --only admin
export const deleteUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);

      if (!user) {
        return next(new ErrorHandler(404,"User not found"));
      }

      await user.deleteOne({ id });

      await redis.del(id);

      res
        .status(200)
        .json({ success: true, message: "User deleted successfully!" });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);
