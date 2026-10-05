import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Button, Card, Field, Message, Screen, Title } from '../components/ui';
import { api } from '../services/api';
import { useSession } from '../state/session';
import { Appointment, Catalog } from '../types';

export default function Home() {
  const { user, loading, error, reconnect, authenticate, logout } = useSession();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]); const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const refreshVersion = useRef(0);
  const invalidate = useCallback(() => { refreshVersion.current++; }, []);
  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    if (!user) return;
    try {
      const [result, directory] = await Promise.all([api<{ appointments: Appointment[] }>('appointments'), api<Catalog>('catalog')]);
      if (version !== refreshVersion.current) return;
      setAppointments(result.appointments); setLoadedFor(user.id); setCatalog(directory); setMessage('');
    } catch (failure) { if (version === refreshVersion.current) setMessage((failure as Error).message); }
  }, [user]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); subscription.remove(); invalidate(); };
  }, [refresh, invalidate]));
  async function signIn() {
    setBusy(true); setMessage('');
    try { await authenticate({ action: register ? 'register' : 'login', name, email, password, consent }); setPassword(''); }
    catch (failure) { setMessage((failure as Error).message); } finally { setBusy(false); }
  }
  function cancel(id: string) {
    Alert.alert('Cancelar consulta?', 'O horário será liberado para outras pessoas.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Cancelar consulta', style: 'destructive', onPress: async () => {
      setBusy(true);
      try { await api('appointments', 'DELETE', { id }); await refresh(); } catch (failure) { setMessage((failure as Error).message); } finally { setBusy(false); }
    } }]);
  }
  if (loading) return <Screen><ActivityIndicator accessibilityLabel="Conectando" /><Text>Conectando ao servidor…</Text></Screen>;
  const visibleAppointments = loadedFor === user?.id ? appointments : [];
  return <Screen><Title>{user ? `Olá, ${user.name}` : 'Saúde na palma da mão'}</Title><Text>Projeto acadêmico. Unidades e consultas fictícias.</Text><Message text={message || error} />
    {error && <Button title="Tentar conectar novamente" onPress={() => void reconnect()} secondary />}
    {!user ? <Card><Title>{register ? 'Criar conta' : 'Entrar'}</Title>{register && <Field label="Nome" value={name} onChangeText={setName} maxLength={80} />}
      <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry maxLength={128} autoCapitalize="none" />
      {register && <View><Text>Concordo com o uso dos dados para criar minha conta.</Text><Switch accessibilityLabel="Consentimento para cadastro" value={consent} onValueChange={setConsent} /></View>}
      <Button title={busy ? 'Aguarde…' : register ? 'Criar minha conta' : 'Entrar'} disabled={busy || (register && !consent)} onPress={() => void signIn()} />
      <Button title={register ? 'Já tenho conta' : 'Criar conta'} onPress={() => setRegister(!register)} secondary /></Card> : <>
      <Button title="Agendar consulta" onPress={() => router.push('/agendar')} /><Button title="Orientação com IA" onPress={() => router.push('/triagem')} secondary />
      <Title>Minhas consultas</Title><Text>Atualização automática a cada 5 segundos. Alterações exigem internet.</Text>
      {!visibleAppointments.length && <Card><Text>Nenhuma consulta carregada.</Text></Card>}
      {visibleAppointments.map(item => { const clinic = catalog?.clinics.find(entry => entry.id === item.clinicId); const professional = clinic?.professionals.find(entry => entry.id === item.professionalId); return <Card key={item.id}><Text style={{ fontSize: 19, fontWeight: '700' }}>{professional?.specialty || item.professionalId}</Text><Text>{item.date} · {item.time}</Text><Text>{professional?.name} · {clinic?.name}</Text><Button title="Editar" disabled={busy} onPress={() => router.push({ pathname: '/agendar', params: { id: item.id } })} secondary /><Button title="Cancelar" disabled={busy} onPress={() => cancel(item.id)} secondary /></Card>; })}
      <Button title="Atualizar agora" onPress={() => void refresh()} secondary /><Button title="Sair" disabled={busy} onPress={() => { setBusy(true); void logout().catch(failure => setMessage(failure.message)).finally(() => setBusy(false)); }} secondary />
    </>}
  </Screen>;
}
