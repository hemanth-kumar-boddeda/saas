import express from "express";
import {
  deleteUser,
  generateAccessToken,
  getAllUsers,
  updateAvatar,
  updateUserInfo,
  updateUserPassword,
  updateUserRole,
} from "../controllers/user.controller";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";

const userRouter = express.Router();



userRouter.put("/update-user-info", generateAccessToken, isAuthenticated, updateUserInfo);
userRouter.put("/update-user-password", generateAccessToken, isAuthenticated, updateUserPassword);
userRouter.put("/update-user-avatar", generateAccessToken, isAuthenticated, updateuserAvatar);

// Admin Routes
userRouter.get("/get-users", generateAccessToken, isAuthenticated, authorizeRoles("admin"), getAllUsers);
userRouter.put("/update-user-role", generateAccessToken, isAuthenticated, authorizeRoles("admin"), updateUserRole);
userRouter.delete("/delete-user/:id", generateAccessToken, isAuthenticated, authorizeRoles("admin"), deleteUser);

export default userRouter;
