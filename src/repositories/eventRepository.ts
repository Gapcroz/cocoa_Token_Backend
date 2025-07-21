import { Event } from '../models/event';
import EventTask from '../models/eventTask';

export class EventRepository {
  static async findActiveEvents() {
    return Event.find({ isActive: true }).sort({ date: 1, createdAt: -1 }).lean();
  }

  static async countTasksForEvent(eventId: string) {
    return EventTask.countDocuments({ eventId, isActive: true });
  }
} 