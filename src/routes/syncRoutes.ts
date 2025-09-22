import express from 'express';
import { SyncController } from '../controllers/syncController';
import { isAuthenticated } from '../middleware/auth.middleware';

const router = express.Router();

router.post('/sync/events', isAuthenticated, SyncController.syncEvents);

export default router;
