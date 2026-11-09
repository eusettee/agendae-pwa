/* Painel restrito: recepção (chegada por CPF) e profissional (agenda e pré-triagem). Exige internet. */
const catalogData = window.AGENDAE_CATALOG;
const $ = selector => document.querySelector(selector);
const REFRESH_MS = 10000;
const STATUS = { agendada: 'Agendada', chegou: 'Chegou', realizada: 'Atendida', faltou: 'Faltou' };
const ACTIONS = { recepcao: { agendada: [['chegou', 'Registrar chegada'], ['faltou', 'Registrar falta']], chegou: [['agendada', 'Desfazer chegada']] }, profissional: { agendada: [['realizada', 'Marcar atendida'], ['faltou', 'Registrar falta']], chegou: [['realizada', 'Marcar atendida'], ['faltou', 'Registrar falta']] } };
let staff = null; let toastTimer; let loading = false;

const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
function showToast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000); }
function today() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function show(id) { document.querySelectorAll('.page').forEach(page => { page.hidden = page.id !== id; }); }
function showError(id, message) { $(id).textContent = message; $(id).hidden = !message; }
function professional(id) { for (const clinic of catalogData.clinics) { const item = clinic.professionals.find(entry => entry.id === id); if (item) return { ...item, clinic }; } return null; }

async function api(path, method = 'GET', body) {
  if (!navigator.onLine) throw new Error('O painel precisa de internet.');
  const response = await fetch(`/api/${path}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) { staff = null; route(); }
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.');
  return result;
}

function triageBlock(triage) {
  const box = element('details', 'unit-details');
  box.append(element('summary', '', triage.urgent ? 'Pré-triagem · sinal de urgência' : `Pré-triagem · ${triage.specialty || 'escolha manual'}`));
  box.append(element('p', '', `Relato: ${triage.symptoms}`), element('p', 'muted', `Duração: ${triage.duration} · Intensidade: ${triage.intensity} · Confiança: ${triage.confidence} · Origem: ${triage.source === 'ai' ? 'IA' : triage.source === 'safety' ? 'regra de segurança' : triage.source === 'regras' ? 'regras locais' : 'manual'}`));
  return box;
}

function appointmentCard(item, showDate = false) {
  const info = professional(item.professionalId);
  const card = element('article', 'card appointment');
  const content = element('div');
  content.append(element('span', 'appointment-date', `${showDate ? item.date.split('-').reverse().join('/') + ' · ' : ''}${item.time} · ${STATUS[item.status] || item.status}`), element('h2', '', item.patient), element('p', 'muted', `${info?.specialty || ''} · ${info?.name || item.professionalId} · ${info?.clinic.name || item.clinicId}`));
  content.append(item.triage ? triageBlock(item.triage) : element('p', 'muted', 'Sem pré-triagem compartilhada.'));
  const actions = element('div', 'appointment-actions');
  for (const [status, label] of (ACTIONS[staff.role]?.[item.status] || []).filter(([next]) => next !== 'chegou' || item.date === today())) {
    const button = element('button', status === 'faltou' || status === 'agendada' ? 'button secondary' : 'button', label);
    button.type = 'button'; button.setAttribute('aria-label', `${label}: ${item.patient} às ${item.time}`);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try { await api('panel', 'PUT', { id: item.id, status }); showToast(`${label}: ${item.patient}.`); $('#lookup-result').replaceChildren(); await loadAgenda(true); }
      catch (error) { showToast(error.message); button.disabled = false; }
    });
    actions.append(button);
  }
  card.append(content, actions); return card;
}

async function loadAgenda(force = false) {
  if (!staff || loading || (!force && (document.hidden || !navigator.onLine))) return;
  loading = true;
  try {
    const result = await api(`panel?date=${encodeURIComponent($('#panel-date').value)}`);
    const list = $('#panel-list'); list.replaceChildren(...result.appointments.map(item => appointmentCard(item)));
    $('#panel-summary').textContent = result.appointments.length ? `${result.appointments.length} consulta(s) · atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Nenhuma consulta nesta data.';
  } catch (error) { $('#panel-summary').textContent = error.message; }
  finally { loading = false; }
}

