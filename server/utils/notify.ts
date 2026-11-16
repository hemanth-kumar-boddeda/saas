// E-mail notifications for review events. Never throws: a mail failure must
// not fail the request that caused it.
import userModel from "../models/user.model";
import sendMail from "./sendMail";
import { logger } from "./logger";

interface Event {
  project: { _id: unknown; title: string; owner: unknown; editors?: unknown[] };
  subject: string;
  heading: string;
  body: string;
  /** Do not notify this user (the actor). */
  exceptUserId?: string;
}

export const notifyProject = async (e: Event) => {
  if (!process.env.SMTP_MAIL) return; // mail not configured: skip silently
  try {
    const ids = [e.project.owner, ...(e.project.editors ?? [])]
      .map(String)
      .filter((id) => id !== e.exceptUserId);
    const users: any[] = await userModel.find({ _id: { $in: ids } }).select("email");
    const origin = (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",")[0].trim();
    await Promise.all(
      users.map((u) =>
        sendMail({
          email: u.email,
          subject: e.subject,
          template: "review-event.ejs",
          data: { heading: e.heading, body: e.body, project: e.project.title, link: `${origin}/projects/${e.project._id}` },
        }).catch((err) => logger.error("notify_failed", { errorMessage: err?.message }))
      )
    );
  } catch (err: any) {
    logger.error("notify_failed", { errorMessage: err?.message });
  }
};

const clientOrigin = () => (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",")[0].trim();
export const reviewLinkUrl = (rawToken: string) => `${clientOrigin()}/review/${rawToken}`;

/**
 * Direct mail to one address with a link (editor invites, feedback digests).
 * Returns whether it was sent; never throws. Without SMTP in dev the mail is printed instead.
 */
export const mailLink = async (to: string, subject: string, heading: string, body: string, link: string, project: string) => {
  try {
    await sendMail({ email: to, subject, template: "review-event.ejs", data: { heading, body, project, link } });
    return true;
  } catch (err: any) {
    logger.error("mail_link_failed", { errorMessage: err?.message });
    return false;
  }
};
