import { EventRepository } from '../repositories/eventRepository';

export class EventService {
  static async getEventsWithTasks() {
    const allActiveEvents = await EventRepository.findActiveEvents();
    
    // Obtener el conteo de tareas para cada evento
    const eventsWithTaskCount = await Promise.all(
      allActiveEvents.map(async (event) => {
        const taskCount = await EventRepository.countTasksForEvent(event._id.toString());
        return { ...event, taskCount };
      })
    );
    
    // Devolver TODOS los eventos activos con su conteo de tareas
    return eventsWithTaskCount.map((event: any) => ({
      eventId: event._id,
      id: event._id,
      title: event.title,
      description: event.description,
      location: event.location,
      date: event.date,
      time: event.time,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
      isActive: event.isActive,
      imageUrl: event.imageUrl,
      minTokens: event.minTokens,
      maxTokens: event.maxTokens,
      categoryId: event.categoryId,
      taskCount: event.taskCount,
    }));
  }
} 