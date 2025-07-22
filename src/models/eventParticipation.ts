import mongoose, { Document, Schema } from 'mongoose';

export interface IEventParticipation extends Document {
  eventId: string;
  userId: string;
  userName: string;
  participationDate: Date;
  isActive: boolean;
  isCompleted: boolean;
  isVerified: boolean;
  completionDate?: Date;
  verificationDate?: Date;
  verificationMethod?: string;
  notes?: string;
  tokensAwarded?: number;
}

const eventParticipationSchema = new Schema<IEventParticipation>({
  eventId: {
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
  participationDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
  },
  isCompleted: {
    type: Boolean,
    required: true,
    default: false,
  },
  isVerified: {
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
  verificationMethod: {
    type: String,
    required: false,
  },
  notes: {
    type: String,
    required: false,
  },
  tokensAwarded: {
    type: Number,
    required: false,
  },
}, {
  timestamps: true,
});

// Índices compuestos para mejorar el rendimiento de las consultas
eventParticipationSchema.index({ eventId: 1, userId: 1 });
eventParticipationSchema.index({ userId: 1, isActive: 1 });
eventParticipationSchema.index({ isActive: 1, isCompleted: 1 });

export const EventParticipation = mongoose.model<IEventParticipation>('EventParticipation', eventParticipationSchema); 