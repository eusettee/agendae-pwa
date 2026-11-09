// Atendimento por mensagens (WhatsApp ou outros canais do gateway), sem estado de conversa.
// Não registra telefone nem relato: apenas devolve a resposta textual.
const { createHash } = require('node:crypto');
const catalog = require('../catalog.cjs');
const { triage, emergencySignal } = require('../triage.cjs');
const { rateLimit } = require('../auth.cjs');
const { getStore } = require('../store.cjs');

let baseUrl = null;
const appUrl = () => (baseUrl || process.env.APP_URL || 'https://agendae-pwa.vercel.app').replace(/\/$/, '');
const plain = text => String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const senderKey = from => createHash('sha256').update(String(from)).digest('hex');
const URGENT = '🚨 *Seu relato pode indicar urgência.* Ligue *192* (SAMU) agora ou procure a emergência mais próxima. Este atendimento não faz diagnóstico.';
const NOTICE = '_Orientação inicial: não substitui avaliação médica. Em emergência, ligue 192._';

function menu() {
  return ['Olá! Sou o atendimento do *Agendaê* — Saúde na Palma da Mão.', '',
    '*1* Especialidades e unidades', '*2* Hospitais públicos do Recife', '*3* Pré-triagem: envie _triagem_ + o que sente e há quanto tempo',
    '*4* Horários livres: _horarios ana 2099-10-05_', '*5* Canais oficiais e emergência', '*6* Agendar consulta', '',
    'Ao enviar uma pré-triagem, você autoriza o envio do relato à IA apenas para sugerir uma especialidade. Não envie nome, CPF ou contato.', NOTICE].join('\n');
}
function specialtiesText() {
  return ['*Especialidades e unidades* (dados fictícios de demonstração):',
    ...catalog.clinics.map(clinic => `\n*${clinic.name}* — ${clinic.address}\n${clinic.professionals.map(item => `• ${item.specialty}: ${item.name} (código _${item.id}_)`).join('\n')}`),
    '', `Agende em ${appUrl()}/#agendar`].join('\n');
}
function hospitalsText(query = '') {
  const term = plain(query);
  const list = catalog.hospitals.filter(item => !term || plain(`${item.name} ${item.acronym} ${item.neighborhood}`).includes(term));
  if (!list.length) return `Nenhum hospital encontrado para "${query}". Envie *2* para ver todos.`;
  return ['*Hospitais estaduais no Recife*:', ...list.map(item => `• *${item.name}* (${item.acronym}) — ${item.address}, ${item.neighborhood}`), '', `Fonte: ${catalog.hospitalSource.name}. Não indica vagas em tempo real.`].join('\n');
}
function channelsText() {
  return ['*Canais oficiais*:', ...catalog.channels.map(item => `• *${item.name}* — ${item.contact}${item.href.startsWith('tel:') ? '' : ` (${item.href})`}: ${item.description}`)].join('\n');
}
function clinicsFor(specialty) {
  return catalog.clinics.filter(clinic => clinic.professionals.some(item => item.specialty === specialty)).map(clinic => clinic.name);
}

async function freeTimes(args) {
  const [professionalId, date] = args.split(/\s+/);
  const professional = catalog.clinics.flatMap(clinic => clinic.professionals.map(item => ({ ...item, clinic }))).find(item => item.id === plain(professionalId));
  if (!professional || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Envie: *horarios* <código do profissional> <AAAA-MM-DD>. Exemplo: _horarios ana 2099-10-05_. Envie *1* para ver os códigos.';
  const weekday = new Date(`${date}T12:00:00-03:00`).getUTCDay();
  if (!Number.isFinite(weekday) || [0, 6].includes(weekday)) return 'Atendimento de segunda a sexta. Escolha outra data.';
  const occupied = await getStore().occupied(professional.id, date);
  const now = Date.now();
  const free = catalog.times.filter(time => !occupied.includes(time) && Date.parse(`${date}T${time}:00-03:00`) > now);
  return free.length ? `*${professional.name}* (${professional.specialty}, ${professional.clinic.name}) em ${date.split('-').reverse().join('/')}:\n${free.join(' · ')}\n\nPara reservar: ${appUrl()}/#agendar` : 'Não há horários livres nessa data. Tente outro dia.';
}

async function preTriage(text, from) {
  if (text.length < 10) return 'Envie *triagem* seguido do que você sente e há quanto tempo. Exemplo: _triagem dor no joelho ao caminhar há dois dias_.';
  await rateLimit(`triage-chat:${senderKey(from)}`, 5, 3600000);
  const result = await triage({ symptoms: text.slice(0, 1000), duration: 'não informada', intensity: 'não informada', consent: true });
  if (result.urgent) return URGENT;
  if (!result.specialty) return `${result.message || 'Não foi possível sugerir uma especialidade.'}\nVeja as opções com *1* ou agende em ${appUrl()}/#agendar\n\n${NOTICE}`;
  const clinics = clinicsFor(result.specialty);
  return [`Sugestão inicial: *${result.specialty}*${result.confidence === 'baixa' ? ' (informações insuficientes para algo mais específico)' : ''}${result.source === 'regras' ? ' — por regras locais' : result.source === 'ai' ? ' — gerada por IA' : ''}.`,
    clinics.length ? `Unidades compatíveis: ${clinics.join(', ')}.` : '', `Agende pelo app: ${appUrl()}/#agendar`, 'No app, você pode refazer a pré-triagem e compartilhá-la com a unidade.', '', NOTICE].filter(Boolean).join('\n');
}

async function reply({ text, from, appUrl: url }) {
  baseUrl = url || null;
  const message = String(text || '').trim().slice(0, 1000);
  const command = plain(message);
  if (message && emergencySignal(message)) return { intent: 'urgencia', reply: URGENT };
  const [word, ...rest] = command.split(/\s+/);
  const args = message.split(/\s+/).slice(1).join(' ');
  try {
    if (['1', 'especialidades', 'especialidade', 'unidades'].includes(word)) return { intent: 'especialidades', reply: specialtiesText() };
    if (['2', 'hospitais', 'hospital'].includes(word)) return { intent: 'hospitais', reply: hospitalsText(args) };
    if (['3', 'triagem', 'pre-triagem', 'sintomas'].includes(word)) return { intent: 'triagem', reply: await preTriage(args, from) };
    if (['4', 'horarios', 'horario', 'disponibilidade'].includes(word)) return { intent: 'horarios', reply: await freeTimes(rest.join(' ')) };
    if (['5', 'canais', 'emergencia', '192', 'samu'].includes(word)) return { intent: 'canais', reply: channelsText() };
    if (['6', 'agendar', 'consulta', 'marcar'].includes(word)) return { intent: 'agendar', reply: `Agende, edite ou cancele sua consulta em ${appUrl()}/#agendar\nCom login, a recepção localiza sua consulta pelo CPF cadastrado.` };
  } catch (error) {
    if (error.status === 429) return { intent: 'limite', reply: 'Você atingiu o limite de pré-triagens por hora. Tente mais tarde ou use o app.' };
    return { intent: 'indisponivel', reply: `Este serviço está indisponível no momento. Use o app em ${appUrl()} ou, em emergência, ligue 192.` };
  }
  return { intent: 'menu', reply: menu() };
}
module.exports = { reply, menu };
