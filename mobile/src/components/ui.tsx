import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TextInputProps, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function Screen({ children }: PropsWithChildren) {
  return <SafeAreaView style={{ flex: 1, backgroundColor: '#f4f8f7' }} edges={['bottom', 'left', 'right']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">{children}</ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function Title({ children }: PropsWithChildren) { return <Text style={styles.title}>{children}</Text>; }
export function Card({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View>; }
export function Message({ text }: { text: string }) { return text ? <Text accessibilityLiveRegion="polite" style={styles.message}>{text}</Text> : null; }
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 6 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#657673" style={styles.input} {...props} /></View>;
}
export function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && { opacity: 0.5 }]}><Text style={{ color: secondary ? '#145c50' : '#fff', fontWeight: '700', textAlign: 'center' }}>{title}</Text></Pressable>;
}
export function Choices({ label, items, value, onChange, disabled = [] }: { label: string; items: { id: string; name: string }[]; value: string; onChange: (id: string) => void; disabled?: string[] }) {
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><View style={styles.choices}>{items.map(item => <Pressable key={item.id} accessibilityRole="radio" accessibilityLabel={item.name} accessibilityState={{ checked: value === item.id, disabled: disabled.includes(item.id) }} disabled={disabled.includes(item.id)} onPress={() => onChange(item.id)} style={[styles.choice, value === item.id && { borderColor: '#167562', backgroundColor: '#e1f2eb' }, disabled.includes(item.id) && { opacity: 0.35 }]}><Text>{item.name}</Text></Pressable>)}</View></View>;
}
const styles = StyleSheet.create({
  screen: { padding: 20, gap: 16, flexGrow: 1 }, title: { fontSize: 28, color: '#163f36', fontWeight: '700' },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#fff', gap: 12 }, label: { fontWeight: '600', color: '#23443c' },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cadbd5', borderRadius: 10, padding: 14, fontSize: 16, color: '#163f36' },
  button: { padding: 16, borderRadius: 12, backgroundColor: '#167562' }, secondary: { backgroundColor: '#e1eee8' },
  message: { color: '#704716', backgroundColor: '#fff2da', padding: 14, borderRadius: 10 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { padding: 12, backgroundColor: '#fff', borderColor: '#cadbd5', borderWidth: 1, borderRadius: 10 },
});
