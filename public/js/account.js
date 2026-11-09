let currentAccount = null;
let registerMode = false;
let occupiedSlots = [];
let availabilityKey = '';
let liveRefreshPending = false;
const LIVE_REFRESH_MS = 5000;

async function refreshSharedData() {
  if (!currentAccount || !navigator.onLine || document.hidden || liveRefreshPending) return;
  liveRefreshPending = true;
  try {
    await loadAccountAppointments();
    if (location.hash === '#agendar') await loadAvailability();
  } catch { /* A próxima atualização tenta novamente sem interromper o formulário. */ }
  finally { liveRefreshPending = false; }
}

async function apiRequest(path, method = 'GET', body) {
  if (!navigator.onLine) throw new Error('Esta ação precisa de internet. O modo demonstração continua disponível offline.');
  const response = await fetch(`/api/${path}`, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(25000) });
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401 && currentAccount) {
      currentAccount = null; appointments = readAppointments(); updateAccountUI(); renderAppointments();
    }
    throw new Error(result.error || 'Não foi possível concluir. Tente novamente.');
  }
  return result;
}

function updateAccountUI() {
  $('#account-link').textContent = currentAccount ? `Olá, ${currentAccount.name}` : 'Entrar / criar conta';
  $('#account-link').href = '#conta';
  $('#auth-form').hidden = Boolean(currentAccount); $('#profile-form').hidden = !currentAccount;
  $('#auth-title').textContent = currentAccount ? 'Minha conta' : registerMode ? 'Criar conta' : 'Entrar';
  const cpf = currentAccount?.cpfMasked; $('#profile-cpf-current').hidden = !cpf; $('#profile-cpf-current').textContent = cpf ? `CPF cadastrado: ${cpf}` : ''; $('#profile-remove').hidden = !cpf;
  $('#logout').hidden = !currentAccount;
  $('#patient').readOnly = Boolean(currentAccount);
  if (currentAccount) $('#patient').value = currentAccount.name;
  $('#booking-consent-text').textContent = currentAccount ? 'Concordo em salvar esta consulta de demonstração na minha conta.' : 'Concordo em salvar esta demonstração neste dispositivo.';
  $('#appointments-description').textContent = currentAccount ? 'Consultas da sua conta. Alterações precisam de internet.' : 'Sua agenda de demonstração, salva neste dispositivo.';
  if (!editingAppointmentId) $('#submit-booking').textContent = currentAccount ? 'Salvar consulta na minha conta →' : 'Salvar consulta de demonstração →';
}

async function loadAccountAppointments() {
  const accountId = currentAccount?.id;
  if (!accountId) return;
  const result = await apiRequest('appointments');
  if (currentAccount?.id !== accountId) return;
  if (JSON.stringify(appointments) === JSON.stringify(result.appointments)) return;
  appointments = result.appointments;
  renderAppointments(); renderSlots(false);
}

async function loadAvailability() {
  if (!currentAccount || !navigator.onLine) return;
  const accountId = currentAccount.id;
  const key = `${$('#professional').value}|${$('#date').value}`;
  try {
    const result = await apiRequest(`availability?professionalId=${encodeURIComponent($('#professional').value)}&date=${encodeURIComponent($('#date').value)}`);
    if (currentAccount?.id !== accountId || key !== `${$('#professional').value}|${$('#date').value}`) return;
    occupiedSlots = result.occupied; availabilityKey = key; renderSlots(false);
  } catch { /* O backend verifica conflitos atomicamente ao salvar. */ }
}

function toggleAuth() {
  registerMode = !registerMode;
  $('#auth-title').textContent = registerMode ? 'Criar conta' : 'Entrar';
  $('#auth-submit').textContent = registerMode ? 'Criar minha conta' : 'Entrar';
  $('#auth-toggle').textContent = registerMode ? 'Já tenho uma conta' : 'Criar conta';
  $('#register-name').hidden = !registerMode; $('#auth-name').disabled = !registerMode; $('#auth-name').required = registerMode;
  $('#register-consent').hidden = !registerMode; $('#auth-consent').disabled = !registerMode; $('#auth-consent').required = registerMode;
  $('#auth-password').autocomplete = registerMode ? 'new-password' : 'current-password';
  $('#auth-error').hidden = true;
}

async function submitAuth(event) {
  event.preventDefault(); $('#auth-error').hidden = true; $('#auth-submit').disabled = true;
  try {
    const result = await apiRequest('auth', 'POST', { action: registerMode ? 'register' : 'login', email: $('#auth-email').value, password: $('#auth-password').value, name: $('#auth-name').value, consent: $('#auth-consent').checked });
    currentAccount = result.user;
    resetBooking(); updateAccountUI(); await loadAccountAppointments(); $('#auth-form').reset();
    location.hash = 'consultas'; showToast('Você entrou na sua conta.');
  } catch (error) { $('#auth-error').textContent = error.message; $('#auth-error').hidden = false; }
  finally { $('#auth-submit').disabled = false; }
}

