// back-end/src/routes/password.route.js
import express from "express";
import { forgotPassword, resetPassword } from "../controllers/password.controller.js";

const router = express.Router();

// Public routes - no protectRoute middleware
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);

export default router;