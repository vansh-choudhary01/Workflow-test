import { Router } from 'express';
import workflowRoutes from './workflow.js';

const router = Router();

router.use('/workflow', workflowRoutes);

export default router;