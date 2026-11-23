import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { API_URL } from '../services/api';
import { evaluateTriage, TriageInput, TriageResult } from '../services/triage';

const STORAGE_KEY = 'agendae.triagens';

export type SavedTriage = TriageInput & TriageResult & {
  id: string; // protocolo mostrado na recepção
  createdAt: string;
  status: 'pendente' | 'enviada';
};

type TriagesContextValue = {
  triages: SavedTriage[];
  saveTriage: (input: TriageInput) => SavedTriage;
  syncPending: () => Promise<number>;
};

const TriagesContext = createContext<TriagesContextValue | null>(null);
const protocol = () => 'PT-' + Math.random().toString(36).slice(2, 8).toUpperCase();

// Fila offline: a triagem é salva no celular na hora e enviada quando houver internet.
// O envio ao DataSUS é SIMULADO neste protótipo: o app confirma que alcança o servidor
// do projeto e marca a ficha como enviada (não há integração real com o Ministério da Saúde).
export function TriagesProvider({ children }: { children: ReactNode }) {
  const [triages, setTriages] = useState<SavedTriage[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => saved && setTriages(JSON.parse(saved)))
      .catch(() => setTriages([]));
  }, []);

  const persist = (next: SavedTriage[]) => {
    setTriages(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  const saveTriage = (input: TriageInput) => {
    const triage: SavedTriage = { ...input, ...evaluateTriage(input), id: protocol(), createdAt: new Date().toISOString(), status: 'pendente' };
    persist([triage, ...triages]);
    return triage;
  };

  const syncPending = async () => {
    const pending = triages.filter((item) => item.status === 'pendente').length;
    if (!pending) return 0;
    const response = await fetch(`${API_URL}/api/status`); // sem internet, lança erro
    if (!response.ok) throw new Error('Servidor indisponível.');
    persist(triages.map((item) => ({ ...item, status: 'enviada' as const })));
    return pending;
  };

  return <TriagesContext.Provider value={{ triages, saveTriage, syncPending }}>{children}</TriagesContext.Provider>;
}

export function useTriages() {
  const context = useContext(TriagesContext);
  if (!context) throw new Error('useTriages precisa estar dentro de TriagesProvider');
  return context;
}
