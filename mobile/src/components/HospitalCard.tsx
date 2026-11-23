import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Hospital } from '../data/hospitals';
import { colors, spacing } from '../theme';

type Props = { hospital: Hospital; favorite: boolean; onPress: () => void; onToggleFavorite: () => void };

// Item da lista de unidades: toque abre os detalhes; a estrela salva nos favoritos.
export function HospitalCard({ hospital, favorite, onPress, onToggleFavorite }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.badge}><Text style={styles.badgeText}>{hospital.acronym}</Text></View>
      <View style={styles.info}>
        <Text style={styles.name}>{hospital.name}</Text>
        <Text style={styles.neighborhood}>{hospital.neighborhood} · Recife</Text>
      </View>
      <TouchableOpacity onPress={onToggleFavorite} hitSlop={12} accessibilityLabel={favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}>
        <Ionicons name={favorite ? 'star' : 'star-outline'} size={26} color={favorite ? '#e0a100' : colors.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 10 },
  badge: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.primary, fontWeight: '800' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  neighborhood: { color: colors.muted, marginTop: 2 },
});
