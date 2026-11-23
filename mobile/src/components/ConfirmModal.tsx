import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

type Props = { visible: boolean; title: string; message: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void };

// Recurso MODAL: confirmação antes de sair do app (ligar ou abrir um site/mapa).
export function ConfirmModal({ visible, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onCancel}>
              <Text style={styles.secondaryText}>Voltar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={onConfirm}>
              <Text style={styles.primaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: colors.card, borderRadius: 18, padding: 22 },
  title: { fontSize: 19, fontWeight: '800', color: colors.text },
  message: { marginTop: 8, fontSize: 15, color: colors.muted, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  button: { flex: 1, paddingVertical: 13, borderRadius: 24, alignItems: 'center', backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryLight },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: colors.primary, fontWeight: '700' },
});
