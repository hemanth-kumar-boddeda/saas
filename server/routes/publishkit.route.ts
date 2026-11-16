import express from "express";
import { requireUser, projectAccess } from "../middleware/projectAccess";
import { aiLimiter } from "../middleware/rateLimit";
import * as c from "../controllers/publishkit.controller";

const r = express.Router();
const member = projectAccess(); // owner/editor only: guests and strangers never reach AI output

r.post("/channels", requireUser, c.createChannel);
r.get("/channels", requireUser, c.listChannels);
r.patch("/channels/:cid", requireUser, c.updateChannel);
r.put("/projects/:id/channel", member, c.setProjectChannel);

r.post("/projects/:id/kit", member, aiLimiter, c.startKit);
r.get("/projects/:id/kit", member, c.getKit);
r.patch("/projects/:id/kit", member, c.editKit);
r.get("/projects/:id/kit/thumbnails/:n", member, c.kitThumbnail);
r.get("/projects/:id/kit/srt", member, c.kitSrt);

export default r;
