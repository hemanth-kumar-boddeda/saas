import express from "express";
import { requireUser, projectAccess } from "../middleware/projectAccess";
import { publishLimiter } from "../middleware/rateLimit";
import * as c from "../controllers/social.controller";

const r = express.Router();
const member = projectAccess(); // guests never reach publishing

r.get("/social/accounts", requireUser, c.listAccounts);
r.delete("/social/accounts/:aid", requireUser, c.disconnect);
r.post("/social/:provider/connect", requireUser, c.connect);
r.get("/social/:provider/callback", c.callback); // signed state, no session
r.get("/public-media/:pid/:kind", c.publicMedia); // signed token, for Meta's fetcher

r.post("/projects/:id/publish", member, publishLimiter, c.createPublication);
r.delete("/projects/:id/publications/:pid", member, publishLimiter, c.cancelPublication);
r.get("/projects/:id/publications", member, c.listPublications);

export default r;
