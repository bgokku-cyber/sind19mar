import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const TOKEN_KEY = 'sind19mar.driver.token';

export type DriverProfile = {
  id: string;
  availability: 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP';
  verifiedAt: string | null;
  user: { fullName: string; phone: string; status: string };
  vehicles: Array<{ id: string; make: string; model: string; color: string; plateNumber: string; year: number; isActive: boolean }>;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('La API todavía no está configurada. Define EXPO_PUBLIC_API_URL.');
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.message === 'string' ? body.message : 'No se pudo completar la solicitud.');
  return body as T;
}

export async function login(phone: string, password: string) {
  const result = await request<{ accessToken: string; user: { role: string } }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ phone, password }),
  });
  if (result.user.role !== 'DRIVER') throw new Error('Esta aplicación es exclusiva para conductores.');
  await AsyncStorage.setItem(TOKEN_KEY, result.accessToken);
}

export async function register(fullName: string, phone: string, password: string, licenseNumber: string) {
  const result = await request<{ accessToken: string }>('/auth/register/driver', {
    method: 'POST', body: JSON.stringify({ fullName, phone, password, licenseNumber }),
  });
  await AsyncStorage.setItem(TOKEN_KEY, result.accessToken);
}

export async function restoreSession() {
  if (!await AsyncStorage.getItem(TOKEN_KEY)) return false;
  try { await request<DriverProfile>('/drivers/me'); return true; }
  catch { await AsyncStorage.removeItem(TOKEN_KEY); return false; }
}

export async function getProfile() { return request<DriverProfile>('/drivers/me'); }

export async function setAvailability(availability: 'AVAILABLE' | 'OFFLINE') {
  return request<DriverProfile>('/drivers/me/availability', { method: 'PATCH', body: JSON.stringify({ availability }) });
}

export async function addVehicle(vehicle: { make: string; model: string; color: string; plateNumber: string; year: number }) {
  return request('/drivers/me/vehicles', { method: 'POST', body: JSON.stringify(vehicle) });
}

export async function logout() { await AsyncStorage.removeItem(TOKEN_KEY); }
