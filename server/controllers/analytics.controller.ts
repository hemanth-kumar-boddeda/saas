import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import OrderModel from "../models/order.model";
import userModel from "../models/user.model";
import VideoModel from "../models/video.model";
import { generateLast12MonthsData } from "../utils/analytics.generator";
import ErrorHandler from "../utils/ErrorHandler";

//user analytics
export const getUserAnalytics = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await generateLast12MonthsData(userModel);

      res.status(200).json({
        success: true,
        users,
      });
    } catch (error: any) {
      return next(new ErrorHandler(500, error.message));
    }
  }
);

export const getVideosAnalytics = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const videos = await generateLast12MonthsData(VideoModel);
  
        res.status(200).json({
          success: true,
          videos,
        });
      } catch (error: any) {
        return next(new ErrorHandler(500, error.message));
      }
    }
  );
  

  export const getOrdersAnalytics = CatchAsyncError(
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const orders = await generateLast12MonthsData(OrderModel);
  
        res.status(200).json({
          success: true,
          orders,
        });
      } catch (error: any) {
        return next(new ErrorHandler(500, error.message));
      }
    }
  );
  