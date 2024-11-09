import axios from "axios";
import cloudinary from "cloudinary";
import ejs from "ejs";
import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import path from "path";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import NotificationModel from "../models/notification.model";
import VideoModel from "../models/video.model";
import { createVideo, getAllVideoService } from "../services/video.service";
import ErrorHandler from "../utils/ErrorHandler";
import { redis } from "../utils/redis";
import sendEmail from "../utils/sendMail";


//upload video
export const uploadVideo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "videos",
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      createVideo(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//update video
export const updateVideo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      const videoId = req.params.id;
      const videoData = await VideoModel.findById(videoId) as any;
      if (thumbnail && !thumbnail.startsWith("https")) {
        await cloudinary.v2.uploader.destroy(videoData.thumbnail.public_id);
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "videos",
        });
        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      if(thumbnail.startsWith("https")){
        data.thumbnail = {
          public_id: videoData?.thumbnail.public_id,
          url:videoData?.thumbnail.url,
        };
      }
    
      const video = await VideoModel.findByIdAndUpdate(
        videoId,
        {
          $set: data,
        },
        {
          new: true,
        }
      );
      res.status(201).json({
        success: true,
        video,
      });
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//get single video --- without purchase
export const getSingleVideo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const videoId = req.params.id;
      const isCacheExist = await redis.get(videoId);
      if (isCacheExist) {
        const video = JSON.parse(isCacheExist);
        return res.status(200).json({
          success: true,
          video,
        });
      }
      const video = await VideoModel.findById(req.params.id).select(
        "-videoData.videoUrl -videoData.suggestions -videoData.questions"
      );

      await redis.set(videoId, JSON.stringify(video),'EX', 604800);
      res.status(200).json({
        success: true,
        video,
      });
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//get all videos

export const getAllVideos = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
        const isCacheExist = await redis.get("allVideos");
        if(isCacheExist){
        const videos = JSON.parse(isCacheExist);

        
        res.status(200).json({
          success: true,
          videos,
        });
      }else{
        let query: any ={};
        if (req.query.category){
          query={categories: req.query.category};
        }
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = req.query.limit as any;
        const skip = (page - 1) * limit;
        const videos = await VideoModel.find(query)
        .sort({_id: -1})
        .select(
          "-videoData.videoUrl -videoData.suggestion -videoData.questions -videoData.links" 
        )
        .skip(skip)
        .limit(limit);
        // await redis.set("allVideos", JSON.stringify(videos));
        const totalVideos = await VideoModel.countDocuments(query);
        const totalPages = Math.ceil(totalVideos / limit);
        res.status(200).json({ 
          success: true,
          videos,
          pagination: {
            currentPage: page,
            totalPages,
            totalVideos,
          },
        });
      }
      }
     catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//get vide content - only for valid user

export const getVideoByUser = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userVideoList = req.user?.videos;
      const videoId = req.params.id;

      const videoExists = userVideoList?.find(
        (video: any) => video._id.toString() === videoId
      );
      if (!videoExists) {
        return next(new ErrorHandler(400, "Video does not exist"));
      }
      const video = await VideoModel.findById(videoId);
      const content = video?.videoData;
      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//add question in video
interface IAddQuestionData {
  question: string;
  videoId: string;
  contentId: string;
}

export const addQuestion = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, videoId, contentId }: IAddQuestionData = req.body;
      const video = await VideoModel.findById(videoId);
      if (!mongoose.Types.ObjectId.isValid(videoId)) {
        return next(new ErrorHandler(404, "Video not found"));
      }
      const videoContent = video?.videoData?.find((item: any) =>
        item._id.equals(contentId)
      );

      if (!videoContent) {
        return next(new ErrorHandler(404, "Video content not found"));
      }

      //create a new question object
      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      videoContent.questions.push(newQuestion);

      await NotificationModel.create({
        user: req.user?._id,
        title: "New Question",
        message: `You have received a new question from ${videoContent.title}`,
      });
      await video?.save();

      res.status(200).json({
        success: true,
        video,
      });
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//add answer to question

