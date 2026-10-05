/* O catálogo estático é o fallback offline; a API fornece o mesmo contrato. */
const STORAGE_KEY = 'agendae.appointments.v1';
let catalog = window.AGENDAE_CATALOG;
let appointments = [];
let installPrompt;
let pendingAction;
let toastTimer;
let editingAppointmentId = null;
const $ = selector => document.querySelector(selector);
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Recife' });

function showToast(message) {
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}

function readAppointments() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(data)) throw new Error();
    return data.filter(item => item && typeof item.id === 'string' && typeof item.patient === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && catalog.times.includes(item.time) && catalog.clinics.some(clinic => clinic.id === item.clinicId && clinic.professionals.some(professional => professional.id === item.professionalId)));
  } catch { showToast('Não foi possível ler a agenda salva neste navegador.'); return []; }
}

function saveAppointments(next) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
  catch { throw new Error('O navegador não permitiu salvar. Libere o armazenamento e tente novamente.'); }
  appointments = next;
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function nextWeekday() {
  const date = new Date(`${today()}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + 1);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function option(value, text) { return new Option(text, value); }

function populateClinics() {
  const specialty = $('#specialty').value;
  const matching = catalog.clinics.filter(clinic => clinic.professionals.some(professional => professional.specialty === specialty));
  $('#clinic').replaceChildren(...matching.map(clinic => option(clinic.id, `${clinic.name} · Recife`)));
  populateProfessionals();
}

function populateProfessionals() {
  const clinic = catalog.clinics.find(item => item.id === $('#clinic').value);
  const professionals = clinic?.professionals.filter(item => item.specialty === $('#specialty').value) || [];
  $('#professional').replaceChildren(...professionals.map(item => option(item.id, item.name)));
  renderSlots();
}

function isSlotUnavailable(date, time, professionalId) {
  const timestamp = Date.parse(`${date}T${time}:00-03:00`);
  const weekday = new Date(`${date}T12:00:00-03:00`).getUTCDay();
  const ownEdit = appointments.find(item => item.id === editingAppointmentId);
  const reserved = currentAccount && availabilityKey === `${professionalId}|${date}` && occupiedSlots.includes(time) && !(ownEdit?.professionalId === professionalId && ownEdit?.date === date && ownEdit?.time === time);
  return !Number.isFinite(timestamp) || timestamp <= Date.now() || [0, 6].includes(weekday) || reserved || appointments.some(item => item.id !== editingAppointmentId && item.professionalId === professionalId && item.date === date && item.time === time);
}

function renderSlots(fetchAvailability = true) {
  const previous = $('input[name=time]:checked')?.value;
  const container = $('#time-slots');
  container.replaceChildren();
  for (const time of catalog.times) {
    const wrapper = document.createElement('div');
    wrapper.className = 'time-choice';
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'time'; radio.value = time; radio.id = `time-${time.replace(':', '')}`; radio.required = true;
    radio.disabled = isSlotUnavailable($('#date').value, time, $('#professional').value);
    radio.checked = previous === time && !radio.disabled;
    const label = document.createElement('label');
    label.htmlFor = radio.id; label.textContent = time;
    if (radio.disabled) label.title = 'Horário indisponível';
    wrapper.append(radio, label); container.append(wrapper);
  }
  if (fetchAvailability) loadAvailability();
}

function resetBooking() {
  editingAppointmentId = null; $('#booking-form').reset(); $('#date').value = nextWeekday();
  $('#cancel-edit').hidden = true; $('#form-error').hidden = true; updateAccountUI(); populateClinics();
}

function editAppointment(item) {
  editingAppointmentId = item.id;
  const info = details(item); $('#patient').value = item.patient;
  $('#specialty').value = info.professional.specialty; populateClinics();
  $('#clinic').value = item.clinicId; populateProfessionals(); $('#professional').value = item.professionalId;
  $('#date').value = item.date; renderSlots();
  const radio = document.getElementById(`time-${item.time.replace(':','')}`); if (radio && !radio.disabled) radio.checked = true;
  $('#consent').checked = false; $('#submit-booking').textContent = 'Salvar alterações →'; $('#cancel-edit').hidden = false; location.hash = 'agendar';
}

function details(item) {
  const clinic = catalog.clinics.find(clinic => clinic.id === item.clinicId);
  const professional = clinic.professionals.find(professional => professional.id === item.professionalId);
  return { clinic, professional, date: dateFormatter.format(new Date(`${item.date}T12:00:00-03:00`)) };
}

function paragraph(text, className = '') {
  const element = document.createElement('p'); element.textContent = text; element.className = className; return element;
}

function renderAppointments() {
  const sorted = [...appointments].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const list = $('#appointment-list'); list.replaceChildren();
  if (!sorted.length) {
    const empty = document.createElement('article'); empty.className = 'card empty-state';
    const heading = document.createElement('h2'); heading.textContent = 'Sua agenda está livre';
    const link = document.createElement('a'); link.href = '#agendar'; link.className = 'button'; link.textContent = 'Agendar minha primeira consulta →';
    empty.append(heading, paragraph('Comece escolhendo uma especialidade.', 'muted'), link); list.append(empty);
  }
  for (const item of sorted) {
    const info = details(item);
    const article = document.createElement('article'); article.className = 'card appointment';
    const content = document.createElement('div');
    const tag = document.createElement('span'); tag.className = 'appointment-date'; tag.textContent = `${info.date} · ${item.time}`;
    const heading = document.createElement('h2'); heading.textContent = info.professional.specialty;
    content.append(tag, heading, paragraph(`${info.professional.name} · ${info.clinic.name}`, 'muted'), paragraph(`Para ${item.patient}`, 'muted'), paragraph(currentAccount ? 'Demonstração · salvo na sua conta' : 'Demonstração · salvo neste dispositivo', 'local-label'));
    const button = document.createElement('button'); button.type = 'button'; button.className = 'button secondary'; button.textContent = 'Cancelar';
    button.setAttribute('aria-label', `Cancelar consulta de ${item.patient} em ${info.date} às ${item.time}`);
    button.addEventListener('click', () => askConfirmation('Cancelar consulta?', currentAccount ? 'A consulta será removida da sua conta.' : 'A consulta será removida deste dispositivo.', async () => {
      try {
        if (currentAccount) { await apiRequest('appointments', 'DELETE', { id: item.id }); await loadAccountAppointments(); }
        else { saveAppointments(appointments.filter(appointment => appointment.id !== item.id)); renderAppointments(); renderSlots(); }
        if (editingAppointmentId === item.id) resetBooking(); showToast('Consulta cancelada. Horário liberado.');
      }
      catch (error) { showToast(error.message); }
    }));
    const actions = document.createElement('div'); actions.className = 'appointment-actions';
    const edit = document.createElement('button'); edit.className = 'button secondary'; edit.textContent = 'Editar'; edit.setAttribute('aria-label', `Editar consulta de ${item.patient}`);
    edit.addEventListener('click', () => editAppointment(item)); actions.append(edit, button);
    article.append(content, actions); list.append(article);
  }
  const next = sorted.find(item => Date.parse(`${item.date}T${item.time}:00-03:00`) > Date.now());
  const container = $('#next-appointment'); container.replaceChildren();
  const heading = document.createElement('h3');
  if (next) {
    const info = details(next); heading.textContent = info.professional.specialty;
    container.append(heading, paragraph(`${info.date} · ${next.time}`, 'muted'), paragraph(`${info.professional.name} · ${info.clinic.name}`, 'muted'));
  } else {
    heading.textContent = 'Sua agenda começa aqui'; container.append(heading, paragraph('Quando agendar, os detalhes aparecem aqui.', 'muted'));
  }
}

function navigate(focus = true) {
  const requested = location.hash.slice(1) || 'inicio';
  const page = ['inicio', 'agendar', 'consultas', 'ajuda', 'conta', 'triagem'].includes(requested) ? requested : 'inicio';
  document.querySelectorAll('.page').forEach(section => { section.hidden = section.id !== page; });
  document.querySelectorAll('[data-page]').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
  if (page === 'agendar') renderSlots();
  if (focus) { $('#main').focus({ preventScroll: true }); window.scrollTo(0, 0); }
}

function updateConnection() {
  $('#connection').textContent = navigator.onLine ? 'Online' : 'Offline';
  $('#connection').classList.toggle('offline', !navigator.onLine);
}

function askConfirmation(title, description, action) {
  pendingAction = action;
  $('#dialog-title').textContent = title;
  $('#dialog-description').textContent = description;
  $('#confirm-dialog').showModal();
  $('#dialog-back').focus();
}

async function submitBooking(event) {
  event.preventDefault();
  $('#form-error').hidden = true;
  const time = $('input[name=time]:checked')?.value;
  const input = { patient: $('#patient').value.trim(), clinicId: $('#clinic').value, professionalId: $('#professional').value, date: $('#date').value, time };
  const button = $('#submit-booking');
  try {
    if (input.patient.length < 2) throw new Error('Informe um nome com pelo menos 2 caracteres.');
    if (!$('#consent').checked) throw new Error('Confirme o armazenamento neste dispositivo.');
    if (!time || isSlotUnavailable(input.date, time, input.professionalId)) throw new Error('Escolha um horário disponível de segunda a sexta.');
    button.disabled = true;
    if (currentAccount) {
      await apiRequest('appointments', editingAppointmentId ? 'PUT' : 'POST', { ...input, id: editingAppointmentId });
      await loadAccountAppointments();
    } else {
      appointments = readAppointments();
      if (isSlotUnavailable(input.date, time, input.professionalId)) throw new Error('Esse horário já foi salvo. Escolha outro.');
      const item = { ...input, id: editingAppointmentId || crypto.randomUUID() };
      saveAppointments(editingAppointmentId ? appointments.map(appointment => appointment.id === editingAppointmentId ? item : appointment) : [...appointments, item]);
    }
    resetBooking();
    renderAppointments(); location.hash = 'consultas';
    showToast(currentAccount ? 'Consulta salva na sua conta.' : 'Consulta de demonstração salva neste dispositivo.');
  } catch (error) {
    $('#form-error').textContent = error.message; $('#form-error').hidden = false;
  } finally { button.disabled = false; }
}

async function initialize() {
  appointments = readAppointments();
  $('#specialty').replaceChildren(...catalog.specialties.map(item => option(item, item)));
  $('#date').min = today(); $('#date').value = nextWeekday();
  populateClinics(); renderAppointments(); navigate(false); updateConnection();
  $('#specialty').addEventListener('change', populateClinics);
  $('#clinic').addEventListener('change', populateProfessionals);
  $('#professional').addEventListener('change', renderSlots);
  $('#date').addEventListener('change', renderSlots);
  $('#booking-form').addEventListener('submit', submitBooking);
  $('#cancel-edit').addEventListener('click', resetBooking);
  window.addEventListener('hashchange', () => navigate());
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
  window.addEventListener('storage', event => { if (!currentAccount && event.key === STORAGE_KEY) { appointments = readAppointments(); renderAppointments(); renderSlots(); } });
  $('#dialog-back').addEventListener('click', () => { pendingAction = undefined; $('#confirm-dialog').close(); });
  $('#dialog-confirm').addEventListener('click', () => { $('#confirm-dialog').close(); pendingAction?.(); pendingAction = undefined; });
  $('#clear-data').addEventListener('click', () => askConfirmation('Apagar todos os dados?', 'Todas as consultas desta demonstração serão apagadas deste dispositivo.', () => {
    try { localStorage.removeItem(STORAGE_KEY); if (!currentAccount) { appointments = []; renderAppointments(); renderSlots(); } showToast('Dados de demonstração apagados. Sua conta não foi alterada.'); } catch (error) { showToast(error.message); }
  }));
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('#install').hidden = false; });
  $('#install').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); installPrompt = undefined; $('#install').hidden = true; });
  window.addEventListener('appinstalled', () => { $('#install').hidden = true; showToast('Agendaê instalado.'); });
  initializeAccount();
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
      $('#offline-ready').textContent = 'Modo offline pronto';
    } catch { $('#offline-ready').textContent = 'Modo offline indisponível. Abra em localhost ou HTTPS.'; }
  } else { $('#offline-ready').textContent = 'Este navegador não oferece modo offline.'; }
  try {
    const response = await fetch('/api/catalog', { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data.clinics) && Array.isArray(data.specialties) && Array.isArray(data.times)) {
      catalog = data;
      const selected = $('#specialty').value;
      $('#specialty').replaceChildren(...catalog.specialties.map(item => option(item, item)));
      $('#specialty').value = selected; populateClinics();
    }
  } catch { /* Catálogo local garante navegação offline. */ }
}
initialize();