function populateActivation() {
  $('#activate-clinic').replaceChildren(...catalogData.clinics.map(clinic => new Option(clinic.name, clinic.id)));
  $('#activate-professional').replaceChildren(...catalogData.clinics.flatMap(clinic => clinic.professionals.map(item => new Option(`${item.name} · ${item.specialty} · ${clinic.name}`, item.id))));
  const toggle = () => { const pro = $('#activate-role').value === 'profissional'; $('#activate-professional-field').hidden = !pro; $('#activate-clinic-field').hidden = pro; };
  $('#activate-role').addEventListener('change', toggle); toggle();
}

function route() {
  $('#panel-logout').hidden = !staff;
  if (!staff) { $('#panel-user').textContent = 'Painel da unidade'; show('panel-login'); return; }
  $('#panel-user').textContent = `Olá, ${staff.name}`;
  if (!['recepcao', 'profissional'].includes(staff.role)) { show('panel-activate'); return; }
  const pro = staff.role === 'profissional' ? professional(staff.professionalId) : null;
  const clinic = catalogData.clinics.find(item => item.id === staff.clinicId);
  $('#panel-scope').textContent = pro ? `PROFISSIONAL · ${pro.name.toUpperCase()}` : `RECEPÇÃO · ${(clinic?.name || '').toUpperCase()}`;
  $('#lookup-form').hidden = staff.role !== 'recepcao';
  show('panel-main'); loadAgenda(true);
}

async function initialize() {
  $('#panel-date').value = today();
  const connection = () => { $('#connection').textContent = navigator.onLine ? 'Online' : 'Offline'; $('#connection').classList.toggle('offline', !navigator.onLine); };
  window.addEventListener('online', connection); window.addEventListener('offline', connection); connection();
  populateActivation();
  $('#panel-date').addEventListener('change', () => loadAgenda(true));
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); showError('#login-error', '');
    try { staff = (await api('auth', 'POST', { action: 'login', email: $('#login-email').value, password: $('#login-password').value })).user; $('#login-form').reset(); route(); }
    catch (error) { showError('#login-error', error.message); }
  });
  $('#activate-form').addEventListener('submit', async event => {
    event.preventDefault(); showError('#activate-error', '');
    const role = $('#activate-role').value;
    try {
      staff = (await api('panel', 'POST', { action: 'activate', role, code: $('#activate-code').value, ...(role === 'profissional' ? { professionalId: $('#activate-professional').value } : { clinicId: $('#activate-clinic').value }) })).user;
      $('#activate-form').reset(); populateActivation(); showToast('Acesso da equipe ativado.'); route();
    } catch (error) { showError('#activate-error', error.message); }
  });
  $('#lookup-form').addEventListener('submit', async event => {
    event.preventDefault(); showError('#lookup-error', ''); const box = $('#lookup-result'); box.replaceChildren();
    try {
      const result = await api('panel', 'POST', { action: 'lookup', cpf: $('#lookup-cpf').value });
      $('#lookup-form').reset();
      const heading = element('h2', '', `${result.patient.name} · CPF ${result.patient.cpfMasked}`);
      box.append(heading, ...(result.appointments.length ? result.appointments.map(item => appointmentCard(item, true)) : [element('p', 'muted', 'Nenhuma consulta futura nesta unidade.')]));
    } catch (error) { showError('#lookup-error', error.message); }
  });
  $('#panel-logout').addEventListener('click', async () => { try { await api('auth', 'POST', { action: 'logout' }); } catch { /* sessão já encerrada */ } staff = null; route(); });
  setInterval(() => loadAgenda(), REFRESH_MS);
  document.addEventListener('visibilitychange', () => loadAgenda());
  try { staff = navigator.onLine ? (await api('auth')).user : null; } catch { staff = null; }
  if (!navigator.onLine) showToast('O painel precisa de internet.');
  route();
}
initialize();
