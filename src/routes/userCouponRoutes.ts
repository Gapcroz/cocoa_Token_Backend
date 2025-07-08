import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { activateCoupon, getUserActivatedCoupons, useActivatedCoupon } from "../controllers/userCouponController";

const router = Router();

// Activar (canjear) un cupón
router.post("/activate", isAuthenticated, activateCoupon);

// Obtener cupones activados del usuario
router.get("/", isAuthenticated, getUserActivatedCoupons);

// Marcar un cupón activado como usado
router.post("/use", isAuthenticated, useActivatedCoupon);

export default router; 