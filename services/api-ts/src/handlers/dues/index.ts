import { Hono } from 'hono';
import { getDuesConfig } from './getDuesConfig';
import { upsertDuesConfig } from './upsertDuesConfig';
import { listFunds } from './listFunds';
import { upsertFunds } from './upsertFunds';
import { recordPayment } from './recordPayment';
import { listPayments } from './listPayments';
import { getPayment } from './getPayment';
import { refundPayment } from './refundPayment';
import { getFinancialDashboard } from './getFinancialDashboard';

const dues = new Hono();

// Config
dues.get('/config/:orgId', getDuesConfig);
dues.put('/config/:orgId', upsertDuesConfig);

// Funds
dues.get('/funds/:orgId', listFunds);
dues.put('/funds/:orgId', upsertFunds);

// Payments
dues.get('/payments', listPayments);
dues.get('/payments/:id', getPayment);
dues.post('/payments', recordPayment);
dues.post('/payments/:id/refund', refundPayment);

// Dashboard
dues.get('/dashboard/:orgId', getFinancialDashboard);

export { dues };
