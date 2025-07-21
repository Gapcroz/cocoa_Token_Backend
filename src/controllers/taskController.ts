import { Request, Response } from 'express';
import Task from '../models/task';
import EventTask from '../models/eventTask';
import { Event } from '../models/event';

export class TaskController {
  // Obtener todas las tareas disponibles
  static async getAvailableTasks(req: Request, res: Response) {
  try {
    const tasks = await Task.find({ isActive: true }).sort({ category: 1, name: 1 });
    
    res.status(200).json(tasks);
  } catch (error) {
    console.error('Error al obtener tareas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

  // Obtener tareas asignadas a un evento específico
  static async getEventTasks(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    
    const eventTasks = await EventTask.find({ 
      eventId, 
      isActive: true 
    }).sort({ category: 1, taskName: 1 });
    
    res.status(200).json(eventTasks);
  } catch (error) {
    console.error('Error al obtener tareas del evento:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

  // Asignar tareas a un evento
  static async assignTasksToEvent(req: Request, res: Response) {
  try {
    console.log('TaskController: Iniciando asignación de tareas');
    const { eventId } = req.params;
    const { taskAssignments } = req.body;

    console.log('TaskController: EventId:', eventId);
    console.log('TaskController: TaskAssignments:', taskAssignments);

    if (!taskAssignments || !Array.isArray(taskAssignments) || taskAssignments.length === 0) {
      console.log('TaskController: Error - asignaciones inválidas');
      return res.status(400).json({ message: 'Se requieren asignaciones de tareas válidas' });
    }

    // Verificar que el evento existe
    console.log('TaskController: Verificando evento:', eventId);
    const event = await Event.findById(eventId);
    if (!event) {
      console.log('TaskController: Evento no encontrado');
      return res.status(404).json({ message: 'Evento no encontrado' });
    }
    console.log('TaskController: Evento encontrado:', event.title);

    // Extraer los IDs de tareas
    const taskIds = taskAssignments.map((assignment: any) => assignment.taskId);
    console.log('TaskController: TaskIds a buscar:', taskIds);

    // Obtener las tareas seleccionadas
    const tasks = await Task.find({ 
      _id: { $in: taskIds }, 
      isActive: true 
    });
    console.log('TaskController: Tareas encontradas:', tasks.length);

    if (tasks.length !== taskIds.length) {
      console.log('TaskController: Error - algunas tareas no existen');
      console.log('TaskController: Tareas solicitadas:', taskIds.length);
      console.log('TaskController: Tareas encontradas:', tasks.length);
      return res.status(400).json({ message: 'Algunas tareas no existen o no están activas' });
    }

    // Crear las asignaciones de tareas con tokens personalizados
    const eventTasks = taskAssignments.map((assignment: any) => {
      const task = tasks.find((t: any) => t._id.toString() === assignment.taskId);
      if (!task) {
        throw new Error(`Tarea no encontrada: ${assignment.taskId}`);
      }
      return {
        eventId,
        taskId: task._id,
        taskName: task.name,
        taskDescription: task.description,
        tokenValue: assignment.tokenValue || task.tokenValue,
        category: task.category,
        isActive: true,
        isCustomToken: assignment.isCustomToken || false,
      };
    });

    // Insertar las tareas asignadas (ignorar duplicados)
    const results = await EventTask.insertMany(eventTasks, { 
      ordered: false,
      rawResult: true 
    });

    res.status(201).json({ 
      message: 'Tareas asignadas exitosamente',
      assignedCount: results.insertedCount || 0
    });
  } catch (error: any) {
    if (error.code === 11000) {
      // Error de duplicado
      res.status(400).json({ message: 'Algunas tareas ya están asignadas a este evento' });
    } else {
      console.error('Error al asignar tareas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }
};

  // Remover tareas de un evento
  static async removeTasksFromEvent(req: Request, res: Response) {
  try {
    const { eventId } = req.params;
    const { taskIds } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ message: 'Se requieren IDs de tareas válidos' });
    }

    const result = await EventTask.updateMany(
      { 
        eventId, 
        taskId: { $in: taskIds } 
      },
      { isActive: false }
    );

    res.status(200).json({ 
      message: 'Tareas removidas exitosamente',
      removedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error al remover tareas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};

  // Obtener eventos con tareas asignadas
  static async getEventsWithTasks(req: Request, res: Response) {
    try {
      console.log('TaskController: Obteniendo eventos con tareas');
      
      // Obtener todos los eventos que tienen tareas asignadas
      const eventTasks = await EventTask.aggregate([
        {
          $match: { isActive: true }
        },
        {
          $group: {
            _id: '$eventId',
            taskCount: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'events',
            localField: '_id',
            foreignField: '_id',
            as: 'event'
          }
        },
        {
          $unwind: '$event'
        },
        {
          $project: {
            eventId: '$_id',
            eventTitle: '$event.title',
            eventDescription: '$event.description',
            taskCount: 1
          }
        }
      ]);

      console.log('TaskController: Eventos con tareas encontrados:', eventTasks.length);
      
      res.status(200).json({
        success: true,
        events: eventTasks
      });
    } catch (error) {
      console.error('Error al obtener eventos con tareas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Verificar si existen tareas en el sistema
  static async checkTasksExist(req: Request, res: Response) {
    try {
      const taskCount = await Task.countDocuments();
      res.status(200).json({ 
        exists: taskCount > 0,
        count: taskCount
      });
    } catch (error) {
      console.error('Error al verificar tareas:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  }

  // Crear tareas predefinidas (solo para desarrollo)
  static async createDefaultTasks(req: Request, res: Response) {
  try {
    const defaultTasks = [
      {
        name: 'Tomar foto del escenario principal',
        description: 'Captura una foto del escenario principal del evento',
        tokenValue: 50,
        category: 'Fotografía',
      },
      {
        name: 'Escanear QR al entrar',
        description: 'Escanea el código QR al entrar al evento',
        tokenValue: 30,
        category: 'Interacción',
      },
      {
        name: 'Compartir en redes sociales',
        description: 'Comparte una foto del evento en tus redes sociales',
        tokenValue: 40,
        category: 'Social',
      },
      {
        name: 'Tomar foto con organizadores',
        description: 'Toma una foto con los organizadores del evento',
        tokenValue: 60,
        category: 'Fotografía',
      },
      {
        name: 'Participar en encuesta',
        description: 'Completa la encuesta de satisfacción del evento',
        tokenValue: 25,
        category: 'Interacción',
      },
      {
        name: 'Tomar foto de la comida',
        description: 'Captura una foto de la comida o bebidas del evento',
        tokenValue: 35,
        category: 'Fotografía',
      },
      {
        name: 'Interactuar con otros asistentes',
        description: 'Conoce y toma una foto con al menos 3 asistentes',
        tokenValue: 45,
        category: 'Social',
      },
      {
        name: 'Usar la app del evento',
        description: 'Descarga y usa la aplicación oficial del evento',
        tokenValue: 55,
        category: 'Tecnología',
      },
      {
        name: 'Crear contenido creativo',
        description: 'Crea un video corto o meme sobre el evento',
        tokenValue: 70,
        category: 'Creatividad',
      },
      {
        name: 'Tomar foto del final del evento',
        description: 'Captura una foto del cierre o despedida del evento',
        tokenValue: 40,
        category: 'Fotografía',
      },
    ];

    // Verificar si ya existen tareas
    const existingTasks = await Task.countDocuments();
    if (existingTasks > 0) {
      return res.status(400).json({ message: 'Ya existen tareas en el sistema' });
    }

    const tasks = await Task.insertMany(defaultTasks);

    res.status(201).json({ 
      message: 'Tareas predefinidas creadas exitosamente',
      createdCount: tasks.length
    });
  } catch (error) {
    console.error('Error al crear tareas predefinidas:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}
} 