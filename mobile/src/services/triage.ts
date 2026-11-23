// Pré-triagem local: roda no próprio celular, sem internet.
// Orientação inicial por regras simples — não é diagnóstico nem substitui avaliação médica.

export type Intensity = 'leve' | 'moderada' | 'intensa';
export type Priority = 'emergencia' | 'urgente' | 'pouco-urgente' | 'nao-urgente';

// Tudo o que a conversa coleta e que o médico recebe na ficha.
export type TriageInput = {
  cpf: string;
  name: string;
  age: string;
  sex: string;
  susCard: string;
  neighborhood: string;
  complaint: string; // tipo de queixa escolhido no botão
  symptoms: string; // descrição com as palavras do paciente
  duration: string;
  intensity: Intensity;
  fever: string;
  warningSigns: string[];
  conditions: string[];
  allergies: string;
  medications: string;
  hospitalId: string;
};

export type TriageResult = { specialty: string; priority: Priority; advice: string };

export const COMPLAINTS = ['Dor', 'Febre ou gripe', 'Problema de pele', 'Coração ou pressão', 'Criança doente', 'Outro'];
export const WARNING_SIGNS = ['Dor no peito', 'Falta de ar', 'Desmaio', 'Sangramento intenso', 'Confusão mental'];
export const CONDITIONS = ['Hipertensão', 'Diabetes', 'Asma', 'Doença do coração', 'Gestante'];

const COMPLAINT_SPECIALTY: Record<string, string> = {
  'Problema de pele': 'Dermatologia',
  'Coração ou pressão': 'Cardiologia',
  'Criança doente': 'Pediatria',
};

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const PRIORITY_INFO: Record<Priority, { label: string; color: string; emoji: string }> = {
  emergencia: { label: 'Emergência', color: '#b3261e', emoji: '🔴' },
  urgente: { label: 'Urgente', color: '#e67e22', emoji: '🟠' },
  'pouco-urgente': { label: 'Pouco urgente', color: '#d4ac0d', emoji: '🟡' },
  'nao-urgente': { label: 'Não urgente', color: '#1e8449', emoji: '🟢' },
};

export function evaluateTriage(input: TriageInput): TriageResult {
  if (input.warningSigns.length) {
    return { specialty: 'Emergência', priority: 'emergencia', advice: 'Ligue 192 (SAMU) agora ou vá à emergência. O hospital já recebeu sua ficha.' };
  }
  const age = Number(input.age);
  const text = normalize(input.symptoms);
  const specialty = age < 12 ? 'Pediatria'
    : COMPLAINT_SPECIALTY[input.complaint]
    ?? (/joelho|coluna|costas|ombro|tornozelo|osso|fratura|torc|lombar/.test(text) ? 'Ortopedia' : 'Clínica Geral');

  // Grupos de risco (idosos, crianças pequenas, doenças crônicas) sobem um nível quando há febre ou dor intensa.
  const riskGroup = age >= 60 || age < 2 || input.conditions.length > 0;
  const hasFever = input.fever === 'Sim';
  let priority: Priority = input.intensity === 'intensa' ? 'urgente' : input.intensity === 'moderada' || hasFever ? 'pouco-urgente' : 'nao-urgente';
  if (riskGroup && (hasFever || input.intensity === 'intensa') && priority !== 'urgente') priority = 'urgente';

  const advice = priority === 'urgente'
    ? 'Procure o hospital hoje. Sua ficha já está com a equipe: você não precisa repetir a triagem.'
    : 'Procure atendimento quando puder. Sua ficha já está com a equipe: você não precisa repetir a triagem.';
  return { specialty, priority, advice };
}