async function submitTriage(event) {
  event.preventDefault(); $('#triage-error').hidden = true; $('#triage-result').hidden = true;
  if (!currentAccount) { showToast('Entre na sua conta para consultar a IA.'); location.hash = 'conta'; return; }
  $('#triage-submit').disabled = true; $('#triage-submit').textContent = 'Consultando…';
  try {
    const result = await apiRequest('triage', 'POST', { symptoms: $('#symptoms').value, duration: $('#duration').value, intensity: $('#intensity').value, consent: $('#triage-consent').checked, share: $('#triage-share').checked });
    $('#symptoms').value = ''; $('#duration').value = ''; $('#triage-consent').checked = false; $('#triage-share').checked = false;
    const attach = () => { if (result.triageId) { pendingTriageId = result.triageId; $('#booking-triage').hidden = false; } };
    const box = $('#triage-result'); box.replaceChildren(); box.hidden = false;
    const heading = document.createElement('h2');
    if (result.urgent) {
      heading.textContent = 'Procure atendimento de urgência';
      box.append(heading, paragraph('Seu relato pode exigir avaliação imediata. Em emergência, ligue 192. A ferramenta não faz diagnóstico.'));
      const call = document.createElement('a'); call.href = 'tel:192'; call.className = 'button'; call.textContent = 'Ligar 192'; box.append(call);
    } else if (result.source === 'ai' || result.source === 'regras') {
      heading.textContent = `Sugestão inicial: ${result.specialty}`;
      const origin = result.source === 'ai' ? 'Sugestão gerada por IA' : 'Sugestão por regras locais (IA não configurada)';
      box.append(heading, paragraph(result.confidence === 'baixa' ? `${origin}. As informações são insuficientes para uma indicação específica. Você pode escolher Clínica Geral ou buscar orientação profissional.` : `${origin}, sujeita a erro. A decisão clínica cabe a um profissional de saúde.`));
      const choose = document.createElement('button'); choose.className = 'button'; choose.textContent = 'Usar especialidade no agendamento';
      choose.addEventListener('click', () => { resetBooking(); attach(); $('#specialty').value = result.specialty; populateClinics(); location.hash = 'agendar'; }); box.append(choose);
    } else {
      heading.textContent = 'Escolha manual disponível'; box.append(heading, paragraph(result.message));
      const link = document.createElement('a'); link.href = '#agendar'; link.className = 'button'; link.textContent = 'Escolher especialidade'; link.addEventListener('click', () => { resetBooking(); attach(); }); box.append(link);
    }
    if (result.triageId) box.append(paragraph('Pré-triagem salva para compartilhar com a unidade ao agendar.', 'local-label'));
    box.append(paragraph(result.notice, 'muted'));
  } catch (error) { $('#triage-error').textContent = error.message; $('#triage-error').hidden = false; }
  finally { $('#triage-submit').disabled = false; $('#triage-submit').textContent = 'Consultar IA'; }
}

async function saveProfile(cpf) {
  $('#profile-error').hidden = true;
  try {
    if (cpf !== null && !$('#profile-consent').checked) throw new Error('Autorize o uso do CPF para identificação na recepção.');
    const result = await apiRequest('auth', 'POST', { action: 'profile', cpf, consent: cpf !== null });
    currentAccount = result.user; $('#profile-form').reset(); updateAccountUI();
    showToast(cpf === null ? 'CPF removido da sua conta.' : 'CPF salvo. A recepção poderá localizar sua consulta.');
  } catch (error) { $('#profile-error').textContent = error.message; $('#profile-error').hidden = false; }
}

async function initializeAccount() {
  setInterval(refreshSharedData, LIVE_REFRESH_MS);
  window.addEventListener('online', refreshSharedData);
  window.addEventListener('focus', refreshSharedData);
  window.addEventListener('hashchange', refreshSharedData);
  document.addEventListener('visibilitychange', refreshSharedData);
  $('#auth-toggle').addEventListener('click', toggleAuth);
  $('#auth-form').addEventListener('submit', submitAuth);
  $('#triage-form').addEventListener('submit', submitTriage);
  $('#profile-form').addEventListener('submit', event => { event.preventDefault(); saveProfile($('#profile-cpf').value); });
  $('#profile-remove').addEventListener('click', () => saveProfile(null));
  $('#logout').addEventListener('click', async () => {
    try {
      await apiRequest('auth', 'POST', { action: 'logout' });
      currentAccount = null; occupiedSlots = []; availabilityKey = ''; appointments = readAppointments();
      $('#triage-result').replaceChildren(); $('#triage-form').reset(); resetBooking(); updateAccountUI(); renderAppointments(); location.hash = 'inicio';
      showToast('Você saiu da sua conta.');
    } catch (error) { showToast(error.message); }
  });
  if (!navigator.onLine) return;
  try {
    const status = await apiRequest('status');
    if (!status.accounts) {
      $('#auth-error').textContent = 'Login em configuração. O modo demonstração está disponível.'; $('#auth-error').hidden = false;
      return;
    }
    const result = await apiRequest('auth'); currentAccount = result.user;
    updateAccountUI(); if (currentAccount) await loadAccountAppointments();
  } catch { /* Nenhuma informação privada de conta é persistida no navegador. */ }
}
