import * as SecureStore from 'expo-secure-store';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://agendae-pwa.vercel.app').replace(/\/$/, '');
const SESSION_KEY = 'agendae.session';
let token: string | null = null;
let onExpired = () => {};

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export function onSessionExpired(handler: () => void) { onExpired = handler; }
export async function restoreSession() { token = await SecureStore.getItemAsync(SESSION_KEY); return Boolean(token); }
export async function saveSession(value: string) { await SecureStore.setItemAsync(SESSION_KEY, value); token = value; }
export async function clearSession() { token = null; await SecureStore.deleteItemAsync(SESSION_KEY); }

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${API_URL}/api/${path}`, {
      method, signal: controller.signal, credentials: 'omit',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && token) { await clearSession(); onExpired(); }
      throw new ApiError(result.error || 'Não foi possível concluir.', response.status);
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error('Sem conexão com o servidor. Verifique a internet e tente novamente.');
  } finally { clearTimeout(timer); }
}
