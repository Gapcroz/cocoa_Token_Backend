// src/routes/authRoutes.ts
import express from "express";
import { login, register, googleLogin, completeGoogleUser } from "../controllers/authController";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google-login", googleLogin);
router.post("/complete-google-user", completeGoogleUser);

export default router;
