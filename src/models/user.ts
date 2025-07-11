import mongoose, { Document, Schema } from "mongoose";

export interface IUser extends Document {
  name: string;
  address: string;
  birthDate?: Date;
  email: string;
  password?: string;
  isStore: boolean;
  tokens: number;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    address: { type: String, required: true },
    birthDate: { type: Date },
    email: { type: String, required: true, unique: true },
    password: { type: String }, // opcional
    isStore: { type: Boolean, default: false },
    tokens: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("User", userSchema);
