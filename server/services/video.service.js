"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllVideoService = exports.createVideo = void 0;
const video_model_1 = __importDefault(require("../models/video.model"));
const catchAsyncErrors_1 = require("../middleware/catchAsyncErrors");
//create video
exports.createVideo = (0, catchAsyncErrors_1.CatchAsyncError)(async (data, res) => {
    const video = await video_model_1.default.create(data);
    res.status(201).json({ success: true, video });
});
//get all videos
const getAllVideoService = async (res) => {
    const videos = await video_model_1.default.find().sort({ createdAt: -1 });
    res.status(201).json({ success: true, videos });
};
exports.getAllVideoService = getAllVideoService;