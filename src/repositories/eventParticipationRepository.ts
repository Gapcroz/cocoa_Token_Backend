import { EventParticipation } from '../models/eventParticipation';

export class EventParticipationRepository {
  static async findByUserId(userId: string) {
    return EventParticipation.find({ userId }).sort({ participationDate: -1 }).lean();
  }

  static async findActiveByEventAndUser(eventId: string, userId: string) {
    return EventParticipation.findOne({ eventId, userId, isActive: true });
  }

  static async findById(id: string) {
    return EventParticipation.findById(id);
  }

  static async save(participation: any) {
    return participation.save();
  }

  static async findPendingVerifications() {
    return EventParticipation.find({ isActive: true, isCompleted: false })
      .sort({ participationDate: -1 })
      .lean();
  }
} 