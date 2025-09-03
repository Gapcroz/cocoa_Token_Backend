// src/models/cancellationRequest.ts
import mongoose, { Document, Schema } from "mongoose";

export interface ICancellationRequest extends Document {
  transactionId: mongoose.Types.ObjectId; // The transaction the user wants to cancel
  requestedBy: mongoose.Types.ObjectId; // The user who made the request
  reason: string; // User's reason for requesting cancellation
  status: "pending" | "approved" | "rejected"; // Admin action status
  reviewedBy?: mongoose.Types.ObjectId; // Admin who reviewed it
  reviewReason?: string; // Admin's reason for approval/rejection
  createdAt?: Date;
  updatedAt?: Date;
}

const CancellationRequestSchema = new Schema<ICancellationRequest>(
  {
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TokenTransaction",
      required: true,
      unique: true, // A transaction can only have one active cancellation request
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      required: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true, // Optional
    },
    reviewReason: { type: String, trim: true, sparse: true }, // Optional
  },
  { timestamps: true },
);

// Add an index for faster lookup of pending requests for a user/transaction
CancellationRequestSchema.index({ transactionId: 1, status: 1 });
CancellationRequestSchema.index({ requestedBy: 1, status: 1 });

export default mongoose.model<ICancellationRequest>(
  "CancellationRequest",
  CancellationRequestSchema,
);