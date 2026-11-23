// Roteiro da conversa do WhatsApp, executado no próprio celular (sem internet).
// Cada passo recebe a resposta do cidadão e devolve as mensagens do atendimento
// e os botões da próxima pergunta. É uma "máquina de estados" simples.
import { hospitals } from '../data/hospitals';
import { findPatient, isValidCpf, maskCpf, onlyDigits } from '../data/patients';
import { COMPLAINTS, CONDITIONS, Intensity, TriageInput, WARNING_SIGNS } from './triage';

export type Button = { value: string; title: string };
type Step = 'menu' | 'consent' | 'cpf' | 'confirm-patient' | 'name' | 'age' | 'sex' | 'neighborhood' | 'complaint' | 'symptoms'
  | 'duration' | 'intensity' | 'fever' | 'signs' | 'conditions' | 'medications' | 'hospital' | 'review';
export type ConversationState = { step: Step; draft: TriageInput; fromRegistry: boolean };
export type BotTurn = { state: ConversationState; replies: string[]; buttons: Button[]; finished?: TriageInput };

const DEMO_CPF = '52998224725';
const NONE = 'Nenhum';

const emptyDraft = (): TriageInput => ({
  cpf: '', name: '', age: '', sex: '', susCard: 'Não informado', neighborhood: '', complaint: '', symptoms: '', duration: '',
  intensity: 'leve', fever: '', warningSigns: [], conditions: [], allergies: 'Não informado', medications: '', hospitalId: '',
});
export const initialState = (): ConversationState => ({ step: 'menu', draft: emptyDraft(), fromRegistry: false });

const options = (...titles: string[]): Button[] => titles.map((title) => ({ value: title, title }));
const MENU_BUTTONS: Button[] = [{ value: '1', title: '🩺 Fazer pré-triagem' }, { value: '2', title: '🏥 Hospitais do Recife' }, { value: '3', title: '🚨 Emergência' }];

export function menu(): BotTurn {
  return {
    state: initialState(),
    replies: [
      'Olá! 👋 Sou o atendimento de saúde do *Conecta Recife*.',
      'Com a *pré-triagem em casa*, suas informações chegam ao hospital antes de você. Lá, você *não precisa repetir a triagem*.\n\nComo posso ajudar?',
    ],
    buttons: MENU_BUTTONS,
  };
}

const ask = (state: ConversationState, step: Step, text: string | string[], buttons: Button[] = []): BotTurn =>
  ({ state: { ...state, step }, replies: Array.isArray(text) ? text : [text], buttons });

// Hospitais do bairro do paciente aparecem primeiro, para agilizar a escolha.
function hospitalButtons(neighborhood: string): Button[] {
  const sorted = [...hospitals].sort((a, b) => Number(b.neighborhood === neighborhood) - Number(a.neighborhood === neighborhood));
  return sorted.map((item) => ({ value: item.id, title: `${item.neighborhood === neighborhood ? '📍 ' : ''}${item.acronym} · ${item.neighborhood}` }));
}

function summary(draft: TriageInput): string {
  const hospital = hospitals.find((item) => item.id === draft.hospitalId);
  return [
    '📝 *Confira sua pré-triagem:*',
    `👤 ${draft.name}, ${draft.age} anos · CPF ${maskCpf(draft.cpf)}`,
    `🤒 ${draft.complaint}: ${draft.symptoms}`,
    `⏱️ Desde: ${draft.duration} · Intensidade: ${draft.intensity}`,
    `🌡️ Febre: ${draft.fever}`,
    `⚠️ Sinais de alerta: ${draft.warningSigns.join(', ') || NONE}`,
    `💊 Doenças: ${draft.conditions.join(', ') || 'Nenhuma'} · Remédios: ${draft.medications}`,
    `🏥 Enviar para: *${hospital?.name}*`,
  ].join('\n');
}

