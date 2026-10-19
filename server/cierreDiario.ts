import { createClient } from '@supabase/supabase-js';
import { db } from './db.js';
import { Ticket, Sede, SEDES } from '../src/types.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

export const BUCKET_NAME = 'historial-turnos';

export interface CierreDiarioRegistro {
  id?: string;
  fecha: string; // YYYY-MM-DD en America/Panama
  totalTickets: number;
  totalTicketsCaja?: number;
  totalTicketsTriada?: number;
  archivoPath: string; // ej: historial/2026/10/16/tickets.json
  archivoPathCaja?: string; // ej: historial/2026/10/16/caja/tickets.json
  archivoPathTriada?: string; // ej: historial/2026/10/16/triada/tickets.json
  bucket: string;
  tamanoBytes?: number;
  tamanoBytesCaja?: number;
  tamanoBytesTriada?: number;
  estado: 'EXITOSO' | 'ERROR' | 'EN_PROCESO';
  errorMensaje?: string | null;
  ejecutadoEn: string;
  sedesProcesadas?: any;
  metadatos?: any;
}

export interface CierreDiarioResultado {
  success: boolean;
  fecha: string;
  totalTickets: number;
  totalTicketsCaja?: number;
  totalTicketsTriada?: number;
  archivoPath?: string;
  archivoPathCaja?: string;
  archivoPathTriada?: string;
  tamanoBytes?: number;
  tamanoBytesCaja?: number;
  tamanoBytesTriada?: number;
  error?: string;
  detallesSedes?: Record<string, number>;
}

class CierreDiarioService {
  private supabase: any = null;
  private intervaloTimer: NodeJS.Timeout | null = null;
  private ejecutandoCierre = false;

