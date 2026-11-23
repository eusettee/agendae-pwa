import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FadeIn } from '../../components/FadeIn';
import { hospitals } from '../../data/hospitals';
import { maskCpf } from '../../data/patients';
import { useTriages } from '../../hooks/useTriages';
import { PRIORITY_INFO } from '../../services/triage';
import { spacing } from '../../theme';

type Stage = 'aguardando' | 'chamado' | 'em-atendimento';
const STAGE_LABEL: Record<Stage, string> = { aguardando: 'Aguardando chegada', chamado: 'Paciente chamado', 'em-atendimento': 'Em atendimento' };

// PRONTUÁRIO MÉDICO (demonstração): o que o médico vê no hospital antes de o paciente chegar.
// A pré-triagem feita em casa substitui a triagem presencial.
export default function ProntuarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { triages } = useTriages();
  const [stage, setStage] = useState<Stage>('aguardando');
  const triage = triages.find((item) => item.id === id);
  if (!triage) return <Text style={styles.missing}>Prontuário não encontrado.</Text>;

  const priority = PRIORITY_INFO[triage.priority];
  const hospital = hospitals.find((item) => item.id === triage.hospitalId);
  const receivedAt = new Date(triage.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const hasAllergy = !/nenhuma|não informado/i.test(triage.allergies);
  const history = `Paciente relata ${triage.symptoms.toLowerCase()}, com início ${triage.duration === 'Hoje' ? 'hoje' : `há ${triage.duration.toLowerCase()}`}, intensidade ${triage.intensity}. Febre: ${triage.fever.toLowerCase()}. Sinais de alerta: ${triage.warningSigns.join(', ').toLowerCase() || 'nega'}.`;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.systemBar}>
        <Ionicons name="medkit" size={16} color="#9fb3c8" />
        <Text style={styles.systemText}>Prontuário eletrônico · {hospital?.name}</Text>
      </View>

      <FadeIn style={[styles.priorityBar, { backgroundColor: priority.color }]}>
        <Text style={styles.priorityText}>{priority.emoji} {priority.label.toUpperCase()}</Text>
        <Text style={styles.priorityHint}>Classificada na pré-triagem em casa · sem triagem presencial</Text>
      </FadeIn>

      <View style={styles.card}>
        <Text style={styles.patientName}>{triage.name}</Text>
        <Text style={styles.patientInfo}>{triage.age} anos · {triage.sex} · {triage.neighborhood}</Text>
        <Text style={styles.patientInfo}>CPF {maskCpf(triage.cpf)} · Cartão SUS {triage.susCard}</Text>
        <Text style={styles.patientInfo}>Protocolo {triage.id} · recebido {receivedAt} via WhatsApp</Text>
      </View>

      {hasAllergy && (
        <View style={styles.allergy}>
          <Ionicons name="warning" size={20} color="#fff" />
          <Text style={styles.allergyText}>ALERGIA: {triage.allergies.toUpperCase()}</Text>
        </View>
      )}

      <Section title="Queixa principal" text={`${triage.complaint} — ${triage.symptoms}`} />
      <Section title="História da doença atual" text={history} />
      <Section title="Comorbidades" text={triage.conditions.join(', ') || 'Nega'} />
      <Section title="Medicamentos em uso" text={triage.medications} />
      <Section title="Encaminhamento sugerido" text={`${triage.specialty} · ${triage.advice}`} />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Situação</Text>
        <Text style={styles.stage}>{STAGE_LABEL[stage]}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.action, stage !== 'aguardando' && styles.disabled]} disabled={stage !== 'aguardando'} onPress={() => setStage('chamado')}>
            <Text style={styles.actionText}>📢 Chamar paciente</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.action, stage !== 'chamado' && styles.disabled]} disabled={stage !== 'chamado'} onPress={() => setStage('em-atendimento')}>
            <Text style={styles.actionText}>🩺 Iniciar atendimento</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.note}>Demonstração com dados fictícios. A pré-triagem orienta e prioriza; a decisão clínica é do profissional.</Text>
    </ScrollView>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#eef2f6' },
  content: { padding: spacing.md, gap: 10, paddingBottom: 40 },
  missing: { textAlign: 'center', marginTop: 40 },
  systemBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1f2d3d', padding: 10, borderRadius: 10 },
  systemText: { color: '#d6e2ee', fontWeight: '600', flex: 1 },
  priorityBar: { borderRadius: 12, padding: 14 },
  priorityText: { color: '#fff', fontWeight: '900', fontSize: 20, letterSpacing: 1 },
  priorityHint: { color: '#fff', opacity: 0.9, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: '#2c6e9b', gap: 4 },
  patientName: { fontSize: 20, fontWeight: '800', color: '#1f2d3d' },
  patientInfo: { color: '#52667a' },
  allergy: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#b3261e', padding: 12, borderRadius: 12 },
  allergyText: { color: '#fff', fontWeight: '800', flex: 1 },
  sectionTitle: { color: '#2c6e9b', fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionText: { color: '#1f2d3d', fontSize: 15, lineHeight: 21 },
  stage: { fontSize: 17, fontWeight: '700', color: '#1f2d3d' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  action: { flex: 1, backgroundColor: '#2c6e9b', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  actionText: { color: '#fff', fontWeight: '700' },
  note: { color: '#52667a', fontSize: 12, textAlign: 'center' },
});
