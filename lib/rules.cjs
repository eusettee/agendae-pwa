// Regras de negócio: perfis, permissões, situação da consulta e CPF.
const { createHmac } = require('node:crypto');
const { fail } = require('./http.cjs');
const catalog = require('./catalog.cjs');
const STAFF_ROLES = ['recepcao', 'profissional'];
const STATUSES = ['agendada', 'chegou', 'realizada', 'faltou'];
// Quem pode mudar de qual situação para qual.
const TRANSITIONS = {
  recepcao: { agendada: ['chegou', 'faltou'], chegou: ['agendada'] },
  profissional: { agendada: ['realizada', 'faltou'], chegou: ['realizada', 'faltou'] }
};
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function requireStaff(user) {
  if (!STAFF_ROLES.includes(user?.role)) fail(403, 'Acesso restrito à equipe da unidade.');
}
function inScope(user, appointment) {
  return user.role === 'recepcao' ? appointment.clinicId === user.clinicId : appointment.professionalId === user.professionalId;
}
function checkTransition(user, appointment, next) {
  if (!STATUSES.includes(next)) fail(422, 'Situação inválida.');
  if (!inScope(user, appointment)) fail(404, 'Consulta não encontrada.');
  if (!(TRANSITIONS[user.role][appointment.status || 'agendada'] || []).includes(next)) fail(409, 'Esta mudança de situação não é permitida.');
  if (next === 'chegou' && appointment.date !== today()) fail(409, 'A chegada só pode ser registrada no dia da consulta.');
}
function staffAssignment({ role, clinicId, professionalId }) {
  if (role === 'recepcao' && catalog.clinics.some(clinic => clinic.id === clinicId)) return { role, clinicId, professionalId: null };
  const clinic = catalog.clinics.find(item => item.professionals.some(pro => pro.id === professionalId));
  if (role === 'profissional' && clinic) return { role, clinicId: clinic.id, professionalId };
  fail(422, 'Escolha uma função e uma unidade ou profissional válidos.');
}
function panelCode() {
  if (process.env.PANEL_ACCESS_CODE) return process.env.PANEL_ACCESS_CODE;
  // Código de demonstração acadêmica; em uso real, defina PANEL_ACCESS_CODE.
  return 'painel-demo';
}

function normalizeCpf(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return null;
  const check = length => { const sum = [...digits.slice(0, length)].reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0); const rest = (sum * 10) % 11; return rest === 10 ? 0 : rest; };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]) ? digits : null;
}
function cpfSecret() {
  if (process.env.CPF_SECRET) return process.env.CPF_SECRET;
  // Sem CPF_SECRET, deriva a chave de um segredo que já existe apenas no servidor.
  if (process.env.FIREBASE_PRIVATE_KEY) return createHmac('sha256', process.env.FIREBASE_PRIVATE_KEY).update('agendae-cpf').digest('hex');
  if (process.env.VERCEL) fail(503, 'Identificação por CPF ainda não configurada.');
  return 'agendae-local-cpf';
}
// O banco guarda apenas o HMAC (para busca) e a versão mascarada (para exibição).
function protectCpf(value) {
  const cpf = normalizeCpf(value);
  if (!cpf) fail(422, 'Informe um CPF válido.');
  return { cpfHash: createHmac('sha256', cpfSecret()).update(cpf).digest('hex'), cpfMasked: `***.${cpf.slice(3, 6)}.***-${cpf.slice(9)}` };
}
module.exports = { STAFF_ROLES, STATUSES, requireStaff, inScope, checkTransition, staffAssignment, panelCode, normalizeCpf, protectCpf, today };
