// Atendimento completo pelo WhatsApp: identificação por CPF, pré-triagem, escolha de
// especialidade, profissional, data e horário, confirmação, consulta e cancelamento.
// O estado da conversa fica no banco por 30 minutos, indexado pelo hash do remetente.
const { createHash, randomBytes, randomUUID } = require('node:crypto');
const catalog = require('../catalog.cjs');
const { triage, emergencySignal } = require('../triage.cjs');
const { rateLimit } = require('../auth.cjs');
const { getStore } = require('../store.cjs');
const { protectCpf, normalizeCpf } = require('../rules.cjs');
const { validateAppointment } = require('../appointment.cjs');

const SESSION_MS = 30 * 60000;
const TRIAGE_TTL = 30 * 86400000;
const NOTICE = '_Orientação inicial: não substitui avaliação médica. Em emergência, ligue 192._';
const URGENT = '🚨 *Seu relato pode indicar urgência.* Ligue *192* (SAMU) agora ou procure a emergência mais próxima. Não aguarde uma consulta agendada.';
const STATUS = { agendada: 'Agendada', chegou: 'Chegada registrada', realizada: 'Atendida', faltou: 'Falta registrada' };
const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const professionals = () => catalog.clinics.flatMap(clinic => clinic.professionals.map(item => ({ ...item, clinic })));
const recifeDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const weekdayName = date => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'America/Recife' }).format(new Date(`${date}T12:00:00-03:00`)).replace('.', '');
const brDate = date => date.split('-').reverse().join('/');
const protocol = id => 'AGD-' + id.replace(/-/g, '').slice(0, 6).toUpperCase();
const numbered = (items, label) => items.map((item, index) => `*${index + 1}* ${label(item)}`).join('\n');
const pick = (text, items) => { const index = Number.parseInt(plain(text), 10); return Number.isInteger(index) && index >= 1 && index <= items.length ? items[index - 1] : null; };
const answer = (reply, buttons = [], intent) => ({ reply, buttons, intent });

