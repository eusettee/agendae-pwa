import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { FavoritesProvider } from '../hooks/useFavorites';
import { TriagesProvider } from '../hooks/useTriages';
import { colors } from '../theme';

// Recurso STACK NAVIGATOR: as abas ficam na base da pilha e a tela de
// detalhes da unidade é empilhada por cima (com botão de voltar).
export default function RootLayout() {
  return (
    <TriagesProvider>
    <FavoritesProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: colors.primary }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '700' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="unidade/[id]" options={{ title: 'Detalhes da unidade' }} />
        <Stack.Screen name="ficha/[id]" options={{ title: 'Ficha da pré-triagem' }} />
      </Stack>
    </FavoritesProvider>
    </TriagesProvider>
  );
}
