import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://sind19mar.onrender.com/api').replace(/\/$/, '');
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
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
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('La conexión está tardando demasiado. Comprueba tu internet e inténtalo nuevamente.');
    }
    if (error instanceof Error && error.message) throw error;
    throw new Error('No se pudo conectar con el servidor. Comprueba tu conexión a internet.');
  } finally {
    clearTimeout(timeout);
  }
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


export type DriverRide = {
  id: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  originAddress: string;
  destinationAddress: string;
  estimatedFare: string | number | null;
  finalFare: string | number | null;
  paymentMethod: 'CASH' | 'DIGITAL';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  requestedAt: string;
};

export async function getRides() {
  const [available, assigned] = await Promise.all([
    request<DriverRide[]>('/rides/available'),
    request<DriverRide[]>('/rides'),
  ]);
  return [...available, ...assigned];
}

export async function acceptRide(rideId: string) {
  return request<DriverRide>(`/rides/${encodeURIComponent(rideId)}/accept`, { method: 'POST' });
}

export async function advanceRide(rideId: string, status: 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED') {
  return request<DriverRide>(`/rides/${encodeURIComponent(rideId)}/status`, {
    method: 'POST', body: JSON.stringify({ status }),
  });
}


export async function cancelRide(rideId: string) {
  return request<DriverRide>(`/rides/${encodeURIComponent(rideId)}/cancel`, { method: 'POST' });
}

export type DriverPayment = {
  id: string;
  rideId: string;
  amount: string | number;
  currency: 'BOB';
  method: 'CASH' | 'DIGITAL';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paidAt: string | null;
  cashConfirmedAt: string | null;
  cashConfirmedByUserId: string | null;
};

/** Confirma el efectivo recibido; el backend valida conductor, viaje y estado del pago. */
export async function confirmCashPayment(rideId: string) {
  return request<DriverPayment>(`/rides/${encodeURIComponent(rideId)}/payment/cash/confirm`, { method: 'POST' });
}

export type MapConfig = {
  city: string;
  country: string;
  center: { latitude: number; longitude: number };
  defaultZoom: number;
  coverageRadiusKm: number;
  provider: string;
  tileUrlTemplate: string;
  locationMode: 'gps_or_manual';
  attributionRequired: boolean;
};

/** Configuración geográfica central compartida por las aplicaciones. */
export async function getMapConfig() {
  return request<MapConfig>('/maps/config');
}


/** Envía una posición GPS autenticada del conductor. */
export async function updateMyLocation(location: { latitude: number; longitude: number }) {
  return request<{ latitude: number; longitude: number; recordedAt: string }>('/drivers/me/location', {
    method: 'POST',
    body: JSON.stringify(location),
  });
}
