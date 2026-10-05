import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider } from '../state/session';

export default function Layout() {
  return <SessionProvider><StatusBar style="dark" /><Stack screenOptions={{ headerStyle: { backgroundColor: '#f4f8f7' }, headerTintColor: '#163f36' }}><Stack.Screen name="index" options={{ title: 'Agendaê' }} /><Stack.Screen name="agendar" options={{ title: 'Agendar consulta' }} /><Stack.Screen name="triagem" options={{ title: 'Orientação inicial' }} /></Stack></SessionProvider>;
}
