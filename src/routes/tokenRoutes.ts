import { Router } from "express";
import {
  transferTokens,
  getUserTokenTransactions,
} from "../controllers/tokenController";
import { isAuthenticated } from "../middleware/auth.middleware"; // Assuming you have this middleware

const router = Router();

// Route to initiate a token transfer
// Requires authentication to know who the sender is
router.post("/transfer", isAuthenticated, transferTokens);

// Route to get a user's token transaction history
// Requires authentication to know whose history to fetch
router.get("/transactions", isAuthenticated, getUserTokenTransactions);

export default router;