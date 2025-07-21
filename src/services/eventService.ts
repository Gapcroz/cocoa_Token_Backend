import { EventRepository } from '../repositories/eventRepository';

export class EventService {
  static async getEventsWithTasks() {
    const allActiveEvents = await EventRepository.findActiveEvents();
    // Si quieres filtrar solo los que tienen tareas, descomenta lo siguiente:
    // const eventsWithTaskCount = await Promise.all(
    //   allActiveEvents.map(async (event) => {
    //     const taskCount = await EventRepository.countTasksForEvent(event._id.toString());
    //     return { ...event, taskCount };
    //   })
    // );
    // return eventsWithTaskCount.filter(event => event.taskCount > 0);
    // Por ahora, regresa todos los eventos activos con taskCount: 0
    return allActiveEvents.map((event: any) => ({
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
      taskCount: 0,
    }));
  }
} 