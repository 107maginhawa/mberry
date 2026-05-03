import { Hono } from 'hono';
import { officerAuthMiddleware } from '@/middleware/officer-auth';
import { listElections } from './listElections';
import { getElection } from './getElection';
import { createElection } from './createElection';
import { updateElectionStatus } from './updateElectionStatus';
import { castVote } from './castVote';

const officerAuth = officerAuthMiddleware();

const electionsRouter = new Hono();

// Read (any member)
electionsRouter.get('/list/:orgId', listElections);
electionsRouter.get('/detail/:id', getElection);
electionsRouter.post('/vote/:id', castVote);        // member voting

// Write (officer-only)
electionsRouter.post('/create/:orgId', officerAuth, createElection);
electionsRouter.post('/status/:id', updateElectionStatus); // per-handler (no orgId param)

export { electionsRouter };
