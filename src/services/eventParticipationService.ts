import { EventParticipationRepository } from '../repositories/eventParticipationRepository';

export class EventParticipationService {
  static async getUserParticipations(userId: string) {
    return EventParticipationRepository.findByUserId(userId);
  }

  static async checkParticipation(eventId: string, userId: string) {
    return EventParticipationRepository.findActiveByEventAndUser(eventId, userId);
  }

  static async getParticipationById(id: string) {
    return EventParticipationRepository.findById(id);
  }

  static async saveParticipation(participation: any) {
    return EventParticipationRepository.save(participation);
  }

  static async getPendingVerifications() {
    return EventParticipationRepository.findPendingVerifications();
  }
} 