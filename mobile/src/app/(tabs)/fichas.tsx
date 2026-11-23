import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { hospitals } from '../../data/hospitals';
import { useTriages } from '../../hooks/useTriages';
import { PRIORITY_INFO } from '../../services/triage';
import { colors, spacing } from '../../theme';

// Minhas fichas: as pré-triagens feitas pelo WhatsApp, guardadas no celular (FlatList).
export default function FichasScreen() {
  const { triages } = useTriages();

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={triages}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={48} color={colors.muted} />
          <Text style={styles.emptyText}>Nenhuma pré-triagem ainda.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.push('/atendimento')}>
            <Text style={styles.buttonText}>Começar pelo WhatsApp</Text>
          </TouchableOpacity>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/ficha/[id]', params: { id: item.id } })}>
          <View style={[styles.dot, { backgroundColor: PRIORITY_INFO[item.priority].color }]} />
          <View style={styles.info}>
            <Text style={styles.protocol}>{item.id} · {item.specialty}</Text>
            <Text style={styles.detail}>🏥 {hospitals.find((hospital) => hospital.id === item.hospitalId)?.name ?? '—'}</Text>
            <Text style={styles.detail} numberOfLines={1}>{item.symptoms}</Text>
            <Text style={styles.detail}>{item.status === 'enviada' ? '☁️ Enviada ao SUS' : '⏳ Aguardando conexão'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: 10, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: colors.muted, fontSize: 16 },
  button: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 24 },
  buttonText: { color: '#fff', fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  dot: { width: 14, height: 14, borderRadius: 7 },
  info: { flex: 1, gap: 2 },
  protocol: { fontWeight: '800', color: colors.text, fontSize: 16 },
  detail: { color: colors.muted },
});
