import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Message } from '../hooks/useChat';
import { colors } from '../theme';

// Converte a formatação do WhatsApp (*negrito* e _itálico_) em trechos de <Text>.
function formatted(text: string) {
  return text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) return <Text key={index} style={styles.bold}>{part.slice(1, -1)}</Text>;
    if (part.startsWith('_') && part.endsWith('_')) return <Text key={index} style={styles.italic}>{part.slice(1, -1)}</Text>;
    return part;
  });
}

export function ChatBubble({ message }: { message: Message }) {
  return (
    <View style={[styles.bubble, message.fromMe ? styles.mine : styles.theirs]}>
      <Text style={styles.text}>{formatted(message.text)}</Text>
      {message.fichaId && (
        <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/ficha/[id]', params: { id: message.fichaId! } })}>
          <Text style={styles.linkText}>📄 Ver minha ficha</Text>
        </TouchableOpacity>
      )}
      {message.fichaId && (
        <TouchableOpacity style={styles.link} onPress={() => router.push({ pathname: '/prontuario/[id]', params: { id: message.fichaId! } })}>
          <Text style={styles.linkText}>🩺 Ver como o médico recebe</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: 10, borderRadius: 10, marginVertical: 3, elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 1, shadowOffset: { width: 0, height: 1 } },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.myMessage },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card },
  text: { fontSize: 15, lineHeight: 21, color: '#111b21' },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
  link: { marginTop: 8, borderTopWidth: 1, borderColor: colors.border, paddingTop: 8, alignItems: 'center' },
  linkText: { color: '#027eb5', fontWeight: '700', fontSize: 15 },
});
