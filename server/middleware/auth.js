const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utils/ErrorHandler");
const { redis } = require("../utils/redis");
require("dotenv").config();

// Middleware to check if the user is authenticated
exports.isAuthenticated = async (req, res, next) => {
  try {
    const accessToken = req.cookies["access_token"] || req.headers.authorization?.split(" ")[1];

    if (!accessToken) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN);

    if (!decoded) {
      return next(new ErrorHandler("Invalid access token", 401));
    }

    const user = await redis.get(decoded.id);

    if (!user) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    req.user = JSON.parse(user);
    next();
  } catch (error) {
    next(error); // Pass the error to the error handling middleware
  }
};

// Middleware to authorize roles
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(new ErrorHandler(`Role: ${req.user?.role} is not allowed to access this resource`, 403));
    }
    next();
  };
};

exports.authorizeRoles = authorizeRoles;
