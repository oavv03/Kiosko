import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  FileSpreadsheet, 
  FileText, 
  Download, 
  RefreshCw, 
  Lock, 
  User, 
  Key, 
  LogOut, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Filter, 
  Search, 
  Calendar, 
  ShieldCheck, 
  Camera, 
  Monitor, 
  ArrowUpDown,
  TrendingUp,
  Layers,
  Database
} from 'lucide-react';
import { Caja, Ticket, Usuario, RolUsuario } from '../types';
import { generarPdfHistorial } from '../utils/pdfExport';
import { useCustomization } from '../context/CustomizationContext';
import { LogoInstitucional } from './LogoInstitucional';

interface ReportesViewProps {
  cajas: Caja[];
  currentSedeId?: string;
  onSedeChange?: (sedeId: string) => void;
}

export const ReportesView: React.FC<ReportesViewProps> = ({
  cajas,
  currentSedeId = 'ancon',
  onSedeChange
}) => {
  const { configuracion } = useCustomization();

  // Sesión autenticada para el Centro de Reportes
  const [sessionUser, setSessionUser] = useState<Usuario | null>(() => {
    try {
      // 1. Verificar si hay sesión explícita de reportes
      const repSession = localStorage.getItem('supervisor_reportes_session');
      if (repSession) {
        const u = JSON.parse(repSession);
        if (u && ['SUPERVISOR_CAJA', 'SUPERVISOR_TRIADA', 'SUPER_ADMIN', 'ADMINISTRADOR'].includes(u.rol)) {
          return u;
        }
      }
      // 2. Verificar si hay sesión activa de Super Admin
      const saSession = localStorage.getItem('superadmin_session');
      if (saSession) {
        const u = JSON.parse(saSession);
        if (u && (u.rol === 'SUPER_ADMIN' || u.rol === 'ADMINISTRADOR')) {
          return u;
        }
      }
    } catch {}
    return null;
  });

  // Estados de login
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Estados de configuración de reporte
  const [tipoReporte, setTipoReporte] = useState<'CAJA' | 'TRIADA' | 'TODAS'>(() => {
    if (sessionUser?.rol === 'SUPERVISOR_TRIADA') return 'TRIADA';
    return 'CAJA';
  });

  const [rango, setRango] = useState<'diario' | 'semanal' | 'mensual' | 'anual'>('mensual');
  
  // Rango de fechas estilo calendario
  const hoyStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const primerDiaMesStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }, []);

  const [fechaInicio, setFechaInicio] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [fechaFin, setFechaFin] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const [estacionFiltro, setEstacionFiltro] = useState<string>('todas'); // 'todas' o id de caja
  const [busqueda, setBusqueda] = useState('');
  const [cargandoDatos, setCargandoDatos] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [origenDatos, setOrigenDatos] = useState<'OPERATIVO' | 'SUPABASE_STORAGE' | 'HIBRIDO_STORAGE'>('OPERATIVO');
  const [archivoStoragePath, setArchivoStoragePath] = useState<string | null>(null);
  const [fechasArchivadas, setFechasArchivadas] = useState<Array<{ fecha: string; totalTickets?: number }>>([]);

  // Cargar lista de fechas archivadas disponibles en Supabase Storage
  useEffect(() => {
    fetch('/api/historial/fechas')
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d.fechas)) {
          setFechasArchivadas(d.fechas);
        }
      })
      .catch(() => {});
  }, []);

  // Separar cajas y triadas
  const cajasRegulares = useMemo(() => {
    return [...cajas.filter(c => c.tipo !== 'TRIADA')].sort((a, b) => a.numero - b.numero);
  }, [cajas]);

  const modulosTriada = useMemo(() => {
    return [...cajas.filter(c => c.tipo === 'TRIADA')].sort((a, b) => a.numero - b.numero);
  }, [cajas]);

  // Sincronizar tipoReporte según el rol de la sesión
  useEffect(() => {
    if (sessionUser) {
      if (sessionUser.rol === 'SUPERVISOR_CAJA') {
        setTipoReporte('CAJA');
      } else if (sessionUser.rol === 'SUPERVISOR_TRIADA') {
        setTipoReporte('TRIADA');
      }
    }
  }, [sessionUser]);

  // Reset de estación al cambiar tipoReporte
  useEffect(() => {
    setEstacionFiltro('todas');
  }, [tipoReporte]);

  // Manejador de Login de Supervisores
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser || !loginPass) return;
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/auth/supervisor-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: loginUser.trim(),
          password: loginPass.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Credenciales no autorizadas');
      }

      setSessionUser(data.user);
      localStorage.setItem('supervisor_reportes_session', JSON.stringify(data.user));
      setLoginUser('');
      setLoginPass('');
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setSessionUser(null);
    localStorage.removeItem('supervisor_reportes_session');
  };

  // Cargar tickets para el reporte
  const cargarReporte = useCallback(async () => {
    if (!sessionUser) return;
    setCargandoDatos(true);
    setErrorCarga(null);

    try {
      let endpoint = '';
      const params = new URLSearchParams();
      if (fechaInicio) params.set('fechaInicio', fechaInicio);
      if (fechaFin) params.set('fechaFin', fechaFin);
      params.set('rango', rango);
      if (currentSedeId) params.set('sedeId', currentSedeId);

      if (estacionFiltro === 'todas') {
        endpoint = `/api/cajas/todas/historial`;
        params.set('tipo', tipoReporte);
      } else {
        endpoint = `/api/cajas/${estacionFiltro}/historial`;
        params.set('tipo', tipoReporte);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Error obteniendo registros para el reporte');
      }

      const data = await res.json();
      setTickets(data.tickets || []);
      if (data.origen === 'SUPABASE_STORAGE') {
        setOrigenDatos('SUPABASE_STORAGE');
        setArchivoStoragePath(data.archivoPath || null);
      } else if (data.origen === 'HIBRIDO_STORAGE') {
        setOrigenDatos('HIBRIDO_STORAGE');
        setArchivoStoragePath(data.archivoPath || null);
      } else {
        setOrigenDatos('OPERATIVO');
        setArchivoStoragePath(null);
      }
    } catch (err: any) {
      setErrorCarga(err.message || 'No se pudieron cargar los datos del reporte');
      setOrigenDatos('OPERATIVO');
      setArchivoStoragePath(null);
    } finally {
      setCargandoDatos(false);
    }
  }, [sessionUser, fechaInicio, fechaFin, rango, tipoReporte, estacionFiltro, currentSedeId]);

  useEffect(() => {
    if (sessionUser) {
      cargarReporte();
    }
  }, [cargarReporte, sessionUser]);

  // Filtrado por búsqueda en tabla
  const ticketsFiltrados = useMemo(() => {
    if (!busqueda.trim()) return tickets;
    const q = busqueda.toLowerCase().trim();
    return tickets.filter(t => 
      (t.codigo && t.codigo.toLowerCase().includes(q)) ||
      (t.tramite && t.tramite.toLowerCase().includes(q)) ||
      (t.ciudadanoNombre && t.ciudadanoNombre.toLowerCase().includes(q)) ||
      (t.ciudadanoApellido && t.ciudadanoApellido.toLowerCase().includes(q)) ||
      (t.usuarioNombre && t.usuarioNombre.toLowerCase().includes(q))
    );
  }, [tickets, busqueda]);

  // KPIs de resumen
  const totalTurnos = tickets.length;
  const finalizados = tickets.filter(t => t.estado === 'FINALIZADO').length;
  const noPresentados = tickets.filter(t => t.estado === 'NO_PRESENTO').length;
  const tasaResolucion = totalTurnos > 0 ? Math.round((finalizados / totalTurnos) * 100) : 0;

  const totalDuracionSeg = tickets.reduce((acc, t) => acc + (t.duracionSegundos || t.duracionAtencionSegundos || 0), 0);
  const promedioAtencionSeg = finalizados > 0 ? Math.round(totalDuracionSeg / finalizados) : 0;

  const totalEsperaSeg = tickets.reduce((acc, t) => acc + (t.esperaSegundos || 0), 0);
  const promedioEsperaSeg = totalTurnos > 0 ? Math.round(totalEsperaSeg / totalTurnos) : 0;

  // Formateador de tiempo
  const formatTiempo = (seg: number) => {
    const m = Math.floor(seg / 60);
    const s = seg % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  };

  // Descargar PDF
  const handleDescargarPDF = () => {
    if (!sessionUser) return;

    let nombreEstacion = '';
    if (estacionFiltro === 'todas') {
      if (tipoReporte === 'CAJA') {
        nombreEstacion = 'Todas las Ventanillas de Caja (Consolidado 0 a 8)';
      } else if (tipoReporte === 'TRIADA') {
        nombreEstacion = 'Todos los Módulos de Triada (Consolidado 1 a 8)';
      } else {
        nombreEstacion = 'Consolidado General (Cajas y Triada)';
      }
    } else {
      const encontrada = cajas.find(c => c.id === Number(estacionFiltro));
      if (encontrada) {
        nombreEstacion = encontrada.tipo === 'TRIADA'
          ? `Módulo de Triada / Fotografía ${encontrada.numero}`
          : (encontrada.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${encontrada.numero}`);
      } else {
        nombreEstacion = `Estación #${estacionFiltro}`;
      }
    }

    const rolTitulo = sessionUser.rol === 'SUPERVISOR_CAJA'
      ? 'Supervisor de Caja'
      : sessionUser.rol === 'SUPERVISOR_TRIADA'
      ? 'Supervisor de Triada'
      : (sessionUser.rol === 'SUPER_ADMIN' ? 'Super Administrador' : 'Administrador');

    generarPdfHistorial({
      caja: estacionFiltro !== 'todas' ? cajas.find(c => c.id === Number(estacionFiltro)) : undefined,
      usuario: sessionUser,
      tickets: ticketsFiltrados,
      tipoEstacion: tipoReporte === 'TRIADA' ? 'TRIADA' : 'CAJA',
      rango,
      fechaInicio,
      fechaFin,
      nombreEstacionPersonalizado: nombreEstacion,
      sedeNombre: currentSedeId ? `Sede: ${currentSedeId.toUpperCase()}` : 'Tribunal Electoral',
      supervisorNombre: sessionUser.nombre,
      supervisorRol: rolTitulo
    });
  };

  // Descargar CSV
  const handleDescargarCSV = () => {
    if (!sessionUser) return;
    const target = estacionFiltro === 'todas' ? 'todas' : estacionFiltro;
    const params = new URLSearchParams();
    if (fechaInicio) params.set('fechaInicio', fechaInicio);
    if (fechaFin) params.set('fechaFin', fechaFin);
    params.set('rango', rango);
    params.set('tipo', tipoReporte);
    if (currentSedeId) params.set('sedeId', currentSedeId);

    window.location.href = `/api/cajas/${target}/historial/csv?${params.toString()}`;
  };

  // Roles permitidos y permisos
  const esSuperAdmin = sessionUser?.rol === 'SUPER_ADMIN' || sessionUser?.rol === 'ADMINISTRADOR';
  const esSupervisorCaja = sessionUser?.rol === 'SUPERVISOR_CAJA';
  const esSupervisorTriada = sessionUser?.rol === 'SUPERVISOR_TRIADA';

  // 1. PANTALLA DE ACCESO RESTRINGIDO SI NO HAY SESIÓN DE SUPERVISOR
  if (!sessionUser) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 flex justify-center items-center">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 mb-3 shadow-inner">
              <FileSpreadsheet className="w-8 h-8 text-blue-400" />
            </div>
            
            <div className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[11px] font-bold uppercase tracking-wider mb-2">
              Sección Exclusiva de Supervisión
            </div>

            <h2 className="text-2xl font-black text-white tracking-tight">
              Centro de Reportes y Auditoría
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Esta sección permite generar reportes diarios, semanales, mensuales y anuales con métricas consolidadas.
              <span className="block mt-1 text-amber-300 font-semibold">
                Por jerarquía institucional, los funcionarios operativos no tienen acceso a esta sección.
              </span>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            {loginError && (
              <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Usuario Supervisor o Administrador</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Ej: oavega o supervisor de área"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Contraseña</span>
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              {loginLoading ? (
                <span>Verificando permisos jerárquicos...</span>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ingresar al Centro de Reportes</span>
                </>
              )}
            </button>

            {/* Accesos rápidos de prueba institucional */}
            <div className="pt-3 border-t border-slate-800/80">
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                <div>
                  <span className="font-semibold text-slate-300 block">Super Administrador (Acceso Total):</span>
                  <span className="font-mono text-blue-300">oavega</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLoginUser('oavega');
                    setLoginPass('1234561');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 font-medium text-[11px] cursor-pointer transition-colors"
                >
                  Rellenar
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 2. VISTA PRINCIPAL AUTENTICADA DE REPORTES Y MÉTRICAS
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Barra Superior de Identificación y Jerarquía de Sesión */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950/50 to-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-md ${
            esSuperAdmin ? 'bg-purple-600/20 border border-purple-500/40 text-purple-400' :
            esSupervisorTriada ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-400' :
            'bg-blue-600/20 border border-blue-500/40 text-blue-400'
          }`}>
            {esSupervisorTriada ? <Camera className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-black text-white">
                {sessionUser.nombre}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                esSuperAdmin ? 'bg-purple-950 border border-purple-800 text-purple-300' :
                esSupervisorTriada ? 'bg-indigo-950 border border-indigo-800 text-indigo-300' :
                'bg-blue-950 border border-blue-800 text-blue-300'
              }`}>
                {esSuperAdmin ? 'Super Administrador • Acceso Total' :
                 esSupervisorTriada ? 'Supervisor de Triada' :
                 'Supervisor de Caja'}
              </span>
            </div>

            <div className="text-xs text-slate-400 mt-0.5">
              Sesión activa como <span className="font-mono text-slate-300">@{sessionUser.usuario || sessionUser.email.split('@')[0]}</span>
              {esSuperAdmin && <span className="text-emerald-400 font-semibold ml-2">• Permiso total: Cajas y Triadas</span>}
              {esSupervisorCaja && <span className="text-blue-400 font-semibold ml-2">• Vista exclusiva: Cajas (0 a 8)</span>}
              {esSupervisorTriada && <span className="text-indigo-400 font-semibold ml-2">• Vista exclusiva: Triadas (1 a 8)</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-800 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
            title="Cerrar sesión de supervisor"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Controles de Configuración de Reporte (Tipo, Período, Estación) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <FileSpreadsheet className="w-6 h-6 text-blue-400" />
              <span>Generación de Reportes Periódicos</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Consolide métricas de atención, tiempos de espera y emisión de turnos para auditoría y control de gestión.
            </p>
          </div>

          {/* Botones de Exportación Oficial */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => cargarReporte()}
              disabled={cargandoDatos}
              title="Refrescar datos del reporte"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${cargandoDatos ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              id="btn-descargar-reporte-pdf"
              onClick={handleDescargarPDF}
              disabled={cargandoDatos || tickets.length === 0}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Descargar Reporte PDF ({rango})</span>
            </button>

            <button
              id="btn-descargar-reporte-csv"
              onClick={handleDescargarCSV}
              disabled={cargandoDatos || tickets.length === 0}
              className="px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>

        {/* Filtros: Área (según rol), Período (diario/semanal/mensual/anual), y Estación */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. Selector de Área (Solo Super Admin puede alternar; supervisores tienen su área bloqueada) */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Área de Supervisión</span>
            </label>

            {esSuperAdmin ? (
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTipoReporte('CAJA')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    tipoReporte === 'CAJA'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Cajas (0 a 8)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoReporte('TRIADA')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    tipoReporte === 'TRIADA'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Triadas (1 a 8)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTipoReporte('TODAS')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    tipoReporte === 'TODAS'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Consolidado</span>
                </button>
              </div>
            ) : esSupervisorCaja ? (
              <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-800/80 text-blue-300 text-xs font-bold flex items-center gap-2">
                <Monitor className="w-4 h-4 text-blue-400" />
                <span>Ventanillas de Caja (Área Exclusiva)</span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-indigo-950/60 border border-indigo-800/80 text-indigo-300 text-xs font-bold flex items-center gap-2">
                <Camera className="w-4 h-4 text-indigo-400" />
                <span>Módulos de Triada / Fotografía (Área Exclusiva)</span>
              </div>
            )}
          </div>

          {/* 2. Filtro de Fechas estilo Calendario (Selector de Rango de Días) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                <span>Rango de Días (Calendario)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {fechaInicio === fechaFin ? fechaInicio : `${fechaInicio} al ${fechaFin}`}
              </span>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-2 space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Desde:</span>
                  <input
                    type="date"
                    value={fechaInicio}
                    max={fechaFin || hoyStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFechaInicio(val);
                      if (fechaFin && val > fechaFin) setFechaFin(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">Hasta:</span>
                  <input
                    type="date"
                    value={fechaFin}
                    min={fechaInicio}
                    max={hoyStr}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFechaFin(val);
                      if (fechaInicio && val < fechaInicio) setFechaInicio(val);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-xs text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Accesos rápidos de calendario */}
              <div className="flex items-center gap-1 pt-1 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => {
                    setFechaInicio(hoyStr);
                    setFechaFin(hoyStr);
                    setRango('diario');
                  }}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                    fechaInicio === hoyStr && fechaFin === hoyStr
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Hoy
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 7);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setFechaInicio(`${y}-${m}-${day}`);
                    setFechaFin(hoyStr);
                    setRango('semanal');
                  }}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                    rango === 'semanal' && fechaFin === hoyStr
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  7 Días
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFechaInicio(primerDiaMesStr);
                    setFechaFin(hoyStr);
                    setRango('mensual');
                  }}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                    fechaInicio === primerDiaMesStr && fechaFin === hoyStr
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  Este Mes
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    setFechaInicio(`${y}-${m}-${day}`);
                    setFechaFin(hoyStr);
                    setRango('mensual');
                  }}
                  className={`flex-1 py-1 px-1 rounded text-[10px] font-bold transition-all cursor-pointer text-center ${
                    fechaFin === hoyStr && fechaInicio !== primerDiaMesStr && fechaInicio !== hoyStr && rango !== 'semanal'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  30 Días
                </button>
              </div>

              {/* Días archivados en Supabase Storage */}
              {fechasArchivadas.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-indigo-400 font-bold flex items-center gap-1 shrink-0">
                    <Database className="w-2.5 h-2.5" />
                    Storage {tipoReporte}:
                  </span>
                  {fechasArchivadas.map(f => {
                    const cant = tipoReporte === 'CAJA' ? (f as any).totalCaja : (tipoReporte === 'TRIADA' ? (f as any).totalTriada : f.totalTickets);
                    return (
                      <button
                        key={f.fecha}
                        type="button"
                        onClick={() => {
                          setFechaInicio(f.fecha);
                          setFechaFin(f.fecha);
                          setRango('diario');
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                          fechaInicio === f.fecha && fechaFin === f.fecha
                            ? 'bg-indigo-600 text-white font-bold shadow-sm'
                            : 'bg-indigo-950/60 border border-indigo-800/70 text-indigo-300 hover:bg-indigo-900'
                        }`}
                        title={`Cargar jornada del ${f.fecha} desde Supabase Storage (${tipoReporte})`}
                      >
                        {f.fecha} {cant !== undefined ? `(${cant})` : (f.totalTickets !== undefined ? `(${f.totalTickets})` : '')}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3. Selector de Alcance: TODAS o Estación individual */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span>Alcance / Estación</span>
            </label>

            <select
              value={estacionFiltro}
              onChange={(e) => setEstacionFiltro(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="todas">
                {tipoReporte === 'CAJA' ? 'Todas las Cajas (Consolidado 0 a 8)' :
                 tipoReporte === 'TRIADA' ? 'Todas las Triadas (Consolidado 1 a 8)' :
                 'Consolidado General (Todas las Cajas y Triadas)'}
              </option>

              {tipoReporte === 'CAJA' && cajasRegulares.map(c => (
                <option key={c.id} value={c.id}>
                  {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`}
                </option>
              ))}

              {tipoReporte === 'TRIADA' && modulosTriada.map(m => (
                <option key={m.id} value={m.id}>
                  Triada / Fotografía {m.numero}
                </option>
              ))}

              {tipoReporte === 'TODAS' && (
                <>
                  <optgroup label="Cajas">
                    {cajasRegulares.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Triada / Fotografía">
                    {modulosTriada.map(m => (
                      <option key={m.id} value={m.id}>
                        Triada {m.numero}
                      </option>
                    ))}
                  </optgroup>
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Tarjetas de Métricas Estadísticas del Reporte */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
            Total Turnos
          </span>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1 font-display">
            {cargandoDatos ? '...' : totalTurnos}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Período: {rango.toUpperCase()}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
            Atendidos con Éxito
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1 font-display">
            {cargandoDatos ? '...' : finalizados}
          </div>
          <span className="text-[10px] text-emerald-500 font-bold mt-0.5 block">
            {tasaResolucion}% resolución
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
            No Presentados
          </span>
          <div className="text-2xl sm:text-3xl font-black text-rose-400 mt-1 font-display">
            {cargandoDatos ? '...' : noPresentados}
          </div>
          <span className="text-[10px] text-rose-500 font-bold mt-0.5 block">
            {totalTurnos > 0 ? Math.round((noPresentados / totalTurnos) * 100) : 0}% abandono
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
            Tiempo Prom. Espera
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1 font-mono">
            {cargandoDatos ? '...' : formatTiempo(promedioEsperaSeg)}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            Desde emisión a llamado
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg col-span-2 md:col-span-1">
          <span className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block">
            Tiempo Prom. Atención
          </span>
          <div className="text-2xl sm:text-3xl font-black text-blue-400 mt-1 font-mono">
            {cargandoDatos ? '...' : formatTiempo(promedioAtencionSeg)}
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">
            En ventanilla / módulo
          </span>
        </div>
      </div>

      {/* Banner de Consulta de Historial en Supabase Storage */}
      {origenDatos === 'SUPABASE_STORAGE' && (
        <div className="p-4 rounded-2xl bg-indigo-950/70 border border-indigo-800 text-indigo-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-900/80 border border-indigo-700 text-indigo-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white text-sm">
                  Historial Centralizado en Supabase Storage
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                  tipoReporte === 'CAJA'
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-indigo-950/80 text-indigo-300 border-indigo-700'
                }`}>
                  Área: {tipoReporte === 'CAJA' ? 'Ventanillas de Caja (0 a 8)' : 'Módulos de Triada (1 a 8)'}
                </span>
              </div>
              <span className="text-[11px] text-indigo-300/90 font-mono block mt-0.5">
                {archivoStoragePath ? `Archivo Storage: ${archivoStoragePath}` : `Cargado desde Supabase Storage (${tipoReporte})`} • Métricas y turnos finalizados correspondientes a {tipoReporte === 'CAJA' ? 'Caja' : 'Triada'}.
              </span>
            </div>
          </div>
          {archivoStoragePath && (
            <a
              href={`/api/historial/archivo/${fechaInicio}/descargar?area=${tipoReporte}`}
              download={`tickets_${tipoReporte.toLowerCase()}_${fechaInicio}.json`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-900 hover:bg-indigo-800 border border-indigo-700 text-white font-semibold text-[11px] transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar JSON Storage ({tipoReporte})</span>
            </a>
          )}
        </div>
      )}

      {origenDatos === 'HIBRIDO_STORAGE' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/60 to-indigo-950/60 border border-indigo-800/80 text-indigo-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-900/80 border border-indigo-700 text-indigo-300">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white block">
                Reporte Consolidado Multi-Jornada
              </span>
              <span className="text-[11px] text-indigo-300/90 font-mono">
                Combinando registros archivados en Supabase Storage con los turnos activos de la jornada operativa actual.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabla Detallada de Turnos y Auditoría */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <span>Registro Detallado de Turnos y Trámites</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                {ticketsFiltrados.length} registros
              </span>
              {origenDatos === 'SUPABASE_STORAGE' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950 border border-indigo-700 text-indigo-300 font-bold uppercase tracking-wider">
                  Supabase Storage
                </span>
              )}
              {origenDatos === 'HIBRIDO_STORAGE' && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 border border-blue-700 text-blue-300 font-bold uppercase tracking-wider">
                  Storage + Operativo
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Desglose cronológico de cada ciudadano atendido en la sede activa.
            </p>
          </div>

          {/* Buscador Rápido */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por código, ciudadano o trámite..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {errorCarga && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorCarga}</span>
          </div>
        )}

        {cargandoDatos ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-400" />
            <span>Generando reporte y calculando métricas...</span>
          </div>
        ) : ticketsFiltrados.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-30 text-blue-400" />
            <p className="text-sm font-semibold text-slate-400">No hay registros para los filtros seleccionados</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {busqueda ? 'No se encontraron turnos con el término de búsqueda ingresado.' : 'No se registraron atenciones en esta estación durante el período seleccionado.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">Trámite</th>
                  <th className="py-3 px-3">Ciudadano</th>
                  <th className="py-3 px-3">Estación</th>
                  <th className="py-3 px-3">Funcionario</th>
                  <th className="py-3 px-3">Emisión</th>
                  <th className="py-3 px-3">Espera</th>
                  <th className="py-3 px-3">Atención</th>
                  <th className="py-3 px-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {ticketsFiltrados.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-black text-white font-mono text-sm">
                      {t.codigo}
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      {t.tramite}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-200">
                      {[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'N/A'}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-300">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tipoReporte === 'TODAS' && (
                          t.etapa === 'TRIADA' ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-950 text-indigo-300 border border-indigo-800">
                              TRIADA
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-950 text-blue-300 border border-blue-800">
                              CAJA
                            </span>
                          )
                        )}
                        <span>
                          {t.estacionTexto || (t.cajaNumero !== undefined ? (t.etapa === 'TRIADA' ? `Triada ${t.cajaNumero}` : (t.cajaNumero === 0 ? 'Caja 0 (Pref.)' : `Caja ${t.cajaNumero}`)) :
                           (t.etapa === 'TRIADA' ? 'Triada' : 'N/A'))}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {t.usuarioNombre || '-'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {t.esperaFormato || `${t.esperaSegundos || 0}s`}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300 font-semibold">
                      {t.duracionFormato || (t.duracionSegundos ? `${t.duracionSegundos}s` : (t.duracionAtencionSegundos ? `${t.duracionAtencionSegundos}s` : '-'))}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        t.estado === 'FINALIZADO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        t.estado === 'NO_PRESENTO' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                        t.estado === 'EN_ATENCION' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-blue-950 text-blue-400 border border-blue-800'
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
  );
};
