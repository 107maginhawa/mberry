import { Hono } from 'hono';
import { listCertificates } from './listCertificates';
import { getCertificate } from './getCertificate';

const certificates = new Hono();

certificates.get('/my', listCertificates);
certificates.get('/:id', getCertificate);

export { certificates };
