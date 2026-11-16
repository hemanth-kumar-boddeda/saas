import nodemailer, { Transporter } from 'nodemailer';
require ('dotenv').config();
import ejs from 'ejs';
import path from 'path';

interface EmailOptions {
    email: string;
    subject: string;
    template: string;
    data:{ [key: string]: any }
}

const sendEmail = async (options: EmailOptions) => {
    // Local dev without SMTP: print the mail data (activation code) instead of failing.
    if (!process.env.SMTP_HOST && !process.env.SMTP_SERVICE && process.env.NODE_ENV !== 'production') {
        console.log(`[dev mail] to=${options.email} subject="${options.subject}"`, options.data);
        return;
    }
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        service: process.env.SMTP_SERVICE,
        auth: {
            user: process.env.SMTP_MAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    const {email, subject, template, data} = options;

    const templatePath = path.join(__dirname, '../mails', template);
    const html = await ejs.renderFile(templatePath, data);

    const mailOptions = {
        from: process.env.SMTP_MAIL,
        to: email,
        subject,
        html
    };

    await transporter.sendMail(mailOptions);
};



export default sendEmail;