import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  name: string;
  description: string;
  tokenValue: number;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
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
}, {
  timestamps: true,
});

export default mongoose.model<ITask>('Task', taskSchema); 