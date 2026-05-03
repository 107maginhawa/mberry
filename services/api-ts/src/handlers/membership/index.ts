import { Hono } from 'hono';
import { officerAuthMiddleware } from '@/middleware/officer-auth';
import { listMembers } from './listMembers';
import { getMember } from './getMember';
import { addMember } from './addMember';
import { updateMember } from './updateMember';
import { importMembers } from './importMembers';
import { listApplications } from './listApplications';
import { reviewApplication } from './reviewApplication';
import { listCategories } from './listCategories';
import { upsertCategory } from './upsertCategory';
import { getOrgProfile } from './getOrgProfile';
import { updateOrgProfile } from './updateOrgProfile';

const officerAuth = officerAuthMiddleware();

const membership = new Hono();

// Org Profile (officer-only)
membership.get('/org-profile/:orgId', officerAuth, getOrgProfile);
membership.put('/org-profile/:orgId', officerAuth, updateOrgProfile);

// Members (officer-only for management)
membership.get('/members/:orgId', officerAuth, listMembers);
membership.get('/members/:orgId/:memberId', officerAuth, getMember);
membership.post('/members/:orgId', officerAuth, addMember);
membership.put('/members/:orgId/:memberId', officerAuth, updateMember);
membership.post('/members/:orgId/import', officerAuth, importMembers);

// Applications (officer-only)
membership.get('/applications/:orgId', officerAuth, listApplications);
membership.post('/applications/:appId/review', reviewApplication); // no orgId param, per-handler

// Categories (officer-only)
membership.get('/categories/:orgId', officerAuth, listCategories);
membership.put('/categories/:orgId', officerAuth, upsertCategory);

export { membership };
