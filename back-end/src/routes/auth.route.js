// back-end/src/routes/auth.route.js
import express from "express";
import { signup, login, logout, checkAuth ,deleteAccount} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/check", protectRoute, checkAuth);
router.delete("/delete-account", protectRoute, deleteAccount);

export default router;