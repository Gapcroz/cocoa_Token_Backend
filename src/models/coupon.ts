import mongoose, { Document, Schema } from "mongoose";

export interface ICoupon extends Document {
  name: string;
  description: string;
  socialEvent?: string;
  tokensRequired: number;
  expirationDate: Date;
  status: "available" | "used" | "expired" | "locked";
  storeId: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    socialEvent: { type: String },
    tokensRequired: { type: Number, required: true },
    expirationDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["available", "used", "expired", "locked"],
      default: "available",
      required: true,
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model<ICoupon>("Coupon", couponSchema);
