import { useState } from 'react';
import { Linking, Switch, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button, Card, Choices, Field, Message, Screen } from '../components/ui';
import { api } from '../services/api';
import { useSession } from '../state/session';
import { Triage } from '../types';

export default function TriageScreen() {
  const { user, loading } = useSession();
  const [symptoms, setSymptoms] = useState(''); const [duration, setDuration] = useState(''); const [intensity, setIntensity] = useState('leve');
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [result, setResult] = useState<Triage | null>(null);
  if (!user && !loading) return <Redirect href="/" />;
  async function consult() {
    setBusy(true); setMessage(''); setResult(null);
    try {
      setResult(await api<Triage>('triage', 'POST', { symptoms, duration, intensity, consent }));
      setSymptoms(''); setDuration(''); setConsent(false);
    } catch (failure) { setMessage((failure as Error).message); } finally { setBusy(false); }
  }
  return <Screen><Text>A IA sugere uma especialidade. Não faz diagnóstico nem substitui avaliação médica. Em emergência, ligue 192.</Text><Message text={message} />
    <Field label="O que você está sentindo?" value={symptoms} onChangeText={setSymptoms} multiline maxLength={1000} />
    <Field label="Há quanto tempo?" value={duration} onChangeText={setDuration} maxLength={80} />
    <Choices label="Intensidade" items={['leve', 'moderada', 'intensa'].map(value => ({ id: value, name: value }))} value={intensity} onChange={setIntensity} />
    <View><Text>Autorizo o envio do relato à IA para orientação inicial. Não informe nome, CPF ou contato.</Text><Switch accessibilityLabel="Consentimento para IA" value={consent} onValueChange={setConsent} /></View>
    <Button title={busy ? 'Consultando…' : 'Consultar IA'} disabled={busy || !consent || !user} onPress={() => void consult()} />
    {result && <Card>{result.urgent ? <><Text>Procure atendimento de urgência.</Text><Button title="Ligar 192" onPress={() => { void Linking.openURL('tel:192').catch(() => setMessage('Ligue 192 pelo telefone.')); }} /></> : result.source === 'ai' && result.specialty ? <><Text>Sugestão inicial: {result.specialty}</Text><Button title="Agendar nesta especialidade" onPress={() => router.push({ pathname: '/agendar', params: { specialty: result.specialty! } })} /></> : <><Text>{result.message}</Text><Button title="Escolher especialidade" onPress={() => router.push('/agendar')} /></>}<Text>{result.notice}</Text></Card>}
  </Screen>;
}
