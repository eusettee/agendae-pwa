import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WhatsAppChat } from '../components/WhatsAppChat';

const WHATSAPP_GREEN = '#075e54';

// Tela só do WhatsApp: o chat ocupa tudo, sem as abas do app, como o cidadão veria no celular.
export default function WhatsAppScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} accessibilityLabel="Voltar">
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.avatar}><Text style={styles.avatarText}>+</Text></View>
        <View style={styles.title}>
          <Text style={styles.name}>Conecta Recife · Saúde <Ionicons name="checkmark-circle" size={14} color="#25d366" /></Text>
          <Text style={styles.status}>online · conta oficial</Text>
        </View>
        <Ionicons name="videocam" size={22} color="#fff" />
        <Ionicons name="call" size={20} color="#fff" />
      </View>
      <WhatsAppChat showToolbar={false} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WHATSAPP_GREEN },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: WHATSAPP_GREEN },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#def5aa', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#125c4c', fontWeight: '800', fontSize: 22 },
  title: { flex: 1 },
  name: { color: '#fff', fontWeight: '700', fontSize: 16 },
  status: { color: '#d0e8e4', fontSize: 12 },
});
