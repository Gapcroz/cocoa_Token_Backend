import mongoose, { Document, Schema } from 'mongoose';

export interface IEvent extends Document {
  title: string;
  description: string;
  location: string;
  date: Date;
  time: string;
  createdBy: string;
  createdAt: Date;
  isActive: boolean;
  imageUrl?: string;
  minTokens: number;
  maxTokens: number;
  categoryId: string;
  // Campos para sincronización con WordPress
  wordpressId?: string;
  source?: 'manual' | 'wordpress';
  isReadOnly?: boolean;
}

const eventSchema = new Schema<IEvent>({
  title: {
    type: String,
    required: [true, 'El título es requerido'],
    trim: true,
    maxlength: [100, 'El título no puede tener más de 100 caracteres'],
  },
  description: {
    type: String,
    required: [true, 'La descripción es requerida'],
    trim: true,
    maxlength: [500, 'La descripción no puede tener más de 500 caracteres'],
  },
  location: {
    type: String,
    required: [true, 'La ubicación es requerida'],
    trim: true,
    maxlength: [200, 'La ubicación no puede tener más de 200 caracteres'],
  },
  date: {
    type: Date,
    required: [true, 'La fecha es requerida'],
  },
  time: {
    type: String,
    required: [true, 'La hora es requerida'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:MM)'],
  },
  createdBy: {
    type: String,
    required: [true, 'El creador es requerido'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  imageUrl: {
    type: String,
    required: false,
  },
  minTokens: {
    type: Number,
    required: true,
    min: [0, 'Los tokens mínimos no pueden ser negativos'],
  },
  maxTokens: {
    type: Number,
    required: true,
    min: [0, 'Los tokens máximos no pueden ser negativos'],
  },
  categoryId: {
    type: String,
    required: [true, 'La categoría es requerida'],
    trim: true,
  },
  // Campos para sincronización con WordPress
  wordpressId: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  source: {
    type: String,
    enum: ['manual', 'wordpress'],
    default: 'manual',
  },
  isReadOnly: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Índices para mejorar el rendimiento
eventSchema.index({ date: 1 });
eventSchema.index({ categoryId: 1 });
eventSchema.index({ createdBy: 1 });
eventSchema.index({ isActive: 1 });
eventSchema.index({ wordpressId: 1 });
eventSchema.index({ source: 1 });

export const Event = mongoose.model<IEvent>('Event', eventSchema); 