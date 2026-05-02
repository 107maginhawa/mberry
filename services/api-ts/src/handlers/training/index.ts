import { Hono } from 'hono';
import { listTrainings } from './listTrainings';
import { getTraining } from './getTraining';
import { createTraining } from './createTraining';
import { updateTraining } from './updateTraining';
import { cancelTraining } from './cancelTraining';
import { enroll } from './enroll';
import { markComplete } from './markComplete';
import { listMyTrainings } from './listMyTrainings';

const trainingRouter = new Hono();

trainingRouter.get('/list/:orgId', listTrainings);
trainingRouter.get('/detail/:id', getTraining);
trainingRouter.post('/create/:orgId', createTraining);
trainingRouter.put('/update/:id', updateTraining);
trainingRouter.post('/cancel/:id', cancelTraining);
trainingRouter.post('/enroll/:id', enroll);
trainingRouter.post('/complete/:id', markComplete);
trainingRouter.get('/my', listMyTrainings);

export { trainingRouter };
