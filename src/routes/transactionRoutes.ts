import express, { Router } from "express";
import { redeemCoupon } from "../controllers/transactionController";

const router: Router = express.Router();

// Ruta para redimir un cupón, falta arreglar ruta
// router.post("/redeem", redeemCoupon);

export default router;
