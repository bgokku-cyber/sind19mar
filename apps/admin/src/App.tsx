import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
type Vehicle = { id: string; make: string; model: string; color: string; plateNumber: string; year: number; isActive: boolean };
type PendingDriver = { id: string; verifiedAt: string | null; user: { id: string; fullName: string; phone: string; status: string; createdAt: string }; vehicles: Vehicle[] };
type PendingFleet = { id: string; name: string; status: string; manager: { id: string; fullName: string; phone: string; createdAt: string } };
type AdminRide = { id: string; status: string; originAddress: string; destinationAddress: string; estimatedFare: string | number | null; finalFare: string | number | null; paymentMethod: string; paymentStatus: string; requestedAt: string; passenger: { user: { fullName: string; phone: string } }; driver: null | { user: { fullName: string; phone: string } } };
type Auth = { accessToken: string; user: { role: string; fullName?: string } };

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('sind19mar.admin.token') || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [drivers, setDrivers] = useState<PendingDriver[]>([]);
  const [fleets, setFleets] = useState<PendingFleet[]>([]);
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'drivers' | 'fleets' | 'rides'>('rides');

  const request = useCallback(async <T,>(path: string, method = 'GET'): Promise<T> => {
    if (!API) throw new Error('Configura VITE_API_URL con la dirección de la API.');
    const response = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'La operación no pudo completarse.');
    return data as T;
  }, [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [d, f, r] = await Promise.all([request<PendingDriver[]>('/admin/drivers/pending'), request<PendingFleet[]>('/admin/fleets/pending'), request<AdminRide[]>('/admin/rides')]);
      setDrivers(d); setFleets(f); setRides(r);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudieron cargar los datos.';
      setError(message);
      if (/401|403|permiso|autentic/i.test(message)) { sessionStorage.removeItem('sind19mar.admin.token'); setToken(''); }
    }
  }, [request, token]);

  useEffect(() => { void load(); }, [load]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy('login'); setError('');
    try {
      const auth = await requestUnauth<Auth>('/auth/login', { phone: phone.trim(), password });
      if (auth.user?.role !== 'ADMIN') throw new Error('Esta cuenta no tiene permisos de administrador.');
      sessionStorage.setItem('sind19mar.admin.token', auth.accessToken);
      setToken(auth.accessToken); setPassword('');
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.'); }
    finally { setBusy(''); }
  }

  async function requestUnauth<T>(path: string, body: unknown): Promise<T> {
    if (!API) throw new Error('Configura VITE_API_URL con la dirección de la API.');
    const response = await fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(typeof data.message === 'string' ? data.message : 'Credenciales incorrectas.');
    return data as T;
  }

  async function act(key: string, path: string, label: string) {
    setBusy(key); setError(''); setNotice('');
    try { await request(path, 'PATCH'); setNotice(label); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la operación.'); }
    finally { setBusy(''); }
  }

  function signOut() { sessionStorage.removeItem('sind19mar.admin.token'); setToken(''); setDrivers([]); setFleets([]); setRides([]); }

  if (!token) return <main className="login-shell"><section className="login-card"><div className="brand-mark">19</div><p className="eyebrow">SIND.19-MAR · LA PAZ</p><h1>Panel administrativo</h1><p className="muted">Acceso exclusivo para personal autorizado.</p><form onSubmit={signIn}><label>Teléfono<input value={phone} onChange={e => setPhone(e.target.value)} autoComplete="username" placeholder="Número de teléfono" required /></label><label>Contraseña<input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required /></label><button disabled={busy === 'login'}>{busy === 'login' ? 'Ingresando…' : 'Iniciar sesión'}</button></form>{error && <p className="error">{error}</p>}<p className="footnote">No existe una cuenta predeterminada. Utiliza las credenciales administrativas habilitadas en el sistema.</p></section></main>;

  return <div className="layout"><aside className="sidebar"><div className="brand-row"><div className="brand-small">19</div><div><b>Sind.19-Mar</b><small>ADMINISTRACIÓN</small></div></div><div className="side-label">GESTIÓN</div><button className={tab === 'rides' ? 'nav active' : 'nav'} onClick={() => setTab('rides')}>Viajes <span>{rides.length}</span></button><button className={tab === 'drivers' ? 'nav active' : 'nav'} onClick={() => setTab('drivers')}>Conductores <span>{drivers.length}</span></button><button className={tab === 'fleets' ? 'nav active' : 'nav'} onClick={() => setTab('fleets')}>Flotas <span>{fleets.length}</span></button><div className="side-bottom"><span>La Paz · Bolivia</span><button className="logout" onClick={signOut}>Cerrar sesión ↗</button></div></aside><main className="main"><header className="topbar"><div><p className="eyebrow">CENTRO DE CONTROL</p><h1>Panel de administración</h1></div><button className="outline" onClick={() => void load()} disabled={!!busy}>Actualizar datos</button></header><section className="welcome"><div><b>Operación de la plataforma</b><p>Supervisa los viajes recientes y revisa las solicitudes de conductores y flotas.</p></div><div className="welcome-icon">✓</div></section>{error && <div className="alert error">{error}</div>}{notice && <div className="alert success">{notice}</div>}<div className="stats"><article><span>Viajes registrados</span><strong>{rides.length}</strong></article><article><span>Conductores pendientes</span><strong>{drivers.length}</strong></article><article><span>Flotas pendientes</span><strong>{fleets.length}</strong></article></div><section className="panel"><div className="panel-head"><div><p className="eyebrow">REVISIÓN ADMINISTRATIVA</p><h2>{tab === 'rides' ? 'Viajes recientes' : tab === 'drivers' ? 'Conductores pendientes' : 'Flotas pendientes'}</h2></div><div className="tabs"><button className={tab === 'rides' ? 'selected' : ''} onClick={() => setTab('rides')}>Viajes</button><button className={tab === 'drivers' ? 'selected' : ''} onClick={() => setTab('drivers')}>Conductores</button><button className={tab === 'fleets' ? 'selected' : ''} onClick={() => setTab('fleets')}>Flotas</button></div></div>{tab === 'rides' ? rides.length === 0 ? <Empty text="Todavía no hay viajes registrados."/> : <div className="cards">{rides.map(r => <article className="item" key={r.id}><div className="item-head"><div className="avatar">V</div><div className="grow"><b>{rideStatus(r.status)}</b><small>{new Date(r.requestedAt).toLocaleString('es-BO')}</small></div><span className="pill">{r.paymentStatus === 'PAID' ? 'Pagado' : r.paymentStatus === 'REFUNDED' ? 'Reembolsado' : 'Pendiente de pago'}</span></div><div className="ride-route"><small>ORIGEN</small><b>{r.originAddress}</b><small>DESTINO</small><b>{r.destinationAddress}</b></div><div className="ride-meta"><span>Pasajero: {r.passenger.user.fullName} · {r.passenger.user.phone}</span><span>Conductor: {r.driver ? r.driver.user.fullName + ' · ' + r.driver.user.phone : 'Sin asignar'}</span><span>Pago: {r.paymentMethod === 'CASH' ? 'Efectivo' : 'Digital'}</span><strong>{r.finalFare != null ? 'Bs ' + Number(r.finalFare).toFixed(2).replace('.', ',') : r.estimatedFare != null ? 'Estimado: Bs ' + Number(r.estimatedFare).toFixed(2).replace('.', ',') : 'Tarifa por definir'}</strong></div></article>)}</div> : tab === 'drivers' ? drivers.length === 0 ? <Empty text="No hay conductores pendientes de aprobación."/> : <div className="cards">{drivers.map(d => <article className="item" key={d.id}><div className="item-head"><div className="avatar">{d.user.fullName.slice(0,1).toUpperCase()}</div><div className="grow"><b>{d.user.fullName}</b><small>{d.user.phone} · Registro {new Date(d.user.createdAt).toLocaleDateString('es-BO')}</small></div><span className="pill">Pendiente</span></div><h3>Vehículos registrados</h3>{d.vehicles.length === 0 ? <p className="muted">No ha registrado vehículos.</p> : d.vehicles.map(v => <div className="vehicle" key={v.id}><div><b>{v.make} {v.model} · {v.year}</b><small>{v.color} · Placa {v.plateNumber}</small></div>{v.isActive ? <span className="approved">Aprobado</span> : <button className="mini" disabled={!!busy} onClick={() => void act(v.id, '/admin/vehicles/'+v.id+'/approve', 'Vehículo aprobado correctamente.')}>{busy === v.id ? '…' : 'Aprobar vehículo'}</button>}</div>)}<button className="approve" disabled={!!busy || !d.vehicles.some(v => v.isActive)} onClick={() => void act(d.id, '/admin/drivers/'+d.id+'/approve', 'Conductor aprobado correctamente.')}>{busy === d.id ? 'Procesando…' : 'Aprobar conductor'}</button>{!d.vehicles.some(v => v.isActive) && <small className="hint">Primero debes aprobar al menos un vehículo.</small>}</article>)}</div> : <div className="cards">{fleets.map(f => <article className="item" key={f.id}><div className="item-head"><div className="avatar">F</div><div className="grow"><b>{f.name}</b><small>Responsable: {f.manager.fullName} · {f.manager.phone}</small></div><span className="pill">Pendiente</span></div><button className="approve" disabled={!!busy} onClick={() => void act(f.id, '/admin/fleets/'+f.id+'/approve', 'Flota aprobada correctamente.')}>{busy === f.id ? 'Procesando…' : 'Aprobar flota'}</button></article>)}{fleets.length === 0 && <Empty text="No hay flotas pendientes de aprobación."/>}</div>}</section><footer>Sind.19-Mar · Panel interno · Moneda de operación: bolivianos (BOB)</footer></main></div>;
}

function rideStatus(status: string) { return ({ REQUESTED: 'Buscando conductor', ACCEPTED: 'Conductor asignado', DRIVER_ARRIVING: 'Conductor en camino', IN_PROGRESS: 'Viaje en curso', COMPLETED: 'Completado', CANCELLED: 'Cancelado' })[status] ?? status; }

function Empty({ text }: { text: string }) { return <div className="empty"><span>✓</span><b>{text}</b><small>Los nuevos registros aparecerán aquí automáticamente al actualizar.</small></div>; }
