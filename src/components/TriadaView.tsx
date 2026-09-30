import React, { useState, useEffect } from 'react';
import { 
  Camera, 
  Sparkles, 
  Bell, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  UserX, 
  Clock, 
  User, 
  FileText, 
  LogOut, 
  ArrowRightLeft, 
  Volume2, 
  VolumeX, 
  Lock, 
  LogIn, 
  Download, 
  Users,
  Check,
  RotateCcw,
  Aperture,
  X
} from 'lucide-react';
import { Caja, Ticket, Usuario } from '../types';
import { wsClient } from '../services/websocketClient';
import { generarPdfHistorial } from '../utils/pdfExport';
import { LogoInstitucional } from './LogoInstitucional';

interface TriadaViewProps {
  cajaId: number;
  cajas: Caja[];
  ticketsEsperando: Ticket[];
  ticketsActivos: Ticket[];
  usuarios: Usuario[];
  onCambiarCaja?: (id: number) => void;
}

export const TriadaView: React.FC<TriadaViewProps> = ({
  cajaId,
  cajas,
  ticketsEsperando,
  ticketsActivos,
  usuarios,
  onCambiarCaja
}) => {
  // Filtrar solo los módulos de Triada (tipo 'TRIADA')
  const modulosTriada = cajas.filter(c => c.tipo === 'TRIADA');
  const moduloActual = modulosTriada.find(c => c.id === cajaId) || modulosTriada[0] || cajas[0];

  const [sessionUsuario, setSessionUsuario] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem(`triada_session_${cajaId}`);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const cajasRegulares = cajas.filter(c => c.tipo !== 'TRIADA');
  const [tabEstacionLogin, setTabEstacionLogin] = useState<'TRIADAS' | 'CAJAS'>('TRIADAS');
  const [tabEstacionCambio, setTabEstacionCambio] = useState<'TRIADAS' | 'CAJAS'>('TRIADAS');

  const [selectedTriadaId, setSelectedTriadaId] = useState<number>(() => {
    return moduloActual?.id || 201;
  });

  const [inputUsuario, setInputUsuario] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  const [modoLlamado, setModoLlamado] = useState<'VOZ' | 'PITIDO'>('VOZ');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarCambioModulo, setMostrarCambioModulo] = useState(false);
  const [tabActiva, setTabActiva] = useState<'ATENCION' | 'COLA' | 'HISTORIAL'>('ATENCION');
  const [historialTickets, setHistorialTickets] = useState<Ticket[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [cronometroSegundos, setCronometroSegundos] = useState(0);

  // Mantener selectedTriadaId sincronizado
  useEffect(() => {
    if (!sessionUsuario && cajaId) {
      const match = cajas.find(c => c.id === cajaId);
      if (match) {
        setSelectedTriadaId(match.id);
        if (match.tipo === 'TRIADA') {
          setTabEstacionLogin('TRIADAS');
        } else {
          setTabEstacionLogin('CAJAS');
        }
      }
    }
  }, [cajaId, sessionUsuario, cajas]);

  // Tickets en espera específicamente para Triada / Fotografía
  const colaTriada = ticketsEsperando
    .filter(t => t.etapa === 'TRIADA' && t.estado === 'ESPERANDO')
    .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());

  // Ticket asignado a este módulo de Triada
  const ticketActual = ticketsActivos.find(t => t.cajaId === moduloActual?.id && (t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION'))
    || (moduloActual?.ticketActualId ? ticketsActivos.find(t => t.id === moduloActual.ticketActualId) : null);

  // Cargar sesión guardada al cambiar de módulo
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`triada_session_${cajaId}`);
      setSessionUsuario(stored ? JSON.parse(stored) : null);
    } catch {
      setSessionUsuario(null);
    }
    setError(null);
    setLoginError(null);
  }, [cajaId]);

  // Registrar presencia en WebSocket
  useEffect(() => {
    if (moduloActual && sessionUsuario) {
      wsClient.register('FUNCIONARIO', sessionUsuario.id, moduloActual.id);
    }
  }, [moduloActual?.id, sessionUsuario?.id]);

  // Cronómetro de atención
  useEffect(() => {
    let timer: any = null;
    if (ticketActual && ticketActual.estado === 'EN_ATENCION' && ticketActual.fechaInicio) {
      const inicio = new Date(ticketActual.fechaInicio).getTime();
      const actualizar = () => {
        const ahora = Date.now();
        setCronometroSegundos(Math.max(0, Math.floor((ahora - inicio) / 1000)));
      };
      actualizar();
      timer = setInterval(actualizar, 1000);
    } else {
      setCronometroSegundos(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [ticketActual?.estado, ticketActual?.fechaInicio]);

  // Cargar historial
  const cargarHistorial = async () => {
    if (!moduloActual) return;
    setLoadingHistorial(true);
    try {
      const res = await fetch(`/api/cajas/${moduloActual.id}/historial-hoy`);
      if (res.ok) {
        const data = await res.json();
        setHistorialTickets(data.tickets || []);
      }
    } catch (e) {
      console.error('Error cargando historial de Triada:', e);
    } finally {
      setLoadingHistorial(false);
    }
  };

  useEffect(() => {
    if (tabActiva === 'HISTORIAL') {
      cargarHistorial();
    }
  }, [tabActiva, moduloActual?.id]);

  const formatearTiempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  };

  // Login de Triada
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUsuario || !inputPassword) {
      setLoginError('Ingrese su usuario y contraseña');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: inputUsuario,
          password: inputPassword,
          cajaId: selectedTriadaId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      setSessionUsuario(data.user);
      localStorage.setItem(`caja_session_${selectedTriadaId}`, JSON.stringify(data.user));
      localStorage.setItem(`triada_session_${selectedTriadaId}`, JSON.stringify(data.user));
      onCambiarCaja?.(selectedTriadaId);
      setInputPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  // Cambiar de estación mientras se está logueado
  const handleCambiarEstacion = async (nuevoId: number) => {
    if (!sessionUsuario || !moduloActual || nuevoId === moduloActual.id) {
      setMostrarCambioModulo(false);
      return;
    }
    try {
      await fetch('/api/auth/cambiar-caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: sessionUsuario.id,
          cajaIdActual: moduloActual.id,
          nuevoCajaId: nuevoId
        })
      });
      localStorage.removeItem(`caja_session_${moduloActual.id}`);
      localStorage.removeItem(`triada_session_${moduloActual.id}`);
      localStorage.setItem(`caja_session_${nuevoId}`, JSON.stringify(sessionUsuario));
      localStorage.setItem(`triada_session_${nuevoId}`, JSON.stringify(sessionUsuario));
      onCambiarCaja?.(nuevoId);
      setMostrarCambioModulo(false);
    } catch (e) {
      console.error(e);
      onCambiarCaja?.(nuevoId);
      setMostrarCambioModulo(false);
    }
  };

  // Cerrar sesión
  const handleLogout = async () => {
    if (!moduloActual) return;
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cajaId: moduloActual.id })
      });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem(`caja_session_${moduloActual.id}`);
    localStorage.removeItem(`triada_session_${moduloActual.id}`);
    setSessionUsuario(null);
  };

  // Descargar Reporte PDF oficial de atenciones en Triada
  const handleDescargarPDF = () => {
    if (!moduloActual) return;
    generarPdfHistorial({
      caja: moduloActual,
      usuario: sessionUsuario,
      tickets: historialTickets,
      tipoEstacion: 'TRIADA'
    });
  };

  // Acciones en el módulo
  const ejecutarAccion = async (endpoint: string, body?: any) => {
    if (!moduloActual || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cajas/${moduloActual.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error en la acción ${endpoint}`);
      }
      if (endpoint === 'finalizar' || endpoint === 'no-presento') {
        setTimeout(cargarHistorial, 400);
      }
    } catch (err: any) {
      setError(err.message || 'Error de comunicación con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const llamarTurno = (modoForzado?: 'VOZ' | 'PITIDO') => {
    const modo = modoForzado || modoLlamado;
    return ejecutarAccion('llamar', { modo });
  };

  const llamarSiguiente = () => {
    return ejecutarAccion('llamar-siguiente', { modo: modoLlamado });
  };

  const iniciarAtencion = () => ejecutarAccion('iniciar');
  const finalizarAtencion = () => ejecutarAccion('finalizar');
  const noSePresento = () => ejecutarAccion('no-presento');

  // SI NO HAY SESIÓN: Mostrar pantalla de login para que el funcionario elija su estación
  if (!sessionUsuario) {
    const estacionSeleccionadaObj = cajas.find(c => c.id === selectedTriadaId) || modulosTriada[0];
    const esTriadaSeleccionada = estacionSeleccionadaObj?.tipo === 'TRIADA';

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl">
          {/* Cabecera del Login */}
          <div className="text-center mb-8 flex flex-col items-center">
            <LogoInstitucional variant="login" className="justify-center mb-4" />
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg ${
              esTriadaSeleccionada
                ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 shadow-indigo-500/10'
                : 'bg-blue-600/20 border border-blue-500/40 text-blue-400 shadow-blue-500/10'
            }`}>
              <Camera className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
              Acceso a Estación de Trabajo del Funcionario
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
              Seleccione la estación (Módulo de Triada o Ventanilla de Caja) en la que atenderá hoy e ingrese con sus credenciales.
            </p>
          </div>

          {loginError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs sm:text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            {/* 1. SELECCIÓN DE LA ESTACIÓN DE TRABAJO */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[11px] font-bold ${
                    esTriadaSeleccionada ? 'bg-indigo-600' : 'bg-blue-600'
                  }`}>
                    1
                  </span>
                  <span>Seleccione la estación donde iniciará sesión:</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                    esTriadaSeleccionada 
                      ? 'bg-indigo-950/80 text-indigo-300 border-indigo-700' 
                      : 'bg-blue-950/80 text-blue-300 border-blue-700'
                  }`}>
                    Seleccionado: {esTriadaSeleccionada ? 'Triada' : 'Caja'} {estacionSeleccionadaObj?.numero}
                  </span>
                </div>
              </div>

              {/* Selector Desplegable Rápido y Tabs de tipo de estación */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs flex-1">
                  <button
                    type="button"
                    onClick={() => setTabEstacionLogin('TRIADAS')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      tabEstacionLogin === 'TRIADAS'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'text-indigo-400 hover:text-white'
                    }`}
                  >
                    Módulos de Triada / Fotografía (1 a 8)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTabEstacionLogin('CAJAS')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      tabEstacionLogin === 'CAJAS'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ventanillas de Caja (0 a 8)
                  </button>
                </div>

                {/* Dropdown directo */}
                <div className="sm:w-64">
                  <select
                    value={selectedTriadaId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedTriadaId(id);
                      const item = cajas.find(c => c.id === id);
                      if (item?.tipo === 'TRIADA') {
                        setTabEstacionLogin('TRIADAS');
                      } else {
                        setTabEstacionLogin('CAJAS');
                      }
                    }}
                    className="w-full bg-slate-950 text-white font-bold rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-indigo-500 text-xs cursor-pointer"
                  >
                    <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                      {modulosTriada.map((c) => (
                        <option key={c.id} value={c.id}>
                          Triada {c.numero} {c.usuarioNombre ? '(En uso)' : '(Libre)'}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Ventanillas de Caja (0 a 8)">
                      {cajasRegulares.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} {c.usuarioNombre ? '(En uso)' : '(Libre)'}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Tarjetas Interactivas de Selección de Estación */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(tabEstacionLogin === 'TRIADAS' ? modulosTriada : cajasRegulares).map((item) => {
                  const esSeleccionada = item.id === selectedTriadaId;
                  const tieneOperador = Boolean(item.usuarioActualId || item.usuarioNombre);
                  const estaDisponible = item.estado === 'DISPONIBLE';
                  const esModuloTriada = item.tipo === 'TRIADA';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`triada-select-${item.numero}`}
                      onClick={() => setSelectedTriadaId(item.id)}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                        esSeleccionada
                          ? esModuloTriada
                            ? 'bg-indigo-950/90 border-indigo-500 ring-2 ring-indigo-500/40 shadow-xl shadow-indigo-950 text-white'
                            : 'bg-blue-950/90 border-blue-500 ring-2 ring-blue-500/40 shadow-xl shadow-blue-950 text-white'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-lg font-black font-display text-white">
                          {esModuloTriada
                            ? `Triada ${item.numero}`
                            : item.numero === 0
                              ? 'Caja 0 (Pref.)'
                              : `Caja ${item.numero}`}
                        </span>
                        {esSeleccionada ? (
                          <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-xs font-bold shadow ${
                            esModuloTriada ? 'bg-indigo-600' : 'bg-blue-600'
                          }`}>
                            ✓
                          </span>
                        ) : (
                          <span className={`w-2 h-2 rounded-full ${
                            tieneOperador ? 'bg-amber-400' : 'bg-slate-600'
                          }`} />
                        )}
                      </div>

                      <div className="text-xs font-medium text-slate-400 truncate">
                        {esModuloTriada
                          ? item.nombre.replace(/^Triada \d+\s*-\s*/i, '') || 'Fotografía y Biometría'
                          : item.nombre.replace(/^Caja \d+\s*-\s*/i, '') || 'Atención al Ciudadano'}
                      </div>

                      <div className="mt-2 text-[11px] font-mono">
                        {tieneOperador ? (
                          <span className="text-amber-400 truncate block">En uso</span>
                        ) : estaDisponible ? (
                          <span className="text-emerald-400 font-semibold">Disponible</span>
                        ) : (
                          <span className="text-slate-500">Libre para iniciar</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CREDENCIALES DEL OPERADOR */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 mb-3">
                <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[11px] font-bold ${
                  esTriadaSeleccionada ? 'bg-indigo-600' : 'bg-blue-600'
                }`}>
                  2
                </span>
                <span>Credenciales de Acceso:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Usuario
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: funcionario1"
                    value={inputUsuario}
                    onChange={(e) => setInputUsuario(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Contraseña institucional"
                    value={inputPassword}
                    onChange={(e) => setInputPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className={`w-full py-3.5 rounded-2xl text-white font-bold text-base shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                esTriadaSeleccionada
                  ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/30'
                  : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
              }`}
            >
              {loginLoading ? (
                <span>Iniciando sesión...</span>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>
                    Iniciar Sesión y Atender en {esTriadaSeleccionada ? 'Triada' : 'Caja'} {estacionSeleccionadaObj?.numero}
                  </span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!moduloActual) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Módulo de Triada no encontrado</h2>
        <p className="text-slate-400 text-sm mt-1">Configure los módulos de Triada desde el panel de Administración.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Modal para cambiar entre estaciones */}
      {mostrarCambioModulo && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                  Cambiar Estación de Trabajo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seleccione el módulo o ventanilla al que desea trasladarse:
                </p>
              </div>
              <button
                onClick={() => setMostrarCambioModulo(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de tipo en modal */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs mb-4">
              <button
                type="button"
                onClick={() => setTabEstacionCambio('TRIADAS')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                  tabEstacionCambio === 'TRIADAS'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-indigo-400 hover:text-white'
                }`}
              >
                Módulos de Triada (1 a 8)
              </button>
              <button
                type="button"
                onClick={() => setTabEstacionCambio('CAJAS')}
                className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer text-center ${
                  tabEstacionCambio === 'CAJAS'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Ventanillas de Caja (0 a 8)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6 max-h-72 overflow-y-auto pr-1">
              {(tabEstacionCambio === 'TRIADAS' ? modulosTriada : cajasRegulares).map((c) => {
                const esActual = c.id === moduloActual.id;
                const esTriada = c.tipo === 'TRIADA';

                return (
                  <button
                    key={c.id}
                    disabled={esActual}
                    onClick={() => handleCambiarEstacion(c.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      esActual
                        ? 'bg-indigo-950/50 border-indigo-600/60 opacity-60 cursor-not-allowed'
                        : esTriada
                          ? 'bg-slate-950 border-slate-800 hover:border-indigo-500 hover:bg-indigo-950/30 cursor-pointer'
                          : 'bg-slate-950 border-slate-800 hover:border-blue-500 hover:bg-slate-900 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-base">
                        {esTriada
                          ? `Triada ${c.numero}`
                          : c.numero === 0
                            ? 'Caja 0 (Pref.)'
                            : `Caja ${c.numero}`}
                      </span>
                      {esActual && <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold">Actual</span>}
                    </div>
                    <p className="text-xs text-slate-300 truncate">
                      {esTriada
                        ? c.nombre.replace(/^Triada \d+\s*-\s*/i, '') || 'Fotografía y Biometría'
                        : c.nombre.replace(/^Caja \d+\s*-\s*/i, '') || 'Atención al Ciudadano'}
                    </p>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {c.usuarioNombre ? 'En uso' : 'Libre'}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setMostrarCambioModulo(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra superior del módulo de Triada */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-indigo-500/20">
            {moduloActual.numero}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                {moduloActual.nombre}
              </h2>
              <button
                onClick={() => setMostrarCambioModulo(true)}
                title="Cambiar de módulo de Triada"
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-indigo-400 transition-colors"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
              <span>Operador: <strong className="text-slate-200">{sessionUsuario.nombre}</strong></span>
              <span>•</span>
              <span className="font-mono text-slate-500">@{sessionUsuario.usuario || 'triada'}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Selector de modo de llamado: Voz vs Pitido */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setModoLlamado('VOZ')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                modoLlamado === 'VOZ'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Voz y Nombre</span>
            </button>
            <button
              onClick={() => setModoLlamado('PITIDO')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                modoLlamado === 'PITIDO'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Solo Pitido</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Pestañas de navegación */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
        <button
          onClick={() => setTabActiva('ATENCION')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tabActiva === 'ATENCION'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4" />
            <span>Atención en Curso</span>
            {ticketActual && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </div>
        </button>

        <button
          onClick={() => setTabActiva('COLA')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tabActiva === 'COLA'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Cola para Triada</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 text-[10px] font-mono">
              {colaTriada.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setTabActiva('HISTORIAL')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            tabActiva === 'HISTORIAL'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>Historial Hoy</span>
          </div>
        </button>
      </div>

      {/* VISTA 1: ATENCIÓN EN CURSO EN TRIADA */}
      {tabActiva === 'ATENCION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Principal del Ticket */}
          <div className="lg:col-span-2">
            {ticketActual ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
                {/* Cabecera del Turno */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-800 mb-6">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-indigo-400">
                      TURNO ASIGNADO A FOTOGRAFÍA / TRIADA {moduloActual.numero}
                    </span>
                    <div className="text-5xl sm:text-6xl font-black text-white font-display mt-1">
                      {ticketActual.codigo}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      ticketActual.estado === 'EN_ATENCION'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : ticketActual.estado === 'LLAMANDO'
                        ? 'bg-indigo-950 text-indigo-300 border border-indigo-500 animate-pulse ring-2 ring-indigo-500/30'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {ticketActual.estado === 'EN_ATENCION' ? 'EN ATENCIÓN EN SALA (FOTOGRAFÍA)' : (ticketActual.estado === 'LLAMANDO' ? '¡LLAMANDO EN PANTALLA!' : ticketActual.estado)}
                    </span>
                    <div className="text-xs text-slate-400 mt-1 font-mono">
                      Llamados: <strong className="text-white">{ticketActual.llamadosContador || 0}</strong>
                    </div>
                  </div>
                </div>

                {/* Datos del Ciudadano */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-400" />
                      Ciudadano
                    </span>
                    <div className="text-lg font-bold text-white mt-1 capitalize">
                      {[ticketActual.ciudadanoNombre, ticketActual.ciudadanoApellido].filter(Boolean).join(' ') || 'No registrado'}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-400 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      Trámite
                    </span>
                    <div className="text-lg font-bold text-white mt-1">
                      {ticketActual.tramite}
                    </div>
                  </div>
                </div>

                {/* BOTONERA DE ACCIÓN EN TRIADA */}
                <div className="space-y-4">
                  {ticketActual.estado === 'ASIGNADO' && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                      <button
                        id="btn-triada-llamar-pantalla"
                        onClick={() => llamarTurno()}
                        disabled={loading}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
                      >
                        <Bell className="w-5 h-5" />
                        <span>LLAMAR A PANTALLA DE TRIADA</span>
                      </button>

                      <button
                        id="btn-triada-iniciar-atencion-directo"
                        onClick={iniciarAtencion}
                        disabled={loading}
                        className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span>INICIAR ATENCIÓN</span>
                      </button>
                    </div>
                  )}

                  {ticketActual.estado === 'LLAMANDO' && (
                    <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                      <button
                        id="btn-triada-rellamar"
                        onClick={() => llamarTurno(modoLlamado)}
                        disabled={loading}
                        title="Vuelve a enviar la señal a la pantalla de TV de Triada"
                        className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/50 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Bell className="w-4 h-4" />
                        <span>RE-LLAMAR A PANTALLA DE TRIADA ({ticketActual.llamadosContador})</span>
                      </button>

                      <button
                        id="btn-triada-iniciar-atencion"
                        onClick={iniciarAtencion}
                        disabled={loading}
                        className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span>INICIAR ATENCIÓN</span>
                      </button>

                      <button
                        id="btn-triada-no-presento"
                        onClick={noSePresento}
                        disabled={loading}
                        className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-rose-950/50 text-rose-300 border border-rose-800/60 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <UserX className="w-4 h-4" />
                        <span>NO SE PRESENTÓ</span>
                      </button>
                    </div>
                  )}

                  {ticketActual.estado === 'EN_ATENCION' && (
                    <div className="w-full text-center space-y-4">
                      {/* Indicador de cronómetro activo de fotografía */}
                      <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 shadow-lg">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Fotografía y Biometría:</span>
                        <span className="text-2xl font-black font-mono text-white tracking-widest">
                          {formatearTiempo(cronometroSegundos)}
                        </span>
                      </div>

                      {/* Botón Finalizar Trámite */}
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                          id="btn-triada-finalizar-tramite"
                          onClick={finalizarAtencion}
                          disabled={loading}
                          className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer border border-emerald-400/30"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                          <span>FINALIZAR TRÁMITE</span>
                        </button>

                        <button
                          onClick={noSePresento}
                          disabled={loading}
                          title="Marcar como no presentado"
                          className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                        >
                          <UserX className="w-4 h-4" />
                          <span>No se presentó</span>
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 font-medium max-w-lg mx-auto">
                        Al presionar <strong>"FINALIZAR TRÁMITE"</strong> se concluye el proceso de fotografía y el módulo quedará listo para recibir el siguiente ticket.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center shadow-xl">
                <Camera className="w-16 h-16 text-indigo-400/40 mx-auto mb-4 animate-pulse" />
                <h3 className="text-xl font-bold text-white mb-2">
                  Triada {moduloActual.numero} Disponible
                </h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                  {colaTriada.length > 0 
                    ? `Hay ${colaTriada.length} turnos derivados de caja esperando en la cola de fotografía.` 
                    : 'No hay turnos en espera para fotografía en este momento. Cuando una caja envíe un ticket a Triada, aparecerá aquí.'}
                </p>

                {colaTriada.length > 0 && (
                  <button
                    onClick={llamarSiguiente}
                    disabled={loading}
                    className="py-3.5 px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 inline-flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Llamar Siguiente Turno en Espera ({colaTriada[0].codigo})</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Panel Lateral: Turnos en espera para Triada */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Cola en Espera (Triada)</span>
              </h3>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-full border border-indigo-800">
                {colaTriada.length}
              </span>
            </div>

            <div className="space-y-2.5 overflow-y-auto max-h-[450px]">
              {colaTriada.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No hay turnos derivados esperando en Triada.
                </div>
              ) : (
                colaTriada.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base font-black text-white font-display">
                        {t.codigo}
                      </span>
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-900">
                        #{idx + 1} en fila
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-300 truncate capitalize">
                      {[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'Ciudadano'}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{t.tramite}</span>
                      <span>{new Date(t.fechaCreacion).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: LISTADO DE LA COLA COMPLETA DE TRIADA */}
      {tabActiva === 'COLA' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>Turnos Derivados Esperando en Triada / Fotografía</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Tickets que terminaron la etapa en Caja y fueron enviados a Triada para fotografía y biometría.
              </p>
            </div>

            {!ticketActual && colaTriada.length > 0 && (
              <button
                onClick={llamarSiguiente}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                <span>Llamar Primer Turno ({colaTriada[0].codigo})</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Posición</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Ciudadano</th>
                  <th className="py-3 px-4">Trámite</th>
                  <th className="py-3 px-4">Hora Creación</th>
                  <th className="py-3 px-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {colaTriada.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No hay turnos en espera para fotografía en este momento.
                    </td>
                  </tr>
                ) : (
                  colaTriada.map((t, idx) => (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-white text-sm">
                        {t.codigo}
                      </td>
                      <td className="py-3 px-4 capitalize">
                        {[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'Anónimo'}
                      </td>
                      <td className="py-3 px-4">{t.tramite}</td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(t.fechaCreacion).toLocaleTimeString('es-ES')}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          Esperando en Triada
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: HISTORIAL DE TICKETS ATENDIDOS HOY EN ESTA TRIADA */}
      {tabActiva === 'HISTORIAL' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Historial de Atenciones en Triada {moduloActual.numero}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Total de trámites y fotografías procesadas en este módulo durante la jornada de hoy.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                id="btn-descargar-triada-pdf"
                onClick={handleDescargarPDF}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Descargar Reporte PDF</span>
              </button>

              <a
                href={`/api/cajas/${moduloActual.id}/historial-hoy/csv`}
                download
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>CSV</span>
              </a>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Turno</th>
                  <th className="py-3 px-4">Ciudadano</th>
                  <th className="py-3 px-4">Trámite</th>
                  <th className="py-3 px-4">Duración</th>
                  <th className="py-3 px-4">Resultado</th>
                  <th className="py-3 px-4">Hora Fin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {historialTickets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      {loadingHistorial ? 'Cargando registros...' : 'No se registran atenciones finalizadas hoy en este módulo.'}
                    </td>
                  </tr>
                ) : (
                  historialTickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-bold text-white text-sm">
                        {t.codigo}
                      </td>
                      <td className="py-3 px-4 capitalize">
                        {[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'Anónimo'}
                      </td>
                      <td className="py-3 px-4">{t.tramite}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {t.duracionAtencionSegundos ? `${t.duracionAtencionSegundos}s` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.estado === 'FINALIZADO'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {t.fechaFinalizacion ? new Date(t.fechaFinalizacion).toLocaleTimeString('es-ES') : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
