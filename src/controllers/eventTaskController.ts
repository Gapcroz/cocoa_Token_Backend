import { Request, Response } from 'express';
import EventTask, { IEventTask } from '../models/eventTask';
import { UserTaskCompletion, IUserTaskCompletion } from '../models/userTaskCompletion';

export class EventTaskController {
  // Obtener tareas de un evento
  static async getEventTasks(req: Request, res: Response): Promise<void> {
    try {
      const { eventId } = req.params;
      console.log('EventTaskController: Obteniendo tareas del evento:', eventId);

      const tasks = await EventTask.find({ 
        eventId, 
        isActive: true 
      })
        .sort({ order: 1 })
        .lean();

      console.log('EventTaskController: Tareas encontradas:', tasks.length);

      res.status(200).json({
        success: true,
        message: 'Tareas obtenidas exitosamente',
        tasks: tasks.map((task: any) => ({
          id: task._id,
          eventId: task.eventId,
          title: task.taskName,
          description: task.taskDescription,
          tokenValue: task.tokenValue,
          category: task.category,
          isActive: task.isActive,
          isCustomToken: task.isCustomToken,
        })),
      });
    } catch (error) {
      console.error('EventTaskController: Error al obtener tareas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Marcar tarea como completada por un usuario
  static async completeTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const { userId, userName, notes } = req.body;
      
      console.log('EventTaskController: Completando tarea:', taskId, 'por usuario:', userId);

      // Verificar que la tarea existe
      const task = await EventTask.findById(taskId);
      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Tarea no encontrada',
        });
        return;
      }

      // Verificar que no se haya completado ya
      const existingCompletion = await UserTaskCompletion.findOne({
        taskId,
        userId,
        isCompleted: true,
      });

      if (existingCompletion) {
        res.status(400).json({
          success: false,
          message: 'Ya has completado esta tarea',
        });
        return;
      }

      // Crear o actualizar la completación
      const completion = await UserTaskCompletion.findOneAndUpdate(
        { taskId, userId },
        {
          eventId: task.eventId,
          taskId,
          userId,
          userName,
          isCompleted: true,
          completionDate: new Date(),
          tokensAwarded: task.tokenValue,
          notes,
        },
        { upsert: true, new: true }
      );

      console.log('EventTaskController: Tarea completada exitosamente');

      res.status(200).json({
        success: true,
        message: 'Tarea completada exitosamente',
        completion: {
          id: completion._id,
          eventId: completion.eventId,
          taskId: completion.taskId,
          userId: completion.userId,
          userName: completion.userName,
          isCompleted: completion.isCompleted,
          completionDate: completion.completionDate,
          tokensAwarded: completion.tokensAwarded,
          notes: completion.notes,
        },
      });
    } catch (error) {
      console.error('EventTaskController: Error al completar tarea:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Verificar tarea completada (para admins)
  static async verifyTaskCompletion(req: Request, res: Response): Promise<void> {
    try {
      const { completionId } = req.params;
      const { verifiedBy, notes } = req.body;
      
      console.log('EventTaskController: Verificando completación:', completionId);

      const completion = await UserTaskCompletion.findById(completionId);
      if (!completion) {
        res.status(404).json({
          success: false,
          message: 'Completación no encontrada',
        });
        return;
      }

      completion.verificationDate = new Date();
      completion.verifiedBy = verifiedBy;
      if (notes) completion.notes = notes;
      await completion.save();

      console.log('EventTaskController: Completación verificada exitosamente');

      res.status(200).json({
        success: true,
        message: 'Completación verificada exitosamente',
        completion: {
          id: completion._id,
          eventId: completion.eventId,
          taskId: completion.taskId,
          userId: completion.userId,
          userName: completion.userName,
          isCompleted: completion.isCompleted,
          completionDate: completion.completionDate,
          verificationDate: completion.verificationDate,
          verifiedBy: completion.verifiedBy,
          tokensAwarded: completion.tokensAwarded,
          notes: completion.notes,
        },
      });
    } catch (error) {
      console.error('EventTaskController: Error al verificar completación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener progreso de un usuario en un evento
  static async getUserEventProgress(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, userId } = req.params;
      console.log('EventTaskController: Obteniendo progreso del usuario:', userId, 'en evento:', eventId);

      // Obtener todas las tareas del evento
      const tasks = await EventTask.find({ 
        eventId, 
        isActive: true 
      })
        .sort({ order: 1 })
        .lean();

      // Obtener completaciones del usuario
      const completions = await UserTaskCompletion.find({
        eventId,
        userId,
        isCompleted: true,
      }).lean();

      // Calcular progreso
      const totalTasks = tasks.length;
      const completedTasks = completions.length;
      const totalTokens = tasks.reduce((sum: number, task: any) => sum + task.tokenValue, 0);
      const earnedTokens = completions.reduce((sum: number, completion: any) => sum + completion.tokensAwarded, 0);
      const progressPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Crear respuesta detallada
      const taskProgress = tasks.map((task: any) => {
        const completion = completions.find((c: any) => c.taskId === task._id.toString());
        return {
          taskId: task._id,
          title: task.taskName,
          description: task.taskDescription,
          tokenValue: task.tokenValue,
          category: task.category,
          isCompleted: completion !== undefined,
          completionDate: completion?.completionDate,
          tokensEarned: completion?.tokensAwarded || 0,
        };
      });

      res.status(200).json({
        success: true,
        message: 'Progreso obtenido exitosamente',
        progress: {
          eventId,
          userId,
          totalTasks,
          completedTasks,
          progressPercentage,
          totalTokens,
          earnedTokens,
          tasks: taskProgress,
        },
      });
    } catch (error) {
      console.error('EventTaskController: Error al obtener progreso:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener todas las completaciones pendientes de verificación
  static async getPendingVerifications(req: Request, res: Response): Promise<void> {
    try {
      console.log('EventTaskController: Obteniendo completaciones pendientes de verificación');

      const completions = await UserTaskCompletion.find({
        isCompleted: true,
        verificationDate: { $exists: false },
      })
        .sort({ completionDate: -1 })
        .lean();

      console.log('EventTaskController: Completaciones pendientes encontradas:', completions.length);

      res.status(200).json({
        success: true,
        message: 'Completaciones pendientes obtenidas exitosamente',
        completions: completions.map(completion => ({
          id: completion._id,
          eventId: completion.eventId,
          taskId: completion.taskId,
          userId: completion.userId,
          userName: completion.userName,
          isCompleted: completion.isCompleted,
          completionDate: completion.completionDate,
          verificationDate: completion.verificationDate,
          verifiedBy: completion.verifiedBy,
          tokensAwarded: completion.tokensAwarded,
          notes: completion.notes,
        })),
      });
    } catch (error) {
      console.error('EventTaskController: Error al obtener completaciones pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }
} 