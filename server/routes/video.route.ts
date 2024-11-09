import express from "express";
import { addAnswer, addQuestion, addReplyToReview, addReview, deleteVideo, generateVideoUrl,getAllVideoAdmin,getAllVideos,getVideoByUser,getSingleVideo,searchVideo,updateVideo,uploadVideo } from "../controllers/video.controller";
import { isAuthenticated , authorizeRoles} from "../middleware/auth";
import {generateAccessToken } from "../controllers/user.controller";

const videoRouter = express.Router();

videoRouter.post("/create-video",generateAccessToken, isAuthenticated, authorizeRoles("admin"), uploadVideo);

videoRouter.put("/update-video/:id",generateAccessToken, isAuthenticated, authorizeRoles("admin"),updateVideo);

videoRouter.get("/get-video/:id",getSingleVideo);

videoRouter.get("/get-videos",getAllVideos);


videoRouter.get("/get-video-content/:id",generateAccessToken,isAuthenticated,getVideoByUser);

videoRouter.put("/add-question",generateAccessToken,isAuthenticated,addQuestion);

videoRouter.put("/add-answer",generateAccessToken,isAuthenticated,addAnswer);

videoRouter.put("/add-review/:id",generateAccessToken,isAuthenticated,addReview);

videoRouter.put("/add-reply",generateAccessToken,isAuthenticated,authorizeRoles("admin"),addReplyToReview);

videoRouter.get("/get-all-videos",isAuthenticated,generateAccessToken,authorizeRoles("admin"),getAllVideoAdmin);

videoRouter.delete("/delete-video/:id",generateAccessToken,isAuthenticated,authorizeRoles("admin"),deleteVideo);

videoRouter.post("/generate-VdoCipherOTP", generateVideoUrl);


videoRouter.get("/search",searchVideo);

export default videoRouter;