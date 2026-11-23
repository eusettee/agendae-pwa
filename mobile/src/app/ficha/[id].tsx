import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FadeIn } from '../../components/FadeIn';
import { hospitals } from '../../data/hospitals';
import { maskCpf } from '../../data/patients';
import { useTriages } from '../../hooks/useTriages';
import { PRIORITY_INFO } from '../../services/triage';
import { colors, spacing } from '../../theme';

// Resumo para o cidadão: protocolo e os dados que o médico recebe antes da chegada (tela empilhada no Stack).
export default function FichaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { triages, syncPending } = useTriages();
  const [syncMessage, setSyncMessage] = useState('');
  const triage = triages.find((item) => item.id === id);

  if (!triage) return <Text style={styles.missing}>Ficha não encontrada.</Text>;

  const priority = PRIORITY_INFO[triage.priority];
  const hospital = hospitals.find((item) => item.id === triage.hospitalId);
  const sync = async () => {
    try {
      await syncPending();
      setSyncMessage('Ficha enviada ao hospital escolhido. A equipe já pode consultá-la.');
    } catch {
      setSyncMessage('Sem conexão agora. A ficha continua salva e será enviada depois.');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FadeIn style={styles.protocolCard}>
        <Text style={styles.protocolLabel}>Seu protocolo · mostre na recepção</Text>
        <Text style={styles.protocol}>{triage.id}</Text>
        <Text style={[styles.priority, { backgroundColor: priority.color }]}>{priority.label}</Text>
        <Text style={styles.advice}>{triage.advice}</Text>
      </FadeIn>

      <TouchableOpacity style={styles.doctorButton} onPress={() => router.push({ pathname: '/prontuario/[id]', params: { id: triage.id } })}>
        <Ionicons name="medical" size={20} color="#fff" />
        <Text style={styles.buttonText}>Ver prontuário (tela do médico)</Text>
      </TouchableOpacity>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>O que o médico vai receber</Text>
        <Row label="Hospital de destino" value={hospital ? `${hospital.name} — ${hospital.neighborhood}` : '—'} />
        <Row label="Paciente" value={`${triage.name}, ${triage.age} anos · ${triage.sex}`} />
        <Row label="CPF · Cartão SUS" value={`${maskCpf(triage.cpf)} · ${triage.susCard}`} />
        <Row label="Queixa" value={`${triage.complaint}: ${triage.symptoms}`} />
        <Row label="Início · intensidade" value={`${triage.duration} · ${triage.intensity}`} />
        <Row label="Febre" value={triage.fever} />
        <Row label="Sinais de alerta" value={triage.warningSigns.join(', ') || 'Nenhum'} />
        <Row label="Doenças crônicas" value={triage.conditions.join(', ') || 'Nenhuma'} />
        <Row label="Alergias" value={triage.allergies} />
        <Row label="Remédios em uso" value={triage.medications} />
        <Row label="Encaminhamento sugerido" value={triage.specialty} />
        <Row label="Registrada em" value={new Date(triage.createdAt).toLocaleString('pt-BR')} />
      </View>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Ionicons name={triage.status === 'enviada' ? 'cloud-done' : 'cloud-upload-outline'} size={24} color={triage.status === 'enviada' ? '#1e8449' : colors.muted} />
          <Text style={styles.statusText}>{triage.status === 'enviada' ? 'Enviada ao DataSUS (simulação)' : 'Aguardando conexão para enviar'}</Text>
        </View>
        {triage.status === 'pendente' && (
          <TouchableOpacity style={styles.button} onPress={sync}>
            <Text style={styles.buttonText}>Enviar agora</Text>
          </TouchableOpacity>
        )}
        {!!syncMessage && <Text style={styles.syncMessage}>{syncMessage}</Text>}
        <Text style={styles.note}>Protótipo: o envio ao DataSUS é simulado. Na versão real, a ficha seguiria pela integração oficial do SUS.</Text>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: 12, backgroundColor: colors.background, flexGrow: 1 },
  missing: { textAlign: 'center', marginTop: 40, color: colors.muted },
  protocolCard: { backgroundColor: colors.primary, borderRadius: 20, padding: spacing.lg, alignItems: 'center', gap: 8 },
  protocolLabel: { color: colors.accent, fontWeight: '700' },
  protocol: { color: '#fff', fontSize: 34, fontWeight: '800', letterSpacing: 2 },
  priority: { color: '#fff', fontWeight: '800', paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14, overflow: 'hidden' },
  advice: { color: '#fff', textAlign: 'center', lineHeight: 21 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  row: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 8 },
  rowLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  rowValue: { color: colors.text, fontSize: 16, marginTop: 2, textTransform: 'none' },
  statusRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  statusText: { fontWeight: '700', color: colors.text, flex: 1 },
  button: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  doctorButton: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1f2d3d', paddingVertical: 14, borderRadius: 26 },
  syncMessage: { color: colors.primary, fontWeight: '600' },
  note: { color: colors.muted, fontSize: 12 },
});
