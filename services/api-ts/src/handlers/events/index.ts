import { Hono } from 'hono';
import { officerAuthMiddleware } from '@/middleware/officer-auth';
import { listEvents } from './listEvents';
import { getEvent } from './getEvent';
import { createEvent } from './createEvent';
import { updateEvent } from './updateEvent';
import { cancelEvent } from './cancelEvent';
import { registerForEvent } from './registerForEvent';
import { checkIn } from './checkIn';
import { listAttendance } from './listAttendance';
import { listRegistrations } from './listRegistrations';
import { listMyEvents } from './listMyEvents';

const officerAuth = officerAuthMiddleware();

const eventsRouter = new Hono();

// Read (any member)
eventsRouter.get('/list/:orgId', listEvents);
eventsRouter.get('/detail/:id', getEvent);        // per-handler org check (P1-2)
eventsRouter.get('/my', listMyEvents);
eventsRouter.post('/register/:id', registerForEvent); // member self-registration

// Write (officer-only for create; per-handler org check for update/cancel/checkin)
eventsRouter.post('/create/:orgId', officerAuth, createEvent);
eventsRouter.put('/update/:id', updateEvent);      // per-handler org check (P1-2)
eventsRouter.post('/cancel/:id', cancelEvent);     // per-handler org check (P1-2)
eventsRouter.post('/checkin/:id', checkIn);        // per-handler org check + session audit (P1-2, P1-3)
eventsRouter.get('/attendance/:id', listAttendance);
eventsRouter.get('/registrations/:id', listRegistrations);

export { eventsRouter };
