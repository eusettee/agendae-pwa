const catalog = require('./catalog.cjs');
function validateAppointment(input, now = Date.now()) {
  if (!input || typeof input !== 'object') return 'Informe os dados da consulta.';
  const clinic = catalog.clinics.find(item => item.id === input.clinicId);
  const professional = clinic?.professionals.find(item => item.id === input.professionalId);
  if (!professional) return 'Escolha uma unidade e um profissional válidos.';
  if (typeof input.patient !== 'string' || input.patient.trim().length < 2 || input.patient.trim().length > 80) return 'Informe um nome entre 2 e 80 caracteres.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !catalog.times.includes(input.time)) return 'Escolha uma data e um horário válidos.';
  const date = new Date(`${input.date}T${input.time}:00-03:00`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.date) return 'Escolha uma data válida.';
  if (date.getTime() <= now) return 'Escolha um horário futuro.';
  if ([0, 6].includes(new Date(`${input.date}T12:00:00-03:00`).getUTCDay())) return 'Escolha um dia de segunda a sexta.';
  return null;
}
module.exports = { validateAppointment };
