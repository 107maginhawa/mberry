import { Hono } from 'hono';
import { listEvents } from './listEvents';
import { getEvent } from './getEvent';
import { createEvent } from './createEvent';
import { updateEvent } from './updateEvent';
import { cancelEvent } from './cancelEvent';
import { registerForEvent } from './registerForEvent';
import { checkIn } from './checkIn';
import { listAttendance } from './listAttendance';
import { listMyEvents } from './listMyEvents';

const eventsRouter = new Hono();

eventsRouter.get('/list/:orgId', listEvents);
eventsRouter.get('/detail/:id', getEvent);
eventsRouter.post('/create/:orgId', createEvent);
eventsRouter.put('/update/:id', updateEvent);
eventsRouter.post('/cancel/:id', cancelEvent);
eventsRouter.post('/register/:id', registerForEvent);
eventsRouter.post('/checkin/:id', checkIn);
eventsRouter.get('/attendance/:id', listAttendance);
eventsRouter.get('/my', listMyEvents);

export { eventsRouter };
