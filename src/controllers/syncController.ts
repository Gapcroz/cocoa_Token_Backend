import { Request, Response } from 'express';
import { WordPressSyncService } from '../services/wordpressSyncService';

export class SyncController {
  static async syncEvents(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      if (!user || !user.isAdmin) {
        res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden sincronizar eventos.',
        });
        return;
      }

      const result = await WordPressSyncService.syncEvents();

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: {
            newEventsCount: result.newEventsCount,
            updatedEventsCount: result.updatedEventsCount,
            errorsCount: result.errors.length,
            errors: result.errors
          }
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message,
          data: {
            newEventsCount: result.newEventsCount,
            updatedEventsCount: result.updatedEventsCount,
            errorsCount: result.errors.length,
            errors: result.errors
          }
        });
      }

    } catch (error) {
      console.error('SyncController: Error durante la sincronización:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor durante la sincronización',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}
