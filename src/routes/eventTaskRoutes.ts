import express from 'express';
import { EventTaskController } from '../controllers/eventTaskController';

const router = express.Router();

// Obtener tareas de un evento
router.get('/events/:eventId/tasks', async (req, res) => {
  await EventTaskController.getEventTasks(req, res);
});

// Completar una tarea
router.post('/event-tasks/:taskId/complete', async (req, res) => {
  await EventTaskController.completeTask(req, res);
});

// Verificar completación de tarea (para admins)
router.post('/event-tasks/:completionId/verify', async (req, res) => {
  await EventTaskController.verifyTaskCompletion(req, res);
});

// Obtener progreso de un usuario en un evento
router.get('/events/:eventId/progress/:userId', async (req, res) => {
  await EventTaskController.getUserEventProgress(req, res);
});

// Obtener completaciones pendientes de verificación
router.get('/event-tasks/pending-verifications', async (req, res) => {
  await EventTaskController.getPendingVerifications(req, res);
});

export default router; 