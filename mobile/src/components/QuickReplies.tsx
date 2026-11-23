import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Button } from '../services/conversation';
import { colors } from '../theme';

// Botões de resposta rápida: o paciente toca em vez de digitar.
export function QuickReplies({ options, onSelect }: { options: Button[]; onSelect: (option: Button) => void }) {
  if (!options.length) return null;
  return (
    <View style={styles.row}>
      {options.map((option) => (
        <TouchableOpacity key={option.value} style={styles.button} onPress={() => onSelect(option)} accessibilityRole="button">
          <Text style={styles.text}>{option.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, backgroundColor: colors.chatBackground },
  button: { flexGrow: 1, flexBasis: '45%', minHeight: 44, justifyContent: 'center', borderWidth: 1.5, borderColor: colors.primary, borderRadius: 22, backgroundColor: colors.card, paddingHorizontal: 12 },
  text: { color: colors.primary, fontWeight: '700', fontSize: 15, textAlign: 'center' },
});