  constructor() {
    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      } catch (err) {
        console.error('[CIERRE-DIARIO] Error inicializando cliente Supabase:', err);
      }
    }
  }

  /**
   * Obtiene la fecha y hora actual en la zona horaria oficial America/Panama
   */
  public getPanamaDate(fechaReferencia: Date = new Date()): {
    fechaStr: string; // YYYY-MM-DD
    horaNum: number;  // 0-23
    minutoNum: number;// 0-59
    diaSemana: number;// 0-6
    isoString: string;
  } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Panama',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(fechaReferencia);
    const map: Record<string, string> = {};
    for (const p of parts) {
      map[p.type] = p.value;
    }

    const fechaStr = `${map.year}-${map.month}-${map.day}`;
    const horaNum = parseInt(map.hour || '0', 10);
    const minutoNum = parseInt(map.minute || '0', 10);
    const diaSemana = fechaReferencia.getDay();

    return {
      fechaStr,
      horaNum,
      minutoNum,
      diaSemana,
      isoString: new Date().toISOString()
    };
  }

  /**
   * Verifica o crea el bucket de almacenamiento en Supabase Storage
   */
  public async asegurarBucket(): Promise<boolean> {
    if (!this.supabase) return false;
    try {
      const { data: buckets, error: listErr } = await this.supabase.storage.listBuckets();
      if (listErr) {
        console.warn('[CIERRE-DIARIO] Advertencia listando buckets:', listErr.message);
      }
      const existe = buckets?.some((b: any) => b.name === BUCKET_NAME);
      if (!existe) {
        const { error: createErr } = await this.supabase.storage.createBucket(BUCKET_NAME, {
          public: false
        });
        if (createErr && !createErr.message.includes('already exists')) {
          console.error('[CIERRE-DIARIO] Error creando bucket:', createErr.message);
          return false;
        }
        console.log(`[CIERRE-DIARIO] Bucket '${BUCKET_NAME}' creado exitosamente.`);
      }
      return true;
    } catch (err: any) {
      console.error('[CIERRE-DIARIO] Error asegurando bucket de storage:', err.message || err);
      return false;
    }
  }

  /**
   * Genera el path en Supabase Storage según el requerimiento y área:
   * Consolidado: historial/YYYY/MM/DD/tickets.json
   * Caja:        historial/YYYY/MM/DD/caja/tickets.json
   * Triada:      historial/YYYY/MM/DD/triada/tickets.json
   */
  public getRutaArchivo(fechaStr: string, area?: 'CAJA' | 'TRIADA' | 'TODAS'): string {
    const [year, month, day] = fechaStr.split('-');
    if (area === 'CAJA') {
      return `historial/${year}/${month}/${day}/caja/tickets.json`;
    }
    if (area === 'TRIADA') {
      return `historial/${year}/${month}/${day}/triada/tickets.json`;
    }
    return `historial/${year}/${month}/${day}/tickets.json`;
  }

  /**
   * Obtiene todos los tickets que pertenecen a una fecha específica
   * en base a su fecha de creación o finalización en America/Panama.
   */
  public async recopilarTicketsFecha(fechaStr: string): Promise<Ticket[]> {
    // 1. Obtener tickets locales en memoria de la base de datos
    const ticketsMemoria = db.getTickets();

    // 2. Si Supabase está disponible, consultar también directamente la tabla 'tickets'
    let ticketsSupabase: Ticket[] = [];
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('tickets')
          .select('*');
        if (!error && data) {
          ticketsSupabase = data.map((t: any) => (db as any).mapFromSupabase('tickets', t));
        }
      } catch (err: any) {
        console.warn('[CIERRE-DIARIO] Advertencia leyendo tabla tickets de Supabase:', err.message || err);
      }
    }

    // Unificar evitando duplicados por ID
    const mapaTickets = new Map<string, Ticket>();
    for (const t of ticketsMemoria) {
      if (t && t.id) mapaTickets.set(t.id, t);
    }
    for (const t of ticketsSupabase) {
      if (t && t.id) {
        if (!mapaTickets.has(t.id)) {
          mapaTickets.set(t.id, t);
        } else {
          // Combinar campos ricos
          const existente = mapaTickets.get(t.id)!;
          mapaTickets.set(t.id, { ...existente, ...t });
        }
      }
    }

    // Filtrar por la fecha dada (YYYY-MM-DD)
    const ticketsFecha = Array.from(mapaTickets.values()).filter(t => {
      const fCreacion = (t.fechaCreacion || '').split('T')[0];
      const fFinal = (t.fechaFinalizacion || '').split('T')[0];
      const fAsig = (t.fechaAsignacion || '').split('T')[0];
      return fCreacion === fechaStr || fFinal === fechaStr || fAsig === fechaStr;
    });

    return ticketsFecha;
  }

  /**
   * Recopila eventos de auditoría relacionados con los tickets del día
   */
  public async recopilarEventosFecha(ticketIds: string[], fechaStr: string): Promise<any[]> {
    const idSet = new Set(ticketIds);
    let eventos = db.getEventos(1000).filter(e => {
      const eFecha = (e.timestamp || '').split('T')[0];
      return eFecha === fechaStr || (e.ticketId && idSet.has(e.ticketId));
    });

    // Si Supabase está conectado, buscar en tracking_tickets
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('tracking_tickets')
          .select('*')
          .limit(2000);
        if (!error && data) {
          const mapa = new Map<string, any>();
          eventos.forEach(e => mapa.set(`${e.type}-${e.ticketId}-${e.timestamp}`, e));
          for (const row of data) {
            const key = `${row.tipo_evento}-${row.ticket_id}-${row.timestamp}`;
            if (!mapa.has(key)) {
              const rFecha = (row.timestamp || '').split('T')[0];
              if (rFecha === fechaStr || idSet.has(row.ticket_id)) {
                mapa.set(key, {
                  type: row.tipo_evento,
                  ticketId: row.ticket_id,
                  codigo: row.codigo,
                  caja: row.caja,
                  cajaId: row.caja_id,
                  funcionario: row.funcionario,
                  ciudadano: row.ciudadano,
                  sedeId: row.sede_id,
                  timestamp: row.timestamp,
                  payload: row.payload
                });
              }
            }
          }
          eventos = Array.from(mapa.values());
        }
      } catch (err: any) {
        console.warn('[CIERRE-DIARIO] Advertencia leyendo tracking_tickets:', err.message || err);
      }
    }

    return eventos;
  }

  /**
   * Clasifica y genera los registros detallados de tickets tanto para CAJA como para TRIADA
   * asegurando que un ticket que pasó por Caja o fue finalizado en Caja tenga su registro en el Storage de Caja,
   * y un ticket que pasó por Triada o fue finalizado en Triada tenga su registro en el Storage de Triada.
   */
  public separarTicketsPorArea(
    tickets: Ticket[],
    eventosAuditoria: any[],
    atenciones: any[] = db.getAtenciones()
  ): {
    ticketsCaja: any[];
    ticketsTriada: any[];
  } {
    const ticketsCaja: any[] = [];
    const ticketsTriada: any[] = [];

    for (const t of tickets) {
      // Eventos relacionados con este ticket
      const evsTicket = eventosAuditoria.filter(e => e.ticketId === t.id || e.codigo === t.codigo);
      // Atenciones registradas para este ticket
      const atnsTicket = atenciones.filter(a => a.ticketId === t.id || a.ticketCodigo === t.codigo);

      // --- 1. DETECCIÓN Y CONSTRUCCIÓN PARA CAJA (Ventanillas 0 a 8) ---
      const tieneCaja =
        t.etapa === 'CAJA' ||
        (Array.isArray(t.cajasHistorialIds) && t.cajasHistorialIds.some(id => id <= 100 || id % 1000 <= 100)) ||
        atnsTicket.some(a => a.cajaId <= 100 || a.cajaId % 1000 <= 100) ||
        evsTicket.some(e => e.cajaId <= 100 || e.cajaId % 1000 <= 100 || e.caja === 0 || e.payload?.destinoTipo === 'CAJA') ||
        (t.codigo && !t.codigo.startsWith('TR')); // Todo ticket de turno regular/preferencial inicia en Caja

      if (tieneCaja) {
        // Encontrar atención de caja
        const atnCaja = atnsTicket.find(a => a.cajaId <= 100 || a.cajaId % 1000 <= 100);
        const evLlamadoCaja = evsTicket.find(e => (e.type === 'TICKET_LLAMADO' || e.type === 'TICKET_EN_ATENCION') && (e.cajaId <= 100 || e.cajaId % 1000 <= 100 || e.caja === 0));
        const evFinCaja = evsTicket.find(e => e.type === 'TICKET_FINALIZADO' && (e.cajaId <= 100 || e.cajaId % 1000 <= 100 || e.caja === 0));

        let cajaIdNum = 1;
        let cajaNum = 1;
        if (atnCaja) {
          cajaIdNum = atnCaja.cajaId;
          cajaNum = cajaIdNum === 100 ? 0 : (cajaIdNum % 1000);
        } else if (evLlamadoCaja && evLlamadoCaja.cajaId) {
          cajaIdNum = evLlamadoCaja.cajaId;
          cajaNum = cajaIdNum === 100 ? 0 : (cajaIdNum % 1000);
        } else if (t.cajasHistorialIds) {
          const cHist = t.cajasHistorialIds.find(id => id <= 100 || id % 1000 <= 100);
          if (cHist !== undefined) {
            cajaIdNum = cHist;
            cajaNum = cHist === 100 ? 0 : (cHist % 1000);
          }
        } else if (t.cajaId && (t.cajaId <= 100 || t.cajaId % 1000 <= 100)) {
          cajaIdNum = t.cajaId;
          cajaNum = t.cajaNumero !== undefined ? t.cajaNumero : (cajaIdNum === 100 ? 0 : (cajaIdNum % 1000));
        }

        if (t.preferencial && (cajaNum === 1 || cajaNum === 0 || t.codigo?.startsWith('P-'))) {
          cajaNum = 0;
          cajaIdNum = 100;
        }

        const estacionTexto = cajaNum === 0 ? 'Caja 0 (Pref.)' : `Caja ${cajaNum}`;
        const funcionarioCaja =
          atnCaja?.usuarioId ? (db.getUsuarios().find(u => u.id === atnCaja.usuarioId)?.nombre || evLlamadoCaja?.funcionario || 'Funcionario de Caja') :
          (evLlamadoCaja?.funcionario || (t.etapa === 'CAJA' ? t.usuarioNombre : 'Funcionario de Caja') || 'Funcionario de Caja');

        const duracionAtencion = atnCaja?.duracionSegundos ||
          (evFinCaja?.payload?.duracionSegundos) ||
          (t.etapa === 'CAJA' ? (t.duracionAtencionSegundos || 1) : 1);

        const fechaLlamadoCaja = evLlamadoCaja?.timestamp || t.fechaLlamado || t.fechaCreacion;
        const duracionEspera = t.duracionEsperaSegundos ||
          (t.fechaCreacion && fechaLlamadoCaja ? Math.max(0, Math.floor((new Date(fechaLlamadoCaja).getTime() - new Date(t.fechaCreacion).getTime()) / 1000)) : 0);

        const fechaInicioCaja = atnCaja?.fechaInicio || evLlamadoCaja?.timestamp || t.fechaInicio || t.fechaCreacion;
        const fechaFinCaja = atnCaja?.fechaFin || evFinCaja?.timestamp || t.fechaFinalizacion || new Date().toISOString();

        ticketsCaja.push({
          id: `${t.id}-caja`,
          ticketOriginalId: t.id,
          codigo: t.codigo,
          numero: t.numero,
          tramite: t.tramite,
          prefijo: t.prefijo,
          ciudadanoNombre: t.ciudadanoNombre || null,
          ciudadanoApellido: t.ciudadanoApellido || null,
          area: 'CAJA',
          etapa: 'CAJA',
          estado: 'FINALIZADO',
          cajaId: cajaIdNum,
          cajaNumero: cajaNum,
          estacionTexto,
          usuarioId: atnCaja?.usuarioId || null,
          usuarioNombre: funcionarioCaja,
          preferencial: Boolean(t.preferencial),
          sedeId: t.sedeId || 'ancon',
          fechaCreacion: t.fechaCreacion,
          fechaAsignacion: t.fechaAsignacion || t.fechaCreacion,
          fechaLlamado: fechaLlamadoCaja,
          fechaInicio: fechaInicioCaja,
          fechaFinalizacion: fechaFinCaja,
          duracionEsperaSegundos: duracionEspera,
          duracionAtencionSegundos: duracionAtencion,
          duracionFormato: `${Math.floor(duracionAtencion / 60)}m ${duracionAtencion % 60}s`,
          esperaFormato: `${Math.floor(duracionEspera / 60)}m ${duracionEspera % 60}s`,
          llamadosContador: t.llamadosContador || 1,
          modoLlamado: t.modoLlamado || 'VOZ'
        });
      }

      // --- 2. DETECCIÓN Y CONSTRUCCIÓN PARA TRIADA (Módulos 1 a 8) ---
      const tieneTriada =
        t.etapa === 'TRIADA' ||
        (Array.isArray(t.cajasHistorialIds) && t.cajasHistorialIds.some(id => (id >= 200 && id <= 208) || id % 1000 >= 200)) ||
        atnsTicket.some(a => a.cajaId >= 200 || a.cajaId % 1000 >= 200) ||
        evsTicket.some(e => e.cajaId >= 200 || e.cajaId % 1000 >= 200 || e.payload?.destinoTipo === 'TRIADA' || e.payload?.etapa === 'TRIADA');

      if (tieneTriada) {
        const atnTriada = atnsTicket.find(a => a.cajaId >= 200 || a.cajaId % 1000 >= 200);
        const evLlamadoTriada = evsTicket.find(e => (e.type === 'TICKET_LLAMADO' || e.type === 'TICKET_EN_ATENCION') && (e.cajaId >= 200 || e.cajaId % 1000 >= 200 || e.payload?.destinoTipo === 'TRIADA'));
        const evFinTriada = evsTicket.find(e => e.type === 'TICKET_FINALIZADO' && (e.cajaId >= 200 || e.cajaId % 1000 >= 200));

        let triadaIdNum = 201;
        let triadaNum = 1;
        if (atnTriada) {
          triadaIdNum = atnTriada.cajaId;
          triadaNum = (triadaIdNum % 1000) >= 200 ? (triadaIdNum % 1000) - 200 : (atnTriada.cajaId - 200);
          if (triadaNum < 1 || triadaNum > 8) triadaNum = 1;
        } else if (evLlamadoTriada && evLlamadoTriada.cajaId) {
          triadaIdNum = evLlamadoTriada.cajaId;
          triadaNum = (triadaIdNum % 1000) >= 200 ? (triadaIdNum % 1000) - 200 : (evLlamadoTriada.cajaId - 200);
          if (triadaNum < 1 || triadaNum > 8) triadaNum = 1;
        } else if (t.cajaId && (t.cajaId >= 200 || t.cajaId % 1000 >= 200)) {
          triadaIdNum = t.cajaId;
          triadaNum = t.cajaNumero !== undefined ? t.cajaNumero : ((triadaIdNum % 1000) - 200);
          if (triadaNum < 1 || triadaNum > 8) triadaNum = 1;
        } else if (t.cajasHistorialIds) {
          const tHist = t.cajasHistorialIds.find(id => (id >= 200 && id <= 208) || id % 1000 >= 200);
          if (tHist !== undefined) {
            triadaIdNum = tHist;
            triadaNum = (tHist % 1000) >= 200 ? (tHist % 1000) - 200 : (tHist - 200);
            if (triadaNum < 1 || triadaNum > 8) triadaNum = 1;
          }
        }

        const estacionTexto = `Triada ${triadaNum}`;
        const funcionarioTriada =
          atnTriada?.usuarioId ? (db.getUsuarios().find(u => u.id === atnTriada.usuarioId)?.nombre || evLlamadoTriada?.funcionario || 'Operador de Triada') :
          (evLlamadoTriada?.funcionario || (t.etapa === 'TRIADA' ? t.usuarioNombre : 'Operador de Triada') || 'Operador de Triada');

        const duracionAtencion = atnTriada?.duracionSegundos ||
          (evFinTriada?.payload?.duracionSegundos) ||
          (t.etapa === 'TRIADA' ? (t.duracionAtencionSegundos || 1) : 1);

        const fechaLlamadoTriada = evLlamadoTriada?.timestamp || (t.etapa === 'TRIADA' ? t.fechaLlamado : t.fechaFinalizacion) || t.fechaCreacion;
        const duracionEspera = (t.etapa === 'TRIADA' ? t.duracionEsperaSegundos : 0) ||
          (t.fechaCreacion && fechaLlamadoTriada ? Math.max(0, Math.floor((new Date(fechaLlamadoTriada).getTime() - new Date(t.fechaCreacion).getTime()) / 1000)) : 0);

        const fechaInicioTriada = atnTriada?.fechaInicio || evLlamadoTriada?.timestamp || (t.etapa === 'TRIADA' ? t.fechaInicio : t.fechaFinalizacion) || t.fechaCreacion;
        const fechaFinTriada = atnTriada?.fechaFin || evFinTriada?.timestamp || t.fechaFinalizacion || new Date().toISOString();

        ticketsTriada.push({
          id: `${t.id}-triada`,
          ticketOriginalId: t.id,
          codigo: t.codigo,
          numero: t.numero,
          tramite: t.tramite,
          prefijo: t.prefijo,
          ciudadanoNombre: t.ciudadanoNombre || null,
          ciudadanoApellido: t.ciudadanoApellido || null,
          area: 'TRIADA',
          etapa: 'TRIADA',
          estado: 'FINALIZADO',
          cajaId: triadaIdNum,
          cajaNumero: triadaNum,
          estacionTexto,
          usuarioId: atnTriada?.usuarioId || null,
          usuarioNombre: funcionarioTriada,
          preferencial: Boolean(t.preferencial),
          sedeId: t.sedeId || 'ancon',
          fechaCreacion: t.fechaCreacion,
          fechaAsignacion: t.fechaAsignacion || t.fechaCreacion,
          fechaLlamado: fechaLlamadoTriada,
          fechaInicio: fechaInicioTriada,
          fechaFinalizacion: fechaFinTriada,
          duracionEsperaSegundos: duracionEspera,
          duracionAtencionSegundos: duracionAtencion,
          duracionFormato: `${Math.floor(duracionAtencion / 60)}m ${duracionAtencion % 60}s`,
          esperaFormato: `${Math.floor(duracionEspera / 60)}m ${duracionEspera % 60}s`,
          llamadosContador: t.llamadosContador || 1,
          modoLlamado: t.modoLlamado || 'VOZ'
        });
      }
    }

    return { ticketsCaja, ticketsTriada };
  }

  /**
   * Genera el resumen de métricas para un subconjunto de tickets
   */
  private generarMetadatosArea(ticketsArea: any[], area: 'CAJA' | 'TRIADA', fechaStr: string) {
    const finalizados = ticketsArea.filter(t => t.estado === 'FINALIZADO');
    const noPresentaron = ticketsArea.filter(t => t.estado === 'NO_PRESENTO');
    const cancelados = ticketsArea.filter(t => t.estado === 'CANCELADO');

    let sumaEspera = 0;
    let countEspera = 0;
    let sumaAtencion = 0;
    let countAtencion = 0;

    ticketsArea.forEach(t => {
      const esp = t.duracionEsperaSegundos || 0;
      if (esp > 0) {
        sumaEspera += esp;
        countEspera++;
      }
      const aten = t.duracionAtencionSegundos || 0;
      if (aten > 0) {
        sumaAtencion += aten;
        countAtencion++;
      }
    });

    const desgloseSedes: Record<string, number> = {};
    SEDES.forEach(s => { desgloseSedes[s.id] = 0; });
    ticketsArea.forEach(t => {
      const s = t.sedeId || 'ancon';
      desgloseSedes[s] = (desgloseSedes[s] || 0) + 1;
    });

    const desgloseEstaciones: Record<string, number> = {};
    ticketsArea.forEach(t => {
      const est = t.estacionTexto || (area === 'TRIADA' ? `Triada ${t.cajaNumero || 1}` : `Caja ${t.cajaNumero || 1}`);
      desgloseEstaciones[est] = (desgloseEstaciones[est] || 0) + 1;
    });

    return {
      area,
      fechaJornada: fechaStr,
      timezone: 'America/Panama',
      ejecutadoEn: new Date().toISOString(),
      versionEsquema: '3.0.0',
      totalTickets: ticketsArea.length,
      resumenEstados: {
        finalizados: finalizados.length,
        noPresentaron: noPresentaron.length,
        cancelados: cancelados.length
      },
      tiempos: {
        promedioEsperaSegundos: countEspera > 0 ? Math.round(sumaEspera / countEspera) : 0,
        promedioAtencionSegundos: countAtencion > 0 ? Math.round(sumaAtencion / countAtencion) : 0
      },
      desglosePorSede: desgloseSedes,
      desglosePorEstacion: desgloseEstaciones
    };
  }

  /**
   * Ejecuta el cierre diario para una fecha dada (por defecto la fecha actual en America/Panama)
   * Guarda los tickets en Supabase Storage en sus respectivas áreas:
   * 1. historial/YYYY/MM/DD/caja/tickets.json   (Storage específico para CAJA)
   * 2. historial/YYYY/MM/DD/triada/tickets.json (Storage específico para TRIADA)
   * 3. historial/YYYY/MM/DD/tickets.json        (Storage consolidado unificado)
   * 4. Valida los 3 archivos en Supabase Storage
   * 5. Limpia tickets operativos tras validar
   */
  public async ejecutarCierreDiario(fechaObjetivo?: string): Promise<CierreDiarioResultado> {
    if (this.ejecutandoCierre) {
      return {
        success: false,
        fecha: fechaObjetivo || this.getPanamaDate().fechaStr,
        totalTickets: 0,
        error: 'Ya hay un proceso de cierre diario en ejecución. Por favor espere.'
      };
    }

    this.ejecutandoCierre = true;
    const fechaPanama = fechaObjetivo || this.getPanamaDate().fechaStr;
    const rutaConsolidada = this.getRutaArchivo(fechaPanama, 'TODAS');
    const rutaCaja = this.getRutaArchivo(fechaPanama, 'CAJA');
    const rutaTriada = this.getRutaArchivo(fechaPanama, 'TRIADA');

    console.log(`[CIERRE-DIARIO] Iniciando cierre diario estructurado por área para: ${fechaPanama}`);
    console.log(`[CIERRE-DIARIO] Rutas de almacenamiento:\n - Caja: ${rutaCaja}\n - Triada: ${rutaTriada}\n - Consolidado: ${rutaConsolidada}`);

    try {
      await this.asegurarBucket();

      // 1. Recopilar tickets y eventos
      const tickets = await this.recopilarTicketsFecha(fechaPanama);
      const ticketIds = tickets.map(t => t.id);
      const eventosAuditoria = await this.recopilarEventosFecha(ticketIds, fechaPanama);
      const atenciones = db.getAtenciones();

      // 2. Separar por área respectiva (CAJA vs TRIADA)
      const { ticketsCaja, ticketsTriada } = this.separarTicketsPorArea(tickets, eventosAuditoria, atenciones);

      console.log(`[CIERRE-DIARIO] Tickets procesados para ${fechaPanama}:`);
      console.log(` - Área CAJA: ${ticketsCaja.length} tickets`);
      console.log(` - Área TRIADA: ${ticketsTriada.length} tickets`);
      console.log(` - Total tickets brutos: ${tickets.length}`);

      // 3. Generar documentos JSON
      const metadatosCaja = this.generarMetadatosArea(ticketsCaja, 'CAJA', fechaPanama);
      const metadatosTriada = this.generarMetadatosArea(ticketsTriada, 'TRIADA', fechaPanama);

      const docCaja = {
        metadatos: metadatosCaja,
        tickets: ticketsCaja
      };

      const docTriada = {
        metadatos: metadatosTriada,
        tickets: ticketsTriada
      };

      const docConsolidado = {
        metadatos: {
          fechaJornada: fechaPanama,
          timezone: 'America/Panama',
          ejecutadoEn: new Date().toISOString(),
          versionEsquema: '3.0.0',
          totalTickets: tickets.length,
          porArea: {
            caja: {
              totalTickets: ticketsCaja.length,
              archivoPath: rutaCaja,
              promedioEsperaSegundos: metadatosCaja.tiempos.promedioEsperaSegundos,
              promedioAtencionSegundos: metadatosCaja.tiempos.promedioAtencionSegundos
            },
            triada: {
              totalTickets: ticketsTriada.length,
              archivoPath: rutaTriada,
              promedioEsperaSegundos: metadatosTriada.tiempos.promedioEsperaSegundos,
              promedioAtencionSegundos: metadatosTriada.tiempos.promedioAtencionSegundos
            }
          },
          desglosePorSede: metadatosCaja.desglosePorSede
        },
        ticketsCaja,
        ticketsTriada,
        tickets: [...ticketsCaja, ...ticketsTriada],
        eventosAuditoria: eventosAuditoria.slice(0, 1000)
      };

      const bufCaja = Buffer.from(JSON.stringify(docCaja, null, 2), 'utf-8');
      const bufTriada = Buffer.from(JSON.stringify(docTriada, null, 2), 'utf-8');
      const bufConsolidado = Buffer.from(JSON.stringify(docConsolidado, null, 2), 'utf-8');

      // 4. Subir los 3 archivos a Supabase Storage
      if (this.supabase) {
        // Subir Caja
        const { error: errCaja } = await this.supabase.storage
          .from(BUCKET_NAME)
          .upload(rutaCaja, bufCaja, { contentType: 'application/json', upsert: true });
        if (errCaja) throw new Error(`Error subiendo storage de Caja: ${errCaja.message}`);

        // Subir Triada
        const { error: errTriada } = await this.supabase.storage
          .from(BUCKET_NAME)
          .upload(rutaTriada, bufTriada, { contentType: 'application/json', upsert: true });
        if (errTriada) throw new Error(`Error subiendo storage de Triada: ${errTriada.message}`);

        // Subir Consolidado
        const { error: errCons } = await this.supabase.storage
          .from(BUCKET_NAME)
          .upload(rutaConsolidada, bufConsolidado, { contentType: 'application/json', upsert: true });
        if (errCons) throw new Error(`Error subiendo storage consolidado: ${errCons.message}`);

        // 5. Validar los 3 archivos en Supabase Storage
        console.log('[CIERRE-DIARIO] Validando almacenamiento e integridad en Supabase Storage...');

        const [dlCaja, dlTriada, dlCons] = await Promise.all([
          this.supabase.storage.from(BUCKET_NAME).download(rutaCaja),
          this.supabase.storage.from(BUCKET_NAME).download(rutaTriada),
          this.supabase.storage.from(BUCKET_NAME).download(rutaConsolidada)
        ]);

        if (dlCaja.error || !dlCaja.data) throw new Error(`Fallo de validación en storage de Caja: ${dlCaja.error?.message}`);
        if (dlTriada.error || !dlTriada.data) throw new Error(`Fallo de validación en storage de Triada: ${dlTriada.error?.message}`);
        if (dlCons.error || !dlCons.data) throw new Error(`Fallo de validación en storage Consolidado: ${dlCons.error?.message}`);

        const textCaja = await dlCaja.data.text();
        const jsonCaja = JSON.parse(textCaja);
        if (jsonCaja.tickets.length !== ticketsCaja.length) {
          throw new Error(`Discrepancia en validación de Caja: esperado ${ticketsCaja.length}, encontrado ${jsonCaja.tickets.length}`);
        }

        const textTriada = await dlTriada.data.text();
        const jsonTriada = JSON.parse(textTriada);
        if (jsonTriada.tickets.length !== ticketsTriada.length) {
          throw new Error(`Discrepancia en validación de Triada: esperado ${ticketsTriada.length}, encontrado ${jsonTriada.tickets.length}`);
        }

        console.log(`[CIERRE-DIARIO] Validación exitosa. Caja: ${ticketsCaja.length} tickets, Triada: ${ticketsTriada.length} tickets.`);

        // 6. Registrar en cierres_diarios de Supabase
        try {
          await this.supabase.from('cierres_diarios').upsert({
            fecha: fechaPanama,
            total_tickets: tickets.length,
            archivo_path: rutaConsolidada,
            bucket: BUCKET_NAME,
            tamano_bytes: bufConsolidado.length,
            estado: 'EXITOSO',
            error_mensaje: null,
            ejecutado_en: new Date().toISOString(),
            sedes_procesadas: metadatosCaja.desglosePorSede,
            metadatos: {
              ...docConsolidado.metadatos,
              caja: {
                totalTickets: ticketsCaja.length,
                archivoPath: rutaCaja,
                tamanoBytes: bufCaja.length
              },
              triada: {
                totalTickets: ticketsTriada.length,
                archivoPath: rutaTriada,
                tamanoBytes: bufTriada.length
              }
            }
          });
        } catch (dbErr: any) {
          console.warn('[CIERRE-DIARIO] Advertencia registrando en tabla cierres_diarios:', dbErr.message || dbErr);
        }
      }

      // 7. Limpieza de tickets de la tabla operativa tras validación exitosa
      console.log(`[CIERRE-DIARIO] Procediendo a limpieza de tickets operativos para ${fechaPanama}...`);
      await this.limpiarTicketsCerrados(ticketIds, fechaPanama);

      // Registrar localmente
      this.registrarCierreLocal({
        fecha: fechaPanama,
        totalTickets: tickets.length,
        totalTicketsCaja: ticketsCaja.length,
        totalTicketsTriada: ticketsTriada.length,
        archivoPath: rutaConsolidada,
        archivoPathCaja: rutaCaja,
        archivoPathTriada: rutaTriada,
        bucket: BUCKET_NAME,
        tamanoBytes: bufConsolidado.length,
        tamanoBytesCaja: bufCaja.length,
        tamanoBytesTriada: bufTriada.length,
        estado: 'EXITOSO',
        ejecutadoEn: new Date().toISOString(),
        sedesProcesadas: metadatosCaja.desglosePorSede,
        metadatos: docConsolidado.metadatos
      });

      return {
        success: true,
        fecha: fechaPanama,
        totalTickets: tickets.length,
        totalTicketsCaja: ticketsCaja.length,
        totalTicketsTriada: ticketsTriada.length,
        archivoPath: rutaConsolidada,
        archivoPathCaja: rutaCaja,
        archivoPathTriada: rutaTriada,
        tamanoBytes: bufConsolidado.length,
        tamanoBytesCaja: bufCaja.length,
        tamanoBytesTriada: bufTriada.length,
        detallesSedes: metadatosCaja.desglosePorSede
      };
    } catch (err: any) {
      console.error(`[CIERRE-DIARIO] Error en cierre diario para ${fechaPanama}:`, err.message || err);

      this.registrarCierreLocal({
        fecha: fechaPanama,
        totalTickets: 0,
        archivoPath: rutaConsolidada,
        bucket: BUCKET_NAME,
        estado: 'ERROR',
        errorMensaje: err.message || String(err),
        ejecutadoEn: new Date().toISOString()
      });

      return {
        success: false,
        fecha: fechaPanama,
        totalTickets: 0,
        archivoPath: rutaConsolidada,
        error: err.message || 'Error desconocido durante el cierre diario'
      };
    } finally {
      this.ejecutandoCierre = false;
    }
  }

  /**
   * Elimina de forma segura los tickets de la fecha cerrada tanto en memoria como en Supabase
   */
  private async limpiarTicketsCerrados(ticketIds: string[], fechaStr: string): Promise<void> {
    if (ticketIds.length === 0) return;

    // 1. Limpiar de la base de datos en memoria local
    const ticketsActuales = db.getTickets();
    const idSet = new Set(ticketIds);
    const ticketsRestantes = ticketsActuales.filter(t => !idSet.has(t.id));
    (db as any).data.tickets = ticketsRestantes;
    (db as any).scheduleSave();

    // 2. Limpiar de Supabase si está disponible
    if (this.supabase) {
      try {
        for (let i = 0; i < ticketIds.length; i += 50) {
          const lote = ticketIds.slice(i, i + 50);
          const { error } = await this.supabase
            .from('tickets')
            .delete()
            .in('id', lote);
          if (error) {
            console.warn(`[CIERRE-DIARIO] Advertencia eliminando lote de tickets en Supabase:`, error.message);
          }
        }
        console.log(`[CIERRE-DIARIO] Limpieza de ${ticketIds.length} tickets en Supabase completada.`);
      } catch (err: any) {
        console.error('[CIERRE-DIARIO] Error eliminando tickets de Supabase:', err.message || err);
      }
    }
  }

  /**
   * Consulta directa de tickets históricos almacenados en Supabase Storage
   * Soporta consulta por área específica: 'CAJA' | 'TRIADA' | 'TODAS'
   */
  public async consultarHistorialStorage(params: {
    fecha: string; // YYYY-MM-DD
    sedeId?: string;
    tramite?: string;
    estado?: string;
    busqueda?: string;
    area?: 'CAJA' | 'TRIADA' | 'TODAS';
  }): Promise<{
    tickets: any[];
    metadatos: any;
    archivoPath: string;
    totalEnArchivo: number;
    totalFiltrados: number;
    area: 'CAJA' | 'TRIADA' | 'TODAS';
  }> {
    const { fecha, sedeId, tramite, estado, busqueda, area = 'TODAS' } = params;

    if (!this.supabase) {
      throw new Error('Supabase Storage no está configurado para consultar el historial');
    }

    let ruta = this.getRutaArchivo(fecha, area);
    let downloadRes = await this.supabase.storage.from(BUCKET_NAME).download(ruta);

    // Si se buscaba caja o triada pero el archivo específico no existe aún, intentar con el consolidado
    if ((downloadRes.error || !downloadRes.data) && area !== 'TODAS') {
      const rutaConsolidada = this.getRutaArchivo(fecha, 'TODAS');
      const fallbackRes = await this.supabase.storage.from(BUCKET_NAME).download(rutaConsolidada);
      if (!fallbackRes.error && fallbackRes.data) {
        ruta = rutaConsolidada;
        downloadRes = fallbackRes;
      }
    }

    if (downloadRes.error || !downloadRes.data) {
      throw new Error(`No se encontró registro histórico archivado para la fecha ${fecha} (${downloadRes.error?.message || 'archivo no existe'})`);
    }

    const texto = await downloadRes.data.text();
    const parsed = JSON.parse(texto);
    let ticketsCrudos: any[] = [];
    const metadatos = parsed.metadatos || {};

    // Extraer según el área requerida
    if (area === 'CAJA') {
      if (Array.isArray(parsed.ticketsCaja) && parsed.ticketsCaja.length > 0) {
        ticketsCrudos = parsed.ticketsCaja;
      } else if (parsed.metadatos?.area === 'CAJA' && Array.isArray(parsed.tickets)) {
        ticketsCrudos = parsed.tickets;
      } else if (Array.isArray(parsed.tickets)) {
        ticketsCrudos = parsed.tickets.filter((t: any) =>
          t.area === 'CAJA' ||
          t.etapa === 'CAJA' ||
          (t.cajasHistorialIds && t.cajasHistorialIds.some((id: number) => id <= 100 || id % 1000 <= 100)) ||
          (t.cajaId !== undefined && (t.cajaId <= 100 || t.cajaId % 1000 <= 100)) ||
          (t.codigo && !t.codigo.startsWith('TR'))
        );
      }
    } else if (area === 'TRIADA') {
      if (Array.isArray(parsed.ticketsTriada) && parsed.ticketsTriada.length > 0) {
        ticketsCrudos = parsed.ticketsTriada;
      } else if (parsed.metadatos?.area === 'TRIADA' && Array.isArray(parsed.tickets)) {
        ticketsCrudos = parsed.tickets;
      } else if (Array.isArray(parsed.tickets)) {
        ticketsCrudos = parsed.tickets.filter((t: any) =>
          t.area === 'TRIADA' ||
          t.etapa === 'TRIADA' ||
          (t.cajasHistorialIds && t.cajasHistorialIds.some((id: number) => (id >= 200 && id <= 208) || id % 1000 >= 200)) ||
          (t.cajaId !== undefined && (t.cajaId >= 200 || t.cajaId % 1000 >= 200))
        );
      }
    } else {
      ticketsCrudos = Array.isArray(parsed.tickets) ? parsed.tickets : [];
    }

    // Normalizar campos de tickets
    ticketsCrudos = ticketsCrudos.map((t: any) => {
      const duracionSeg = t.duracionAtencionSegundos || t.duracionSegundos || 0;
      const esperaSeg = t.duracionEsperaSegundos || t.esperaSegundos || 0;
      let cNum = t.cajaNumero;
      if (cNum === undefined) {
        if (t.cajaId !== undefined) {
          cNum = t.cajaId === 100 ? 0 : (t.cajaId >= 200 ? ((t.cajaId % 1000) - 200) : (t.cajaId % 1000));
        } else {
          cNum = 1;
        }
      }
      const esTriada = t.area === 'TRIADA' || t.etapa === 'TRIADA' || area === 'TRIADA';
      const estTxt = t.estacionTexto || (esTriada ? `Triada ${cNum || 1}` : (cNum === 0 ? 'Caja 0 (Pref.)' : `Caja ${cNum}`));

      return {
        ...t,
        area: esTriada ? 'TRIADA' : 'CAJA',
        etapa: esTriada ? 'TRIADA' : 'CAJA',
        cajaNumero: cNum,
        estacionTexto: estTxt,
        duracionSegundos: duracionSeg,
        esperaSegundos: esperaSeg,
        duracionAtencionSegundos: duracionSeg,
        duracionEsperaSegundos: esperaSeg,
        duracionFormato: `${Math.floor(duracionSeg / 60)}m ${duracionSeg % 60}s`,
        esperaFormato: `${Math.floor(esperaSeg / 60)}m ${esperaSeg % 60}s`
      };
    });

    // Aplicar filtros en memoria
    let filtrados = ticketsCrudos;

    if (sedeId && sedeId !== 'todas') {
      filtrados = filtrados.filter(t => t.sedeId === sedeId);
    }

    if (tramite && tramite !== 'todos') {
      filtrados = filtrados.filter(t => t.tramite?.toLowerCase() === tramite.toLowerCase());
    }

    if (estado && estado !== 'todos') {
      filtrados = filtrados.filter(t => t.estado === estado);
    }

    if (busqueda && busqueda.trim()) {
      const q = busqueda.toLowerCase().trim();
      filtrados = filtrados.filter(t =>
        (t.codigo && t.codigo.toLowerCase().includes(q)) ||
        (t.ciudadanoNombre && t.ciudadanoNombre.toLowerCase().includes(q)) ||
        (t.ciudadanoApellido && t.ciudadanoApellido.toLowerCase().includes(q)) ||
        (t.tramite && t.tramite.toLowerCase().includes(q)) ||
        (t.usuarioNombre && t.usuarioNombre.toLowerCase().includes(q))
      );
    }

    return {
      tickets: filtrados,
      metadatos,
      archivoPath: ruta,
      totalEnArchivo: ticketsCrudos.length,
      totalFiltrados: filtrados.length,
      area
    };
  }

  /**
   * Consulta tickets históricos a través de un rango de fechas con soporte para área
   */
  public async consultarHistorialRango(params: {
    fechaInicio: string;
    fechaFin: string;
    sedeId?: string;
    tramite?: string;
    estado?: string;
    busqueda?: string;
    area?: 'CAJA' | 'TRIADA' | 'TODAS';
  }): Promise<{
    tickets: any[];
    fechasProcesadas: string[];
    archivosPaths: string[];
    totalEnStorage: number;
  }> {
    const { fechaInicio, fechaFin, sedeId, tramite, estado, busqueda, area = 'TODAS' } = params;
    const fechasDisponibles = await this.listarFechasDisponibles();

    const fechasEnRango = fechasDisponibles.filter(f => {
      return f.fecha >= fechaInicio && f.fecha <= fechaFin;
    });

    const todosTickets: any[] = [];
    const archivosPaths: string[] = [];
    const fechasProcesadas: string[] = [];

    for (const f of fechasEnRango) {
      try {
        const resDia = await this.consultarHistorialStorage({
          fecha: f.fecha,
          sedeId,
          tramite,
          estado,
          busqueda,
          area
        });
        if (resDia && resDia.tickets && resDia.tickets.length > 0) {
          todosTickets.push(...resDia.tickets);
          archivosPaths.push(resDia.archivoPath);
          fechasProcesadas.push(f.fecha);
        }
      } catch (errDia) {
        // Continuar si un día no tiene archivo
      }
    }

    return {
      tickets: todosTickets,
      fechasProcesadas,
      archivosPaths,
      totalEnStorage: todosTickets.length
    };
  }

  /**
   * Obtiene la lista de fechas históricas disponibles en Supabase Storage
   * incluyendo los paths de storage de Caja y Triada
   */
  public async listarFechasDisponibles(): Promise<Array<{
    fecha: string;
    ruta: string;
    rutaCaja?: string;
    rutaTriada?: string;
    totalTickets?: number;
    totalCaja?: number;
    totalTriada?: number;
    tamanoBytes?: number;
    estado?: string;
  }>> {
    if (!this.supabase) return [];
    try {
      // 1. Intentar consultar tabla cierres_diarios
      const { data: dbCierres, error } = await this.supabase
        .from('cierres_diarios')
        .select('*')
        .order('fecha', { ascending: false });

      if (!error && dbCierres && dbCierres.length > 0) {
        return dbCierres.map((c: any) => {
          const meta = c.metadatos || {};
          return {
            fecha: c.fecha,
            ruta: c.archivo_path,
            rutaCaja: meta.caja?.archivoPath || this.getRutaArchivo(c.fecha, 'CAJA'),
            rutaTriada: meta.triada?.archivoPath || this.getRutaArchivo(c.fecha, 'TRIADA'),
            totalTickets: c.total_tickets,
            totalCaja: meta.caja?.totalTickets !== undefined ? meta.caja.totalTickets : undefined,
            totalTriada: meta.triada?.totalTickets !== undefined ? meta.triada.totalTickets : undefined,
            tamanoBytes: c.tamano_bytes,
            estado: c.estado,
            ejecutadoEn: c.ejecutado_en
          };
        });
      }

      // 2. Si no hay tabla cierres_diarios o está vacía, explorar buckets en storage
      const resultados: Array<{ fecha: string; ruta: string; rutaCaja?: string; rutaTriada?: string }> = [];
      const { data: years } = await this.supabase.storage.from(BUCKET_NAME).list('historial');
      if (years) {
        for (const y of years) {
          if (!y.name.startsWith('.')) {
            const { data: months } = await this.supabase.storage.from(BUCKET_NAME).list(`historial/${y.name}`);
            if (months) {
              for (const m of months) {
                if (!m.name.startsWith('.')) {
                  const { data: days } = await this.supabase.storage.from(BUCKET_NAME).list(`historial/${y.name}/${m.name}`);
                  if (days) {
                    for (const d of days) {
                      if (!d.name.startsWith('.')) {
                        const fechaStr = `${y.name}-${m.name.padStart(2, '0')}-${d.name.padStart(2, '0')}`;
                        resultados.push({
                          fecha: fechaStr,
                          ruta: `historial/${y.name}/${m.name}/${d.name}/tickets.json`,
                          rutaCaja: `historial/${y.name}/${m.name}/${d.name}/caja/tickets.json`,
                          rutaTriada: `historial/${y.name}/${m.name}/${d.name}/triada/tickets.json`
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      return resultados.sort((a, b) => b.fecha.localeCompare(a.fecha));
    } catch (err: any) {
      console.warn('[CIERRE-DIARIO] Error listando fechas en storage:', err.message || err);
      return [];
    }
  }

  /**
   * Herramienta de migración y regeneración retroactiva:
   * Toma fechas existentes en Storage y les genera sus archivos dedicados
   * caja/tickets.json y triada/tickets.json si aún no existen.
   */
  public async migrarFechasExistentes(): Promise<void> {
    if (!this.supabase) return;
    try {
      const fechas = await this.listarFechasDisponibles();
      for (const item of fechas) {
        const fecha = item.fecha;
        const rutaCaja = this.getRutaArchivo(fecha, 'CAJA');
        const rutaTriada = this.getRutaArchivo(fecha, 'TRIADA');

        // Comprobar si ya existe caja/tickets.json
        const [checkCaja, checkTriada] = await Promise.all([
          this.supabase.storage.from(BUCKET_NAME).download(rutaCaja),
          this.supabase.storage.from(BUCKET_NAME).download(rutaTriada)
        ]);

        if (checkCaja.error || !checkCaja.data || checkTriada.error || !checkTriada.data) {
          console.log(`[MIGRACION-STORAGE] Generando archivos dedicados de Caja y Triada para ${fecha}...`);
          const rutaConsolidada = this.getRutaArchivo(fecha, 'TODAS');
          const dlCons = await this.supabase.storage.from(BUCKET_NAME).download(rutaConsolidada);
          if (dlCons.data) {
            const rawJson = JSON.parse(await dlCons.data.text());
            const ticketsRaw: Ticket[] = rawJson.tickets || [];
            const evsRaw: any[] = rawJson.eventosAuditoria || [];

            const { ticketsCaja, ticketsTriada } = this.separarTicketsPorArea(ticketsRaw, evsRaw);

            const docCaja = {
              metadatos: this.generarMetadatosArea(ticketsCaja, 'CAJA', fecha),
              tickets: ticketsCaja
            };
            const docTriada = {
              metadatos: this.generarMetadatosArea(ticketsTriada, 'TRIADA', fecha),
              tickets: ticketsTriada
            };

            const bufCaja = Buffer.from(JSON.stringify(docCaja, null, 2), 'utf-8');
            const bufTriada = Buffer.from(JSON.stringify(docTriada, null, 2), 'utf-8');

            await Promise.all([
              this.supabase.storage.from(BUCKET_NAME).upload(rutaCaja, bufCaja, { contentType: 'application/json', upsert: true }),
              this.supabase.storage.from(BUCKET_NAME).upload(rutaTriada, bufTriada, { contentType: 'application/json', upsert: true })
            ]);

            // Actualizar consolidado con ticketsCaja y ticketsTriada
            rawJson.ticketsCaja = ticketsCaja;
            rawJson.ticketsTriada = ticketsTriada;
            rawJson.metadatos = {
              ...(rawJson.metadatos || {}),
              porArea: {
                caja: { totalTickets: ticketsCaja.length, archivoPath: rutaCaja },
                triada: { totalTickets: ticketsTriada.length, archivoPath: rutaTriada }
              }
            };
            const bufCons = Buffer.from(JSON.stringify(rawJson, null, 2), 'utf-8');
            await this.supabase.storage.from(BUCKET_NAME).upload(rutaConsolidada, bufCons, { contentType: 'application/json', upsert: true });

            console.log(`[MIGRACION-STORAGE] Archivos creados exitosamente para ${fecha}: Caja (${ticketsCaja.length}), Triada (${ticketsTriada.length})`);
          }
        }
      }
    } catch (e: any) {
      console.warn('[MIGRACION-STORAGE] Advertencia durante migración de fechas:', e.message || e);
    }
  }

  /**
   * Registro de respaldo local en caso de caídas de red
   */
  private logLocalPath = 'data/cierres_diarios_log.json';
  private registrarCierreLocal(registro: CierreDiarioRegistro) {
    try {
      let lista: CierreDiarioRegistro[] = [];
      if (fsExists(this.logLocalPath)) {
        lista = JSON.parse(fsRead(this.logLocalPath));
      }
      const idx = lista.findIndex(r => r.fecha === registro.fecha);
      if (idx !== -1) {
        lista[idx] = registro;
      } else {
        lista.unshift(registro);
      }
      fsWrite(this.logLocalPath, JSON.stringify(lista, null, 2));
    } catch (e) {
      console.warn('[CIERRE-DIARIO] Error guardando log local:', e);
    }
  }

  public getCierresLocales(): CierreDiarioRegistro[] {
    try {
      if (fsExists(this.logLocalPath)) {
        return JSON.parse(fsRead(this.logLocalPath));
      }
    } catch (e) {}
    return [];
  }

  /**
   * Inicia el monitor automático que corre permanentemente en el servidor
   */
  public iniciarAutomatizacionServidor() {
    if (this.intervaloTimer) return;

    console.log('[CIERRE-DIARIO] Automatización autónoma de cierre diario iniciada (Monitoreo continuo para zona horaria America/Panama).');

    // Ejecutar migración inicial para asegurar que fechas existentes tengan storage de Caja y Triada
    this.migrarFechasExistentes().catch(err => console.warn('[CIERRE-DIARIO] Migración inicial:', err));

    // Revisar cada 60 segundos si es momento de ejecutar el cierre
    this.intervaloTimer = setInterval(async () => {
      try {
        const { fechaStr, horaNum, minutoNum } = this.getPanamaDate();

        // Ejecución objetivo: 15:35 o 15:36 (3:35 p.m. Panamá, tras cierre de las 16 regionales a las 3:30 p.m.)
        if (horaNum === 15 && (minutoNum === 35 || minutoNum === 36)) {
          const cierres = await this.listarFechasDisponibles();
          const yaCerrado = cierres.some(c => c.fecha === fechaStr && (c as any).estado !== 'ERROR');

          if (!yaCerrado) {
            console.log(`[CIERRE-DIARIO-AUTO] Son las 3:35 p.m. en Panamá (${fechaStr}). Fin de jornada en todas las sedes. Ejecutando cierre automático...`);
            await this.ejecutarCierreDiario(fechaStr);
          }
        }
      } catch (err) {
        console.error('[CIERRE-DIARIO-AUTO] Error en ciclo de automatización:', err);
      }
    }, 60000);
  }

  public detenerAutomatizacion() {
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }
}

// Helpers de sistema de archivos
import fs from 'fs';
function fsExists(p: string): boolean {
  return fs.existsSync(p);
}
function fsRead(p: string): string {
  return fs.readFileSync(p, 'utf-8');
}
function fsWrite(p: string, c: string): void {
  fs.writeFileSync(p, c, 'utf-8');
}

export const cierreDiarioService = new CierreDiarioService();
