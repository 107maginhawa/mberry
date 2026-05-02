import { Hono } from 'hono';
import { listAnnouncements } from './listAnnouncements';
import { getAnnouncement } from './getAnnouncement';
import { createAnnouncement } from './createAnnouncement';
import { publishAnnouncement } from './publishAnnouncement';
import { archiveAnnouncement } from './archiveAnnouncement';

const communications = new Hono();

communications.get('/announcements/:orgId', listAnnouncements);
communications.get('/announcements/detail/:id', getAnnouncement);
communications.post('/announcements/:orgId', createAnnouncement);
communications.post('/announcements/:id/publish', publishAnnouncement);
communications.post('/announcements/:id/archive', archiveAnnouncement);

export { communications };
