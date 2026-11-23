import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';
import { colors } from '../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Recurso BOTTOM TABS + ICONS: as cinco telas principais ficam nas abas inferiores.
export default function TabsLayout() {
  const tab = (title: string, iconName: IconName) => ({
    title,
    tabBarIcon: ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={iconName} color={color} size={size} />,
  });

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ ...tab('Início', 'home'), headerShown: false }} />
      <Tabs.Screen name="atendimento" options={{ ...tab('WhatsApp', 'logo-whatsapp'), headerTitle: 'Conecta Recife · Saúde' }} />
      <Tabs.Screen name="fichas" options={{ ...tab('Fichas', 'document-text'), headerTitle: 'Minhas pré-triagens' }} />
      <Tabs.Screen name="unidades" options={tab('Unidades', 'business')} />
      <Tabs.Screen name="canais" options={{ ...tab('Canais', 'call'), headerTitle: 'Canais oficiais' }} />
    </Tabs>
  );
}
