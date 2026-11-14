import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
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

export async function restoreSession() {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return false;
  try {
    await request('/rides');
    return true;
  } catch {
    await AsyncStorage.removeItem(TOKEN_KEY);
    return false;
  }
}

export async function logout() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}


export type PassengerRide = {
  id: string;
  status: 'REQUESTED' | 'ACCEPTED' | 'DRIVER_ARRIVING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  originAddress: string;
  destinationAddress: string;
  estimatedFare: string | number | null;
  paymentMethod: 'CASH' | 'DIGITAL';
  requestedAt: string;
  driver?: { location: { latitude: string | number; longitude: string | number; recordedAt: string } | null } | null;
};

export async function getMyRides() {
  return request<PassengerRide[]>('/rides');
}

export async function cancelRide(rideId: string) {
  return request<PassengerRide>(`/rides/${encodeURIComponent(rideId)}/cancel`, { method: 'POST' });
}

export type CreatePassengerRideInput = {
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  destinationAddress: string;
  destinationLatitude: number;
  destinationLongitude: number;
  paymentMethod: 'CASH' | 'DIGITAL';
};

/** Crea una solicitud usando coordenadas reales; la identidad del pasajero la obtiene la API del token. */
export async function createRide(input: CreatePassengerRideInput) {
  const addresses = [input.originAddress, input.destinationAddress];
  if (addresses.some((address) => typeof address !== 'string' || !address.trim())) {
    throw new Error('Debes indicar el origen y el destino.');
  }
  const coordinates = [
    input.originLatitude, input.originLongitude,
    input.destinationLatitude, input.destinationLongitude,
  ];
  if (!coordinates.every(Number.isFinite)) {
    throw new Error('Selecciona ubicaciones con coordenadas válidas.');
  }
  if (input.originLatitude < -90 || input.originLatitude > 90 ||
      input.destinationLatitude < -90 || input.destinationLatitude > 90 ||
      input.originLongitude < -180 || input.originLongitude > 180 ||
      input.destinationLongitude < -180 || input.destinationLongitude > 180) {
    throw new Error('Las coordenadas de origen o destino están fuera de rango.');
  }
  return request<PassengerRide>('/rides', {
    method: 'POST',
    body: JSON.stringify({
      originAddress: input.originAddress.trim(),
      originLatitude: input.originLatitude,
      originLongitude: input.originLongitude,
      destinationAddress: input.destinationAddress.trim(),
      destinationLatitude: input.destinationLatitude,
      destinationLongitude: input.destinationLongitude,
      paymentMethod: input.paymentMethod,
    }),
  });
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


export type RouteQuote = {
  provider: string;
  distanceKm: number;
  durationMinutes: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  fare: { currency: 'BOB'; distanceKm: number; amount: number; pricingVersion: string } | null;
  fareUnavailableReason: string | null;
};

/** Cotización vial calculada por el backend; no calcula precios en el dispositivo. */
export async function getRouteQuote(input: { originLatitude: number; originLongitude: number; destinationLatitude: number; destinationLongitude: number }) {
  const query = new URLSearchParams({ originLatitude: String(input.originLatitude), originLongitude: String(input.originLongitude), destinationLatitude: String(input.destinationLatitude), destinationLongitude: String(input.destinationLongitude) });
  return request<RouteQuote>('/routes/quote?' + query.toString());
}
