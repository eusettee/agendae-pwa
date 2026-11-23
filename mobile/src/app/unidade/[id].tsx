import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConfirmModal } from '../../components/ConfirmModal';
import { FadeIn } from '../../components/FadeIn';
import { hospitals } from '../../data/hospitals';
import { useFavorites } from '../../hooks/useFavorites';
import { colors, spacing } from '../../theme';

// Tela de detalhes empilhada pelo Stack Navigator (recebe o id pela rota).
export default function UnidadeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hospital = hospitals.find((item) => item.id === id);
  const { isFavorite, toggleFavorite } = useFavorites();
  const [askMap, setAskMap] = useState(false);

  if (!hospital) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Unidade não encontrada.</Text>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.link}>Voltar</Text></TouchableOpacity>
      </View>
    );
  }

  const address = `${hospital.address}, ${hospital.neighborhood}, Recife/PE, CEP ${hospital.cep}`;
  const favorite = isFavorite(hospital.id);
  const openMap = () => {
    setAskMap(false);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hospital.name}, ${address}`)}`).catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <FadeIn style={styles.card}>
        <Text style={styles.acronym}>{hospital.acronym}</Text>
        <Text style={styles.name}>{hospital.name}</Text>
        <View style={styles.row}>
          <Ionicons name="location" size={20} color={colors.primary} />
          <Text style={styles.address}>{address}</Text>
        </View>
      </FadeIn>

      <TouchableOpacity style={styles.primary} onPress={() => setAskMap(true)}>
        <Ionicons name="map" size={20} color="#fff" />
        <Text style={styles.primaryText}>Ver no mapa</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={() => toggleFavorite(hospital.id)}>
        <Ionicons name={favorite ? 'star' : 'star-outline'} size={20} color={colors.primary} />
        <Text style={styles.secondaryText}>{favorite ? 'Remover dos favoritos' : 'Salvar nos favoritos'}</Text>
      </TouchableOpacity>

      <ConfirmModal
        visible={askMap}
        title="Abrir o mapa?"
        message="Você vai sair do app para ver o endereço no Google Maps (precisa de internet)."
        confirmLabel="Abrir mapa"
        onConfirm={openMap}
        onCancel={() => setAskMap(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: 12, backgroundColor: colors.background, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  muted: { color: colors.muted },
  link: { color: colors.primary, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, gap: 8 },
  acronym: { alignSelf: 'flex-start', backgroundColor: colors.primaryLight, color: colors.primary, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  address: { flex: 1, color: colors.muted, fontSize: 15, lineHeight: 21 },
  primary: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, paddingVertical: 14, borderRadius: 26 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primaryLight, paddingVertical: 14, borderRadius: 26 },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});
