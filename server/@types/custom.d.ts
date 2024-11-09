import { Request } from "express";
import { IUser } from "../models/user.model"; // Adjust this import based on your project structure

declare global {
    namespace Express {
        interface Request {
            user?: IUser; // This allows you to access req.user in your controllers
        }
    }
}
