import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Database,
  Download,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Building2,
  Shield,
  Layers,
  ArrowRight,
  Filter,
  Eye,
  FileSpreadsheet
} from 'lucide-react';
import { SEDES } from '../types';

interface EstadoCierre {
  zonaHoraria: string;
  horaPanama: string;
  fechaHoyPanama: string;
  sedePrincipalHorario: string;
  regionalesHorario: string;
  sedePrincipalAbierta: boolean;
  regionalesAbiertas: boolean;
  jornadaActiva: boolean;
  yaCerradoHoy: boolean;
  bucketStorage: string;
  fechasArchivadas: Array<{ fecha: string; ruta: string; totalTickets?: number; estado?: string }>;
  totalFechasArchivadas: number;
  cierresLocales: any[];
}

export const CierreDiarioView: React.FC = () => {
  const [estado, setEstado] = useState<EstadoCierre | null>(null);
  const [loadingEstado, setLoadingEstado] = useState(false);
  const [ejecutandoCierre, setEjecutandoCierre] = useState(false);
  const [mensajeAccion, setMensajeAccion] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [forzarCierre, setForzarCierre] = useState(false);
  const [fechaManual, setFechaManual] = useState('');

  // Estados del visualizador de historial en Supabase Storage
  const [fechaConsulta, setFechaConsulta] = useState('');
  const [areaFiltro, setAreaFiltro] = useState<'TODAS' | 'CAJA' | 'TRIADA'>('TODAS');
  const [sedeFiltro, setSedeFiltro] = useState('todas');
  const [tramiteFiltro, setTramiteFiltro] = useState('todos');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [busquedaTexto, setBusquedaTexto] = useState('');

  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);
  const [datosHistorial, setDatosHistorial] = useState<{
    tickets: any[];
    metadatos: any;
    archivoPath: string;
    totalEnArchivo: number;
    totalFiltrados: number;
    area?: 'CAJA' | 'TRIADA' | 'TODAS';
  } | null>(null);

  // Cargar estado del cierre diario
  const cargarEstado = useCallback(async () => {
    setLoadingEstado(true);
    try {
      const res = await fetch('/api/cierre-diario/estado');
      if (!res.ok) throw new Error('Error al consultar estado de cierre');
      const data = await res.json();
      setEstado(data);

      // Si hay fechas archivadas y no hemos seleccionado fecha de consulta, poner la más reciente
      if (!fechaConsulta && data.fechasArchivadas && data.fechasArchivadas.length > 0) {
        setFechaConsulta(data.fechasArchivadas[0].fecha);
      } else if (!fechaConsulta && data.fechaHoyPanama) {
        setFechaConsulta(data.fechaHoyPanama);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingEstado(false);
    }
  }, [fechaConsulta]);

  useEffect(() => {
    cargarEstado();
    const interval = setInterval(cargarEstado, 30000);
    return () => clearInterval(interval);
  }, [cargarEstado]);

  // Consultar historial en Supabase Storage
  const consultarHistorial = useCallback(async (fecha: string) => {
    if (!fecha) return;
    setCargandoHistorial(true);
    setErrorHistorial(null);

    try {
      const params = new URLSearchParams();
      params.set('fecha', fecha);
      if (areaFiltro !== 'TODAS') params.set('area', areaFiltro);
      if (sedeFiltro !== 'todas') params.set('sedeId', sedeFiltro);
      if (tramiteFiltro !== 'todos') params.set('tramite', tramiteFiltro);
      if (estadoFiltro !== 'todos') params.set('estado', estadoFiltro);
      if (busquedaTexto.trim()) params.set('busqueda', busquedaTexto.trim());

      const res = await fetch(`/api/historial/consulta?${params.toString()}`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `No se encontró archivo histórico para la fecha ${fecha}`);
      }

      const data = await res.json();
      setDatosHistorial(data);
    } catch (err: any) {
      setErrorHistorial(err.message || 'Error cargando historial de Supabase Storage');
      setDatosHistorial(null);
    } finally {
      setCargandoHistorial(false);
    }
  }, [areaFiltro, sedeFiltro, tramiteFiltro, estadoFiltro, busquedaTexto]);

  useEffect(() => {
    if (fechaConsulta) {
      consultarHistorial(fechaConsulta);
    }
  }, [fechaConsulta, consultarHistorial]);

  // Ejecutar cierre manual
  const handleEjecutarCierre = async () => {
    setEjecutandoCierre(true);
    setMensajeAccion(null);

    try {
      const body: any = {};
      if (fechaManual.trim()) body.fecha = fechaManual.trim();
      if (forzarCierre) body.forzar = true;

      const res = await fetch('/api/cierre-diario/ejecutar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al ejecutar cierre diario');
      }

      setMensajeAccion({
        tipo: 'success',
        texto: `¡Cierre diario completado exitosamente! Se exportaron ${data.totalTickets} tickets al archivo '${data.archivoPath}' y se limpiaron de la tabla operativa.`
      });

      await cargarEstado();
      if (data.fecha) {
        setFechaConsulta(data.fecha);
      }
    } catch (err: any) {
      setMensajeAccion({
        tipo: 'error',
        texto: err.message || 'Error al ejecutar el cierre diario'
      });
    } finally {
      setEjecutandoCierre(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* 1. Encabezado de la Sección */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800">
              <Database className="w-3.5 h-3.5 text-blue-400" />
              Gestión de Almacenamiento & Supabase
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-950 border border-emerald-800 text-emerald-300">
              <Clock className="w-3 h-3 text-emerald-400" />
              America/Panama (UTC-5)
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Cierre Diario, Limpieza de Tickets e Historial Centralizado
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Optimización de almacenamiento en la base de datos de Supabase. Al cerrar la jornada, los tickets se exportan a archivos JSON estructurados en Supabase Storage (<span className="font-mono text-blue-300">historial/YYYY/MM/DD/tickets.json</span>), se valida su integridad y se depura la tabla operativa para comenzar cada día con una tabla limpia sin perder trazabilidad.
          </p>
        </div>

        <button
          onClick={cargarEstado}
          disabled={loadingEstado}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loadingEstado ? 'animate-spin' : ''}`} />
          <span>Actualizar Estado</span>
        </button>
      </div>

      {/* 2. Tarjetas de Estado Operativo y Horarios de Atención */}
      {estado && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Horario Sede Principal */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Sede Principal (Ancón)</span>
                <span className="text-base font-extrabold text-white mt-1 block">7:00 a. m. a 3:00 p. m.</span>
              </div>
              <div className={`p-2 rounded-xl border ${
                estado.sedePrincipalAbierta
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${estado.sedePrincipalAbierta ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs font-semibold text-slate-300">
                {estado.sedePrincipalAbierta ? 'Jornada activa en Ancón' : 'Jornada finalizada (Cierre: 3:00 p. m.)'}
              </span>
            </div>
          </div>

          {/* Horario Sedes Regionales */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">15 Sedes Regionales</span>
                <span className="text-base font-extrabold text-white mt-1 block">7:30 a. m. a 3:30 p. m.</span>
              </div>
              <div className={`p-2 rounded-xl border ${
                estado.regionalesAbiertas
                  ? 'bg-blue-950/70 border-blue-800 text-blue-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${estado.regionalesAbiertas ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs font-semibold text-slate-300">
                {estado.regionalesAbiertas ? 'Jornada activa en regionales' : 'Jornada finalizada (Cierre: 3:30 p. m.)'}
              </span>
            </div>
          </div>

          {/* Estado del Cierre Diario */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Cierre Diario Automático</span>
                <span className="text-base font-extrabold text-white mt-1 block">
                  Hora Panamá: <span className="text-blue-400 font-mono">{estado.horaPanama}</span>
                </span>
              </div>
              <div className={`p-2 rounded-xl border ${
                estado.yaCerradoHoy
                  ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400'
                  : 'bg-amber-950/70 border-amber-800 text-amber-400'
              }`}>
                {estado.yaCerradoHoy ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-300">
              {estado.yaCerradoHoy ? (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Jornada de hoy ({estado.fechaHoyPanama}) cerrada y archivada en Storage.
                </span>
              ) : (
                <span className="text-amber-400 font-medium">
                  Programado automáticamente para las 3:35 p. m. (al término de todas las regionales).
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Panel de Ejecución Manual y Forzada */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-400" />
              <span>Control Manual de Cierre de Jornada</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Permite forzar el cierre del día actual o procesar fechas anteriores pendientes de archivo en Supabase Storage.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div>
              <input
                type="date"
                value={fechaManual}
                onChange={(e) => setFechaManual(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />
              <span className="block text-[10px] text-slate-500 mt-0.5">Vacío = Fecha de hoy ({estado?.fechaHoyPanama})</span>
            </div>

            <label className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={forzarCierre}
                onChange={(e) => setForzarCierre(e.target.checked)}
                className="rounded border-slate-700 text-blue-600 focus:ring-0"
              />
              <span>Forzar antes de 3:30 p. m.</span>
            </label>

            <button
              onClick={handleEjecutarCierre}
              disabled={ejecutandoCierre}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              {ejecutandoCierre ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Procesando y Validando en Storage...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  <span>Ejecutar Cierre Diario Ahora</span>
                </>
              )}
            </button>
          </div>
        </div>

        {mensajeAccion && (
          <div className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            mensajeAccion.tipo === 'success'
              ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
              : 'bg-rose-950/80 border-rose-800 text-rose-200'
          }`}>
            {mensajeAccion.tipo === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span className="leading-relaxed">{mensajeAccion.texto}</span>
          </div>
        )}
      </div>

      {/* 4. SECCIÓN DE CONSULTA DE HISTORIAL DIRECTAMENTE DESDE SUPABASE STORAGE */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <FileJson className="w-5 h-5 text-indigo-400" />
              <span>Consulta de Historial Persistente en Supabase Storage</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Lectura directa desde el bucket <span className="font-mono text-indigo-300">historial-turnos</span>. No reinserta datos en la tabla operativa.
            </p>
          </div>

          {datosHistorial && (
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`/api/historial/archivo/${fechaConsulta}/descargar?area=CAJA`}
                download={`tickets_caja_${fechaConsulta}.json`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700 text-xs font-semibold text-emerald-300 transition-colors cursor-pointer"
                title="Descargar archivo JSON exclusivo de Caja"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON Caja</span>
              </a>
              <a
                href={`/api/historial/archivo/${fechaConsulta}/descargar?area=TRIADA`}
                download={`tickets_triada_${fechaConsulta}.json`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700 text-xs font-semibold text-indigo-300 transition-colors cursor-pointer"
                title="Descargar archivo JSON exclusivo de Triada"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON Triada</span>
              </a>
              <a
                href={`/api/historial/archivo/${fechaConsulta}/descargar?area=TODAS`}
                download={`tickets_${fechaConsulta}.json`}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                title="Descargar archivo JSON consolidado general"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Consolidado</span>
              </a>
            </div>
          )}
        </div>

        {/* Barra de Filtros */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* Selector de Fecha */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Fecha Jornada
            </label>
            <input
              type="date"
              value={fechaConsulta}
              onChange={(e) => setFechaConsulta(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Selector de Área */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Área Operativa
            </label>
            <select
              value={areaFiltro}
              onChange={(e) => setAreaFiltro(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="TODAS">Todas las Áreas</option>
              <option value="CAJA">Caja (Ventanillas 0-8)</option>
              <option value="TRIADA">Triada (Módulos 1-8)</option>
            </select>
          </div>

          {/* Selector de Sede / Regional */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Regional / Sede
            </label>
            <select
              value={sedeFiltro}
              onChange={(e) => setSedeFiltro(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="todas">Todas las 16 Regionales</option>
              {SEDES.map(s => (
                <option key={s.id} value={s.id}>{s.nombre.replace('Tribunal Electoral de Panamá — ', '')}</option>
              ))}
            </select>
          </div>

          {/* Selector de Trámite */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Trámite
            </label>
            <select
              value={tramiteFiltro}
              onChange={(e) => setTramiteFiltro(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="todos">Todos los Trámites</option>
              <option value="Cedulación">Cedulación</option>
              <option value="Extranjería">Extranjería</option>
              <option value="Organización Electoral">Organización Electoral</option>
              <option value="Registro Civil">Registro Civil</option>
            </select>
          </div>

          {/* Selector de Estado */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Estado
            </label>
            <select
              value={estadoFiltro}
              onChange={(e) => setEstadoFiltro(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="todos">Todos los Estados</option>
              <option value="FINALIZADO">Finalizado</option>
              <option value="NO_PRESENTO">No se presentó</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          {/* Búsqueda rápida */}
          <div>
            <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
              Búsqueda
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={busquedaTexto}
                onChange={(e) => setBusquedaTexto(e.target.value)}
                placeholder="Código o ciudadano..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Fechas archivadas disponibles como chips de acceso rápido */}
        {estado?.fechasArchivadas && estado.fechasArchivadas.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400">Jornadas Disponibles en Storage:</span>
            {estado.fechasArchivadas.map(f => (
              <button
                key={f.fecha}
                onClick={() => setFechaConsulta(f.fecha)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  fechaConsulta === f.fecha
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                {f.fecha} {f.totalTickets !== undefined && `(${f.totalTickets})`}
              </button>
            ))}
          </div>
        )}

        {/* KPIs del archivo histórico seleccionado */}
        {datosHistorial && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-400">Total en Archivo JSON</span>
              <div className="text-xl font-black text-white mt-0.5 font-mono">
                {datosHistorial.totalEnArchivo}
              </div>
              <span className="text-[10px] text-indigo-400 font-mono truncate block mt-0.5">{datosHistorial.archivoPath}</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-900/60">
              <span className="text-[10px] font-bold uppercase text-emerald-400">Área CAJA</span>
              <div className="text-xl font-black text-emerald-300 mt-0.5 font-mono">
                {datosHistorial.tickets.filter(t => t.area === 'CAJA' || t.etapa === 'CAJA').length}
              </div>
              <span className="text-[10px] text-emerald-500/80">Ventanillas 0 a 8</span>
            </div>

            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-900/60">
              <span className="text-[10px] font-bold uppercase text-indigo-400">Área TRIADA</span>
              <div className="text-xl font-black text-indigo-300 mt-0.5 font-mono">
                {datosHistorial.tickets.filter(t => t.area === 'TRIADA' || t.etapa === 'TRIADA').length}
              </div>
              <span className="text-[10px] text-indigo-400/80">Módulos de Fotografía</span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-blue-400">Resultados Filtrados</span>
              <div className="text-xl font-black text-blue-400 mt-0.5 font-mono">
                {datosHistorial.totalFiltrados}
              </div>
              <span className="text-[10px] text-slate-500">Coincidencias en tabla</span>
            </div>
          </div>
        )}

        {/* Tabla de Tickets Históricos */}
        {cargandoHistorial ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
            <span>Descargando y procesando archivo JSON de Supabase Storage...</span>
          </div>
        ) : errorHistorial ? (
          <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs space-y-2">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <span className="font-semibold text-slate-300 block">{errorHistorial}</span>
            <span className="text-[11px] text-slate-500 block">
              Si la jornada de esta fecha aún no se ha cerrado, ejecute el cierre manual arriba o seleccione una fecha ya archivada.
            </span>
          </div>
        ) : datosHistorial && datosHistorial.tickets.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 text-xs">
            <span>No se encontraron tickets con los filtros aplicados para la fecha {fechaConsulta}.</span>
          </div>
        ) : datosHistorial ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Área</th>
                  <th className="py-3 px-4">Trámite</th>
                  <th className="py-3 px-4">Ciudadano</th>
                  <th className="py-3 px-4">Regional</th>
                  <th className="py-3 px-4">Estación</th>
                  <th className="py-3 px-4">Funcionario</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Hora Creación</th>
                  <th className="py-3 px-4">Hora Cierre</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {datosHistorial.tickets.map((t) => {
                  const nombreCiudadano = [t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'Anónimo';
                  const nombreSede = SEDES.find(s => s.id === t.sedeId)?.nombre.replace('Tribunal Electoral de Panamá — ', '') || t.sedeId || 'Ancón';
                  const esTriada = t.area === 'TRIADA' || t.etapa === 'TRIADA';

                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-white flex items-center gap-1.5">
                        <span className="text-indigo-400">{t.codigo}</span>
                        {t.preferencial && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                            PREF
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                          esTriada
                            ? 'bg-indigo-950 text-indigo-300 border-indigo-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}>
                          {esTriada ? 'Triada' : 'Caja'}
                        </span>
                      </td>
                      <td className="py-3 px-4">{t.tramite}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">{nombreCiudadano}</td>
                      <td className="py-3 px-4 text-slate-400">{nombreSede}</td>
                      <td className="py-3 px-4 font-mono">
                        {esTriada ? `Triada ${t.cajaNumero || ''}` : `Caja ${t.cajaNumero || ''}`}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{t.usuarioNombre || '—'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          t.estado === 'FINALIZADO' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          t.estado === 'NO_PRESENTO' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {t.estado}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleTimeString('es-PA') : '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-400">
                        {t.fechaFinalizacion ? new Date(t.fechaFinalizacion).toLocaleTimeString('es-PA') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};
