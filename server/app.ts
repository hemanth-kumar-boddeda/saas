// // app.ts

// import express, { Request, Response, NextFunction } from 'express';
// import cors from 'cors';
// import cookieParser from 'cookie-parser';
// import { ErrorMiddleware } from "./middleware/error";
// require("dotenv").config();

// // Import all routers
// import userRouter from './routes/user.route';
// import videoRouter from './routes/video.route';
// import orderRouter from './routes/order.route';
// import notificationRouter from './routes/notification.route';
// import analyticsRouter from './routes/analytics.route';
// import layoutRouter from './routes/layout.route';
// import authRouter from './routes/auth.route'; // Import authRouter

// export const app = express();

// // Middleware setup
// app.use(cors({
//     origin: ['http://localhost:3000'],
//     credentials: true,
// }));

// app.use(express.json({ limit: '50mb' }));
// app.use(cookieParser());

// // Mount authRouter to /api/v1/auth
// app.use("/api/v1/auth", authRouter);

// // Mount other routers to /api/v1/
// app.use("/api/v1/", userRouter, orderRouter, videoRouter, notificationRouter, analyticsRouter, layoutRouter);

// // Test route
// app.get('/test', (req: Request, res: Response, next: NextFunction) => {
//     res.status(200).json({
//         success: true,
//         message: 'Server is up and running',
//     });
// });

// // Handle undefined routes
// app.all('*', (req: Request, res: Response, next: NextFunction) => {
//     const error = new Error(`Route ${req.originalUrl} not found`) as any;
//     error.statusCode = 404;
//     next(error);
// });

// // Error handling middleware
// app.use(ErrorMiddleware);
