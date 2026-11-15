// auth.route.ts

import express from "express";
import {
  activeUser,
  generateAccessToken,
  getUserInfo,
  loginUser,
  logoutUser,
  registrationUser,
  refreshAccessToken,
  socialAuth,
} from "../controllers/user.controller";
import { isAuthenticated } from "../middleware/auth";

const authRouter = express.Router();

authRouter.post("/registration", registrationUser);
authRouter.post("/active-user", activeUser);
authRouter.post("/login", loginUser);
authRouter.get("/logout", generateAccessToken, isAuthenticated, logoutUser);
authRouter.get("/refresh-token", refreshAccessToken, (_req, res) => {
  res.status(200).json({ success: true });
});
authRouter.get("/me", generateAccessToken, isAuthenticated, getUserInfo);
authRouter.post("/social-auth", socialAuth);

export default authRouter;
