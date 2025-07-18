import { Request, Response } from 'express';
import { EventParticipation, IEventParticipation } from '../models/eventParticipation';
import { UserTaskCompletion } from '../models/userTaskCompletion';
import EventTask from '../models/eventTask';

export class EventParticipationController {
  // Crear una nueva participación
  static async createParticipation(req: Request, res: Response): Promise<void> {
    try {
      console.log('EventParticipationController: Creando participación:', req.body);
      
      const { eventId, userId, userName } = req.body;

      // Validaciones
      if (!eventId || !userId || !userName) {
        res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos',
        });
        return;
      }

      // Verificar si ya existe una participación para este usuario y evento
      const existingParticipation = await EventParticipation.findOne({
        eventId,
        userId,
        isActive: true,
      });

      if (existingParticipation) {
        res.status(400).json({
          success: false,
          message: 'Ya estás registrado en este evento',
        });
        return;
      }

      // Crear la participación
      const newParticipation = new EventParticipation({
        eventId,
        userId,
        userName,
        participationDate: new Date(),
        isActive: true,
        isCompleted: false,
        isVerified: false,
      });

      const savedParticipation = await newParticipation.save();
      console.log('EventParticipationController: Participación creada exitosamente:', savedParticipation._id);

      res.status(201).json({
        success: true,
        message: 'Te has registrado exitosamente para participar en el evento',
        participation: {
          id: savedParticipation._id,
          eventId: savedParticipation.eventId,
          userId: savedParticipation.userId,
          userName: savedParticipation.userName,
          participationDate: savedParticipation.participationDate,
          isActive: savedParticipation.isActive,
          isCompleted: savedParticipation.isCompleted,
          isVerified: savedParticipation.isVerified,
          completionDate: savedParticipation.completionDate,
          verificationDate: savedParticipation.verificationDate,
          verificationMethod: savedParticipation.verificationMethod,
          notes: savedParticipation.notes,
          tokensAwarded: savedParticipation.tokensAwarded,
        },
      });
    } catch (error) {
      console.error('EventParticipationController: Error al crear participación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Obtener participaciones de un usuario
  static async getUserParticipations(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      console.log('EventParticipationController: Obteniendo participaciones del usuario:', userId);

      const participations = await EventParticipation.find({ userId })
        .sort({ participationDate: -1 })
        .lean();

      console.log('EventParticipationController: Participaciones encontradas:', participations.length);

      res.status(200).json({
        success: true,
        message: 'Participaciones obtenidas exitosamente',
        participations: participations.map((participation: any) => ({
          id: participation._id,
          eventId: participation.eventId,
          userId: participation.userId,
          userName: participation.userName,
          participationDate: participation.participationDate,
          isActive: participation.isActive,
          isCompleted: participation.isCompleted,
          isVerified: participation.isVerified,
          completionDate: participation.completionDate,
          verificationDate: participation.verificationDate,
          verificationMethod: participation.verificationMethod,
          notes: participation.notes,
          tokensAwarded: participation.tokensAwarded,
        })),
      });
    } catch (error) {
      console.error('EventParticipationController: Error al obtener participaciones:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Verificar si un usuario está participando en un evento
  static async checkParticipation(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, userId } = req.params;
      console.log('EventParticipationController: Verificando participación:', eventId, userId);

      const participation = await EventParticipation.findOne({
        eventId,
        userId,
        isActive: true,
      });

      const isParticipating = participation !== null;

      res.status(200).json({
        success: true,
        message: 'Verificación completada',
        isParticipating,
      });
    } catch (error) {
      console.error('EventParticipationController: Error al verificar participación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Cancelar participación
  static async cancelParticipation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      console.log('EventParticipationController: Cancelando participación:', id);

      const participation = await EventParticipation.findById(id);

      if (!participation) {
        res.status(404).json({
          success: false,
          message: 'Participación no encontrada',
        });
        return;
      }

      participation.isActive = false;
      await participation.save();

      res.status(200).json({
        success: true,
        message: 'Participación cancelada exitosamente',
      });
    } catch (error) {
      console.error('EventParticipationController: Error al cancelar participación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Verificar participación (para admins)
  static async verifyParticipation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { verificationMethod, notes } = req.body;
      console.log('EventParticipationController: Verificando participación:', id);

      const participation = await EventParticipation.findById(id);

      if (!participation) {
        res.status(404).json({
          success: false,
          message: 'Participación no encontrada',
        });
        return;
      }

      participation.isVerified = true;
      participation.verificationDate = new Date();
      participation.verificationMethod = verificationMethod;
      participation.notes = notes;
      await participation.save();

      res.status(200).json({
        success: true,
        message: 'Participación verificada exitosamente',
        participation: {
          id: participation._id,
          eventId: participation.eventId,
          userId: participation.userId,
          userName: participation.userName,
          participationDate: participation.participationDate,
          isActive: participation.isActive,
          isCompleted: participation.isCompleted,
          isVerified: participation.isVerified,
          completionDate: participation.completionDate,
          verificationDate: participation.verificationDate,
          verificationMethod: participation.verificationMethod,
          notes: participation.notes,
          tokensAwarded: participation.tokensAwarded,
        },
      });
    } catch (error) {
      console.error('EventParticipationController: Error al verificar participación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Completar participación (para admins)
  static async completeParticipation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      console.log('EventParticipationController: Completando participación:', id);

      const participation = await EventParticipation.findById(id);

      if (!participation) {
        res.status(404).json({
          success: false,
          message: 'Participación no encontrada',
        });
        return;
      }

      participation.isCompleted = true;
      participation.completionDate = new Date();
      participation.notes = notes;
      await participation.save();

      res.status(200).json({
        success: true,
        message: 'Participación marcada como completada',
        participation: {
          id: participation._id,
          eventId: participation.eventId,
          userId: participation.userId,
          userName: participation.userName,
          participationDate: participation.participationDate,
          isActive: participation.isActive,
          isCompleted: participation.isCompleted,
          isVerified: participation.isVerified,
          completionDate: participation.completionDate,
          verificationDate: participation.verificationDate,
          verificationMethod: participation.verificationMethod,
          notes: participation.notes,
          tokensAwarded: participation.tokensAwarded,
        },
      });
    } catch (error) {
      console.error('EventParticipationController: Error al completar participación:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }

  // Calcular tokens basados en tareas completadas
  static async calculateTokensFromTasks(eventId: string, userId: string): Promise<number> {
    try {
      // Obtener todas las tareas del evento
      const tasks = await EventTask.find({ 
        eventId, 
        isActive: true 
      }).lean();

      // Obtener completaciones verificadas del usuario
      const completions = await UserTaskCompletion.find({
        eventId,
        userId,
        isCompleted: true,
        verificationDate: { $exists: true },
      }).lean();

      // Calcular total de tokens ganados
      let totalTokens = 0;
      for (const completion of completions) {
        const task = tasks.find((t: any) => t._id.toString() === completion.taskId);
        if (task) {
          totalTokens += completion.tokensAwarded;
        }
      }

      return totalTokens;
    } catch (error) {
      console.error('EventParticipationController: Error al calcular tokens:', error);
      return 0;
    }
  }

  // Obtener participaciones pendientes de verificación
  static async getPendingVerifications(req: Request, res: Response): Promise<void> {
    try {
      console.log('EventParticipationController: Obteniendo participaciones pendientes de verificación');

      const participations = await EventParticipation.find({
        isActive: true,
        isCompleted: false,
      })
        .sort({ participationDate: -1 })
        .lean();

      console.log('EventParticipationController: Participaciones pendientes encontradas:', participations.length);

      res.status(200).json({
        success: true,
        message: 'Participaciones pendientes obtenidas exitosamente',
        participations: participations.map((participation: any) => ({
          id: participation._id,
          eventId: participation.eventId,
          userId: participation.userId,
          userName: participation.userName,
          participationDate: participation.participationDate,
          isActive: participation.isActive,
          isCompleted: participation.isCompleted,
          isVerified: participation.isVerified,
          completionDate: participation.completionDate,
          verificationDate: participation.verificationDate,
          verificationMethod: participation.verificationMethod,
          notes: participation.notes,
          tokensAwarded: participation.tokensAwarded,
        })),
      });
    } catch (error) {
      console.error('EventParticipationController: Error al obtener participaciones pendientes:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
      });
    }
  }
} 