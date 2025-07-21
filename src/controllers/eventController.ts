import { Request, Response } from 'express';
import { Event, IEvent } from '../models/event';
// import EventTask, { IEventTask } from '../models/eventTask';
import { EventService } from '../services/eventService';

export class EventController {
  // Crear un nuevo evento
  static async createEvent(req: Request, res: Response): Promise<void> {
    try {
      console.log('EventController: Creando evento:', req.body);
      
      const { title, description, location, date, time, createdBy, imageUrl, minTokens, maxTokens, categoryId, tasks } = req.body;

      // Validaciones
      if (!title || !description || !location || !date || !time || !createdBy || minTokens === undefined || maxTokens === undefined || !categoryId) {
        res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos',
        });
        return;
      }

      // Validar tokens
      if (minTokens < 0 || maxTokens < 0) {
        res.status(400).json({
          success: false,
          message: 'Los tokens no pueden ser negativos',
        });
        return;
      }

      if (minTokens > maxTokens) {
        res.status(400).json({
          success: false,
          message: 'Los tokens mínimos no pueden ser mayores que los máximos',
        });
        return;
      }

      // Validar formato de hora
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        res.status(400).json({
          success: false,
          message: 'Formato de hora inválido. Use HH:MM',
        });
        return;
      }

      // Validar fecha
      const eventDate = new Date(date);
      if (isNaN(eventDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Fecha inválida',
        });
        return;
      }

      // Validar tareas si se proporcionan
      let totalTaskTokens = 0;
      if (tasks && Array.isArray(tasks) && tasks.length > 0) {
        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          if (!task.title || !task.description || task.tokenValue === undefined) {
            res.status(400).json({
              success: false,
              message: `Tarea ${i + 1}: título, descripción y valor de tokens son requeridos`,
            });
            return;
          }
          if (task.tokenValue < 0) {
            res.status(400).json({
              success: false,
              message: `Tarea ${i + 1}: el valor de tokens no puede ser negativo`,
            });
            return;
          }
          totalTaskTokens += task.tokenValue;
        }

        // Verificar que el total de tokens de las tareas esté dentro del rango
        if (totalTaskTokens < minTokens) {
          res.status(400).json({
            success: false,
            message: `El total de tokens de las tareas (${totalTaskTokens}) debe ser al menos ${minTokens}`,
          });
          return;
        }
        if (totalTaskTokens > maxTokens) {
          res.status(400).json({
            success: false,
            message: `El total de tokens de las tareas (${totalTaskTokens}) no puede exceder ${maxTokens}`,
          });
          return;
        }
      }

      // Crear el evento
      const newEvent = new Event({
        title,
        description,
        location,
        date: eventDate,
        time,
        createdBy,
        imageUrl,
        minTokens,
        maxTokens,
        categoryId,
      });

      const savedEvent = await newEvent.save();
      console.log('EventController: Evento creado exitosamente:', savedEvent._id);

      // Crear tareas si se proporcionan (temporalmente deshabilitado)
      const createdTasks: any[] = [];
      if (tasks && Array.isArray(tasks) && tasks.length > 0) {
        console.log('EventController: Creación de tareas deshabilitada temporalmente');
        // TODO: Implementar creación de tareas cuando se resuelva el conflicto de modelos
      }

      res.status(201).json({
        success: true,
        message: 'Evento creado exitosamente',
        event: {
          id: savedEvent._id,
          title: savedEvent.title,
          description: savedEvent.description,
          location: savedEvent.location,
          date: savedEvent.date,
          time: savedEvent.time,
          createdBy: savedEvent.createdBy,
          createdAt: savedEvent.createdAt,
          isActive: savedEvent.isActive,
          imageUrl: savedEvent.imageUrl,
          minTokens: savedEvent.minTokens,
          maxTokens: savedEvent.maxTokens,
          categoryId: savedEvent.categoryId,
        },
        tasks: createdTasks,
      });
    } catch (error) {
      console.error('EventController: Error al crear evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener todos los eventos
  static async getAllEvents(req: Request, res: Response): Promise<void> {
    try {
      console.log('EventController: Obteniendo todos los eventos');
      
      const events = await Event.find({ isActive: true })
        .sort({ date: 1, createdAt: -1 })
        .lean();

      console.log('EventController: Eventos encontrados:', events.length);

      res.status(200).json({
        success: true,
        message: 'Eventos obtenidos exitosamente',
        events: events.map(event => ({
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
        })),
      });
    } catch (error) {
      console.error('EventController: Error al obtener eventos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener evento por ID
  static async getEventById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      console.log('EventController: Obteniendo evento:', id);

      const event = await Event.findById(id).lean();

      if (!event) {
        res.status(404).json({
          success: false,
          message: 'Evento no encontrado',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Evento obtenido exitosamente',
        event: {
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
        },
      });
    } catch (error) {
      console.error('EventController: Error al obtener evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Actualizar evento
  static async updateEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { title, description, location, date, time, imageUrl, minTokens, maxTokens, categoryId } = req.body;
      
      console.log('EventController: Actualizando evento:', id);

      // Validaciones
      if (!title || !description || !location || !date || !time || minTokens === undefined || maxTokens === undefined || !categoryId) {
        res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos',
        });
        return;
      }

      // Validar tokens
      if (minTokens < 0 || maxTokens < 0) {
        res.status(400).json({
          success: false,
          message: 'Los tokens no pueden ser negativos',
        });
        return;
      }

      if (minTokens > maxTokens) {
        res.status(400).json({
          success: false,
          message: 'Los tokens mínimos no pueden ser mayores que los máximos',
        });
        return;
      }

      // Validar formato de hora
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) {
        res.status(400).json({
          success: false,
          message: 'Formato de hora inválido. Use HH:MM',
        });
        return;
      }

      // Validar fecha
      const eventDate = new Date(date);
      if (isNaN(eventDate.getTime())) {
        res.status(400).json({
          success: false,
          message: 'Fecha inválida',
        });
        return;
      }

      const updatedEvent = await Event.findByIdAndUpdate(
        id,
        {
          title,
          description,
          location,
          date: eventDate,
          time,
          imageUrl,
          minTokens,
          maxTokens,
          categoryId,
        },
        { new: true, runValidators: true }
      ).lean();

      if (!updatedEvent) {
        res.status(404).json({
          success: false,
          message: 'Evento no encontrado',
        });
        return;
      }

      console.log('EventController: Evento actualizado exitosamente');

      res.status(200).json({
        success: true,
        message: 'Evento actualizado exitosamente',
        event: {
          id: updatedEvent._id,
          title: updatedEvent.title,
          description: updatedEvent.description,
          location: updatedEvent.location,
          date: updatedEvent.date,
          time: updatedEvent.time,
          createdBy: updatedEvent.createdBy,
          createdAt: updatedEvent.createdAt,
          isActive: updatedEvent.isActive,
          imageUrl: updatedEvent.imageUrl,
          minTokens: updatedEvent.minTokens,
          maxTokens: updatedEvent.maxTokens,
          categoryId: updatedEvent.categoryId,
        },
      });
    } catch (error) {
      console.error('EventController: Error al actualizar evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Eliminar evento (soft delete)
  static async deleteEvent(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      console.log('EventController: Eliminando evento:', id);

      const deletedEvent = await Event.findByIdAndUpdate(
        id,
        { isActive: false },
        { new: true }
      ).lean();

      if (!deletedEvent) {
        res.status(404).json({
          success: false,
          message: 'Evento no encontrado',
        });
        return;
      }

      console.log('EventController: Evento eliminado exitosamente');

      res.status(200).json({
        success: true,
        message: 'Evento eliminado exitosamente',
      });
    } catch (error) {
      console.error('EventController: Error al eliminar evento:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener eventos por creador
  static async getEventsByCreator(req: Request, res: Response): Promise<void> {
    try {
      const { createdBy } = req.params;
      console.log('EventController: Obteniendo eventos del creador:', createdBy);

      const events = await Event.find({ 
        createdBy, 
        isActive: true 
      })
        .sort({ date: 1, createdAt: -1 })
        .lean();

      console.log('EventController: Eventos encontrados:', events.length);

      res.status(200).json({
        success: true,
        message: 'Eventos obtenidos exitosamente',
        events: events.map(event => ({
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
        })),
      });
    } catch (error) {
      console.error('EventController: Error al obtener eventos del creador:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener eventos que tienen tareas asignadas (para eventos sociales)
  static async getEventsWithTasks(req: Request, res: Response): Promise<void> {
    try {
      const eventsWithTasks = await EventService.getEventsWithTasks();
      res.status(200).json({
        success: true,
        message: 'Eventos obtenidos exitosamente',
        events: eventsWithTasks,
      });
    } catch (error) {
      console.error('EventController: Error al obtener eventos con tareas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener eventos activos del usuario (para recompensas)
  static async getUserActiveEvents(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      console.log('EventController: Obteniendo eventos activos del usuario:', userId);

      // Obtener eventos donde el usuario está participando activamente con información de tareas
      const userActiveEvents = await Event.aggregate([
        {
          $lookup: {
            from: 'eventparticipations',
            localField: '_id',
            foreignField: 'eventId',
            as: 'participations'
          }
        },
        {
          $lookup: {
            from: 'eventtasks',
            localField: '_id',
            foreignField: 'eventId',
            as: 'tasks'
          }
        },
        {
          $lookup: {
            from: 'usertaskcompletions',
            localField: '_id',
            foreignField: 'eventId',
            as: 'userCompletions'
          }
        },
        {
          $match: {
            isActive: true,
            'participations': {
              $elemMatch: {
                userId: userId,
                isActive: true
              }
            }
          }
        },
        {
          $sort: { date: 1, createdAt: -1 }
        }
      ]);

      console.log('EventController: Eventos activos del usuario encontrados:', userActiveEvents.length);

      res.status(200).json({
        success: true,
        message: 'Eventos activos del usuario obtenidos exitosamente',
        events: userActiveEvents.map(event => {
          // Filtrar tareas completadas por este usuario
          const userTaskCompletions = event.userCompletions?.filter(
            (completion: any) => completion.userId === userId && completion.isCompleted
          ) || [];

          return {
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
            totalTasks: event.tasks?.length || 0,
            completedTasks: userTaskCompletions.length,
            completedTokens: userTaskCompletions.reduce((sum: number, completion: any) => sum + (completion.tokensAwarded || 0), 0),
          };
        }),
      });
    } catch (error) {
      console.error('EventController: Error al obtener eventos activos del usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }
} 