interface IAddAnswerData {
  answer: string;
  videoId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, videoId, contentId, questionId }: IAddAnswerData =
        req.body;

      const video = await VideoModel.findById(videoId);

      if (!mongoose.Types.ObjectId.isValid(videoId)) {
        return next(new ErrorHandler(404, "Video not found"));
      }
      const videoContent = video?.videoData?.find((item: any) =>
        item._id.equals(contentId)
      );

      if (!videoContent) {
        return next(new ErrorHandler(404, "Video content not found"));
      }

      const question = videoContent.questions.find((item: any) =>
        item._id.equals(questionId)
      );

      if (!question) {
        return next(new ErrorHandler(404, "Question not found"));
      }

      const newAnswer: any = {
        user: req.user,
        answer,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      question.questionReplies.push(newAnswer);

      await video?.save();

      if (req.user?._id === question.user._id) {
        await NotificationModel.create({
          user: req.user?._id,
          title: "New Reply",
          message: `You have received a new reply from ${videoContent.title}`,
        })
      } else {
        const data = {
          name: question.user.name,
          title: videoContent.title,
        };

        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );

        try {
          await sendEmail({
            email: question.user.email,
            subject: "Question Reply",
            template: "question-reply.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(400, error.message));
        }
      }
      res.status(201).json({
        success: true,
        video,
      });
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//add review to video

interface IAddReviewData {
  
  review: string;
  rating: number;
  userId: string;
}

export const addReview = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userVideoList = req.user?.videos;
      const videoId = req.params.id;

      const videoExists = userVideoList?.some(
        (video: any) => video._id.toString() === videoId.toString()
      );

      if (!videoExists) {
        return next(new ErrorHandler(404, "Video not found"));
      }
      const video = await VideoModel.findById(videoId);
      const { review, rating } = req.body as IAddReviewData;
      const reviewData: any = {
        user: req.user,
        comment: review,
        rating,
      };

      video?.reviews.push(reviewData);

      let avg = 0;
      video?.reviews.forEach((review: any) => {
        avg += review.rating;
      });
      if (video) {
        video.ratings = avg / video.reviews.length;
      }

      await video?.save();

    await NotificationModel.create({
      user:req.user?._id,
      title:"New Review received",
      message:`${req.user?.name} has given a review in ${video?.name}`,
    })

      //create notification

      res.status(200).json({
        success: true,
        video,
      });
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);

//add reply in review

interface IAddReviewData {
  comment: string;
  videoId: string;
  reviewId: string;
}

export const addReplyToReview = CatchAsyncError(
  async (req: any, res: Response, next: NextFunction) => {
    try {
      const { comment, videoId, reviewId } = req.body as IAddReviewData;

      const video = await VideoModel.findById(videoId);

      if (!video) {
        return next(new ErrorHandler(404, "Video not found"));
      }

      const review = video?.reviews.find(
        (review) => review._id.toString() === reviewId
      );

      if (!review) {
        return next(new ErrorHandler(404, "Review not found"));
      }

      const replyData: any = {
        user: req.user,
        comment,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (!review.commentReplies) {
        review.commentReplies = [];
      }
      review.commentReplies?.push(replyData);

      await video?.save();

      if(req.user?._id === review.user._id){

      await NotificationModel.create({
        user:req.user?._id,
        title: "New Review Reply Received",
        message:`You have a new review reply in ${video.name}`,
      });
    }else{
      const data = {
        name:review.user.name,
        title:video.name
      };

      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/review_reply.ejs"),
        data
      );
      try {
        await sendEmail({
          email: review.user.email,
          subject:"Review reply",
          template: "review_reply.ejs",
          data,
        });
    } catch(err: any){
      return next(new ErrorHandler(400, err.message));
    }
  }
      res.status(201).json({
        success: true,
        video,
      });
    } catch (err: any) {
      return next(new ErrorHandler(400, err.message));
    }
  }
);


export const getAllVideoAdmin = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      getAllVideoService(res);
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
);
export const deleteVideo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;

      const video = await VideoModel.findById(id);

      if (!video) {
        return next(new ErrorHandler(400,"Video not found"));
      }

      await video.deleteOne({ id });

      await redis.del(id);

      res.status(200).json({
        success: true,
        message: "Video deleted successfully!",
      });
    } catch (err: any) {
      return next(new ErrorHandler(400,err.message));
    }
  }
);
export const generateVideoUrl = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {videoId} = req.body;
      const response = await axios.post(
        `https://dev.vdocipher.com/api/videos/${videoId}/otp`,
        {ttl: 300},
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Apisecret ${process.env.VDOCIPHER_API_KEY}`,
          },
        }
      );
      res.json(response.data);
    } catch (error: any) {
      return next(new ErrorHandler(400, error.message));
    }
  }
)

export const searchVideo = CatchAsyncError(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 10;
      const skip = (page - 1) * limit;
      const searchParams = (req.query.title as string) || "";
      const decodedSearchParams = decodeURIComponent(searchParams);
      const searchQuery = {
        // Define your search criteria based on your VideoModel schema
        name: {
          $regex: new RegExp(
            decodedSearchParams.replace(/\s/g, "\\s*").split(" ").join("\\s*"),
            "i"
          ),
        },
      };

      const videos = await VideoModel.find(searchQuery)
        .select(
          "-videoData.videoUrl -videoData.suggestion -videoData.questions -videoData.links"
        )
        .skip(skip)
        .limit(limit);

      // Fetch total videos count based on the search filter
      const totalVideos = await VideoModel.countDocuments(searchQuery);

      const totalPages = Math.ceil(totalVideos / limit);

      res.status(200).json({
        success: true,
        videos,
        pagination: {
          currentPage: page,
          totalPages,
          totalVideos,
        },
      });
    } catch (err: any) {
      return next(new ErrorHandler(500,err.message));
    }
  }
);