import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Play, 
  CheckCircle, 
  UserX, 
  Clock, 
  UserCheck, 
  AlertCircle,
  LogIn,
  LogOut,
  RefreshCw,
  Power,
  User,
  Volume2,
  Volume1,
  Download,
  Key,
  Lock,
  Calendar,
  CheckCircle2,
  History,
  Activity,
  FileSpreadsheet,
  ArrowRightLeft,
  X,
  Sparkles,
  FileText
} from 'lucide-react';
import { Caja, Ticket, Usuario } from '../types';
import { wsClient } from '../services/websocketClient';
import { generarPdfHistorial } from '../utils/pdfExport';
import { LogoInstitucional } from './LogoInstitucional';

interface CajaViewProps {
  cajaId: number;
  cajas: Caja[];
  ticketsEsperando: Ticket[];
  ticketsActivos: Ticket[];
  usuarios: Usuario[];
  onCambiarCaja?: (id: number) => void;
}

export const CajaView: React.FC<CajaViewProps> = ({
  cajaId,
  cajas,
  ticketsEsperando,
  ticketsActivos,
  usuarios,
  onCambiarCaja
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cronometroSegundos, setCronometroSegundos] = useState(0);
  const [modoLlamado, setModoLlamado] = useState<'VOZ' | 'PITIDO'>('VOZ');
  const [tabActiva, setTabActiva] = useState<'ATENCION' | 'HISTORIAL'>('ATENCION');
  const [rangoSeleccionado, setRangoSeleccionado] = useState<'diario' | 'semanal' | 'mensual' | 'anual'>('diario');

  const cajasRegulares = cajas.filter(c => c.tipo !== 'TRIADA');
  const modulosTriada = cajas.filter(c => c.tipo === 'TRIADA');

  const [tabEstacionLogin, setTabEstacionLogin] = useState<'CAJAS' | 'TRIADAS'>('CAJAS');
  const [tabEstacionCambio, setTabEstacionCambio] = useState<'CAJAS' | 'TRIADAS'>('CAJAS');

  // Número de estación seleccionada en pantalla de login (Caja 0-8 o Triada 1-8)
  const [selectedCajaId, setSelectedCajaId] = useState<number>(() => {
    const match = cajas.find(c => c.id === cajaId);
    return match ? match.id : (cajasRegulares[0]?.id || 1);
  });

  // Modal para cambiar de caja mientras se está logueado
  const [mostrarCambioCaja, setMostrarCambioCaja] = useState(false);
  const [cambiandoCaja, setCambiandoCaja] = useState(false);

  // Autenticación por Usuario y Contraseña para operar la caja
  const [sessionUsuario, setSessionUsuario] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem(`caja_session_${cajaId}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  });

  const [inputUsuario, setInputUsuario] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Historial del día para esta caja
  const [historialTickets, setHistorialTickets] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  // Obtener datos de la caja actual (exclusivo de cajas de atención)
  const caja = cajasRegulares.find(c => c.id === cajaId) || cajasRegulares[0];

  // Mantener selectedCajaId sincronizado si cambia cajaId y no hay sesión
  useEffect(() => {
    if (!sessionUsuario && cajaId) {
      const match = cajas.find(c => c.id === cajaId);
      if (match) {
        setSelectedCajaId(match.id);
        if (match.tipo === 'TRIADA') {
          setTabEstacionLogin('TRIADAS');
        } else {
          setTabEstacionLogin('CAJAS');
        }
      }
    }
  }, [cajaId, sessionUsuario, cajas]);

  // Cargar sesión guardada si cambia de caja
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`caja_session_${cajaId}`);
      setSessionUsuario(stored ? JSON.parse(stored) : null);
    } catch (e) {
      setSessionUsuario(null);
    }
    setError(null);
    setLoginError(null);
  }, [cajaId]);

  // Cargar historial del día o rango
  const cargarHistorial = async (rango = rangoSeleccionado) => {
    setLoadingHistorial(true);
    try {
      const res = await fetch(`/api/cajas/${cajaId}/historial?rango=${rango}`);
      if (res.ok) {
        const data = await res.json();
        setHistorialTickets(data.tickets || []);
      }
    } catch (e) {
      console.error('Error cargando historial de la caja:', e);
    } finally {
      setLoadingHistorial(false);
    }
  };

  useEffect(() => {
    if (tabActiva === 'HISTORIAL') {
      cargarHistorial(rangoSeleccionado);
    }
  }, [tabActiva, cajaId, rangoSeleccionado]);

  // Buscar el ticket que tiene esta caja (desde la lista de tickets o desde la caja)
  const ticketActual = ticketsActivos.find(t => t.cajaId === cajaId && (t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION')) 
    || (caja?.ticketActualId ? ticketsActivos.find(t => t.id === caja.ticketActualId) : null);

  // Cola de espera exclusiva para ventanillas de caja (excluye Triada)
  const colaCaja = ticketsEsperando
    .filter(t => t.etapa !== 'TRIADA' && t.estado === 'ESPERANDO')
    .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());

  // Registrar presencia en WebSocket cuando esta vista está montada y hay sesión
  useEffect(() => {
    if (caja && sessionUsuario) {
      wsClient.register('FUNCIONARIO', sessionUsuario.id, cajaId);
    }
  }, [cajaId, sessionUsuario?.id, caja?.activa]);

  // Cronómetro de atención en vivo
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

  const formatearTiempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const seg = segundos % 60;
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  };

  // Login de la caja con selección del número de caja
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
          cajaId: selectedCajaId
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales inválidas');
      }

      setSessionUsuario(data.user);
      localStorage.setItem(`caja_session_${selectedCajaId}`, JSON.stringify(data.user));
      localStorage.setItem(`triada_session_${selectedCajaId}`, JSON.stringify(data.user));
      onCambiarCaja?.(selectedCajaId);
      setInputPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  // Cambiar a otra caja manteniendo la sesión activa
  const handleCambiarCaja = async (nuevaCajaId: number) => {
    if (!sessionUsuario || nuevaCajaId === cajaId) {
      setMostrarCambioCaja(false);
      return;
    }
    setCambiandoCaja(true);
    try {
      const res = await fetch('/api/auth/cambiar-caja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuarioId: sessionUsuario.id,
          cajaIdActual: cajaId,
          nuevoCajaId: nuevaCajaId
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'No se pudo cambiar de caja');
      }

      localStorage.removeItem(`caja_session_${cajaId}`);
      localStorage.removeItem(`triada_session_${cajaId}`);
      localStorage.setItem(`caja_session_${nuevaCajaId}`, JSON.stringify(sessionUsuario));
      localStorage.setItem(`triada_session_${nuevaCajaId}`, JSON.stringify(sessionUsuario));
      onCambiarCaja?.(nuevaCajaId);
      setMostrarCambioCaja(false);
    } catch (e: any) {
      setError(e.message || 'Error al cambiar de caja');
    } finally {
      setCambiandoCaja(false);
    }
  };

  // Logout de la caja
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cajaId })
      });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem(`caja_session_${cajaId}`);
    setSessionUsuario(null);
  };

  // Descargar CSV del historial del día
  const handleDescargarCSV = () => {
    window.location.href = `/api/cajas/${cajaId}/historial-hoy/csv`;
  };

  // Descargar Reporte PDF oficial de tickets atendidos por la cajera
  const handleDescargarPDF = () => {
    if (!caja) return;
    generarPdfHistorial({
      caja,
      usuario: sessionUsuario,
      tickets: historialTickets,
      tipoEstacion: 'CAJA',
      rango: rangoSeleccionado
    });
  };

  // Acciones del funcionario
  const ejecutarAccion = async (endpoint: string, body?: any) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cajas/${cajaId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error en la acción ${endpoint}`);
      }
      // Refrescar historial si terminó o no se presentó
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
  const llamarSiguiente = () => ejecutarAccion('llamar-siguiente', { modo: modoLlamado });
  const iniciarAtencion = () => ejecutarAccion('iniciar');
  const finalizarAtencion = () => ejecutarAccion('finalizar');
  const finalizarYEnviarATriada = () => ejecutarAccion('finalizar-y-triada');
  const noSePresento = () => ejecutarAccion('no-presento');

  // SI NO HAY SESIÓN INICIADA: Pantalla donde el funcionario elige su estación e inicia sesión
  if (!sessionUsuario) {
    const estacionSeleccionadaObj = cajas.find(c => c.id === selectedCajaId) || cajasRegulares[0];
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
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white font-display">
              Acceso a Estación de Trabajo del Funcionario
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-lg mx-auto">
              Seleccione la estación (Ventanilla de Caja o Módulo de Triada) en la que atenderá hoy e ingrese con sus credenciales.
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
                    onClick={() => setTabEstacionLogin('CAJAS')}
                    className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer text-center ${
                      tabEstacionLogin === 'CAJAS'
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Ventanillas de Caja (0 a 8)
                  </button>
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
                </div>

                {/* Dropdown directo */}
                <div className="sm:w-64">
                  <select
                    value={selectedCajaId}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedCajaId(id);
                      const item = cajas.find(c => c.id === id);
                      if (item?.tipo === 'TRIADA') {
                        setTabEstacionLogin('TRIADAS');
                      } else {
                        setTabEstacionLogin('CAJAS');
                      }
                    }}
                    className="w-full bg-slate-950 text-white font-bold rounded-xl px-3 py-2 border border-slate-800 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
                  >
                    <optgroup label="Ventanillas de Caja (0 a 8)">
                      {cajasRegulares.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} {c.usuarioNombre ? '(En uso)' : '(Libre)'}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                      {modulosTriada.map((c) => (
                        <option key={c.id} value={c.id}>
                          Triada {c.numero} {c.usuarioNombre ? '(En uso)' : '(Libre)'}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* Tarjetas Interactivas de Selección de Estación */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-3">
                {(tabEstacionLogin === 'CAJAS' ? cajasRegulares : modulosTriada).map((item) => {
                  const esSeleccionada = item.id === selectedCajaId;
                  const tieneOperador = Boolean(item.usuarioActualId || item.usuarioNombre);
                  const estaDisponible = item.estado === 'DISPONIBLE';
                  const esModuloTriada = item.tipo === 'TRIADA';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      id={`select-estacion-${item.numero}`}
                      onClick={() => setSelectedCajaId(item.id)}
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
                          <span className="w-2 h-2 rounded-full bg-slate-700" />
                        )}
                      </div>

                      <p className="text-xs font-semibold truncate text-slate-300">
                        {esModuloTriada
                          ? item.nombre.replace(/^Triada \d+\s*-\s*/i, '') || 'Fotografía y Biometría'
                          : item.nombre.replace(/^Caja \d+\s*-\s*/i, '') || 'Atención al Ciudadano'}
                      </p>

                      <div className="mt-2 text-[11px]">
                        {tieneOperador ? (
                          <span className="text-amber-400 flex items-center gap-1 font-medium truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span className="truncate">En uso</span>
                          </span>
                        ) : estaDisponible ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
                            Disponible
                          </span>
                        ) : (
                          <span className="text-slate-500 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                            Libre para iniciar
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. CREDENCIALES DEL FUNCIONARIO */}
            <div className="pt-4 border-t border-slate-800">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-3 flex items-center gap-2">
                <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[11px] font-bold ${
                  esTriadaSeleccionada ? 'bg-indigo-600' : 'bg-blue-600'
                }`}>
                  2
                </span>
                <span>Ingrese sus credenciales de acceso:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Usuario o Correo
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ej: funcionario1"
                      value={inputUsuario}
                      onChange={(e) => setInputUsuario(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 pl-10"
                    />
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="••••••"
                      value={inputPassword}
                      onChange={(e) => setInputPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 pl-10"
                    />
                    <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  </div>
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

  if (!caja) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Caja no encontrada</h2>
        <p className="text-slate-400 text-sm mt-1">Seleccione una caja válida en el selector superior.</p>
      </div>
    );
  }

  // Cálculos del historial para métricas
  const totalAtendidos = historialTickets.length;
  const finalizados = historialTickets.filter(t => t.estado === 'FINALIZADO').length;
  const noPresentados = historialTickets.filter(t => t.estado === 'NO_PRESENTO').length;
  const promedioSegundos = finalizados > 0 
    ? Math.round(historialTickets.filter(t => t.estado === 'FINALIZADO').reduce((acc, t) => acc + (t.duracionSegundos || 0), 0) / finalizados)
    : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Modal para Cambiar de Estación */}
      {mostrarCambioCaja && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-xl w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-blue-400" />
                  Cambiar Estación de Trabajo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Seleccione la nueva estación (Ventanilla o Módulo de Triada) a la que desea trasladarse:
                </p>
              </div>
              <button
                onClick={() => setMostrarCambioCaja(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de tipo en modal */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs mb-4">
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
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6 max-h-72 overflow-y-auto pr-1">
              {(tabEstacionCambio === 'CAJAS' ? cajasRegulares : modulosTriada).map((c) => {
                const esActual = c.id === cajaId;
                const esTriada = c.tipo === 'TRIADA';

                return (
                  <button
                    key={c.id}
                    disabled={esActual || cambiandoCaja}
                    onClick={() => handleCambiarCaja(c.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      esActual
                        ? 'bg-blue-950/50 border-blue-600/60 opacity-60 cursor-not-allowed'
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
                      {esActual && <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">Actual</span>}
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
              onClick={() => setMostrarCambioCaja(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Barra superior de estado de la caja */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 mb-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md shadow-blue-500/20">
            {caja.numero}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">
                {caja.nombre}
              </h2>
              <button
                onClick={() => setMostrarCambioCaja(true)}
                title="Cambiar a otra caja"
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
                <span>Cambiar Caja</span>
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                {sessionUsuario.nombre}
              </span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-slate-400">@{sessionUsuario.usuario || sessionUsuario.email.split('@')[0]}</span>
            </div>
          </div>
        </div>

        {/* Estado en vivo y Botón de Cerrar Sesión */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
              Estado de Caja
            </span>
            <div className="flex items-center gap-2 mt-0.5 justify-end">
              {caja.estado === 'DISPONIBLE' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  DISPONIBLE
                </span>
              )}
              {caja.estado === 'OCUPADA' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-950/80 text-amber-400 border border-amber-700/60 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  EN ATENCIÓN
                </span>
              )}
              {caja.estado === 'DESCONECTADA' && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  DESCONECTADA
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title="Cerrar sesión de la caja"
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pestañas de Navegación: Atención Activa vs Historial del Día y Botón Descargar PDF */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTabActiva('ATENCION')}
            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              tabActiva === 'ATENCION'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Atención Activa</span>
            {ticketActual && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setTabActiva('HISTORIAL')}
            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
              tabActiva === 'HISTORIAL'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de la Jornada</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono">
              {historialTickets.length}
            </span>
          </button>
        </div>

        {/* Botón Destacado: Descargar PDF de tickets atendidos por esta cajera */}
        <button
          onClick={handleDescargarPDF}
          title="Descargar Reporte Oficial en PDF de los tickets atendidos en esta caja"
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>Descargar Reporte PDF ({historialTickets.length})</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs sm:text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-xs underline text-rose-400 cursor-pointer">
            Descartar
          </button>
        </div>
      )}

      {/* VISTA 1: ATENCIÓN ACTIVA */}
      {tabActiva === 'ATENCION' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda: Ticket en Turno */}
          <div className="lg:col-span-2 space-y-6">
            {ticketActual ? (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none text-blue-400">
                  <Bell className="w-48 h-48 -mr-12 -mt-12" />
                </div>

                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-extrabold text-slate-400">
                      TURNO ASIGNADO A SU CAJA:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      ticketActual.estado === 'ASIGNADO' ? 'bg-blue-950 text-blue-400 border border-blue-800' :
                      ticketActual.estado === 'LLAMANDO' ? 'bg-amber-950 text-amber-300 border border-amber-500 animate-pulse ring-2 ring-amber-500/30' :
                      'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    }`}>
                      {ticketActual.estado === 'LLAMANDO' ? '¡LLAMANDO EN PANTALLA!' : (ticketActual.estado === 'EN_ATENCION' ? 'EN ATENCIÓN EN SALA' : ticketActual.estado)}
                    </span>
                  </div>

                  <span className="text-xs text-slate-500 font-mono">
                    ID: {ticketActual.id.split('-').slice(0, 3).join('-')}
                  </span>
                </div>

                {/* Código Gigante y Ciudadano */}
                <div className="text-center py-4 relative z-10">
                  {ticketActual.ciudadanoNombre && (
                    <div className="mb-3 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-950/70 border border-blue-800/80 text-blue-300 text-sm font-bold shadow-sm">
                      <User className="w-4 h-4 text-blue-400" />
                      <span>{ticketActual.ciudadanoNombre} {ticketActual.ciudadanoApellido}</span>
                    </div>
                  )}

                  <div className="text-7xl sm:text-8xl font-black text-white tracking-tight font-display drop-shadow-md">
                    {ticketActual.codigo}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-slate-300">{ticketActual.tramite}</span>
                    {ticketActual.preferencial && (
                      <span className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black bg-amber-950/80 text-amber-300 border border-amber-600/70">
                        <span>♿</span> ATENCIÓN PREFERENCIAL
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs text-slate-400">
                    <span>Emisión: {new Date(ticketActual.fechaCreacion).toLocaleTimeString()}</span>
                    <span>•</span>
                    <span>
                      Llamadas realizadas: <strong>{ticketActual.llamadosContador || 0}</strong>
                    </span>
                  </div>

                  {/* Selector de Modo de Llamado (Por Nombre o Pitido) */}
                  {(ticketActual.estado === 'ASIGNADO' || ticketActual.estado === 'LLAMANDO') && (
                    <div className="mt-5 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 text-left max-w-xl mx-auto">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          <Volume2 className="w-4 h-4 text-blue-400" />
                          Modalidad de Llamado a Pantalla:
                        </span>
                        <span className="text-[11px] font-medium text-slate-400">
                          {modoLlamado === 'VOZ' ? 'Locución por voz activada' : 'Solo señal acústica'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          id="opcion-llamado-voz"
                          onClick={() => setModoLlamado('VOZ')}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            modoLlamado === 'VOZ'
                              ? 'bg-blue-950/60 border-blue-500 text-white ring-2 ring-blue-500/20 shadow-md shadow-blue-950'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${modoLlamado === 'VOZ' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <Volume2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <span>Llamar por Nombre</span>
                              {modoLlamado === 'VOZ' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded font-semibold">
                                  Activo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              Campanilla y locución con el nombre del usuario y su caja.
                            </p>
                          </div>
                        </button>

                        <button
                          type="button"
                          id="opcion-llamado-pitido"
                          onClick={() => setModoLlamado('PITIDO')}
                          className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                            modoLlamado === 'PITIDO'
                              ? 'bg-amber-950/60 border-amber-500 text-white ring-2 ring-amber-500/20 shadow-md shadow-amber-950'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${modoLlamado === 'PITIDO' ? 'bg-amber-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
                            <Bell className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <span>Solo Pitido</span>
                              {modoLlamado === 'PITIDO' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/30 text-amber-300 rounded font-semibold">
                                  Activo
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                              Suena únicamente la campanilla sin nombrar al usuario.
                            </p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Botonera de Control de Atención de Caja */}
                <div className="mt-8 pt-6 border-t border-slate-800 flex flex-wrap items-center justify-center gap-3 relative z-10">
                  {ticketActual.estado === 'ASIGNADO' && (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                      <button
                        id="btn-llamar-turno-pantalla"
                        onClick={() => llamarTurno(modoLlamado)}
                        disabled={loading}
                        className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-base shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
                      >
                        {modoLlamado === 'VOZ' ? <Volume2 className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                        <span>LLAMAR A PANTALLA (TV DE CAJA)</span>
                      </button>

                      <button
                        id="btn-iniciar-atencion-directo"
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
                        id="btn-rellamar-modo-actual"
                        onClick={() => llamarTurno(modoLlamado)}
                        disabled={loading}
                        title="Vuelve a enviar la señal a la pantalla de TV de Caja"
                        className="px-6 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/50 font-bold text-sm flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        {modoLlamado === 'VOZ' ? <Volume2 className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                        <span>RE-LLAMAR A PANTALLA ({ticketActual.llamadosContador})</span>
                      </button>

                      <button
                        id="btn-iniciar-atencion"
                        onClick={iniciarAtencion}
                        disabled={loading}
                        className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm sm:text-base shadow-xl shadow-emerald-600/30 flex items-center gap-2 transition-all transform active:scale-95 cursor-pointer"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span>INICIAR ATENCIÓN</span>
                      </button>

                      <button
                        id="btn-no-presento"
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
                      {/* Indicador de cronómetro activo */}
                      <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 shadow-lg">
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Atención en Curso:</span>
                        <span className="text-2xl font-black font-mono text-white tracking-widest">
                          {formatearTiempo(cronometroSegundos)}
                        </span>
                      </div>

                      {/* Botones de Finalización */}
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        {/* FINALIZAR Y ENVIAR A TRIADA (OPCIÓN EXCLUSIVA PARA TRÁMITES DE CEDULACIÓN) */}
                        {Boolean(ticketActual.tramite?.toLowerCase().includes('cedul') || ticketActual.prefijo === 'C') ? (
                          <>
                            <button
                              id="btn-finalizar-y-triada"
                              onClick={finalizarYEnviarATriada}
                              disabled={loading}
                              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer border border-indigo-400/30"
                            >
                              <ArrowRightLeft className="w-5 h-5 text-indigo-200" />
                              <span>FINALIZAR Y ENVIAR A TRIADA</span>
                            </button>

                            <button
                              id="btn-finalizar-atencion"
                              onClick={finalizarAtencion}
                              disabled={loading}
                              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-base shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
                            >
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                              <span>FINALIZAR TOTALMENTE</span>
                            </button>
                          </>
                        ) : (
                          /* Trámites que NO son Cedulación (Extranjería, Organización Electoral, Registro Civil) */
                          <button
                            id="btn-finalizar-atencion"
                            onClick={finalizarAtencion}
                            disabled={loading}
                            className="w-full sm:w-auto px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-base shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
                          >
                            <CheckCircle className="w-5 h-5 text-white" />
                            <span>FINALIZAR TOTALMENTE</span>
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 font-medium max-w-lg mx-auto">
                        {Boolean(ticketActual.tramite?.toLowerCase().includes('cedul') || ticketActual.prefijo === 'C')
                          ? 'Trámite de Cedulación: Utilice "FINALIZAR Y ENVIAR A TRIADA" para derivar al ciudadano a la fila de toma de fotografía y biometría, o "FINALIZAR TOTALMENTE" si ya no requiere fotografía.'
                          : `Trámite de ${ticketActual.tramite}: Este trámite no requiere fotografía ni biometría y culmina totalmente en esta ventanilla.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 text-center shadow-xl">
                <div className="w-16 h-16 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mx-auto mb-4 shadow-lg shadow-emerald-900/20">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-white font-display">Caja Lista y Disponible</h3>
                <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto leading-relaxed">
                  Esta ventanilla se encuentra <span className="text-emerald-400 font-bold">DISPONIBLE</span>. En cuanto un ciudadano tome un turno en el kiosco o haya tickets en espera, el sistema se lo repartirá automáticamente a esta caja.
                </p>

                {colaCaja.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={llamarSiguiente}
                      disabled={loading}
                      className="px-8 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm shadow-xl shadow-blue-600/30 inline-flex items-center gap-2.5 transition-all transform active:scale-95 cursor-pointer"
                    >
                      <Bell className="w-5 h-5 animate-bounce" />
                      <span>Llamar Siguiente Turno en Espera ({colaCaja[0].codigo})</span>
                    </button>
                  </div>
                )}

                <div className="mt-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-slate-950/90 text-xs text-slate-200 border border-slate-800 shadow">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>Monitoreando cola de tickets para Cajas ({colaCaja.length} ciudadanos en espera)</span>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Cola de Espera de Cajas */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Cola de Cajas
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 text-xs font-bold font-mono">
                {colaCaja.length} en espera
              </span>
            </div>

            <p className="text-[11px] text-slate-400 mb-3">
              Turnos en espera asignados a ventanillas de caja (Caja 0 a 8):
            </p>

            <div className="space-y-2 overflow-y-auto max-h-[460px] pr-1">
              {colaCaja.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No hay ciudadanos esperando para cajas en este momento.
                </div>
              ) : (
                colaCaja.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs flex items-center justify-center font-mono">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-black text-white text-base font-display">
                          {t.codigo}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                          {t.ciudadanoNombre ? `${t.ciudadanoNombre} ${t.ciudadanoApellido || ''}` : t.tramite}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] font-mono text-slate-500">
                      {new Date(t.fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: HISTORIAL DEL DÍA */}
      {tabActiva === 'HISTORIAL' && (
        <div className="space-y-6">
          {/* Métricas del día de la caja */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
                {rangoSeleccionado === 'diario' ? 'Total Atendidos Hoy' : rangoSeleccionado === 'semanal' ? 'Atendidos Semanal' : rangoSeleccionado === 'mensual' ? 'Atendidos Mensual' : 'Atendidos Anual'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-display">{totalAtendidos}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Finalizados con Éxito</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-display">{finalizados}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">No Presentados</span>
              <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 font-display">{noPresentados}</div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow">
              <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">Tiempo Promedio</span>
              <div className="text-2xl sm:text-3xl font-black text-blue-400 mt-1 font-mono">
                {Math.floor(promedioSegundos / 60)}m {promedioSegundos % 60}s
              </div>
            </div>
          </div>

          {/* Tabla de Historial con Botón de Descarga CSV */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Registro de Tickets Atendidos ({rangoSeleccionado === 'diario' ? 'Hoy' : rangoSeleccionado === 'semanal' ? 'Últimos 7 días' : rangoSeleccionado === 'mensual' ? 'Últimos 30 días' : 'Último año'})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reporte oficial de turnos despachados en {caja.nombre} durante el período seleccionado.
                </p>

                {/* Selector de rango de tiempo para el reporte */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 border border-slate-800 rounded-xl mt-3 flex-wrap max-w-max">
                  {(['diario', 'semanal', 'mensual', 'anual'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRangoSeleccionado(r)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase transition-all cursor-pointer ${
                        rangoSeleccionado === r
                          ? 'bg-blue-600 text-white shadow'
                          : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                      }`}
                    >
                      {r === 'diario' ? 'Diario' : r === 'semanal' ? 'Semanal' : r === 'mensual' ? 'Mensual' : 'Anual'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => cargarHistorial()}
                  disabled={loadingHistorial}
                  title="Refrescar datos del historial"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingHistorial ? 'animate-spin text-blue-400' : ''}`} />
                </button>

                <button
                  id="btn-descargar-historial-pdf"
                  onClick={handleDescargarPDF}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>Descargar Reporte PDF</span>
                </button>

                <button
                  id="btn-descargar-historial-csv"
                  onClick={handleDescargarCSV}
                  disabled={historialTickets.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {loadingHistorial ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
                Cargando historial de la jornada...
              </div>
            ) : historialTickets.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-2 opacity-40 text-blue-400" />
                <p className="text-sm font-semibold text-slate-400">Sin tickets atendidos aún en esta caja</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  A medida que atienda ciudadanos y finalice sus turnos, se listarán aquí con sus tiempos de duración y podrá exportarlos a CSV.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                      <th className="py-3 px-3">Código</th>
                      <th className="py-3 px-3">Ciudadano</th>
                      <th className="py-3 px-3">Trámite</th>
                      <th className="py-3 px-3">Hora Llamado</th>
                      <th className="py-3 px-3">Duración</th>
                      <th className="py-3 px-3">Modo</th>
                      <th className="py-3 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {historialTickets.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-black text-white font-mono text-sm">
                          {t.codigo}
                        </td>
                        <td className="py-3 px-3 text-slate-200 font-semibold">
                          {[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {t.tramite}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">
                          {t.fechaLlamado ? new Date(t.fechaLlamado).toLocaleTimeString() : '-'}
                        </td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-300">
                          {t.duracionFormato || `${t.duracionSegundos || 0}s`}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.modoLlamado === 'PITIDO' ? 'bg-amber-950 text-amber-400' : 'bg-blue-950 text-blue-400'
                          }`}>
                            {t.modoLlamado || 'VOZ'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            t.estado === 'FINALIZADO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            t.estado === 'NO_PRESENTO' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                            'bg-blue-950 text-blue-400'
                          }`}>
                            {t.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
