import mongoose, { Document, Schema } from "mongoose";

export interface IUserCoupon extends Document {
  userId: mongoose.Types.ObjectId;
  couponId: mongoose.Types.ObjectId;
  status: "active" | "used";
  activationDate: Date;
  usedDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserCouponSchema = new Schema<IUserCoupon>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    couponId: { type: Schema.Types.ObjectId, ref: "Coupon", required: true },
    status: { type: String, enum: ["active", "used"], default: "active" },
    activationDate: { type: Date, default: Date.now },
    usedDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model<IUserCoupon>("UserCoupon", UserCouponSchema); 