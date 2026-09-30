import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "rfipl_secret";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";
const REFRESH_EXPIRES_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRES_DAYS || "7", 10);

export const hashPassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        throw error;
    }
};

export const comparePassword = async (password, hash) => {
    try {
        return await bcrypt.compare(password, hash);
    } catch (error) {
        throw error;
    }
};

export const signAccessToken = (user) => {
    try {
        return jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );
    } catch (error) {
        throw error;
    }
};

export const hashRefreshToken = (token) => {
    return bcrypt.hash(token, 10);
};

export const verifyAccessToken = (token) => {
    return jwt.verify(token, JWT_SECRET);
};

export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Access token required" });
        }
        const token = authHeader.split(" ")[1];
        const decoded = verifyAccessToken(token);
        const [users] = await pool.query(
            "SELECT id, email, isActive FROM users WHERE id = ? AND deletedAt IS NULL",
            [decoded.id]
        );
        if (users.length === 0 || !users[0].isActive) {
            return res.status(401).json({ message: "Unauthorized: user not found or inactive" });
        }
        req.user = users[0];
        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
        console.error("Auth middleware error:", error);
        return res.status(500).json({ message: "Authentication error" });
    }
};

export { JWT_SECRET, JWT_EXPIRES_IN, REFRESH_EXPIRES_DAYS };
