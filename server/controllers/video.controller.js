"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchVideo = exports.generateVideoUrl = exports.deleteVideo = exports.getAllVideoAdmin = exports.addReplyToReview = exports.addReview = exports.addAnswer = exports.addQuestion = exports.getVideoByUser = exports.getAllVideos = exports.getSingleVideo = exports.updateVideo = exports.uploadVideo = void 0;
const ejs_1 = __importDefault(require("ejs"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
const ErrorHandler_1 = __importDefault(require("../utils/ErrorHandler"));
const cloudinary_1 = __importDefault(require("cloudinary"));
const video_service_1 = require("../services/video.service");
const video_model_1 = __importDefault(require("../models/video.model"));
const redis_1 = require("../utils/redis");
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const sendMail_1 = __importDefault(require("../utils/sendMail"));
const notification_model_1 = __importDefault(require("../models/notification.model"));
const axios_1 = __importDefault(require("axios"));
//upload video
exports.uploadVideo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        if (thumbnail) {
            const myCloud = await cloudinary_1.default.v2.uploader.upload(thumbnail, {
                folder: "videos",
            });
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            };
        }
        (0, video_service_1.createVideo)(data, res, next);
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
//update video
exports.updateVideo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const data = req.body;
        const thumbnail = data.thumbnail;
        const videoId = req.params.id;
        const videoData = (await video_model_1.default.findById(videoId));
        if (thumbnail && !thumbnail.startsWith("https")) {
            await cloudinary_1.default.v2.uploader.destroy(videoData.thumbnail.public_id);
            const myCloud = await cloudinary_1.default.v2.uploader.upload(thumbnail, {
                folder: "videos",
            });
            data.thumbnail = {
                public_id: myCloud.public_id,
                url: myCloud.secure_url,
            };
        }
        if (thumbnail.startsWith("https")) {
            data.thumbnail = {
                public_id: videoData?.thumbnail.public_id,
                url: videoData?.thumbnail.url,
            };
        }
        const video = await video_model_1.default.findByIdAndUpdate(videoId, {
            $set: data,
        }, {
            new: true,
        });
        res.status(201).json({ success: true, video });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
//get single video --without purchasing
exports.getSingleVideo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const videoId = req.params.id;
        const isCacheExist = await redis_1.redis.get(videoId);
        if (isCacheExist) {
            const video = JSON.parse(isCacheExist);
            res.status(200).json({ success: true, video });
        }
        else {
            const video = await video_model_1.default.findById(videoId).select("-videoData.videoUrl -videoData.suggestion -videoData.questions, -videoData.links");
            // await redis.set(videoId, JSON.stringify(video), "EX", 604800); //7days
            res.status(200).json({ success: true, video });
        }
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
//get all videos --without purchasing
exports.getAllVideos = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const isCacheExist = await redis_1.redis.get("allVideos");
        if (isCacheExist) {
            const videos = JSON.parse(isCacheExist);
            res.status(200).json({ success: true, videos });
        }
        else {
            let query = {};
            if (req.query.category) {
                query = { categories: req.query.category };
            }
            const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not specified
            const limit = req.query.limit;
            const skip = (page - 1) * limit;
            const videos = await video_model_1.default.find(query)
                .sort({ _id: -1 })
                .select("-videoData.videoUrl -videoData.suggestion -videoData.questions, -videoData.links")
                .skip(skip)
                .limit(limit);
            // await redis.set("allVideos", JSON.stringify(videos));
            // Send the fetched videos as the response along with pagination metadata
            const totalVideos = await video_model_1.default.countDocuments(query); // Get total number of videos
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
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
//get video content --only for valid user
exports.getVideoByUser = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userVideoList = req.user?.videos;
        const videoId = req.params.id;
        const videoExists = userVideoList?.find((video) => video._id.toString() === videoId);
        if (!videoExists) {
            return next(new ErrorHandler_1.default("You are not eligible to access this video.", 404));
        }
        const video = await video_model_1.default.findById(videoId);
        const content = video?.videoData;
        res.status(200).json({
            success: true,
            content,
        });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
exports.addQuestion = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { question, videoId, contentId } = req.body;
        const video = await video_model_1.default.findById(videoId);
        if (!mongoose_1.default.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const videoContent = video?.videoData?.find((item) => item._id.equals(contentId));
        if (!videoContent) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        //create new question object
        const newQuestion = {
            user: req.user,
            question,
            questionReplies: [],
        };
        //add this question to our video content
        videoContent.questions.push(newQuestion);
        //create notification
        await notification_model_1.default.create({
            user: req.user?._id,
            title: "New Question Received!",
            message: `You have a new question in ${videoContent.title}`,
        });
        //save and update video
        await video?.save();
        res.status(200).json({
            success: true,
            video,
        });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
exports.addAnswer = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { answer, videoId, contentId, questionId } = req.body;
        const video = await video_model_1.default.findById(videoId);
        if (!mongoose_1.default.Types.ObjectId.isValid(contentId)) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const videoContent = video?.videoData?.find((item) => item._id.equals(contentId));
        if (!videoContent) {
            return next(new ErrorHandler_1.default("Invalid content id", 400));
        }
        const question = videoContent?.questions?.find((item) => item._id.equals(questionId));
        if (!question) {
            return next(new ErrorHandler_1.default("Invalid question id", 400));
        }
        //create a new answer object
        const newAnswer = {
            user: req.user,
            answer,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        //add this answer to our this video
        question.questionReplies.push(newAnswer);
        await video?.save();
        if (req.user?._id === question.user._id) {
            //create a notification
            await notification_model_1.default.create({
                user: req.user?._id,
                title: "New Question Reply Received!",
                message: `You have a new reply in ${videoContent.title}`,
            });
        }
        else {
            const data = {
                name: question.user.name,
                title: videoContent.title,
            };
            const html = await ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/question_reply.ejs"), data);
            try {
                await (0, sendMail_1.default)({
                    email: question.user.email,
                    subject: "Question reply",
                    template: "question_reply.ejs",
                    data,
                });
            }
            catch (err) {
                return next(new ErrorHandler_1.default(err.message, 500));
            }
        }
        res.status(200).json({
            success: true,
            video,
        });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
exports.addReview = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const userVideoList = req.user?.videos;
        const videoId = req.params.id;
        //check videoId already exists in userVideoList base on _id
        const videoExists = userVideoList.some((video) => video._id.toString() === videoId.toString());
        if (!videoExists) {
            return next(new ErrorHandler_1.default("You are not eligible to access this video", 404));
        }
        const video = await video_model_1.default.findById(videoId);
        const { review, rating } = req.body;
        const reviewData = {
            user: req.user,
            comment: review,
            rating: rating,
        };
        video?.reviews.push(reviewData);
        let avg = 0;
        video?.reviews.forEach((review) => {
            avg += review.rating;
        });
        if (video) {
            video.ratings = avg / video.reviews.length;
        }
        await video?.save();
        // await redis.set(videoId, JSON.stringify(video), "EX", 604800);
        //create notification
        await notification_model_1.default.create({
            user: req.user?._id,
            title: "New review received",
            message: `${req.user?.name} has given a review in ${video?.name}`,
        });
        res.status(200).json({ success: true, video });
    }
    catch (error) {
        return next(new ErrorHandler_1.default(error.message, 500));
    }
});
exports.addReplyToReview = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { comment, videoId, reviewId } = req.body;
        const video = await video_model_1.default.findById(videoId);
        if (!video) {
            return next(new ErrorHandler_1.default("Video not found", 404));
        }
        const review = video?.reviews.find((review) => review._id.toString() === reviewId);
        if (!review) {
            return next(new ErrorHandler_1.default("Review not found", 404));
        }
        const replyData = {
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
        // await redis.set(videoId, JSON.stringify(video), "EX", 604800);
        //create send mail
        if (req.user?._id === review.user._id) {
            //create a notification
            await notification_model_1.default.create({
                user: req.user?._id,
                title: "New Review Reply Received!",
                message: `You have a new review reply in ${video.name}`,
            });
        }
        else {
            const data = {
                name: review.user.name,
                title: video.name,
            };
            const html = await ejs_1.default.renderFile(path_1.default.join(__dirname, "../mails/review_reply.ejs"), data);
            try {
                await (0, sendMail_1.default)({
                    email: review.user.email,
                    subject: "Review reply",
                    template: "review_reply.ejs",
                    data,
                });
            }
            catch (err) {
                return next(new ErrorHandler_1.default(err.message, 500));
            }
        }
        res.status(200).json({
            success: true,
            video,
        });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
//get all videos --only admin
exports.getAllVideoAdmin = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        (0, video_service_1.getAllVideoService)(res);
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 400));
    }
});
//delete video --only admin
exports.deleteVideo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { id } = req.params;
        const video = await video_model_1.default.findById(id);
        if (!video) {
            return next(new ErrorHandler_1.default("Video not found", 404));
        }
        await video.deleteOne({ id });
        await redis_1.redis.del(id);
        res.status(200).json({
            success: true,
            message: "Video deleted successfully!",
        });
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 400));
    }
});
//generate video url
exports.generateVideoUrl = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const { videoId } = req.body;
        const response = await axios_1.default.post(`https://dev.vdocipher.com/api/videos/${videoId}/otp`, { ttl: 300 }, {
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Apisecret ${process.env.VDOCIPHER_API_KEY}`,
            },
        });
        res.json(response.data);
    }
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 400));
    }
});
//search video
exports.searchVideo = (0, catchAsyncErrors_1.CatchAsyncError)(async (req, res, next) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 10;
        const skip = (page - 1) * limit;
        const searchParams = req.query.title || "";
        const decodedSearchParams = decodeURIComponent(searchParams);
        const searchQuery = {
            // Define your search criteria based on your VideoModel schema
            name: {
                $regex: new RegExp(decodedSearchParams.replace(/\s/g, "\\s*").split(" ").join("\\s*"), "i"),
            },
        };
        const videos = await video_model_1.default.find(searchQuery)
            .select("-videoData.videoUrl -videoData.suggestion -videoData.questions -videoData.links")
            .skip(skip)
            .limit(limit);
        // Fetch total videos count based on the search filter
        const totalvideos = await video_model_1.default.countDocuments(searchQuery);
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
    catch (err) {
        return next(new ErrorHandler_1.default(err.message, 500));
    }
});
