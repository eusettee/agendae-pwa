import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { HospitalCard } from '../../components/HospitalCard';
import { hospitals, hospitalSource } from '../../data/hospitals';
import { useFavorites } from '../../hooks/useFavorites';
import { colors, spacing } from '../../theme';

// Remove acentos para que "restauracao" encontre "Restauração".
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Unidades: busca por nome ou bairro (TextInput + useState), lista (FlatList) e favoritos.
export default function UnidadesScreen() {
  const [search, setSearch] = useState('');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { isFavorite, toggleFavorite, favorites } = useFavorites();

  const visible = hospitals.filter((hospital) =>
    (!onlyFavorites || isFavorite(hospital.id)) &&
    normalize(`${hospital.name} ${hospital.acronym} ${hospital.neighborhood}`).includes(normalize(search)),
  );

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Pesquisar por nome ou bairro (ex.: Derby)" />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Só favoritos ({favorites.length})</Text>
          <Switch value={onlyFavorites} onValueChange={setOnlyFavorites} trackColor={{ true: colors.primary }} />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <HospitalCard
            hospital={item}
            favorite={isFavorite(item.id)}
            onPress={() => router.push({ pathname: '/unidade/[id]', params: { id: item.id } })}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>{onlyFavorites ? 'Você ainda não salvou favoritos.' : 'Nenhuma unidade encontrada.'}</Text>}
        ListFooterComponent={<Text style={styles.source}>Fonte: {hospitalSource}. Não indica vagas em tempo real.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  filters: { padding: spacing.md, gap: 10, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border },
  search: { backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchLabel: { color: colors.text, fontWeight: '600' },
  list: { padding: spacing.md },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 30 },
  source: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