function nextDates(count = 5) {
  const dates = []; const cursor = new Date(`${recifeDate()}T12:00:00-03:00`);
  while (dates.length < count) {
    const date = cursor.toISOString().slice(0, 10);
    const lastSlot = Date.parse(`${date}T${catalog.times.at(-1)}:00-03:00`);
    if (![0, 6].includes(cursor.getUTCDay()) && lastSlot > Date.now()) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function menu(name) {
  return answer([`Olá${name ? `, *${name.split(' ')[0]}*` : ''}! Sou o atendimento do *Agendaê* — Saúde na Palma da Mão. 💚`, '', 'Como posso ajudar?',
    '*1* Agendar consulta (com pré-triagem)', '*2* Minhas consultas', '*3* Hospitais públicos do Recife', '*4* Canais oficiais e emergência', '',
    'Digite *0* a qualquer momento para voltar ao menu.'].join('\n'),
    [['1', 'Agendar consulta'], ['2', 'Minhas consultas'], ['3', 'Hospitais'], ['4', 'Canais oficiais']], 'menu');
}
function hospitalsText() {
  return ['*Hospitais estaduais no Recife*:', ...catalog.hospitals.map(item => `• *${item.name}* (${item.acronym}) — ${item.address}, ${item.neighborhood}`), '', `Fonte: ${catalog.hospitalSource.name}. Não indica vagas em tempo real.`, '', 'Digite *0* para voltar ao menu.'].join('\n');
}
function channelsText() {
  return ['*Canais oficiais*:', ...catalog.channels.map(item => `• *${item.name}* — ${item.contact}${item.href.startsWith('tel:') ? '' : ` (${item.href})`}`), '', 'Em emergência, ligue *192*.', 'Digite *0* para voltar ao menu.'].join('\n');
}

async function identify(state, text, store) {
  const cpf = normalizeCpf(text);
  if (!cpf) return answer('CPF inválido. Envie os 11 números do seu CPF (ex.: 52998224725) ou *0* para voltar.');
  const { cpfHash, cpfMasked } = protectCpf(cpf);
  const patient = await store.userByCpf(cpfHash);
  if (patient) {
    state.patient = { id: patient.id, name: patient.name };
    return null;
  }
  state.pendingCpf = { cpfHash, cpfMasked };
  state.step = 'name';
  return answer('Não encontrei cadastro com esse CPF. Qual é o seu *nome completo*?');
}
async function createPatient(state, text, store) {
  const name = String(text).trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 80 || /\d/.test(name)) return answer('Informe seu nome completo, sem números.');
  const id = randomUUID();
  // Paciente criado pelo WhatsApp: sem senha utilizável; identificação pelo CPF.
  await store.createUser({ id, name, email: `wa-${id}@whatsapp.agendae.invalid`, passwordHash: `${randomBytes(16).toString('hex')}:${randomBytes(64).toString('hex')}`, createdAt: Date.now(), channel: 'whatsapp' });
  await store.setCpf(id, state.pendingCpf.cpfHash, state.pendingCpf.cpfMasked);
  delete state.pendingCpf; state.patient = { id, name };
  return null;
}

function askSymptoms(state) {
  state.step = 'symptoms';
  return answer(`Certo, *${state.patient.name.split(' ')[0]}*. Vamos à pré-triagem. 🩺\n\n*O que você está sentindo?* Descreva com suas palavras (ex.: _dor no joelho ao subir escadas_).`);
}
function askProfessional(state) {
  const options = professionals().filter(item => item.specialty === state.specialty);
  state.step = 'professional';
  return answer(`*${state.specialty}* — escolha o profissional e a unidade:\n${numbered(options, item => `${item.name} — ${item.clinic.name}`)}`, options.map((item, index) => [String(index + 1), item.name]));
}
function askDate(state) {
  const dates = nextDates(); state.step = 'date'; state.dates = dates;
  return answer(`Escolha a *data*:\n${numbered(dates, item => `${weekdayName(item)}`)}`, dates.map((item, index) => [String(index + 1), weekdayName(item)]));
}
async function askTime(state, store) {
  const occupied = await store.occupied(state.professionalId, state.date);
  const free = catalog.times.filter(time => !occupied.includes(time) && Date.parse(`${state.date}T${time}:00-03:00`) > Date.now());
  if (!free.length) { const reply = askDate(state); reply.reply = `Não há horários livres em ${brDate(state.date)}.\n\n` + reply.reply; return reply; }
  state.step = 'time'; state.free = free;
  return answer(`Horários livres em *${weekdayName(state.date)}*:\n${numbered(free, item => item)}`, free.map((item, index) => [String(index + 1), item]));
}
function summary(state) {
  const pro = professionals().find(item => item.id === state.professionalId);
  state.step = 'confirm';
  return answer(['*Confira sua consulta:*', `👤 ${state.patient.name}`, `🩺 ${pro.specialty} — ${pro.name}`, `🏥 ${pro.clinic.name} (${pro.clinic.address})`, `📅 ${weekdayName(state.date)} às ${state.time}`, state.triageId ? '📋 Pré-triagem anexada para a unidade' : '', '', '*1* Confirmar', '*2* Escolher outro horário', '*0* Cancelar'].filter(line => line !== '').join('\n'),
    [['1', 'Confirmar'], ['2', 'Outro horário'], ['0', 'Cancelar']]);
}
async function listAppointments(state, store) {
  const today = recifeDate();
  const items = (await store.listAppointments(state.patient.id)).filter(item => item.date >= today);
  if (!items.length) { state.step = 'menu'; return answer('Você não tem consultas futuras. Digite *1* para agendar ou *0* para o menu.', [['1', 'Agendar consulta'], ['0', 'Menu']]); }
  state.step = 'appointments'; state.appointmentIds = items.map(item => item.id);
  const lines = items.map((item, index) => { const pro = professionals().find(entry => entry.id === item.professionalId); return `*${index + 1}* ${weekdayName(item.date)} ${item.time} — ${pro?.specialty}, ${pro?.name} (${pro?.clinic.name}) · ${STATUS[item.status || 'agendada']} · ${protocol(item.id)}`; });
  return answer(`*Suas consultas:*\n${lines.join('\n')}\n\nPara cancelar, digite o número da consulta. *0* volta ao menu.`, [...items.map((item, index) => [String(index + 1), `Cancelar ${index + 1}`]), ['0', 'Menu']]);
}

async function step(state, text, store, from) {
  const command = plain(text);
  if (['0', 'menu', 'inicio', 'voltar', 'cancelar', 'sair'].includes(command)) { const patient = state.patient; Object.keys(state).forEach(key => delete state[key]); if (patient) state.patient = patient; state.step = 'menu'; return menu(patient?.name); }
  if (['symptoms', 'duration', 'menu', undefined].includes(state.step) && text && emergencySignal(text)) { state.step = 'menu'; return answer(URGENT, [['0', 'Menu']], 'urgencia'); }
  switch (state.step) {
    case undefined: state.step = 'menu'; return menu(state.patient?.name);
    case 'menu':
      if (command === '1') { state.flow = 'agendar'; state.step = 'consent'; return answer('Para agendar, usamos seu *nome*, *CPF* e o *relato dos sintomas* somente para esta consulta, compartilhados com a unidade escolhida (LGPD).\n\n*1* Concordo\n*0* Voltar', [['1', 'Concordo'], ['0', 'Voltar']]); }
      if (command === '2') { state.flow = 'consultas'; if (state.patient) return listAppointments(state, store); state.step = 'cpf'; return answer('Para ver suas consultas, envie seu *CPF* (somente números).'); }
      if (command === '3') return answer(hospitalsText(), [['0', 'Menu']], 'hospitais');
      if (command === '4') return answer(channelsText(), [['0', 'Menu']], 'canais');
      return menu(state.patient?.name);
    case 'consent':
      if (command !== '1') return answer('Responda *1* para concordar ou *0* para voltar.', [['1', 'Concordo'], ['0', 'Voltar']]);
      state.consent = true;
      if (state.patient) return askSymptoms(state);
      state.step = 'cpf'; return answer('Envie seu *CPF* (somente números). Na unidade, a recepção usa o CPF para localizar sua consulta.');
    case 'cpf': {
      const pending = await identify(state, text, store);
      if (pending) return pending;
      return state.flow === 'consultas' ? listAppointments(state, store) : askSymptoms(state);
    }
    case 'name': {
      const pending = await createPatient(state, text, store);
      if (pending) return pending;
      return state.flow === 'consultas' ? listAppointments(state, store) : askSymptoms(state);
    }
    case 'symptoms':
      if (String(text).trim().length < 10) return answer('Descreva um pouco mais (pelo menos 10 caracteres). Não envie nome, CPF ou contato aqui.');
      state.symptoms = String(text).trim().slice(0, 1000); state.step = 'duration';
      return answer('*Há quanto tempo* você sente isso? (ex.: _há dois dias_)');
    case 'duration':
      state.duration = String(text).trim().slice(0, 80) || 'não informada'; state.step = 'intensity';
      return answer('Qual a *intensidade*?\n*1* Leve\n*2* Moderada\n*3* Intensa', [['1', 'Leve'], ['2', 'Moderada'], ['3', 'Intensa']]);
    case 'intensity': {
      const intensity = { 1: 'leve', 2: 'moderada', 3: 'intensa' }[command];
      if (!intensity) return answer('Responda *1*, *2* ou *3*.', [['1', 'Leve'], ['2', 'Moderada'], ['3', 'Intensa']]);
      await rateLimit(`triage-chat:${hash(from)}`, 5, 3600000);
      const input = { symptoms: state.symptoms, duration: state.duration, intensity, consent: true };
      const result = await triage(input);
      const id = randomUUID(); const now = Date.now();
      await store.saveTriage({ id, userId: state.patient.id, createdAt: now, expiresAt: now + TRIAGE_TTL, data: { ...input, specialty: result.specialty, confidence: result.confidence, urgent: result.urgent, source: result.source, createdAt: now, channel: 'whatsapp' } });
      delete state.symptoms; delete state.duration;
      if (result.urgent) { state.step = 'menu'; return answer(URGENT, [['0', 'Menu']], 'urgencia'); }
      state.triageId = id; state.suggested = result.specialty || 'Clínica Geral'; state.step = 'specialty';
      const origin = result.source === 'ai' ? 'gerada por IA' : result.source === 'regras' ? 'por regras locais' : 'padrão';
      return answer([`Sugestão inicial (${origin}): *${state.suggested}*${result.confidence === 'baixa' ? ' — as informações não permitem algo mais específico' : ''}.`, NOTICE, '', `*1* Agendar com ${state.suggested}`, '*2* Escolher outra especialidade'].join('\n'), [['1', state.suggested], ['2', 'Outra especialidade']], 'triagem');
    }
    case 'specialty':
      if (command === '1') { state.specialty = state.suggested; return askProfessional(state); }
      if (command === '2') { state.step = 'specialty-list'; return answer(`Escolha a especialidade:\n${numbered(catalog.specialties, item => item)}`, catalog.specialties.map((item, index) => [String(index + 1), item])); }
      return answer('Responda *1* ou *2*.');
    case 'specialty-list': {
      const specialty = pick(text, catalog.specialties);
      if (!specialty) return answer('Escolha um número da lista.');
      state.specialty = specialty; return askProfessional(state);
    }
    case 'professional': {
      const pro = pick(text, professionals().filter(item => item.specialty === state.specialty));
      if (!pro) return answer('Escolha um número da lista.');
      state.professionalId = pro.id; state.clinicId = pro.clinic.id; return askDate(state);
    }
    case 'date': {
      const date = pick(text, state.dates || []);
      if (!date) return answer('Escolha um número da lista de datas.');
      state.date = date; return askTime(state, store);
    }
    case 'time': {
      const time = pick(text, state.free || []);
      if (!time) return answer('Escolha um número da lista de horários.');
      state.time = time; return summary(state);
    }
    case 'confirm': {
      if (command === '2') return askTime(state, store);
      if (command !== '1') return answer('Responda *1* para confirmar, *2* para outro horário ou *0* para cancelar.');
      const appointment = { id: randomUUID(), patient: state.patient.name, clinicId: state.clinicId, professionalId: state.professionalId, date: state.date, time: state.time, status: 'agendada', triageId: state.triageId };
      const invalid = validateAppointment(appointment);
      if (invalid) return askTime(state, store);
      try { await store.saveAppointment(appointment, state.patient.id, true); }
      catch (error) { if (error.status === 409) { const retry = await askTime(state, store); retry.reply = 'Esse horário acabou de ser ocupado. 😕\n\n' + retry.reply; return retry; } throw error; }
      const pro = professionals().find(item => item.id === appointment.professionalId);
      const patient = state.patient; Object.keys(state).forEach(key => delete state[key]); state.patient = patient; state.step = 'menu';
      return answer(['✅ *Consulta confirmada!*', `Protocolo: *${protocol(appointment.id)}*`, `${pro.specialty} — ${pro.name}`, `${pro.clinic.name} · ${weekdayName(appointment.date)} às ${appointment.time}`, '', 'Na recepção, informe seu *CPF*: sua pré-triagem já estará disponível para a equipe.', '', 'Digite *2* para ver suas consultas ou *0* para o menu.'].join('\n'), [['2', 'Minhas consultas'], ['0', 'Menu']], 'agendado');
    }
    case 'appointments': {
      const id = pick(text, state.appointmentIds || []);
      if (!id) return answer('Digite o número da consulta para cancelar ou *0* para o menu.');
      state.cancelId = id; state.step = 'cancel';
      return answer(`Cancelar a consulta *${protocol(id)}*?\n*1* Sim, cancelar\n*2* Não`, [['1', 'Sim, cancelar'], ['2', 'Não']]);
    }
    case 'cancel':
      if (command === '1') {
        try { await store.deleteAppointment(state.cancelId, state.patient.id); }
        catch (error) { if (error.status === 409 || error.status === 404) { state.step = 'menu'; return answer('Essa consulta já foi registrada pela unidade e não pode ser cancelada aqui. Digite *0* para o menu.'); } throw error; }
        const reply = await listAppointments(state, store);
        reply.reply = '❎ Consulta cancelada e horário liberado.\n\n' + reply.reply; return reply;
      }
      return listAppointments(state, store);
    default:
      state.step = 'menu'; return menu(state.patient?.name);
  }
}

async function reply({ text, from }) {
  const message = String(text || '').trim().slice(0, 1000);
  const key = hash(`conversation:${from}`);
  let store;
  try {
    store = getStore();
    await rateLimit(`chat-msg:${key}`, 60, 600000);
    const state = (await store.getConversation(key)) || {};
    const result = await step(state, message, store, from);
    await store.saveConversation(key, state, Date.now() + SESSION_MS);
    return { intent: result.intent || state.step, reply: result.reply, buttons: result.buttons.map(([value, title]) => ({ value, title })) };
  } catch (error) {
    if (error.status === 429) return { intent: 'limite', reply: 'Muitas mensagens em pouco tempo. Aguarde alguns minutos. Em emergência, ligue *192*.', buttons: [] };
    if (error.status === 422 || error.status === 409) return { intent: 'erro', reply: `${error.message}\nDigite *0* para o menu.`, buttons: [] };
    return { intent: 'indisponivel', reply: 'O atendimento está indisponível no momento. Em emergência, ligue *192*.', buttons: [] };
  }
}
module.exports = { reply, menu, nextDates, protocol };
