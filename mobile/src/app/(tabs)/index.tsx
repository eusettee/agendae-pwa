import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FadeIn } from '../../components/FadeIn';
import { PulseButton } from '../../components/PulseButton';
import { colors, spacing } from '../../theme';

const steps = [
  { icon: 'home', text: 'Em casa, converse pelo WhatsApp do Conecta Recife e responda à pré-triagem.' },
  { icon: 'cloud-upload', text: 'A ficha é enviada ao DataSUS assim que houver conexão.' },
  { icon: 'medical', text: 'O médico recebe sua ficha antes de você chegar.' },
  { icon: 'flash', text: 'No hospital, informe o protocolo: sem repetir a triagem.' },
] as const;

// Tela inicial: identidade visual, objetivo do app e atalho para o WhatsApp.
export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <FadeIn style={styles.hero}>
          <View style={styles.logo}><Text style={styles.logoText}>+</Text></View>
          <Text style={styles.brand}>agendaê<Text style={styles.dot}>.</Text></Text>
          <Text style={styles.slogan}>Saúde na palma da mão</Text>
          <Text style={styles.goal}>Pré-triagem em casa para a rede pública do Recife (Conecta Recife). Você chega ao hospital e o médico já conhece o seu caso.</Text>
        </FadeIn>

        <FadeIn delay={200}>
          <PulseButton title="Começar pelo WhatsApp" icon="logo-whatsapp" onPress={() => router.push('/whatsapp')} />
        </FadeIn>

        <FadeIn delay={400} style={styles.card}>
          <Text style={styles.cardTitle}>Como funciona</Text>
          {steps.map((step) => (
            <View key={step.text} style={styles.step}>
              <Ionicons name={step.icon} size={22} color={colors.primary} />
              <Text style={styles.stepText}>{step.text}</Text>
            </View>
          ))}
        </FadeIn>

        <FadeIn delay={600}>
          <Text style={styles.notice}>Projeto acadêmico com dados fictícios. Não substitui avaliação médica. Em emergência, ligue 192.</Text>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg },
  hero: { backgroundColor: colors.primary, borderRadius: 24, padding: spacing.lg, alignItems: 'flex-start' },
  logo: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 32, fontWeight: '800', color: colors.primary },
  brand: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 12 },
  dot: { color: colors.accent },
  slogan: { color: colors.accent, fontWeight: '700', fontSize: 16 },
  goal: { color: '#fff', fontSize: 16, lineHeight: 23, marginTop: 12 },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 14 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  step: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stepText: { flex: 1, color: colors.text, fontSize: 15, lineHeight: 21 },
  notice: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});
