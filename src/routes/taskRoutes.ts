import express from 'express';
import { TaskController } from '../controllers/taskController';

const router = express.Router();

// Obtener todas las tareas disponibles
router.get('/tasks', async (req, res) => {
  await TaskController.getAvailableTasks(req, res);
});

// Obtener tareas de un evento específico
router.get('/events/:eventId/tasks', async (req, res) => {
  await TaskController.getEventTasks(req, res);
});

// Asignar tareas a un evento
router.post('/events/:eventId/tasks', async (req, res) => {
  await TaskController.assignTasksToEvent(req, res);
});

// Remover tareas de un evento
router.delete('/events/:eventId/tasks', async (req, res) => {
  await TaskController.removeTasksFromEvent(req, res);
});

// Obtener eventos con tareas asignadas
router.get('/events/with-tasks', async (req, res) => {
  await TaskController.getEventsWithTasks(req, res);
});

// Verificar si existen tareas
router.get('/tasks/check', async (req, res) => {
  await TaskController.checkTasksExist(req, res);
});

// Crear tareas predefinidas (solo para desarrollo)
router.post('/tasks/create-default', async (req, res) => {
  await TaskController.createDefaultTasks(req, res);
});

export default router; 