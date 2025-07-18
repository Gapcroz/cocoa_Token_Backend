import express from 'express';
import { EventParticipationController } from '../controllers/eventParticipationController';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = express.Router();

// Rutas protegidas (requieren autenticación)
router.post('/event-participations', isAuthenticated, EventParticipationController.createParticipation);
router.get('/event-participations/user/:userId', isAuthenticated, EventParticipationController.getUserParticipations);
router.get('/event-participations/check/:eventId/:userId', isAuthenticated, EventParticipationController.checkParticipation);
router.delete('/event-participations/:id', isAuthenticated, EventParticipationController.cancelParticipation);
router.put('/event-participations/:id/verify', isAuthenticated, EventParticipationController.verifyParticipation);
router.put('/event-participations/:id/complete', isAuthenticated, EventParticipationController.completeParticipation);
router.get('/event-participations/pending-verifications', isAuthenticated, EventParticipationController.getPendingVerifications);

export default router; 