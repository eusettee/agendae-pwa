import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Switch, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Button, Choices, Field, Message, Screen } from '../components/ui';
import { api } from '../services/api';
import { useSession } from '../state/session';
import { Appointment, Catalog } from '../types';

function nextWeekday() {
  const date = new Date(); date.setDate(date.getDate() + 1);
  while ([0, 6].includes(date.getDay())) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export default function Booking() {
  const { user, loading: sessionLoading } = useSession();
  const { id, specialty: suggested } = useLocalSearchParams<{ id?: string; specialty?: string }>();
  const [catalog, setCatalog] = useState<Catalog | null>(null); const [original, setOriginal] = useState<Appointment | null>(null);
  const [specialty, setSpecialty] = useState(''); const [clinicId, setClinicId] = useState(''); const [professionalId, setProfessionalId] = useState('');
  const [date, setDate] = useState(nextWeekday); const [time, setTime] = useState(''); const [consent, setConsent] = useState(false);
  const [occupied, setOccupied] = useState<string[]>([]); const [availabilityReady, setAvailabilityReady] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [loadError, setLoadError] = useState('');
  const availabilityVersion = useRef(0);
  const invalidate = useCallback(() => { availabilityVersion.current++; }, []);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let active = true;
    if (!user) return;
    void (async () => {
      try {
        const directory = await api<Catalog>('catalog');
        const existing = id ? (await api<{ appointments: Appointment[] }>('appointments')).appointments.find(item => item.id === id) : undefined;
        if (id && !existing) throw new Error('Consulta não encontrada. Volte para sua agenda.');
        if (!active) return;
        const clinic = existing ? directory.clinics.find(item => item.id === existing.clinicId)! : directory.clinics.find(item => item.professionals.some(professional => professional.specialty === suggested)) || directory.clinics[0];
        const professional = existing ? clinic.professionals.find(item => item.id === existing.professionalId)! : clinic.professionals.find(item => item.specialty === suggested) || clinic.professionals[0];
        setCatalog(directory); setSpecialty(professional.specialty); setClinicId(clinic.id); setProfessionalId(professional.id);
        if (existing) { setOriginal(existing); setDate(existing.date); setTime(existing.time); }
      } catch (failure) { if (active) setLoadError((failure as Error).message); }
    })();
    return () => { active = false; };
  }, [user, id, suggested]);
  const refreshAvailability = useCallback(async () => {
    if (!user || !professionalId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const version = ++availabilityVersion.current;
    try {
      const result = await api<{ occupied: string[] }>(`availability?professionalId=${encodeURIComponent(professionalId)}&date=${encodeURIComponent(date)}`);
      if (version !== availabilityVersion.current) return;
      setOccupied(result.occupied); setAvailabilityReady(true); setMessage(''); setNow(Date.now());
    } catch (failure) { if (version === availabilityVersion.current) { setAvailabilityReady(false); setMessage((failure as Error).message); } }
  }, [user, professionalId, date]);
  useEffect(() => {
    const initial = setTimeout(() => { void refreshAvailability(); }, 0);
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refreshAvailability(); }, 5000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refreshAvailability(); });
    return () => { clearTimeout(initial); clearInterval(timer); subscription.remove(); invalidate(); };
  }, [refreshAvailability, invalidate]);
  if (sessionLoading) return <Screen><ActivityIndicator /></Screen>;
  if (!user) return <Redirect href="/" />;
  if (loadError) return <Screen><Message text={loadError} /><Button title="Voltar" onPress={() => router.back()} /></Screen>;
  if (!catalog) return <Screen><ActivityIndicator /></Screen>;
  const clinics = catalog.clinics.filter(item => item.professionals.some(professional => professional.specialty === specialty));
  const professionals = catalog.clinics.find(item => item.id === clinicId)?.professionals.filter(item => item.specialty === specialty) || [];
  const blocked = catalog.times.filter(value => {
    const own = original?.professionalId === professionalId && original.date === date && original.time === value;
    return (!own && occupied.includes(value)) || Date.parse(`${date}T${value}:00-03:00`) <= now || [0, 6].includes(new Date(`${date}T12:00:00-03:00`).getUTCDay());
  });
  function chooseSpecialty(value: string) {
    const clinic = catalog!.clinics.find(item => item.professionals.some(professional => professional.specialty === value))!;
    setSpecialty(value); setClinicId(clinic.id); setProfessionalId(clinic.professionals.find(item => item.specialty === value)!.id); setTime(''); setAvailabilityReady(false);
  }
  async function save() {
    if (!consent || !time || blocked.includes(time) || !availabilityReady) { setMessage('Confirme o armazenamento e escolha um horário disponível.'); return; }
    setBusy(true); setMessage('');
    try {
      await api('appointments', id ? 'PUT' : 'POST', { id, clinicId, professionalId, date, time });
      router.replace('/');
    } catch (failure) { setMessage((failure as Error).message); void refreshAvailability(); } finally { setBusy(false); }
  }
  return <Screen><Text>Paciente: {user.name}. Consulta fictícia, salva na sua conta.</Text><Message text={message} />
    <Choices label="Especialidade" items={catalog.specialties.map(value => ({ id: value, name: value }))} value={specialty} onChange={chooseSpecialty} />
    <Choices label="Unidade" items={clinics} value={clinicId} onChange={value => { const professional = catalog.clinics.find(item => item.id === value)!.professionals.find(item => item.specialty === specialty)!; setClinicId(value); setProfessionalId(professional.id); setTime(''); setAvailabilityReady(false); }} />
    <Choices label="Profissional" items={professionals} value={professionalId} onChange={value => { setProfessionalId(value); setTime(''); setAvailabilityReady(false); }} />
    <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={value => { setDate(value); setTime(''); setAvailabilityReady(false); }} maxLength={10} placeholder="2026-10-06" keyboardType="numbers-and-punctuation" />
    <Choices label="Horário" items={catalog.times.map(value => ({ id: value, name: value }))} value={time} onChange={setTime} disabled={availabilityReady ? blocked : catalog.times} />
    {!availabilityReady && <Text>Aguardando disponibilidade do servidor.</Text>}
    <View><Text>Concordo em salvar a consulta na minha conta.</Text><Switch accessibilityLabel="Consentimento para agendamento" value={consent} onValueChange={setConsent} /></View>
    <Button title={busy ? 'Salvando…' : id ? 'Salvar alterações' : 'Salvar consulta'} disabled={busy || !availabilityReady || !consent || !time || blocked.includes(time)} onPress={() => void save()} />
  </Screen>;
}
