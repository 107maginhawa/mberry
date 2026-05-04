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
import { listEnrollments } from './listEnrollments';

const officerAuth = officerAuthMiddleware();

const trainingRouter = new Hono();

// Read (any authenticated member)
trainingRouter.get('/list/:orgId', listTrainings);
trainingRouter.get('/detail/:orgId/:id', getTraining);
trainingRouter.post('/enroll/:orgId/:id', enroll); // member self-enrollment (orgId-scoped, BR-02 check)
trainingRouter.get('/my', listMyTrainings);
trainingRouter.get('/:orgId/enrollments/:id', officerAuth, listEnrollments);

// Write (officer-only — orgId scoped)
trainingRouter.post('/create/:orgId', officerAuth, createTraining);
trainingRouter.put('/update/:orgId/:id', officerAuth, updateTraining);
trainingRouter.post('/cancel/:orgId/:id', officerAuth, cancelTraining);
trainingRouter.post('/complete/:orgId/:id', officerAuth, markComplete);
trainingRouter.post('/:orgId/:id/check-in', officerAuth, markComplete);

export { trainingRouter };
