import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConfirmModal } from '../../components/ConfirmModal';
import { Channel, channels } from '../../data/channels';
import { colors, spacing } from '../../theme';

// Canais oficiais em ScrollView. Antes de ligar ou abrir um site, um Modal confirma.
export default function CanaisScreen() {
  const [selected, setSelected] = useState<Channel | null>(null);

  const openSelected = () => {
    if (selected) Linking.openURL(selected.url).catch(() => {});
    setSelected(null);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.alert}>
        <Ionicons name="warning" size={22} color={colors.danger} />
        <Text style={styles.alertText}>Em emergência, ligue 192 (SAMU).</Text>
      </View>

      {channels.map((channel) => (
        <View key={channel.id} style={styles.card}>
          <Text style={styles.name}>{channel.name}</Text>
          <Text style={styles.description}>{channel.description}</Text>
          <TouchableOpacity style={styles.button} onPress={() => setSelected(channel)}>
            <Ionicons name={channel.icon} size={18} color={colors.primary} />
            <Text style={styles.buttonText}>{channel.label}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <ConfirmModal
        visible={selected !== null}
        title={selected?.name ?? ''}
        message={selected?.url.startsWith('tel:') ? 'Você vai sair do app para fazer uma ligação.' : 'Você vai sair do app para abrir um site oficial (precisa de internet).'}
        confirmLabel={selected?.label ?? 'Abrir'}
        onConfirm={openSelected}
        onCancel={() => setSelected(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: 12 },
  alert: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fde8e6', padding: 14, borderRadius: 14 },
  alertText: { color: colors.danger, fontWeight: '700', fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 6 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  description: { color: colors.muted, lineHeight: 20 },
  button: { flexDirection: 'row', gap: 8, alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.primaryLight, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  buttonText: { color: colors.primary, fontWeight: '700' },
});
