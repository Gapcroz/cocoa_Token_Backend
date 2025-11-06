import { Router } from "express";
import { isAuthenticated, isStore } from "../middleware/auth.middleware";
import {
  activateCoupon,
  getUserActivatedCoupons,
  scanCouponForStore,
  useActivatedCoupon,
} from "../controllers/userCouponController";

const router = Router();

// Activar (canjear) un cupón
router.post("/activate", isAuthenticated, activateCoupon);

// Obtener cupones activados del usuario
router.get("/", isAuthenticated, getUserActivatedCoupons);

// Marcar un cupón activado como usado
router.post("/use", isAuthenticated, useActivatedCoupon);

// Escanear y canjear un cupón desde la tienda
router.post("/scan", isAuthenticated, isStore, scanCouponForStore);

export default router; 