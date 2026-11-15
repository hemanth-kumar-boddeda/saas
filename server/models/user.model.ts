import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";
require ("dotenv").config();
import jwt from "jsonwebtoken";
const emailRegexPattern: RegExp = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    googleId?: string;
    avatar: {
        public_id: string;
        url: string;
    }
    role: string;
    isVerified: boolean;
    activationTokenHash?: string;
    activationExpiresAt?: Date;
    videos:Array<{videoId: string}>;
    comparePassword: (password: string) => Promise<boolean>;
};

const userSchema: Schema<IUser> = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please enter your name"],
    },
    email: {
        type: String,
        required: [true, "Please enter your email"],
        validate: {
            validator: function (value: string) {
                return emailRegexPattern.test(value);
            },
            message: "Please enter a valid email",
        },
        unique: true,
    },
    // SEC-01: provider subject id — the only trusted link to an external identity.
    googleId: {
        type: String,
        unique: true,
        sparse: true,
    },
    password: {
        type: String,
        // Optional: accounts created through a verified provider identity
        // (OIDC-only) have no password.
        minLength: [6, "Password should be greater than 6 characters"],
        select: false,
    },
    avatar: {
        // required: false,
        public_id: {
            type: String,
            required: false,
        },
        url: {
            type: String,
            required: false,
        }
    },
    role: {
        type: String,
        default: "user",
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    // SEC-06: single-use activation credential. Only the SHA-256 hash of the
    // token is stored; the raw token exists solely in the activation e-mail.
    activationTokenHash: {
        type: String,
        select: false,
    },
    activationExpiresAt: {
        type: Date,
        select: false,
    },
    videos: [
        {
            videoId: String,

        },
    ],

},

    {
        timestamps: true,
    }
);

//Hash Password
userSchema.pre<IUser>("save", async function (next) {
    if (!this.isModified("password")) {
      return next(); // Return to prevent further execution
    }
    this.password = await bcrypt.hash(this.password, 10);
    next();
  });
  
  //compare password
  userSchema.methods.comparePassword = async function (
    enteredPassword: string
  ): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
  };

  const userModel: Model<IUser> = mongoose.model("User", userSchema);
  
  export default userModel;
  