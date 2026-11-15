// Minimal express app mounting the real routers + real error middleware,
// so HTTP-level tests exercise the actual guards (isAuthenticated,
// authorizeRoles, rate limits) rather than controllers in isolation.
import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "../../routes/auth.route";
import userRouter from "../../routes/user.route";
import videoRouter from "../../routes/video.route";
import orderRouter from "../../routes/order.route";
import notificationRouter from "../../routes/notification.route";
import { ErrorMiddleware } from "../../middleware/error";

export const buildTestApp = () => {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use("/v1/auth/", authRouter);
  app.use("/v1/users/", userRouter);
  app.use("/v1/videos/", videoRouter);
  app.use("/v1/orders/", orderRouter);
  app.use("/v1/notifications/", notificationRouter);
  app.use(ErrorMiddleware);
  return app;
};
