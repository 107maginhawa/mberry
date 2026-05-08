import { Hono } from 'hono';
import { officerAuthMiddleware } from '@/middleware/officer-auth';
import { getDuesConfig } from './getDuesConfig';
import { upsertDuesConfig } from './upsertDuesConfig';
import { listFunds } from './listFunds';
import { upsertFunds } from './upsertFunds';
import { recordPayment } from './recordPayment';
import { listPayments } from './listPayments';
import { getPayment } from './getPayment';
import { refundPayment } from './refundPayment';
import { getFinancialDashboard } from './getFinancialDashboard';
import { getGatewayConfig } from './getGatewayConfig';
import { upsertGatewayConfig } from './upsertGatewayConfig';
import { testGatewayConnection } from './testGatewayConnection';
import { disconnectGateway } from './disconnectGateway';
import { generateReport } from './generateReport';

const officerAuth = officerAuthMiddleware();

const dues = new Hono();

// Config (officer-only)
dues.get('/config/:orgId', officerAuth, getDuesConfig);
dues.put('/config/:orgId', officerAuth, upsertDuesConfig);

// Funds (officer-only)
dues.get('/funds/:orgId', officerAuth, listFunds);
dues.put('/funds/:orgId', officerAuth, upsertFunds);

// Payments (write=officer, read by ID has per-handler org check)
dues.get('/payments', listPayments);
dues.get('/payments/:id', getPayment);
dues.post('/payments/:orgId', officerAuth, recordPayment);
dues.post('/payments/:id/refund', refundPayment); // per-handler org check (P1-2)

// Dashboard (officer-only)
dues.get('/dashboard/:orgId', officerAuth, getFinancialDashboard);

// Reports (officer-only)
dues.get('/reports/:orgId', officerAuth, generateReport);

// Gateway (officer-only)
dues.get('/gateway/:orgId', officerAuth, getGatewayConfig);
dues.put('/gateway/:orgId', officerAuth, upsertGatewayConfig);
dues.post('/gateway/:orgId/test', officerAuth, testGatewayConnection);
dues.delete('/gateway/:orgId', officerAuth, disconnectGateway);

export { dues };
