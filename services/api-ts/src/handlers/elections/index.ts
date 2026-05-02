import { Hono } from 'hono';
import { listElections } from './listElections';
import { getElection } from './getElection';
import { createElection } from './createElection';
import { updateElectionStatus } from './updateElectionStatus';
import { castVote } from './castVote';

const electionsRouter = new Hono();

electionsRouter.get('/list/:orgId', listElections);
electionsRouter.get('/detail/:id', getElection);
electionsRouter.post('/create/:orgId', createElection);
electionsRouter.post('/status/:id', updateElectionStatus);
electionsRouter.post('/vote/:id', castVote);

export { electionsRouter };
