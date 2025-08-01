// src/routes/tokenRoutes.ts
import { Router } from "express";
import {
  requestTransfer,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer, // Admin action
  getUserTokenTransactions,
  adminAdjustUserTokens,
  adminUpdateTransactionStatus,
  adminGetAllTransactions,
  createCancellationRequest, // NEW USER ROUTE
  adminGetPendingCancellationRequests, // NEW ADMIN ROUTE
  adminReviewCancellationRequest, // NEW ADMIN ROUTE
  getPendingTransferRequestsSent,
  getPendingTransferRequestsReceived,
  getUserCancellationRequests,
  adminGetTransactionById,
  adminGetUserTransactions,
  adminGetUserBalance,
} from "../controllers/tokenController";
import { isAuthenticated, isAdmin } from "../middleware/auth.middleware"; // Ensure isAdmin is imported

const router = Router();

// --- USER-FACING ROUTES ---

// Route to initiate a token transfer request (sender)
router.post("/transfer/request", isAuthenticated, requestTransfer);

// Route for a receiver to accept a pending token transfer
// transactionId comes from the URL param
router.post("/transfer/:transactionId/accept", isAuthenticated, acceptTransfer);

// Route for a receiver to reject a pending token transfer
// transactionId comes from the URL param
router.post("/transfer/:transactionId/reject", isAuthenticated, rejectTransfer);

// Route to get a user's token transaction history (sent, received, etc.)
router.get("/transactions", isAuthenticated, getUserTokenTransactions);

// Route for a user to create a cancellation request for a completed transaction
router.post(
  "/transactions/cancel-request",
  isAuthenticated,
  createCancellationRequest
);

// --- ADMIN-FACING ROUTES ---
// Apply isAdmin middleware to all admin routes to ensure only authorized users can access them.

// Route for an admin to adjust a user's token balance (credit/debit)
router.post("/admin/adjust", isAuthenticated, isAdmin, adminAdjustUserTokens);

// Route for an admin to manually update a transaction's status (use with caution)
// transactionId comes from the URL param
router.put(
  "/admin/transactions/:transactionId/status",
  isAuthenticated,
  isAdmin,
  adminUpdateTransactionStatus
);

// Route for an admin to explicitly cancel a completed transfer (revert funds with cooldown)
// transactionId comes from the URL param
router.post(
  "/admin/transactions/:transactionId/cancel",
  isAuthenticated,
  isAdmin,
  cancelTransfer
);

// Route for an admin to get all token transactions in the system
router.get(
  "/admin/transactions",
  isAuthenticated,
  isAdmin,
  adminGetAllTransactions
);

// Route for an admin to get all pending user cancellation requests
router.get(
  "/admin/cancellation-requests/pending",
  isAuthenticated,
  isAdmin,
  adminGetPendingCancellationRequests
);

// Route for an admin to review (approve or reject) a specific cancellation request
// requestId comes from the URL param
router.post(
  "/admin/cancellation-requests/:requestId/review",
  isAuthenticated,
  isAdmin,
  adminReviewCancellationRequest
);

// Route to get pending transfer requests sent by the user
router.get(
  "/transfers/pending/sent",
  isAuthenticated,
  getPendingTransferRequestsSent
);

// Route to get pending transfer requests received by the user
router.get(
  "/transfers/pending/received",
  isAuthenticated,
  getPendingTransferRequestsReceived
);

// Route for a user to view their cancellation requests
router.get(
  "/transactions/cancellation-requests",
  isAuthenticated,
  getUserCancellationRequests
);

// Route for an admin to get details of a specific transaction by its ID
router.get(
  "/admin/transactions/:transactionId",
  isAuthenticated,
  isAdmin,
  adminGetTransactionById
);

// Route for an admin to get all transactions of a specific user
router.get(
  "/admin/users/:userId/transactions",
  isAuthenticated,
  isAdmin,
  adminGetUserTransactions
);

// Route for an admin to get the current token balance of a specific user
router.get(
  "/admin/users/:userId/balance",
  isAuthenticated,
  isAdmin,
  adminGetUserBalance
);

export default router;
