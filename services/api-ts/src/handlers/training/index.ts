import { Hono } from 'hono';
import { officerAuthMiddleware } from '@/middleware/officer-auth';
import { listTrainings } from './listTrainings';
import { getTraining } from './getTraining';
import { createTraining } from './createTraining';
import { updateTraining } from './updateTraining';
import { cancelTraining } from './cancelTraining';
import { enroll } from './enroll';
import { markComplete } from './markComplete';
import { listMyTrainings } from './listMyTrainings';

const officerAuth = officerAuthMiddleware();

const trainingRouter = new Hono();

// Read (any member)
trainingRouter.get('/list/:orgId', listTrainings);
trainingRouter.get('/detail/:id', getTraining);
trainingRouter.post('/enroll/:id', enroll);       // member self-enrollment
trainingRouter.get('/my', listMyTrainings);

// Write (officer-only for create; per-handler for update/cancel/complete)
trainingRouter.post('/create/:orgId', officerAuth, createTraining);
trainingRouter.put('/update/:id', updateTraining);    // per-handler (no orgId param)
trainingRouter.post('/cancel/:id', cancelTraining);   // per-handler
trainingRouter.post('/complete/:id', markComplete);   // per-handler
trainingRouter.post('/:id/check-in', markComplete);   // alias for attendance UI

export { trainingRouter };
