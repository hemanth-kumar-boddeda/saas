import nodemailer from 'nodemailer';
require('dotenv').config();
import ejs from 'ejs';
import path from 'path';

interface EmailOptions {
    email: string;
    subject: string;
    template: string;
    data: { [key: string]: any };
}

/** Which transport is configured: Resend (HTTP, free tier), SMTP, or none. */
export const mailTransport = (env: Record<string, string | undefined> = process.env): 'resend' | 'smtp' | null =>
    env.RESEND_API_KEY ? 'resend' : env.SMTP_HOST || env.SMTP_SERVICE ? 'smtp' : null;

const sendEmail = async (options: EmailOptions) => {
    const { email, subject, template, data } = options;
    const transport = mailTransport();

    // Local dev without any mail config: print the mail data (activation code, links) instead of failing.
    if (!transport && process.env.NODE_ENV !== 'production') {
        console.log(`[dev mail] to=${email} subject="${subject}"`, data);
        return;
    }
    if (!transport) throw new Error('Email is not configured (set RESEND_API_KEY or SMTP_HOST)');

    const html = await ejs.renderFile(path.join(__dirname, '../mails', template), data);
    const from = process.env.MAIL_FROM || process.env.SMTP_MAIL || 'CreatorFlow <onboarding@resend.dev>';

    if (transport === 'resend') {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: [email], subject, html }),
            signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
            const j: any = await res.json().catch(() => ({}));
            throw new Error(`Resend rejected the email (${res.status}): ${j.message || j.name || 'unknown error'}`);
        }
        return;
    }

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        service: process.env.SMTP_SERVICE,
        auth: { user: process.env.SMTP_MAIL, pass: process.env.SMTP_PASSWORD },
    });
    await transporter.sendMail({ from, to: email, subject, html });
};

export default sendEmail;
