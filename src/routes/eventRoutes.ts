import express from 'express';
import { EventController } from '../controllers/eventController';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = express.Router();

// Rutas públicas (sin autenticación)
router.get('/events', EventController.getAllEvents);
router.get('/events/with-tasks', EventController.getEventsWithTasks);
router.get('/events/user/:userId/active', isAuthenticated, EventController.getUserActiveEvents);
router.get('/events/:id', EventController.getEventById);

// Rutas protegidas (requieren autenticación)
router.post('/events', isAuthenticated, EventController.createEvent);
router.put('/events/:id', isAuthenticated, EventController.updateEvent);
router.delete('/events/:id', isAuthenticated, EventController.deleteEvent);
router.get('/events/creator/:createdBy', EventController.getEventsByCreator);

export default router; 