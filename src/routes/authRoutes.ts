// src/routes/authRoutes.ts
import express, { Router } from "express";
import {
  login,
  register,
  googleLogin,
  completeGoogleUser,
  getMe,
  updateProfile,
  checkAdminExists,
} from "../controllers/authController";
import { isAuthenticated } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google-login", googleLogin);
router.post("/complete-google-user", completeGoogleUser);
router.get("/me", isAuthenticated, getMe);
router.put("/update-profile", isAuthenticated, updateProfile);
router.get("/check-admin", checkAdminExists);

export default router;
