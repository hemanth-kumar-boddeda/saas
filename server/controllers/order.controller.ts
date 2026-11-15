import ejs from "ejs";
import { NextFunction, Request, Response } from "express";
import path from "path";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import NotificationModel from "../models/notification.model";
import { IOrder } from "../models/order.model";
import userModel from "../models/user.model";
import VideoModel from "../models/video.model";
import { IVideo } from "../models/video.model";
import { getAllOrdersService, newOrder } from "../services/order.service";
import ErrorHandler from "../utils/ErrorHandler";
import { updateSessionUser } from "../utils/session";
import sendMail from "../utils/sendMail";
require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
//create order
export const createOrder = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { videoId, payment_info } = req.body as IOrder;

      if (payment_info) {
        if ("id" in payment_info) {
          const paymentIntentId = payment_info.id;
          const paymentIntent = await stripe.paymentIntents.retrieve(
            paymentIntentId
          );

          if (paymentIntent.status !== "succeeded") {
            return next(new ErrorHandler( 400,"Payment not authorized"));
          }
        }
      }

      const userId = req.user?._id;
      const sessionId = req.sessionId;
      if (!userId || !sessionId) {
        return next(new ErrorHandler(401, "Please login to access this resource"));
      }

      const user = await userModel.findById(userId);
      if (!user) {
        return next(new ErrorHandler(404, "User not found"));
      }

      const videoExistsInUser = user?.videos.some(
        (video: any) => video._id.toString() === videoId
      );

      if (videoExistsInUser) {
        return next(
          new ErrorHandler( 400,"You have already purchased this video.")
        );
      }

      const video: IVideo | null = await VideoModel.findById(videoId);

      if (!video) {
        return next(new ErrorHandler( 400,"Video not found."));
      }

      const data: any = {
        videoId: video._id,
        userId: user?._id,
        payment_info,
      };

      const mailData = {
        order: {
          _id: video._id.toString().slice(0, 6),
          name: video.name,
          price: video.price,
          date: new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        },
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/order_confirmation.ejs"),
        { order: mailData }
      );

      try {
        if (user) {
          await sendMail({
            email: user.email,
            subject: "Order Confirmation!",
            template: "order_confirmation.ejs",
            data: mailData,
          });
        }
      } catch (err: any) {
        return next(new ErrorHandler(500, err.message));
      }
      user?.videos.push(video?._id);

      await user?.save();
      await updateSessionUser(sessionId, user);

      await NotificationModel.create({
        user: user?._id,
        title: "New Order",
        message: `You have a new order from ${video?.name}`,
      });

      video.purchased = (video.purchased ?? 0) + 1;

      await video.save();

      newOrder(data, res, next);
    } catch (err: any) {
      return next(new ErrorHandler(500, err.message));
    }
  }
);

//get all orders
export const getAllOrders = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllOrdersService(res);
    } catch (err: any) {
      return next(new ErrorHandler(500, err.message));
    }
  }
);

//sent strip publishable key
export const sendStripePublishableKey = CatchAsyncError(
  async (req: Request, res: Response) => {
    res.status(200).json({
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  }
);

//new payment
export const newPayment = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const myPayment = await stripe.paymentIntents.create({
        amount: req.body.amount,
        currency: "inr",
        metadata: {
          company: "VIDTOUCH",
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res
        .status(201)
        .json({ success: true, client_secret: myPayment.client_secret });
    } catch (error: any) {
      return next(new ErrorHandler(500, error.message));
    }
  }
);
