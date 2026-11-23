import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ChatBubble } from '../components/ChatBubble';
import { QuickReplies } from '../components/QuickReplies';
import { Message, useChat } from '../hooks/useChat';
import { useShake } from '../hooks/useShake';
import { colors } from '../theme';

// Conversa do WhatsApp reutilizada na aba e na tela cheia.
// FlatList mostra as mensagens; TextInput e botões rápidos enviam as respostas.
export function WhatsAppChat({ showToolbar = true }: { showToolbar?: boolean }) {
  const { messages, buttons, typing, send, restart } = useChat();
  const [text, setText] = useState('');
  const { shake, shakeStyle } = useShake();
  const list = useRef<FlatList<Message>>(null);

  // Sempre mostra a última mensagem (inclusive quando os botões aparecem).
  useEffect(() => {
    const timer = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 100);
    return () => clearTimeout(timer);
  }, [messages, buttons, typing]);

  const submit = () => {
    if (!text.trim()) return shake(); // Mensagem vazia: o campo balança (recurso SHAKE).
    send(text);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {showToolbar && (
      <View style={styles.topBar}>
        <Text style={styles.topText}>Demonstração do WhatsApp · funciona sem internet</Text>
        <TouchableOpacity onPress={restart} style={styles.restart}>
          <Ionicons name="refresh" size={16} color={colors.primary} />
          <Text style={styles.restartText}>Recomeçar</Text>
        </TouchableOpacity>
      </View>
      )}

      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        initialNumToRender={100} // conversa curta: renderiza tudo para rolar até a última mensagem
        contentContainerStyle={styles.messages}
        ListFooterComponent={typing ? <Text style={styles.typing}>digitando…</Text> : null}
      />

      <QuickReplies options={buttons} onSelect={(option) => send(option.value, option.title)} />

      <Animated.View style={[styles.inputRow, shakeStyle]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Digite ou toque numa opção"
          maxLength={1000}
          returnKeyType="send"
        />
        <TouchableOpacity style={styles.send} onPress={submit} accessibilityLabel="Enviar mensagem">
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.chatBackground },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff8' },
  topText: { fontSize: 12, color: colors.muted, flex: 1 },
  restart: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: colors.primaryLight },
  restartText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  messages: { padding: 12 },
  typing: { alignSelf: 'flex-start', margin: 6, color: colors.muted, fontStyle: 'italic' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 8, backgroundColor: '#f0f2f5' },
  input: { flex: 1, backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16 },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});
