import { Hono } from 'hono';
import { officerAuthMiddleware } from '@/middleware/officer-auth';
import { listAnnouncements } from './listAnnouncements';
import { getAnnouncement } from './getAnnouncement';
import { createAnnouncement } from './createAnnouncement';
import { publishAnnouncement } from './publishAnnouncement';
import { archiveAnnouncement } from './archiveAnnouncement';
import { updateAnnouncement } from './updateAnnouncement';
import { deleteAnnouncement } from './deleteAnnouncement';

const officerAuth = officerAuthMiddleware();

const communications = new Hono();

// Read (any member)
communications.get('/announcements/:orgId', listAnnouncements);
communications.get('/announcements/detail/:id', getAnnouncement);

// Write (officer-only)
communications.post('/announcements/:orgId', officerAuth, createAnnouncement);
communications.post('/announcements/:id/publish', publishAnnouncement);  // per-handler (no orgId param)
communications.post('/announcements/:id/archive', archiveAnnouncement);  // per-handler
communications.patch('/announcements/:id', officerAuth, updateAnnouncement);
communications.delete('/announcements/:id', officerAuth, deleteAnnouncement);

export { communications };
