/* Unidades públicas e canais oficiais: dados estáticos do catálogo, disponíveis offline. */
(() => {
  const FAVORITES_KEY = 'agendae.favorites.v1';
  const data = window.AGENDAE_CATALOG || {};
  const hospitals = Array.isArray(data.hospitals) ? data.hospitals : [];
  const channels = Array.isArray(data.channels) ? data.channels : [];
  const byId = id => document.getElementById(id);
  const normalize = text => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

  function readFavorites() {
    try {
      const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
      return Array.isArray(value) ? value.filter(id => hospitals.some(item => item.id === id)) : [];
    } catch { return []; }
  }
  function writeFavorites(list) {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(list)); return true; }
    catch { return false; }
  }

  function renderUnits() {
    const query = normalize(byId('unit-search').value);
    const favorites = readFavorites();
    const onlyFavorites = byId('unit-favorites-only').checked;
    const visible = hospitals.filter(item => (!onlyFavorites || favorites.includes(item.id)) && (!query || normalize(`${item.name} ${item.acronym} ${item.neighborhood}`).includes(query)));
    byId('favorite-count').textContent = favorites.length;
    byId('unit-summary').textContent = visible.length ? `${visible.length} de ${hospitals.length} unidades` : onlyFavorites && !favorites.length ? 'Você ainda não salvou favoritos.' : 'Nenhuma unidade encontrada. Tente outro nome ou bairro.';
    const list = byId('unit-list'); list.replaceChildren();
    for (const item of visible) {
      const favorite = favorites.includes(item.id);
      const card = element('article', 'card unit-card');
      const heading = element('h2', '', item.name);
      const tag = element('span', 'appointment-date', `${item.neighborhood} · ${item.acronym}`);
      const details = element('details', 'unit-details');
      const summary = element('summary', '', 'Ver detalhes');
      const address = `${item.address}, ${item.neighborhood}, Recife/PE, CEP ${item.cep}`;
      const map = element('a', '', 'Abrir no mapa (requer internet)');
      map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.name}, ${address}`)}`; map.target = '_blank'; map.rel = 'noopener';
      details.append(summary, element('p', 'muted', address), map);
      const button = element('button', `button ${favorite ? '' : 'secondary'} small`.trim(), favorite ? '★ Favorito' : '☆ Salvar favorito');
      button.type = 'button'; button.setAttribute('aria-pressed', String(favorite));
      button.setAttribute('aria-label', `${favorite ? 'Remover' : 'Salvar'} ${item.name} ${favorite ? 'dos' : 'nos'} favoritos`);
      button.addEventListener('click', () => {
        const next = favorite ? readFavorites().filter(id => id !== item.id) : [...new Set([...readFavorites(), item.id])];
        if (!writeFavorites(next)) { window.showToast?.('O navegador não permitiu salvar favoritos.'); return; }
        renderUnits(); window.showToast?.(favorite ? 'Favorito removido.' : 'Unidade salva nos favoritos deste dispositivo.');
      });
      card.append(tag, heading, details, button); list.append(card);
    }
  }

  function renderChannels() {
    const list = byId('channel-list'); list.replaceChildren();
    for (const item of channels) {
      const card = element('article', 'card channel-card');
      const link = element('a', 'button secondary small', item.href.startsWith('tel:') ? `Ligar ${item.contact}` : `Abrir ${item.contact}`);
      link.href = item.href;
      if (!item.href.startsWith('tel:')) { link.target = '_blank'; link.rel = 'noopener'; }
      card.append(element('h2', '', item.name), element('p', 'muted', item.description), link); list.append(card);
    }
  }

  function formatMessage(text) {
    const escaped = String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    return escaped.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/(^|\s)_([^_\n]+)_/g, '$1<em>$2</em>').replace(/\n/g, '<br>');
  }
  function addBubble(text, own) {
    const bubble = element('div', own ? 'chat-bubble own' : 'chat-bubble');
    bubble.innerHTML = formatMessage(text);
    const time = element('small', '', new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    bubble.append(time); byId('chat-log').append(bubble); byId('chat-log').scrollTop = byId('chat-log').scrollHeight;
    return bubble;
  }
  async function sendChat(text) {
    text = text.trim(); if (!text) return;
    addBubble(text, true); byId('chat-input').value = '';
    if (!navigator.onLine) { addBubble('Sem conexão. O atendimento precisa de internet. Em emergência, ligue *192*.'); return; }
    const typing = addBubble('_digitando…_');
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(25000) });
      const result = await response.json();
      typing.remove(); addBubble(response.ok ? result.reply : result.error || 'Atendimento indisponível.');
    } catch { typing.remove(); addBubble('Atendimento indisponível no momento. Tente novamente.'); }
  }

  function initializeUnits() {
    if (!byId('unit-list')) return;
    const source = data.hospitalSource;
    if (source) {
      const note = byId('unit-source'); note.replaceChildren('Fonte: ');
      const link = element('a', '', source.name); link.href = source.url; link.target = '_blank'; link.rel = 'noopener';
      const date = source.accessed.split('-').reverse().join('/');
      note.append(link, `. Consultado em ${date}. Recorte estático: não informa vagas nem atendimento em tempo real.`);
    }
    byId('unit-search').addEventListener('input', renderUnits);
    byId('unit-favorites-only').addEventListener('change', renderUnits);
    window.addEventListener('storage', event => { if (event.key === FAVORITES_KEY) renderUnits(); });
    byId('chat-form').addEventListener('submit', event => { event.preventDefault(); sendChat(byId('chat-input').value); });
    document.querySelectorAll('[data-chat]').forEach(button => button.addEventListener('click', () => sendChat(button.dataset.chat)));
    addBubble('Olá! Envie *oi* para ver o menu do atendimento.');
    renderUnits(); renderChannels();
  }
  initializeUnits();
})();
