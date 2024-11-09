import { Response } from "express";
import VideoModel from "../models/video.model";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";

//create video
export const createVideo = CatchAsyncError(
  async (data: any, res: Response) => {
    const video = await VideoModel.create(data);
    res.status(201).json({ success: true, video });
  }
);

//get all videos
export const getAllVideoService = async (res: Response) => {
  const videos = await VideoModel.find().sort({ createdAt: -1 });
  res.status(201).json({ success: true, videos });
};