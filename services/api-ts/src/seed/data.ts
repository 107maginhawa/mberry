import type { MemberStatus } from './types';

export const OFFICERS = [
  { email: 'test@memberry.ph', firstName: 'Maria', lastName: 'Santos', position: 'President', spec: 'Orthodontics', license: '0012345' },
  { email: 'treasurer@memberry.ph', firstName: 'Juan', lastName: 'Cruz', position: 'Treasurer', spec: 'Prosthodontics', license: '0023456' },
  { email: 'secretary@memberry.ph', firstName: 'Ana', lastName: 'Reyes', position: 'Secretary', spec: 'Pediatric Dentistry', license: '0034567' },
  { email: 'society@memberry.ph', firstName: 'Carlos', lastName: 'Diaz', position: 'Society Officer', spec: 'Endodontics', license: '0045678' },
  { email: 'membership@memberry.ph', firstName: 'Sofia', lastName: 'Garcia', position: 'Membership Chair', spec: 'General Dentistry', license: '0056789' },
];

export const MEMBERS: Array<{ email: string; firstName: string; lastName: string; spec: string; license: string; status: MemberStatus }> = [
  // Legacy test user (referenced by 6+ test files — DO NOT REMOVE)
  { email: 'member@memberry.ph', firstName: 'Miguel', lastName: 'Bautista', spec: 'General Dentistry', license: '0099999', status: 'active' },
  // 15 active (dues paid, future expiry)
  { email: 'member01@memberry.ph', firstName: 'Isabella', lastName: 'Dela Cruz', spec: 'General Dentistry', license: '0100001', status: 'active' },
  { email: 'member02@memberry.ph', firstName: 'Luis', lastName: 'Ramos', spec: 'Oral Surgery', license: '0100002', status: 'active' },
  { email: 'member03@memberry.ph', firstName: 'Patricia', lastName: 'Navarro', spec: 'Periodontics', license: '0100003', status: 'active' },
  { email: 'member04@memberry.ph', firstName: 'Fernando', lastName: 'Bautista', spec: 'Orthodontics', license: '0100004', status: 'active' },
  { email: 'member05@memberry.ph', firstName: 'Carmen', lastName: 'Aquino', spec: 'Endodontics', license: '0100005', status: 'active' },
  { email: 'member06@memberry.ph', firstName: 'Roberto', lastName: 'Flores', spec: 'Prosthodontics', license: '0100006', status: 'active' },
  { email: 'member07@memberry.ph', firstName: 'Teresa', lastName: 'Santiago', spec: 'Pediatric Dentistry', license: '0100007', status: 'active' },
  { email: 'member08@memberry.ph', firstName: 'Antonio', lastName: 'Torres', spec: 'General Dentistry', license: '0100008', status: 'active' },
  { email: 'member09@memberry.ph', firstName: 'Rosa', lastName: 'Mendoza', spec: 'Oral Pathology', license: '0100009', status: 'active' },
  { email: 'member10@memberry.ph', firstName: 'Diego', lastName: 'Rivera', spec: 'Orthodontics', license: '0100010', status: 'active' },
  { email: 'member11@memberry.ph', firstName: 'Lucia', lastName: 'Hernandez', spec: 'General Dentistry', license: '0100011', status: 'active' },
  { email: 'member12@memberry.ph', firstName: 'Marco', lastName: 'Lim', spec: 'Prosthodontics', license: '0100012', status: 'active' },
  { email: 'member13@memberry.ph', firstName: 'Gabriela', lastName: 'Tan', spec: 'Periodontics', license: '0100013', status: 'active' },
  { email: 'member14@memberry.ph', firstName: 'Pedro', lastName: 'Sy', spec: 'Oral Surgery', license: '0100014', status: 'active' },
  { email: 'member15@memberry.ph', firstName: 'Andrea', lastName: 'Ong', spec: 'General Dentistry', license: '0100015', status: 'active' },
  // 3 grace period (expired 10-20 days ago, within 30-day grace)
  { email: 'member16@memberry.ph', firstName: 'Jose', lastName: 'Co', spec: 'Endodontics', license: '0100016', status: 'grace' },
  { email: 'member17@memberry.ph', firstName: 'Valeria', lastName: 'Chua', spec: 'General Dentistry', license: '0100017', status: 'grace' },
  { email: 'member18@memberry.ph', firstName: 'Ricardo', lastName: 'Go', spec: 'Pediatric Dentistry', license: '0100018', status: 'grace' },
  // 2 lapsed (expired 60-90 days ago, past grace)
  { email: 'member19@memberry.ph', firstName: 'Catalina', lastName: 'Yap', spec: 'General Dentistry', license: '0100019', status: 'lapsed' },
  { email: 'member20@memberry.ph', firstName: 'Eduardo', lastName: 'Ang', spec: 'Prosthodontics', license: '0100020', status: 'lapsed' },
  // 2 suspended (officer action — non-payment escalation or conduct issue)
  { email: 'member21@memberry.ph', firstName: 'Mariana', lastName: 'Castillo', spec: 'General Dentistry', license: '0100021', status: 'suspended' },
  { email: 'member22@memberry.ph', firstName: 'Sergio', lastName: 'Wu', spec: 'Oral Surgery', license: '0100022', status: 'suspended' },
  // 1 removed (irreversible — fraudulent credentials)
  { email: 'member23@memberry.ph', firstName: 'Daniela', lastName: 'Lee', spec: 'Periodontics', license: '0100023', status: 'removed' },
  // 2 pendingPayment (approved but awaiting first dues payment)
  { email: 'member24@memberry.ph', firstName: 'Francisco', lastName: 'Gonzales', spec: 'General Dentistry', license: '0100024', status: 'pendingPayment' },
  { email: 'member25@memberry.ph', firstName: 'Claudia', lastName: 'Tiu', spec: 'Orthodontics', license: '0100025', status: 'pendingPayment' },
  // 1 expired (dues expired over a year ago)
  { email: 'member26@memberry.ph', firstName: 'Ramon', lastName: 'Villanueva', spec: 'General Dentistry', license: '0100026', status: 'expired' },
  // 1 resigned (voluntary departure)
  { email: 'member27@memberry.ph', firstName: 'Elena', lastName: 'Santos', spec: 'Prosthodontics', license: '0100027', status: 'resigned' },
  // 1 deceased (terminal state — LIF-04)
  { email: 'member28@memberry.ph', firstName: 'Gregorio', lastName: 'Padilla', spec: 'General Dentistry', license: '0100028', status: 'deceased' },
  // 1 expelled (terminal state — disciplinary removal)
  { email: 'member29@memberry.ph', firstName: 'Vivian', lastName: 'Ramos', spec: 'Oral Surgery', license: '0100029', status: 'expelled' },
];

export const APPLICANTS = [
  { email: 'applicant01@memberry.ph', firstName: 'Beatriz', lastName: 'Lao', spec: 'General Dentistry', license: '0200001', rejected: false },
  { email: 'applicant02@memberry.ph', firstName: 'Manuel', lastName: 'Yu', spec: 'Prosthodontics', license: '0200002', rejected: true },
];
