// src/models/user.ts
import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  _id: string;
  name: string;
  address: string;
  birthDate?: Date;
  email: string;
  password?: string;
  isStore: boolean;
  isAdmin: boolean;
  tokens: number;
  // New field for cooldown period after a cancelled transfer
  lastCancelledTransferCooldownUntil?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    birthDate: { type: Date },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // opcional
    isStore: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    tokens: { type: Number, default: 0 },
    lastCancelledTransferCooldownUntil: { type: Date }, // New field
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);