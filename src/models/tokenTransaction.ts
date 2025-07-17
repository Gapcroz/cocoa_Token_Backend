import mongoose, { Document, Schema } from "mongoose";

export interface ITokenTransaction extends Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  amount: number;
  status: "pending" | "completed" | "failed" | "cancelled";
  transactionType: "transfer" | "coupon_redemption" | "admin_credit";
  description?: string;
  requestId?: string; // <-- New field for idempotency
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
    amount: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "pending",
      required: true,
    },
    transactionType: {
      type: String,
      enum: ["transfer", "coupon_redemption", "admin_credit"],
      required: true,
    },
    description: { type: String },
    requestId: { type: String, unique: true, sparse: true }, // <-- Make it unique, but allow nulls
  },
  { timestamps: true },
);

export default mongoose.model<ITokenTransaction>(
  "TokenTransaction",
  TokenTransactionSchema,
);