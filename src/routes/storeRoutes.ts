import { Router } from "express";
import { getStores } from "../controllers/userController";

const router = Router();

// GET /api/stores
router.get("/", getStores);

export default router; 