export function nextTurn(state: ConversationState, answer: string): BotTurn {
  const text = answer.trim();
  if (['0', 'menu', 'voltar'].includes(text.toLowerCase())) return menu();
  const draft = state.draft;
  const withDraft = (changes: Partial<TriageInput>): ConversationState => ({ ...state, draft: { ...draft, ...changes } });

  switch (state.step) {
    case 'menu':
      if (text === '1') return ask(state, 'consent', '🔒 Suas respostas serão usadas *somente* para o seu atendimento e enviadas ao hospital escolhido, pelo SUS (LGPD). Podemos continuar?', [{ value: 'sim', title: 'Sim, concordo' }, { value: '0', title: 'Voltar' }]);
      if (text === '2') return { state, replies: ['🏥 *Hospitais estaduais no Recife:*\n' + hospitals.map((item) => `• *${item.acronym}* ${item.name} — ${item.neighborhood}`).join('\n')], buttons: MENU_BUTTONS };
      if (text === '3') return { state, replies: ['🚨 Em emergência, ligue *192* (SAMU) agora ou vá à emergência mais próxima.'], buttons: MENU_BUTTONS };
      return menu();

    case 'consent':
      if (text !== 'sim') return menu();
      return ask(state, 'cpf', 'Informe seu *CPF* (só números). Vou consultar seu cadastro no SUS para agilizar.', [{ value: DEMO_CPF, title: '🧪 Usar CPF de demonstração' }]);

    case 'cpf': {
      if (!isValidCpf(text)) return ask(state, 'cpf', '❌ CPF inválido. Confira os 11 números.', [{ value: DEMO_CPF, title: '🧪 Usar CPF de demonstração' }]);
      const cpf = onlyDigits(text);
      const patient = findPatient(cpf);
      if (!patient) return ask(withDraft({ cpf }), 'name', 'Não encontrei seu cadastro. Sem problema! Qual é o seu *nome*?');
      const next = { ...withDraft({ cpf, name: patient.name, age: String(patient.age), sex: patient.sex, susCard: patient.susCard, neighborhood: patient.neighborhood, conditions: patient.conditions, allergies: patient.allergies, medications: patient.medications }), fromRegistry: true };
      return ask(next, 'confirm-patient', [
        '✅ *Cadastro encontrado no SUS* (simulado):',
        `👤 ${patient.name}\n🎂 ${patient.age} anos · ${patient.sex}\n💳 Cartão SUS ${patient.susCard}\n📍 ${patient.neighborhood}\n💊 ${patient.conditions.join(', ') || 'Sem doenças registradas'}\n⚠️ Alergia: ${patient.allergies}\n\nÉ você?`,
      ], [{ value: 'sim', title: 'Sim, sou eu' }, { value: 'nao', title: 'Não sou eu' }]);
    }
    case 'confirm-patient':
      if (text === 'sim') return ask(state, 'complaint', 'Qual é o *motivo* do atendimento?', options(...COMPLAINTS));
      return ask({ ...initialState(), step: 'cpf' }, 'cpf', 'Tudo bem. Digite o CPF correto.');

    case 'name':
      if (text.length < 3) return ask(state, 'name', 'Digite seu nome completo, por favor.');
      return ask(withDraft({ name: text }), 'age', `Prazer, *${text.split(' ')[0]}*! Qual a sua *idade*?`);
    case 'age': {
      const age = Number(text);
      if (!Number.isInteger(age) || age < 0 || age > 120) return ask(state, 'age', 'Digite a idade só com números (ex.: 54).');
      return ask(withDraft({ age: text }), 'sex', 'Sexo:', options('Feminino', 'Masculino'));
    }
    case 'sex':
      return ask(withDraft({ sex: text }), 'neighborhood', 'Em qual *bairro* você mora?', options(...new Set(hospitals.map((item) => item.neighborhood))));
    case 'neighborhood':
      return ask(withDraft({ neighborhood: text }), 'complaint', 'Qual é o *motivo* do atendimento?', options(...COMPLAINTS));

    case 'complaint':
      return ask(withDraft({ complaint: text }), 'symptoms', `Certo: *${text}*. Agora descreva o que sente com suas palavras (ex.: _dor no joelho ao subir escadas_).`);
    case 'symptoms':
      if (text.length < 10) return ask(state, 'symptoms', 'Conte um pouco mais (pelo menos 10 letras).');
      return ask(withDraft({ symptoms: text }), 'duration', 'Desde *quando* sente isso?', options('Hoje', '1 a 3 dias', '4 a 7 dias', 'Mais de 1 semana'));
    case 'duration':
      return ask(withDraft({ duration: text }), 'intensity', 'De 0 a 10, qual a *intensidade* do incômodo?', [
        { value: 'leve', title: '🙂 Leve (1 a 3)' }, { value: 'moderada', title: '😣 Moderada (4 a 6)' }, { value: 'intensa', title: '😫 Intensa (7 a 10)' }]);
    case 'intensity':
      if (!['leve', 'moderada', 'intensa'].includes(text)) return ask(state, 'intensity', 'Toque em uma das opções acima.');
      return ask(withDraft({ intensity: text as Intensity }), 'fever', 'Está com *febre* (38 °C ou mais)?', options('Sim', 'Não', 'Não medi'));
    case 'fever':
      return ask(withDraft({ fever: text }), 'signs', '⚠️ Você tem algum destes *sinais de alerta*?', options(NONE, ...WARNING_SIGNS));
    case 'signs': {
      const next = withDraft({ warningSigns: text === NONE ? [] : [text] });
      if (text !== NONE) {
        return ask({ ...next, draft: { ...next.draft, hospitalId: 'hr' } }, 'review', ['🚨 *Atenção:* esse sinal pode indicar emergência. *Ligue 192 agora.*', 'Vou enviar sua ficha com prioridade para o *Hospital da Restauração* (emergência de referência).\n\n' + summary({ ...next.draft, hospitalId: 'hr' })], [{ value: 'enviar', title: '✅ Enviar ficha agora' }]);
      }
      if (state.fromRegistry) return ask(next, 'hospital', `Seu cadastro já informa doenças e remédios. 👍\n\n🏥 Para qual *hospital* enviamos sua ficha? (📍 = perto de você)`, hospitalButtons(draft.neighborhood));
      return ask(next, 'conditions', 'Você tem alguma destas *condições*?', options('Nenhuma', ...CONDITIONS));
    }
    case 'conditions':
      return ask(withDraft({ conditions: text === 'Nenhuma' ? [] : [text] }), 'medications', 'Usa algum *remédio* todo dia? Escreva o nome ou toque em "Nenhum".', options(NONE));
    case 'medications':
      return ask(withDraft({ medications: text }), 'hospital', '🏥 Para qual *hospital* enviamos sua ficha? (📍 = perto de você)', hospitalButtons(draft.neighborhood));
    case 'hospital': {
      if (!hospitals.some((item) => item.id === text)) return ask(state, 'hospital', 'Toque em um dos hospitais.', hospitalButtons(draft.neighborhood));
      const next = withDraft({ hospitalId: text });
      return ask(next, 'review', summary(next.draft), [{ value: 'enviar', title: '✅ Confirmar e enviar' }, { value: '0', title: 'Recomeçar' }]);
    }
    case 'review':
      if (text !== 'enviar') return menu();
      return { state: initialState(), replies: ['Enviando sua pré-triagem… 📤'], buttons: [], finished: draft };
  }
}
