import express from "express";
import { authorizeRoles, isAuthenticated } from "../middleware/auth";
import { getOrdersAnalytics, getUserAnalytics, getVideosAnalytics } from "../controllers/analytics.controller";
import { generateAccessToken } from "../controllers/user.controller";


const analyticsRouter = express.Router();

analyticsRouter.get("/get-users-analytics",generateAccessToken, isAuthenticated,authorizeRoles("admin"), getUserAnalytics);

analyticsRouter.get("/get-orders-analytics",generateAccessToken, isAuthenticated,authorizeRoles("admin"), getOrdersAnalytics);

analyticsRouter.get("/get-videos-analytics",generateAccessToken, isAuthenticated,authorizeRoles("admin"), getVideosAnalytics);

export default analyticsRouter;