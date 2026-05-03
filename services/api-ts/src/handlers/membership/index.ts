import { Hono } from 'hono';
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

const membership = new Hono();

// Org Profile (officer-accessible)
membership.get('/org-profile/:orgId', getOrgProfile);
membership.put('/org-profile/:orgId', updateOrgProfile);

// Members
membership.get('/members/:orgId', listMembers);
membership.get('/members/:orgId/:memberId', getMember);
membership.post('/members/:orgId', addMember);
membership.put('/members/:orgId/:memberId', updateMember);
membership.post('/members/:orgId/import', importMembers);

// Applications
membership.get('/applications/:orgId', listApplications);
membership.post('/applications/:appId/review', reviewApplication);

// Categories
membership.get('/categories/:orgId', listCategories);
membership.put('/categories/:orgId', upsertCategory);

export { membership };
