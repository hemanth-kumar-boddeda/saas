import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { ErrorMiddleware } from "./middleware/error";
import userRouter from "./routes/user.route";
import authRouter from "./routes/auth.route";
import reviewRouter from "./routes/review.route";
import publishKitRouter from "./routes/publishkit.route";
import { startKitWorker } from "./jobs/publishKit";
import socialRouter from "./routes/social.route";
import { startPublishWorker } from "./jobs/publish";
import http from "http";
import { allowedOrigins } from "./config/env";

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const server = http.createServer(app);

// Body parser
app.use(express.json({ limit: "1mb" }));

// CORS (Cross-Origin Resource Sharing)
app.use(
  cors({
    origin: allowedOrigins(),
    credentials: true,
  })
);

// Cookie parser
app.use(cookieParser());

// Connect to MongoDB with error handling
const connectDB = async () => {
  const dbUrl = process.env.DB_URL;
  if (!dbUrl) {
    throw new Error("DB_URL is not defined in the environment variables");
  }

  try {
    await mongoose.connect(dbUrl).then(() => {
      console.log("Connected to MongoDB");
    });
  } catch (error) {
    console.error("Error connecting to MongoDB", error);
    setTimeout(connectDB, 3000); // Retry connection after 3 seconds
  }
};

// Cloudinary config with environment variable checks
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME || "", // Provide a default value if needed
  api_key: process.env.CLOUD_API_KEY || "",
  api_secret: process.env.CLOUD_SECRET_KEY || "",
});

// Routes
app.use("/v1/auth/", authRouter);
app.use("/v1/users/", userRouter);
app.use("/v1/", reviewRouter);
app.use("/v1/", publishKitRouter);
app.use("/v1/", socialRouter);

app.get("/", (req: Request, res: Response) => {
  return res.send("Express Typescript on Vercel");
});

app.get("/ping", (req: Request, res: Response) => {
  return res.send("pong 🏓");
});

// Error middleware
app.use(ErrorMiddleware);

// Initialize Socket.io server

// Connect to server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}!`);
  connectDB();
  startKitWorker();
  startPublishWorker();
});
