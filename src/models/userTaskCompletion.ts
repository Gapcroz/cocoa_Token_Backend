import mongoose, { Document, Schema } from 'mongoose';

export interface IUserTaskCompletion extends Document {
  eventId: string;
  taskId: string;
  userId: string;
  userName: string;
  isCompleted: boolean;
  completionDate?: Date;
  verificationDate?: Date;
  verifiedBy?: string;
  notes?: string;
  tokensAwarded: number;
}

const userTaskCompletionSchema = new Schema<IUserTaskCompletion>({
  eventId: {
    type: String,
    required: true,
    index: true,
  },
  taskId: {
    type: String,
    required: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userName: {
    type: String,
    required: true,
  },
  isCompleted: {
    type: Boolean,
    required: true,
    default: false,
  },
  completionDate: {
    type: Date,
    required: false,
  },
  verificationDate: {
    type: Date,
    required: false,
  },
  verifiedBy: {
    type: String,
    required: false,
  },
  notes: {
    type: String,
    required: false,
  },
  tokensAwarded: {
    type: Number,
    required: true,
    default: 0,
  },
}, {
  timestamps: true,
});

// Índices compuestos para mejorar el rendimiento
userTaskCompletionSchema.index({ eventId: 1, userId: 1 });
userTaskCompletionSchema.index({ taskId: 1, userId: 1 });
userTaskCompletionSchema.index({ userId: 1, isCompleted: 1 });

export const UserTaskCompletion = mongoose.model<IUserTaskCompletion>('UserTaskCompletion', userTaskCompletionSchema); 