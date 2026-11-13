import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\\/$/, '');
const TOKEN_KEY = 'sind19mar.passenger.token';

export type AuthResponse = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  user: { id: string; role: string; status: string };
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('La API todavía no está configurada. Define EXPO_PUBLIC_API_URL.');
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof body.message === 'string' ? body.message : 'No se pudo completar la solicitud.');
  }
  return body as T;
}

export async function login(phone: string, password: string) {
  const result = await request<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, password }),
  });
  if (result.user.role !== 'PASSENGER') throw new Error('Esta aplicación es exclusiva para pasajeros.');
  await AsyncStorage.setItem(TOKEN_KEY, result.accessToken);
  return result;
}

export async function register(fullName: string, phone: string, password: string) {
  const result = await request<AuthResponse>('/auth/register/passenger', {
    method: 'POST',
    body: JSON.stringify({ fullName, phone, password }),
  });
  await AsyncStorage.setItem(TOKEN_KEY, result.accessToken);
  return result;
}

export async function logout() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
