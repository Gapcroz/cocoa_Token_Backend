// src/models/tokenTransaction.ts
import mongoose, { Document, Schema } from "mongoose";

export interface ITokenTransaction extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  amount: number;
  // Updated status enum
  status:
    | "pending" // Initial state for immediate transfers (like admin adjustments)
    | "pending_acceptance" // For transfer requests awaiting receiver's action
    | "rejected" // Receiver rejected the request
    | "completed"
    | "failed"
    | "cancelled"; // Original transaction cancelled
  transactionType:
    | "transfer"
    | "transfer_request" // New type for the initial request
    | "transfer_acceptance" // New type for the successful acceptance
    | "transfer_rejection" // New type for the rejection reversal
    | "transfer_cancellation" // New type for a cancellation reversal
    | "coupon_redemption"
    | "admin_credit"
    | "admin_debit"; // Added admin_debit for clarity
  description?: string;
  requestId?: string; // For idempotency of initial request
  originalTransactionId?: mongoose.Types.ObjectId; // For linking reversals/cancellations
  cancellationDetails?: {
    reason: string;
    cancelledBy: mongoose.Types.ObjectId; // Admin ID
    cancelledAt: Date;
    cooldownUntil?: Date; // When the funds are available again for the original sender
  };
  createdAt?: Date;
  updatedAt?: Date;
}

const TokenTransactionSchema = new Schema<ITokenTransaction>(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: { type: Number, required: true, min: 0 }, // Amount can be 0 for admin adjustments with negative descriptions. Min: 0 to allow debit transaction types where amount is logged as positive.
    status: {
      type: String,
      enum: [
        "pending",
        "pending_acceptance",
        "rejected",
        "completed",
        "failed",
        "cancelled",
      ],
      default: "pending",
      required: true,
    },
    transactionType: {
      type: String,
      enum: [
        "transfer",
        "transfer_request",
        "transfer_acceptance",
        "transfer_rejection",
        "transfer_cancellation",
        "coupon_redemption",
        "admin_credit",
        "admin_debit",
      ],
      required: true,
    },
    description: { type: String },
    requestId: { type: String, unique: true, sparse: true },
    originalTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TokenTransaction",
      sparse: true,
    },
    cancellationDetails: {
      type: new Schema(
        {
          reason: { type: String, required: true },
          cancelledBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          cancelledAt: { type: Date, required: true },
          cooldownUntil: { type: Date },
        },
        { _id: false },
      ),
      sparse: true, // Only exists if transaction is cancelled
    },
  },
  { timestamps: true },
);

export default mongoose.model<ITokenTransaction>(
  "TokenTransaction",
  TokenTransactionSchema,
);