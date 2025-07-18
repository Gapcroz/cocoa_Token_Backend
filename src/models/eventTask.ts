import mongoose, { Schema, Document } from 'mongoose';

export interface IEventTask extends Document {
  eventId: mongoose.Types.ObjectId;
  taskId: mongoose.Types.ObjectId;
  taskName: string;
  taskDescription: string;
  tokenValue: number;
  category: string;
  isActive: boolean;
  isCustomToken: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const eventTaskSchema = new Schema<IEventTask>({
  eventId: {
    type: Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
  },
  taskId: {
    type: Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  taskName: {
    type: String,
    required: true,
    trim: true,
  },
  taskDescription: {
    type: String,
    required: true,
    trim: true,
  },
  tokenValue: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    required: true,
    enum: ['Fotografía', 'Interacción', 'Social', 'Tecnología', 'Creatividad'],
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isCustomToken: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Índice compuesto para evitar duplicados
eventTaskSchema.index({ eventId: 1, taskId: 1 }, { unique: true });

export default mongoose.model<IEventTask>('EventTask', eventTaskSchema); 