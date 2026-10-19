import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { 
  Usuario, 
  Caja, 
  Ticket, 
  Atencion, 
  EventoRealtime, 
  MetricasSistema,
  EstadoGlobalSnapshot,
  ConfiguracionVisual
} from '../src/types.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[SUPABASE] Cliente inicializado correctamente para: ' + supabaseUrl);
  } catch (err) {
    console.error('[SUPABASE] Error inicializando cliente de Supabase:', err);
  }
}

export const DEFAULT_CONFIGURACION_VISUAL: ConfiguracionVisual = {
  nombreSistema: 'Sistema de Gestión de Turnos',
  nombreInstitucion: 'Tribunal Electoral',
  nombreCorto: 'TE',
  tituloNavegador: 'Sistema de Gestión de Turnos | Tribunal Electoral',
  textoBienvenida: 'Bienvenido, tome su turno',
  pieDePagina: '© 2026 Tribunal Electoral • Sistema Oficial de Atención y Asignación de Turnos',
  version: '1.0.0',
  nombreApp: 'Turnos Realtime',

  logoPrincipalUrl: '',
  logoMovilUrl: '',
  faviconUrl: '',

  primaryColor: '#1D4ED8',
  secondaryColor: '#2563EB',
  backgroundColor: '#F8FAFC',
  surfaceColor: '#FFFFFF',
  textColor: '#0F172A',
  mutedTextColor: '#64748B',
  buttonColor: '#1D4ED8',
  buttonHoverColor: '#1E40AF',
  headerColor: '#0F172A',
  borderColor: '#E2E8F0',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  errorColor: '#EF4444',

  fontFamily: 'Plus Jakarta Sans',
  interfaceSize: 'normal',
  borderRadius: 'medium',
  themeMode: 'light',

  pantallaFondoTipo: 'color',
  pantallaFondoValor: '#0B1329',

  // Configuración de Ticket Térmico y Kiosko
  ticketLogoUrl: '',
  ticketMostrarLogo: true,
  ticketLogoTamano: 'mediano',
  ticketEncabezado: 'Tribunal Electoral',
  ticketSubencabezado: 'Comprobante Oficial de Turno',
  ticketMensajeEspera: 'Por favor permanezca atento a la Pantalla Pública y al audio del llamado.',
  ticketPieMensaje: '¡Gracias por su visita! Conserve este comprobante hasta finalizar su atención.',
  ticketNotaPie: 'Validez únicamente para el día de emisión.',
  ticketMostrarCiudadano: true,
  ticketMostrarTramite: true,
  ticketMostrarFechaHora: true,
  ticketMostrarCodigoBarras: true,
  ticketMostrarQr: true,
  ticketAnchoPapel: '80mm',
  ticketEstiloFuente: 'monospace',
  ticketEspaciado: 'normal'
};

interface DatabaseSchema {
  usuarios: Usuario[];
  cajas: Caja[];
  tickets: Ticket[];
  atenciones: Atencion[];
  eventos: EventoRealtime[];
  ultimoCorrelativo: Record<string, number>; // prefijo -> número (e.g., "A" -> 5)
  configuracionVisual: ConfiguracionVisual;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'turnos_db.json');

// Los tres usuarios requeridos del sistema: oavega (SUPER ADMIN), lperez (Caja) y rfrias (Triada)
// Cualquier usuario adicional se creará exclusivamente desde el sistema desplegado y se almacenará en Supabase.
const SEED_USUARIOS: Usuario[] = [
  {
    id: 'user-superadmin',
    nombre: 'Oscar Vega',
    usuario: 'oavega',
    email: 'superadmin@institucion.gob',
    password: 'admin',
    rol: 'SUPER_ADMIN',
    activo: true,
    cajaAsignadaId: null,
    sedeId: 'ancon',
    fechaCreacion: '2026-09-29T22:23:39.847+00:00'
  },
  {
    id: 'user-1791401216789-nheh',
    nombre: 'Laura Perez',
    usuario: 'lperez',
    email: 'lperez@te.gob.pa',
    password: '123',
    rol: 'FUNCIONARIO_CAJA',
    activo: true,
    cajaAsignadaId: 1,
    sedeId: 'ancon',
    fechaCreacion: '2026-10-07T19:26:56.789+00:00'
  },
  {
    id: 'user-1791402340603-jw0w',
    nombre: 'Roberto Frias',
    usuario: 'rfrias',
    email: 'rfrias@te.gob.pa',
    password: '123',
    rol: 'FUNCIONARIO_TRIADA',
    activo: true,
    cajaAsignadaId: 201,
    sedeId: 'ancon',
    fechaCreacion: '2026-10-07T19:45:40.603+00:00'
  }
];

function generarCajasSedes(): Caja[] {
  const result: Caja[] = [];
  const sedesList = [
    'ancon', 'bocas_del_toro', 'cocle', 'colon', 'chiriqui', 'darien', 'herrera',
    'los_santos', 'panama_centro', 'panama_norte', 'panama_este', 'panama_oeste',
    'san_miguelito', 'veraguas', 'guna_yala', 'arraijan'
  ];

  const nombresTramites = [
    'Preferencial',
    'Cedulación',
    'Extranjería',
    'Organización Electoral',
    'Registro Civil',
    'Atención General A',
    'Atención General B',
    'Atención General C',
    'Atención General D'
  ];

  for (let i = 0; i < sedesList.length; i++) {
    const sedeId = sedesList[i];
    // Caja 0 (Preferencial)
    result.push({
      id: i * 1000 + 100, // Caja 0 -> 100 para Ancón (i=0), 1100 para i=1, etc.
      numero: 0,
      nombre: `Caja 0 - Preferencial`,
      estado: 'DESCONECTADA',
      usuarioActualId: null,
      usuarioNombre: null,
      ticketActualId: null,
      ticketActualCodigo: null,
      ultimaActividad: new Date().toISOString(),
      activa: true,
      tipo: 'CAJA',
      sedeId
    });

    // Cajas 1 a 8
    for (let num = 1; num <= 8; num++) {
      result.push({
        id: i * 1000 + num, // Caja 1 -> 1 para Ancón (i=0), 1001 para i=1, etc.
        numero: num,
        nombre: `Caja ${num} - ${nombresTramites[num] || 'Atención'}`,
        estado: 'DESCONECTADA',
        usuarioActualId: null,
        usuarioNombre: null,
        ticketActualId: null,
        ticketActualCodigo: null,
        ultimaActividad: new Date().toISOString(),
        activa: true,
        tipo: 'CAJA',
        sedeId
      });
    }

    // Triadas 1 a 8
    for (let num = 1; num <= 8; num++) {
      result.push({
        id: i * 1000 + 200 + num, // Triada 1 -> 201 para Ancón (i=0), 1201 para i=1, etc.
        numero: num,
        nombre: `Triada ${num} - Fotografía ${String.fromCharCode(64 + num)}`,
        estado: 'DESCONECTADA',
        usuarioActualId: null,
        usuarioNombre: null,
        ticketActualId: null,
        ticketActualCodigo: null,
        ultimaActividad: new Date().toISOString(),
        activa: true,
        tipo: 'TRIADA',
        sedeId
      });
    }
  }

  return result;
}

const SEED_CAJAS: Caja[] = generarCajasSedes();

class Database {
  private data: DatabaseSchema;
  private isSaving = false;
  private pendingSave = false;

  constructor() {
    this.data = this.load();
  }

  private mapToSupabase(table: string, record: any): any {
    const res: any = {};
    for (const k of Object.keys(record)) {
      const snake = k.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      res[snake] = record[k];
    }
    // Overrides específicos si aplican
    if (table === 'usuarios') {
      // Mapear los roles enriquecidos del frontend al rol 'FUNCIONARIO' para la restricción de Supabase
      if (res.rol === 'FUNCIONARIO_CAJA' || res.rol === 'FUNCIONARIO_TRIADA' || res.rol === 'SUPERVISOR_CAJA' || res.rol === 'SUPERVISOR_TRIADA') {
        res.rol = 'FUNCIONARIO';
      }
    } else if (table === 'tickets') {
      delete res.duracion_atencion_segundos;
      delete res.cajas_historial_ids;
      delete res.estacion_texto;
      delete res.duracion_segundos;
      delete res.espera_segundos;
      delete res.duracion_formato;
      delete res.espera_formato;
    }
    return res;
  }

  private mapFromSupabase(table: string, record: any): any {
    const res: any = {};
    for (const k of Object.keys(record)) {
      const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      res[camel] = record[k];
    }
    if (table === 'usuarios') {
      // Reconstruir el rol específico basándonos en la estación asignada o nombre
      if (res.rol === 'FUNCIONARIO') {
        const lowerUser = (res.usuario || '').toLowerCase();
        const lowerNombre = (res.nombre || '').toLowerCase();
        const isSupervisor = lowerUser.includes('supervisor') || lowerNombre.includes('supervisor');

        if (res.cajaAsignadaId !== null && res.cajaAsignadaId !== undefined) {
          // Si el ID de caja está en rango de Triadas (por ej: termina en 200+ o el ID de caja es de Triada)
          // Verificamos si es Triada usando el id o número.
          // Triadas en Ancón (id: 201-208), Bocas (1201-1208), etc.
          // El residuo modulo 1000 nos dice si es de Triada (rango 201-208)
          const modId = res.cajaAsignadaId % 1000;
          const esTriada = modId > 200 && modId <= 208;
          if (isSupervisor) {
            res.rol = esTriada ? 'SUPERVISOR_TRIADA' : 'SUPERVISOR_CAJA';
          } else {
            res.rol = esTriada ? 'FUNCIONARIO_TRIADA' : 'FUNCIONARIO_CAJA';
          }
        } else if (lowerUser.includes('triada') || lowerNombre.includes('triada')) {
          res.rol = isSupervisor ? 'SUPERVISOR_TRIADA' : 'FUNCIONARIO_TRIADA';
        } else {
          res.rol = isSupervisor ? 'SUPERVISOR_CAJA' : 'FUNCIONARIO_CAJA';
        }
      }
    }
    return res;
  }

  public async syncToSupabase(table: string, record: any) {
    if (!supabase) return;
    try {
      const mapped = this.mapToSupabase(table, record);
      const { error } = await supabase.from(table).upsert(mapped);
      if (error) {
        console.warn(`[SUPABASE] Advertencia upsert en ${table}:`, error.message);
      }
    } catch (err: any) {
      console.error(`[SUPABASE] Error de conexión al guardar en ${table}:`, err.message || err);
    }
  }

  public async deleteFromSupabase(table: string, id: any) {
    if (!supabase) return;
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) {
        console.warn(`[SUPABASE] Advertencia delete en ${table}:`, error.message);
      }
    } catch (err: any) {
      console.error(`[SUPABASE] Error de conexión al eliminar en ${table}:`, err.message || err);
    }
  }

  public async initSupabase() {
    if (!supabase) {
      console.log('[SUPABASE] No se detectaron credenciales de Supabase en variables de entorno. Usando base de datos JSON local.');
      return;
    }
    try {
      console.log('[SUPABASE] Sincronizando datos desde la base de datos de Supabase...');
      
      // 1. Cargar Usuarios exclusivamente creados en el sistema y sincronizados en Supabase
      const { data: dbUsuarios, error: errU } = await supabase.from('usuarios').select('*');
      if (errU) throw errU;
      
      const DEMO_USERNAMES = ['admin', 'juan', 'maria', 'carlos', 'ana', 'triada1', 'triada2'];

      if (dbUsuarios && dbUsuarios.length > 0) {
        const mappedUsers = dbUsuarios
          .map((u: any) => this.mapFromSupabase('usuarios', u))
          .filter((u: any) => !DEMO_USERNAMES.includes(u.usuario?.toLowerCase()));
        this.data.usuarios = mappedUsers;
      } else {
        this.data.usuarios = [];
      }

      // Garantizar que los tres usuarios requeridos (oavega, lperez, rfrias) existan en memoria y en Supabase
      for (const su of SEED_USUARIOS) {
        let existing = this.data.usuarios.find(u => 
          u.usuario?.toLowerCase() === su.usuario?.toLowerCase() || 
          u.id === su.id
        );

        if (!existing) {
          existing = { ...su };
          this.data.usuarios.push(existing);
          await this.syncToSupabase('usuarios', existing);
        } else {
          existing.activo = true;
          if (su.usuario === 'oavega') {
            existing.rol = 'SUPER_ADMIN';
            existing.usuario = 'oavega';
            existing.nombre = 'Oscar Vega';
            if (!existing.password) existing.password = '1234561';
          }
          if (su.usuario === 'lperez') {
            existing.rol = 'FUNCIONARIO_CAJA';
            existing.cajaAsignadaId = 1;
          }
          if (su.usuario === 'rfrias') {
            existing.rol = 'FUNCIONARIO_TRIADA';
            existing.cajaAsignadaId = 201;
          }
        }
      }

      // 2. Cargar Cajas (MERGE para no perder las cajas de las 16 sedes)
      const { data: dbCajas, error: errC } = await supabase.from('cajas').select('*');
      if (errC) throw errC;
      if (dbCajas && dbCajas.length > 0) {
        const mappedCajas = dbCajas.map((c: any) => this.mapFromSupabase('cajas', c));
        for (const mc of mappedCajas) {
          // Las cajas no deben conservar sesiones volátiles zombies de usuarios desconectados al iniciar
          mc.socketId = null;
          mc.estado = 'DESCONECTADA';
          mc.usuarioActualId = null;
          mc.usuarioNombre = null;
          mc.ticketActualId = null;
          mc.ticketActualCodigo = null;

          const idx = this.data.cajas.findIndex(c => c.id === mc.id);
          if (idx !== -1) {
            this.data.cajas[idx] = { ...this.data.cajas[idx], ...mc };
          } else {
            this.data.cajas.push(mc);
          }
        }
      }

      // Garantizar que TODAS las cajas de las 16 sedes (Caja 0-8 y Triada 1-8) existan siempre
      for (const sc of SEED_CAJAS) {
        const idx = this.data.cajas.findIndex(c => c.id === sc.id);
        if (idx === -1) {
          this.data.cajas.push({ ...sc });
        }
      }

      // Limpiar presencia de todas las cajas en memoria y sincronizar estado desconectado
      for (const c of this.data.cajas) {
        c.socketId = null;
        c.estado = 'DESCONECTADA';
        c.usuarioActualId = null;
        c.usuarioNombre = null;
        c.ticketActualId = null;
        c.ticketActualCodigo = null;
      }

      // Si Supabase tiene menos cajas que las 16 sedes o para limpiar estados de cajas en Supabase
      try {
        const mappedSeed = this.data.cajas.map(c => this.mapToSupabase('cajas', c));
        for (let i = 0; i < mappedSeed.length; i += 40) {
          await supabase.from('cajas').upsert(mappedSeed.slice(i, i + 40));
        }
        console.log('[SUPABASE] Cajas de todas las 16 sedes actualizadas en Supabase (limpias y desconectadas).');
      } catch (seedErr) {
        console.warn('[SUPABASE] No se pudieron sincronizar las cajas en Supabase:', seedErr);
      }

      // 3. Cargar Tickets
      const { data: dbTickets, error: errT } = await supabase.from('tickets').select('*');
      if (errT) throw errT;
      if (dbTickets && dbTickets.length > 0) {
        const loadedTickets: Ticket[] = dbTickets.map((t: any) => this.mapFromSupabase('tickets', t));
        const nowIso = new Date().toISOString();
        const hoy = nowIso.split('T')[0];

        // Preservar historial local de cajas por si no viene en Supabase
        const existingMap = new Map(this.data.tickets.map(t => [t.id, t]));
        for (const t of loadedTickets) {
          const ex = existingMap.get(t.id);
          if (ex && Array.isArray((ex as any).cajasHistorialIds) && !(t as any).cajasHistorialIds) {
            (t as any).cajasHistorialIds = (ex as any).cajasHistorialIds;
          }

          if (t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION') {
            const fechaT = (t.fechaCreacion || '').split('T')[0];
            if (fechaT && fechaT < hoy) {
              t.estado = 'FINALIZADO';
              t.fechaFinalizacion = t.fechaFinalizacion || nowIso;
              t.duracionAtencionSegundos = t.duracionAtencionSegundos || 60;
              await this.syncToSupabase('tickets', t);
            }
          }
        }
        this.data.tickets = loadedTickets;
      }

      // 4. Cargar Tracking (Eventos)
      const { data: dbTracking, error: errTr } = await supabase.from('tracking_tickets').select('*').order('timestamp', { ascending: false }).limit(500);
      if (!errTr && dbTracking && dbTracking.length > 0) {
        this.data.eventos = dbTracking.map((e: any) => {
          return {
            type: e.tipo_evento,
            timestamp: e.timestamp,
            sedeId: e.sede_id,
            codigo: e.codigo,
            caja: e.caja,
            cajaId: e.caja_id,
            funcionario: e.funcionario,
            ciudadano: e.ciudadano,
            payload: e.payload || {}
          };
        });
      }

      console.log('[SUPABASE] Sincronización inicial con Supabase exitosa.');
    } catch (err: any) {
      console.error('[SUPABASE] Error en sincronización con Supabase (¿ejecutaste el script SQL de creación de tablas?):', err.message || err);
      console.log('[SUPABASE] Continuando con datos locales JSON de respaldo.');
    }
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        // Reiniciar estados volátiles de sockets al arrancar el servidor
        parsed.cajas.forEach(c => {
          c.socketId = null;
          // Si el servidor reinicia, las cajas empiezan desconectadas a la espera de que los funcionarios abran la app
          c.estado = 'DESCONECTADA';
          c.usuarioActualId = null;
          c.usuarioNombre = null;
          c.ticketActualId = null;
          c.ticketActualCodigo = null;
          if (!c.tipo) {
            c.tipo = 'CAJA';
          }
          if (!c.sedeId) {
            c.sedeId = 'ancon';
          }
        });

        const nowLoad = new Date().toISOString();
        const hoyLoad = nowLoad.split('T')[0];
        // Finalizar turnos huérfanos de fechas anteriores que se hayan quedado trabados
        parsed.tickets.forEach(t => {
          if (t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION') {
            const fechaT = (t.fechaCreacion || '').split('T')[0];
            if (fechaT && fechaT < hoyLoad) {
              t.estado = 'FINALIZADO';
              t.fechaFinalizacion = t.fechaFinalizacion || nowLoad;
              t.duracionAtencionSegundos = t.duracionAtencionSegundos || 60;
            }
          }
        });
        // Garantizar que todos los cubículos de SEED_CAJAS (Cajas 0-8 y Triadas 1-8 para las 16 sedes) existan
        for (const sc of SEED_CAJAS) {
          const idx = parsed.cajas.findIndex(c => c.id === sc.id);
          if (idx === -1) {
            parsed.cajas.push({ ...sc });
          } else {
            if (!parsed.cajas[idx].tipo) {
              parsed.cajas[idx].tipo = sc.tipo;
            }
            if (!parsed.cajas[idx].sedeId) {
              parsed.cajas[idx].sedeId = sc.sedeId;
            }
          }
        }

        // Filtrar usuarios de prueba o demo legados
        const DEMO_USERNAMES = ['admin', 'juan', 'maria', 'carlos', 'ana', 'triada1', 'triada2'];
        parsed.usuarios = parsed.usuarios.filter(u => !DEMO_USERNAMES.includes(u.usuario?.toLowerCase()));

        // Garantizar que los tres usuarios requeridos (oavega, lperez, rfrias) siempre existan
        for (const su of SEED_USUARIOS) {
          const existing = parsed.usuarios.find(u => 
            u.usuario?.toLowerCase() === su.usuario?.toLowerCase() || 
            u.id === su.id
          );
          if (!existing) {
            parsed.usuarios.push({ ...su });
          } else {
            existing.activo = true;
            if (su.usuario === 'oavega') {
              existing.rol = 'SUPER_ADMIN';
              existing.usuario = 'oavega';
              existing.nombre = 'Oscar Vega';
              if (!existing.password) existing.password = '1234561';
            }
          }
        }

        parsed.usuarios.forEach(u => {
          if (!u.usuario) {
            u.usuario = u.email ? u.email.split('@')[0] : `user${u.id.substring(0, 4)}`;
          }
          if (!u.password) {
            u.password = (u.rol === 'SUPER_ADMIN' || u.rol === 'ADMINISTRADOR') ? 'admin' : '123';
          }
          if (!u.sedeId) {
            u.sedeId = 'ancon';
          }
          // Normalizar roles de acceso exclusivos para Caja vs Triada
          if (u.rol !== 'SUPER_ADMIN' && u.rol !== 'ADMINISTRADOR' && u.rol !== 'SUPERVISOR_CAJA' && u.rol !== 'SUPERVISOR_TRIADA') {
            if (u.rol === 'FUNCIONARIO' || !u.rol) {
              const esTriada = (u.cajaAsignadaId && (u.cajaAsignadaId % 1000 > 200 && u.cajaAsignadaId % 1000 <= 208)) ||
                u.usuario?.toLowerCase().includes('triada') ||
                u.nombre?.toLowerCase().includes('triada');
              u.rol = esTriada ? 'FUNCIONARIO_TRIADA' : 'FUNCIONARIO_CAJA';
            }
          }
        });

        // Garantizar configuración visual institucional
        if (!parsed.configuracionVisual) {
          parsed.configuracionVisual = { ...DEFAULT_CONFIGURACION_VISUAL };
        } else {
          parsed.configuracionVisual = {
            ...DEFAULT_CONFIGURACION_VISUAL,
            ...parsed.configuracionVisual
          };
        }

        // Guardar inmediatamente la estructura completa
        fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

        return parsed;
      }
    } catch (err) {
      console.error('Error cargando base de datos, inicializando con datos semilla:', err);
    }

    return {
      usuarios: SEED_USUARIOS,
      cajas: SEED_CAJAS,
      tickets: [],
      atenciones: [],
      eventos: [],
      ultimoCorrelativo: { C: 0, E: 0, O: 0, R: 0 },
      configuracionVisual: { ...DEFAULT_CONFIGURACION_VISUAL }
    };
  }

  private scheduleSave() {
    if (this.isSaving) {
      this.pendingSave = true;
      return;
    }
    this.isSaving = true;

    setImmediate(() => {
      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        const tempPath = `${DB_FILE}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(tempPath, DB_FILE);
      } catch (err) {
        console.error('Error guardando base de datos en disco:', err);
      } finally {
        this.isSaving = false;
        if (this.pendingSave) {
          this.pendingSave = false;
          this.scheduleSave();
        }
      }
    });
  }

  // --- Usuarios ---
  public getUsuarios(sedeId?: string): Usuario[] {
    if (sedeId) {
      return this.data.usuarios.filter(u => u.sedeId === sedeId || u.rol === 'SUPER_ADMIN');
    }
    return [...this.data.usuarios];
  }

  public getUsuarioById(id: string): Usuario | undefined {
    return this.data.usuarios.find(u => u.id === id);
  }

  public authenticateUser(usuarioOEmail: string, password: string): Usuario | null {
    const cleanUser = (usuarioOEmail || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();
    const found = this.data.usuarios.find(u => 
      u.activo && (
        (u.usuario && u.usuario.toLowerCase() === cleanUser) ||
        (u.email && u.email.toLowerCase() === cleanUser) ||
        (cleanUser === 'oavega' && (u.id === 'user-superadmin' || u.usuario?.toLowerCase() === 'oavega')) ||
        (cleanUser === 'superadmin' && (u.id === 'user-superadmin' || u.usuario?.toLowerCase() === 'oavega'))
      )
    );
    if (!found) return null;

    // Validación de credenciales para el Super Administrador oavega
    if (found.usuario?.toLowerCase() === 'oavega' || found.id === 'user-superadmin') {
      if (cleanPass === '1234561' || cleanPass === 'admin' || cleanPass === found.password) {
        return found;
      }
      return null;
    }

    // Validación estándar para demás usuarios creados
    if (found.password && found.password !== cleanPass) {
      return null;
    }
    return found;
  }

  public createUsuario(usuario: Omit<Usuario, 'id' | 'fechaCreacion'>): Usuario {
    const nuevo: Usuario = {
      ...usuario,
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      usuario: usuario.usuario || usuario.email.split('@')[0],
      password: usuario.password || '123',
      fechaCreacion: new Date().toISOString()
    };
    this.data.usuarios.push(nuevo);
    this.scheduleSave();
    this.syncToSupabase('usuarios', nuevo);
    return nuevo;
  }

  public updateUsuario(id: string, patch: Partial<Usuario>): Usuario | null {
    const user = this.data.usuarios.find(u => u.id === id);
    if (!user) return null;
    Object.assign(user, patch);
    this.scheduleSave();
    this.syncToSupabase('usuarios', user);
    return user;
  }

  public deleteUsuario(id: string): boolean {
    const idx = this.data.usuarios.findIndex(u => u.id === id);
    if (idx === -1) return false;
    this.data.usuarios.splice(idx, 1);
    this.scheduleSave();
    this.deleteFromSupabase('usuarios', id);
    return true;
  }

  // --- Historial de Caja del Día ---
  public getHistorialCajaHoy(
    cajaId: number,
    tipo?: 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS',
    sedeId?: string
  ) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const targetCaja = this.getCajaById(cajaId) || 
      this.data.cajas.find(c => c.id === cajaId || (c.numero === cajaId && (!tipo || tipo === 'TODAS' || tipo === 'AMBOS' || c.tipo === tipo) && (!sedeId || c.sedeId === sedeId)));

    const cajaIdNum = targetCaja ? targetCaja.id : cajaId;
    const cajaNumero = targetCaja ? targetCaja.numero : cajaId;
    const cajaTipo = targetCaja ? targetCaja.tipo : (tipo || (cajaIdNum >= 200 && cajaIdNum % 1000 >= 200 ? 'TRIADA' : 'CAJA'));
    const targetSedeId = targetCaja ? targetCaja.sedeId : sedeId;

    const tickets = this.data.tickets.filter(t => {
      if (targetSedeId && t.sedeId && t.sedeId !== targetSedeId) return false;
      if (sedeId && t.sedeId && t.sedeId !== sedeId) return false;

      let isMatch = false;

      if (cajaTipo === 'CAJA') {
        if (cajaNumero === 0 && (t.preferencial || t.codigo?.startsWith('P-') || (Array.isArray(t.cajasHistorialIds) && t.cajasHistorialIds.includes(100)))) {
          isMatch = true;
        } else if (Array.isArray(t.cajasHistorialIds) && (t.cajasHistorialIds.includes(cajaIdNum) || t.cajasHistorialIds.includes(cajaId))) {
          isMatch = true;
        } else if (this.data.atenciones && this.data.atenciones.some(a => 
          a.ticketId === t.id && (a.cajaId === cajaIdNum || a.cajaId === cajaId || (targetCaja && a.cajaId === targetCaja.id))
        )) {
          isMatch = true;
        } else if (this.data.eventos && this.data.eventos.some(e => 
          e.ticketId === t.id && (e.cajaId === cajaIdNum || e.cajaId === cajaId || (targetCaja && e.cajaId === targetCaja.id))
        )) {
          isMatch = true;
        } else if (t.etapa === 'CAJA') {
          if (t.cajaId === cajaIdNum || t.cajaId === cajaId) {
            isMatch = true;
          } else if (t.cajaNumero === cajaNumero) {
            isMatch = true;
          }
        }
      } else if (cajaTipo === 'TRIADA') {
        if (t.etapa === 'TRIADA') {
          if (t.cajaId === cajaIdNum || t.cajaId === cajaId) {
            isMatch = true;
          } else if (t.cajaNumero === cajaNumero) {
            isMatch = true;
          }
        }
        if (!isMatch && Array.isArray(t.cajasHistorialIds)) {
          if (t.cajasHistorialIds.includes(cajaIdNum) || t.cajasHistorialIds.includes(cajaId)) {
            isMatch = true;
          }
        }
        if (!isMatch && this.data.atenciones) {
          if (this.data.atenciones.some(a => 
            a.ticketId === t.id && (a.cajaId === cajaIdNum || a.cajaId === cajaId || (targetCaja && a.cajaId === targetCaja.id))
          )) {
            isMatch = true;
          }
        }
        if (!isMatch && this.data.eventos) {
          if (this.data.eventos.some(e => 
            e.ticketId === t.id && (e.cajaId === cajaIdNum || e.cajaId === cajaId || (targetCaja && e.cajaId === targetCaja.id))
          )) {
            isMatch = true;
          }
        }
      }

      if (!isMatch) return false;

      const fCreacion = t.fechaCreacion ? t.fechaCreacion.split('T')[0] : '';
      const fFin = t.fechaFinalizacion ? t.fechaFinalizacion.split('T')[0] : '';
      const fLlamado = t.fechaLlamado ? t.fechaLlamado.split('T')[0] : '';
      return fCreacion === hoyStr || fFin === hoyStr || fLlamado === hoyStr;
    });

    return tickets.map(t => {
      let duracionSegundos = 0;
      const atencionCaja = this.data.atenciones?.find(a => 
        a.ticketId === t.id && (a.cajaId === cajaIdNum || a.cajaId === cajaId || (targetCaja && a.cajaId === targetCaja.id))
      );
      if (atencionCaja && atencionCaja.duracionSegundos) {
        duracionSegundos = atencionCaja.duracionSegundos;
      } else if (t.duracionAtencionSegundos) {
        duracionSegundos = t.duracionAtencionSegundos;
      } else if (t.fechaInicio && t.fechaFinalizacion) {
        duracionSegundos = Math.max(0, Math.floor((new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000));
      }

      let esperaSegundos = 0;
      if (t.duracionEsperaSegundos) {
        esperaSegundos = t.duracionEsperaSegundos;
      } else if (t.fechaCreacion && (t.fechaInicio || t.fechaLlamado)) {
        esperaSegundos = Math.max(0, Math.floor((new Date(t.fechaInicio || t.fechaLlamado!).getTime() - new Date(t.fechaCreacion).getTime()) / 1000));
      }

      const estacionDescriptiva = targetCaja
        ? (targetCaja.tipo === 'TRIADA' ? `Triada ${targetCaja.numero}` : (targetCaja.numero === 0 ? 'Caja 0 (Pref.)' : `Caja ${targetCaja.numero}`))
        : (t.cajaNumero !== undefined ? `Caja ${t.cajaNumero}` : 'Caja');

      return {
        ...t,
        cajaId: cajaIdNum,
        cajaNumero: cajaNumero,
        estacionTexto: estacionDescriptiva,
        duracionSegundos,
        esperaSegundos,
        duracionFormato: `${Math.floor(duracionSegundos / 60)}m ${duracionSegundos % 60}s`,
        esperaFormato: `${Math.floor(esperaSegundos / 60)}m ${esperaSegundos % 60}s`
      };
    }).sort((a, b) => {
      const timeA = a.fechaFinalizacion || a.fechaLlamado || a.fechaCreacion;
      const timeB = b.fechaFinalizacion || b.fechaLlamado || b.fechaCreacion;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }

  // Helper para verificar si una fecha cae en el rango de calendario o predefinido
  public isWithinDateRange(
    dateString: string | null | undefined, 
    fechaInicio?: string, 
    fechaFin?: string, 
    rango: 'diario' | 'semanal' | 'mensual' | 'anual' = 'diario'
  ): boolean {
    if (!dateString) return false;

    // 1. Si se especificó rango por calendario (fechaInicio y/o fechaFin en formato YYYY-MM-DD)
    if (fechaInicio || fechaFin) {
      const start = fechaInicio || fechaFin!;
      const end = fechaFin || fechaInicio!;

      const dateUtc = dateString.split('T')[0];
      const dObj = new Date(dateString);
      const year = dObj.getFullYear();
      const month = String(dObj.getMonth() + 1).padStart(2, '0');
      const day = String(dObj.getDate()).padStart(2, '0');
      const dateLocal = `${year}-${month}-${day}`;

      return (dateUtc >= start && dateUtc <= end) || (dateLocal >= start && dateLocal <= end);
    }

    // 2. Si no, usar los rangos predefinidos
    const now = new Date();
    let limitDate = new Date();
    if (rango === 'diario') {
      limitDate.setHours(0, 0, 0, 0);
    } else if (rango === 'semanal') {
      limitDate.setDate(now.getDate() - 7);
      limitDate.setHours(0, 0, 0, 0);
    } else if (rango === 'mensual') {
      limitDate.setDate(now.getDate() - 30);
      limitDate.setHours(0, 0, 0, 0);
    } else if (rango === 'anual') {
      limitDate.setDate(now.getDate() - 365);
      limitDate.setHours(0, 0, 0, 0);
    }

    const tDate = new Date(dateString);
    return tDate >= limitDate;
  }

  // --- Historial de Caja por Rangos de Tiempo (Calendario de Días o Rangos Predefinidos) ---
  public getHistorialCajaRange(
    cajaId: number, 
    rango: 'diario' | 'semanal' | 'mensual' | 'anual' = 'diario',
    tipo?: 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS',
    sedeId?: string,
    fechaInicio?: string,
    fechaFin?: string
  ) {
    const targetCaja = this.getCajaById(cajaId) || 
      this.data.cajas.find(c => c.id === cajaId || (c.numero === cajaId && (!tipo || tipo === 'TODAS' || tipo === 'AMBOS' || c.tipo === tipo) && (!sedeId || c.sedeId === sedeId)));

    const cajaIdNum = targetCaja ? targetCaja.id : cajaId;
    const cajaNumero = targetCaja ? targetCaja.numero : cajaId;
    const cajaTipo = targetCaja ? targetCaja.tipo : (tipo || (cajaIdNum >= 200 && cajaIdNum % 1000 >= 200 ? 'TRIADA' : 'CAJA'));
    const targetSedeId = targetCaja ? targetCaja.sedeId : sedeId;

    const tickets = this.data.tickets.filter(t => {
      if (targetSedeId && t.sedeId && t.sedeId !== targetSedeId) return false;
      if (sedeId && t.sedeId && t.sedeId !== sedeId) return false;

      let isMatch = false;

      if (cajaTipo === 'CAJA') {
        // Coincidencias exclusivas para CAJA (Ventanillas 0 a 8) - NO MEZCLAR CON TRIADA
        if (cajaNumero === 0 && (t.preferencial || t.codigo?.startsWith('P-') || (Array.isArray(t.cajasHistorialIds) && t.cajasHistorialIds.includes(100)))) {
          isMatch = true;
        } else if (Array.isArray(t.cajasHistorialIds) && (t.cajasHistorialIds.includes(cajaIdNum) || t.cajasHistorialIds.includes(cajaId))) {
          isMatch = true;
        } else if (this.data.atenciones && this.data.atenciones.some(a => 
          a.ticketId === t.id && (a.cajaId === cajaIdNum || a.cajaId === cajaId || (targetCaja && a.cajaId === targetCaja.id))
        )) {
          isMatch = true;
        } else if (this.data.eventos && this.data.eventos.some(e => 
          e.ticketId === t.id && (e.cajaId === cajaIdNum || e.cajaId === cajaId || (targetCaja && e.cajaId === targetCaja.id))
        )) {
          isMatch = true;
        } else if (t.etapa === 'CAJA') {
          if (t.cajaId === cajaIdNum || t.cajaId === cajaId) {
            isMatch = true;
          } else if (t.cajaNumero === cajaNumero) {
            isMatch = true;
          }
        }
      } else if (cajaTipo === 'TRIADA') {
        // Coincidencias exclusivas para TRIADA (Módulos 1 a 8) - NO MEZCLAR CON CAJA
        if (t.etapa === 'TRIADA') {
          if (t.cajaId === cajaIdNum || t.cajaId === cajaId) {
            isMatch = true;
          } else if (t.cajaNumero === cajaNumero) {
            isMatch = true;
          }
        }
        if (!isMatch && Array.isArray(t.cajasHistorialIds)) {
          if (t.cajasHistorialIds.includes(cajaIdNum) || t.cajasHistorialIds.includes(cajaId)) {
            isMatch = true;
          }
        }
        if (!isMatch && this.data.atenciones) {
          if (this.data.atenciones.some(a => 
            a.ticketId === t.id && (a.cajaId === cajaIdNum || a.cajaId === cajaId || (targetCaja && a.cajaId === targetCaja.id))
          )) {
            isMatch = true;
          }
        }
        if (!isMatch && this.data.eventos) {
          if (this.data.eventos.some(e => 
            e.ticketId === t.id && (e.cajaId === cajaIdNum || e.cajaId === cajaId || (targetCaja && e.cajaId === targetCaja.id))
          )) {
            isMatch = true;
          }
        }
      }

      if (!isMatch) return false;

      const tDate = t.fechaFinalizacion || t.fechaLlamado || t.fechaCreacion;
      return this.isWithinDateRange(tDate, fechaInicio, fechaFin, rango);
    });

    return tickets.map(t => {
      let duracionSegundos = 0;
      const atencionCaja = this.data.atenciones?.find(a => 
        a.ticketId === t.id && (a.cajaId === cajaIdNum || a.cajaId === cajaId || (targetCaja && a.cajaId === targetCaja.id))
      );
      if (atencionCaja && atencionCaja.duracionSegundos) {
        duracionSegundos = atencionCaja.duracionSegundos;
      } else if (t.duracionAtencionSegundos) {
        duracionSegundos = t.duracionAtencionSegundos;
      } else if (t.fechaInicio && t.fechaFinalizacion) {
        duracionSegundos = Math.max(0, Math.floor((new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000));
      }

      let esperaSegundos = 0;
      if (t.duracionEsperaSegundos) {
        esperaSegundos = t.duracionEsperaSegundos;
      } else if (t.fechaCreacion && (t.fechaInicio || t.fechaLlamado)) {
        esperaSegundos = Math.max(0, Math.floor((new Date(t.fechaInicio || t.fechaLlamado!).getTime() - new Date(t.fechaCreacion).getTime()) / 1000));
      }

      const estacionDescriptiva = cajaTipo === 'TRIADA'
        ? `Triada ${cajaNumero}`
        : (cajaNumero === 0 ? 'Caja 0 (Pref.)' : `Caja ${cajaNumero}`);

      const funcNombre = atencionCaja?.usuarioId
        ? (this.data.usuarios.find(u => u.id === atencionCaja.usuarioId)?.nombre || t.usuarioNombre || (cajaTipo === 'TRIADA' ? 'Operador de Triada' : 'Funcionario de Caja'))
        : (t.usuarioNombre || (cajaTipo === 'TRIADA' ? 'Operador de Triada' : 'Funcionario de Caja'));

      return {
        ...t,
        etapa: cajaTipo,
        cajaId: cajaIdNum,
        cajaNumero: cajaNumero,
        estacionTexto: estacionDescriptiva,
        usuarioNombre: funcNombre,
        duracionSegundos,
        esperaSegundos,
        duracionFormato: `${Math.floor(duracionSegundos / 60)}m ${duracionSegundos % 60}s`,
        esperaFormato: `${Math.floor(esperaSegundos / 60)}m ${esperaSegundos % 60}s`
      };
    }).sort((a, b) => {
      const timeA = a.fechaFinalizacion || a.fechaLlamado || a.fechaCreacion;
      const timeB = b.fechaFinalizacion || b.fechaLlamado || b.fechaCreacion;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }

  // --- Historial Consolidado para Supervisores (Todas las Cajas o Todas las Triadas o Consolidado General) ---
  public getHistorialGeneralRange(
    tipo: 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS', 
    rango: 'diario' | 'semanal' | 'mensual' | 'anual' = 'diario', 
    sedeId?: string,
    fechaInicio?: string,
    fechaFin?: string
  ) {
    const filterSede = sedeId;
    const items: any[] = [];

    for (const t of this.data.tickets) {
      if (filterSede && t.sedeId && t.sedeId !== filterSede) continue;

      const tDate = t.fechaFinalizacion || t.fechaLlamado || t.fechaCreacion;
      if (!this.isWithinDateRange(tDate, fechaInicio, fechaFin, rango)) continue;

      if (tipo === 'CAJA') {
        // REPORTE EXCLUSIVO DE CAJA (Ventanillas 0 a 8) - NO MEZCLAR CON TRIADA
        const hasCaja = (t.cajasHistorialIds && t.cajasHistorialIds.some(id => id <= 100 || id % 1000 <= 100)) ||
          t.etapa === 'CAJA' ||
          (this.data.atenciones && this.data.atenciones.some(a => a.ticketId === t.id && (a.cajaId <= 100 || a.cajaId % 1000 <= 100))) ||
          (this.data.eventos && this.data.eventos.some(e => (e as any).ticketId === t.id && (e.cajaId ? (e.cajaId <= 100 || e.cajaId % 1000 <= 100) : false))) ||
          (t.etapa === 'TRIADA' && (t.preferencial || (t.codigo && !t.codigo.startsWith('TR'))));

        if (!hasCaja) continue;

        let cajaNum = 1;
        if (t.cajasHistorialIds) {
          const cajaHistId = t.cajasHistorialIds.find(id => id <= 100 || id % 1000 <= 100);
          if (cajaHistId !== undefined) {
            cajaNum = cajaHistId === 100 ? 0 : (cajaHistId % 1000);
          }
        } else {
          const at = this.data.atenciones?.find(a => a.ticketId === t.id && (a.cajaId <= 100 || a.cajaId % 1000 <= 100));
          if (at) {
            cajaNum = at.cajaId === 100 ? 0 : (at.cajaId % 1000);
          } else {
            const ev = this.data.eventos?.find(e => (e as any).ticketId === t.id && e.cajaId && (e.cajaId <= 100 || e.cajaId % 1000 <= 100));
            if (ev && ev.cajaId) {
              cajaNum = ev.cajaId === 100 ? 0 : (ev.cajaId % 1000);
            }
          }
        }
        if (t.preferencial && (cajaNum === 1 || cajaNum === 0) && t.codigo?.startsWith('P-')) {
          cajaNum = 0;
        }

        const atencionCaja = this.data.atenciones?.find(a => 
          a.ticketId === t.id && (a.cajaId <= 100 || a.cajaId % 1000 <= 100)
        );

        let duracionSegundos = atencionCaja?.duracionSegundos || t.duracionAtencionSegundos || 0;
        if (!duracionSegundos && t.fechaInicio && t.fechaFinalizacion) {
          duracionSegundos = Math.max(0, Math.floor((new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000));
        }

        let esperaSegundos = t.duracionEsperaSegundos || 0;
        if (!esperaSegundos && t.fechaCreacion && t.fechaLlamado) {
          esperaSegundos = Math.max(0, Math.floor((new Date(t.fechaLlamado).getTime() - new Date(t.fechaCreacion).getTime()) / 1000));
        }

        const estacionTexto = cajaNum === 0 ? 'Caja 0 (Pref.)' : `Caja ${cajaNum}`;
        const funcNombre = atencionCaja?.usuarioId 
          ? (this.data.usuarios.find(u => u.id === atencionCaja.usuarioId)?.nombre || t.usuarioNombre || 'Funcionario de Caja')
          : (t.usuarioNombre || 'Funcionario de Caja');

        items.push({
          ...t,
          etapa: 'CAJA',
          cajaNumero: cajaNum,
          cajaId: cajaNum === 0 ? 100 : cajaNum,
          estacionTexto,
          usuarioNombre: funcNombre,
          duracionSegundos,
          esperaSegundos,
          duracionFormato: `${Math.floor(duracionSegundos / 60)}m ${duracionSegundos % 60}s`,
          esperaFormato: `${Math.floor(esperaSegundos / 60)}m ${esperaSegundos % 60}s`
        });

      } else if (tipo === 'TRIADA') {
        // REPORTE EXCLUSIVO DE TRIADA (Módulos 1 a 8) - NO MEZCLAR CON CAJA
        const hasTriada = t.etapa === 'TRIADA' || 
          (t.cajasHistorialIds && t.cajasHistorialIds.some(id => (id >= 200 && id <= 208) || id % 1000 >= 200)) ||
          (t.cajaId && (t.cajaId >= 200 || t.cajaId % 1000 >= 200)) ||
          (this.data.atenciones && this.data.atenciones.some(a => a.ticketId === t.id && (a.cajaId >= 200 || a.cajaId % 1000 >= 200))) ||
          (this.data.eventos && this.data.eventos.some(e => (e as any).ticketId === t.id && (e.cajaId ? (e.cajaId >= 200 || e.cajaId % 1000 >= 200) : false)));

        if (!hasTriada) continue;

        let triadaNum = t.cajaNumero !== undefined ? t.cajaNumero : 1;
        if (t.cajasHistorialIds) {
          const triadaHistId = t.cajasHistorialIds.find(id => (id >= 200 && id <= 208) || id % 1000 >= 200);
          if (triadaHistId !== undefined) {
            triadaNum = (triadaHistId % 1000) - 200;
            if (triadaNum < 1 || triadaNum > 8) triadaNum = t.cajaNumero || 1;
          }
        }

        const atencionTriada = this.data.atenciones?.find(a => 
          a.ticketId === t.id && (a.cajaId >= 200 || a.cajaId % 1000 >= 200)
        );

        let duracionSegundos = atencionTriada?.duracionSegundos || t.duracionAtencionSegundos || 0;
        if (!duracionSegundos && t.fechaInicio && t.fechaFinalizacion) {
          duracionSegundos = Math.max(0, Math.floor((new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000));
        }

        let esperaSegundos = t.duracionEsperaSegundos || 0;
        if (!esperaSegundos && t.fechaCreacion && t.fechaLlamado) {
          esperaSegundos = Math.max(0, Math.floor((new Date(t.fechaLlamado).getTime() - new Date(t.fechaCreacion).getTime()) / 1000));
        }

        const estacionTexto = `Triada ${triadaNum}`;
        const funcNombre = atencionTriada?.usuarioId
          ? (this.data.usuarios.find(u => u.id === atencionTriada.usuarioId)?.nombre || t.usuarioNombre || 'Operador de Triada')
          : (t.usuarioNombre || 'Operador de Triada');

        items.push({
          ...t,
          etapa: 'TRIADA',
          cajaNumero: triadaNum,
          cajaId: 200 + triadaNum,
          estacionTexto,
          usuarioNombre: funcNombre,
          duracionSegundos,
          esperaSegundos,
          duracionFormato: `${Math.floor(duracionSegundos / 60)}m ${duracionSegundos % 60}s`,
          esperaFormato: `${Math.floor(esperaSegundos / 60)}m ${esperaSegundos % 60}s`
        });

      } else {
        // CONSOLIDADO GENERAL (TODAS) - EXCLUSIVO PARA SUPER ADMIN
        // "en el consolidado debe aparecer los turnos finalizados tanto de caja como de triada"
        const hasCaja = (t.cajasHistorialIds && t.cajasHistorialIds.some(id => id <= 100 || id % 1000 <= 100)) ||
          t.etapa === 'CAJA' ||
          (this.data.atenciones && this.data.atenciones.some(a => a.ticketId === t.id && (a.cajaId <= 100 || a.cajaId % 1000 <= 100))) ||
          (this.data.eventos && this.data.eventos.some(e => (e as any).ticketId === t.id && (e.cajaId ? (e.cajaId <= 100 || e.cajaId % 1000 <= 100) : false))) ||
          (t.etapa === 'TRIADA' && (t.preferencial || (t.codigo && !t.codigo.startsWith('TR'))));
        
        const hasTriada = t.etapa === 'TRIADA' || 
          (t.cajasHistorialIds && t.cajasHistorialIds.some(id => (id >= 200 && id <= 208) || id % 1000 >= 200)) ||
          (t.cajaId && (t.cajaId >= 200 || t.cajaId % 1000 >= 200)) ||
          (this.data.atenciones && this.data.atenciones.some(a => a.ticketId === t.id && (a.cajaId >= 200 || a.cajaId % 1000 >= 200))) ||
          (this.data.eventos && this.data.eventos.some(e => (e as any).ticketId === t.id && (e.cajaId ? (e.cajaId >= 200 || e.cajaId % 1000 >= 200) : false)));

        // Registro de atención en Caja
        if (hasCaja) {
          let cajaNum = 1;
          if (t.cajasHistorialIds) {
            const cId = t.cajasHistorialIds.find(id => id <= 100 || id % 1000 <= 100);
            if (cId !== undefined) cajaNum = cId === 100 ? 0 : (cId % 1000);
          } else {
            const at = this.data.atenciones?.find(a => a.ticketId === t.id && (a.cajaId <= 100 || a.cajaId % 1000 <= 100));
            if (at) {
              cajaNum = at.cajaId === 100 ? 0 : (at.cajaId % 1000);
            } else {
              const ev = this.data.eventos?.find(e => (e as any).ticketId === t.id && e.cajaId && (e.cajaId <= 100 || e.cajaId % 1000 <= 100));
              if (ev && ev.cajaId) {
                cajaNum = ev.cajaId === 100 ? 0 : (ev.cajaId % 1000);
              }
            }
          }
          if (t.preferencial && (cajaNum === 1 || cajaNum === 0) && t.codigo?.startsWith('P-')) {
            cajaNum = 0;
          }

          const atencionCaja = this.data.atenciones?.find(a => 
            a.ticketId === t.id && (a.cajaId <= 100 || a.cajaId % 1000 <= 100)
          );

          let duracionSegundos = atencionCaja?.duracionSegundos || t.duracionAtencionSegundos || 60;
          let esperaSegundos = t.duracionEsperaSegundos || 120;

          items.push({
            ...t,
            id: `${t.id}-caja`,
            etapa: 'CAJA',
            cajaNumero: cajaNum,
            cajaId: cajaNum === 0 ? 100 : cajaNum,
            estacionTexto: cajaNum === 0 ? 'Caja 0 (Pref.)' : `Caja ${cajaNum}`,
            usuarioNombre: atencionCaja?.usuarioId 
              ? (this.data.usuarios.find(u => u.id === atencionCaja.usuarioId)?.nombre || t.usuarioNombre || 'Funcionario Caja')
              : (t.usuarioNombre || 'Funcionario Caja'),
            duracionSegundos,
            esperaSegundos,
            duracionFormato: `${Math.floor(duracionSegundos / 60)}m ${duracionSegundos % 60}s`,
            esperaFormato: `${Math.floor(esperaSegundos / 60)}m ${esperaSegundos % 60}s`
          });
        }

        // Registro de atención en Triada
        if (hasTriada) {
          let triadaNum = t.cajaNumero !== undefined ? t.cajaNumero : 1;
          if (t.cajasHistorialIds) {
            const trId = t.cajasHistorialIds.find(id => (id >= 200 && id <= 208) || id % 1000 >= 200);
            if (trId !== undefined) {
              triadaNum = (trId % 1000) - 200;
              if (triadaNum < 1 || triadaNum > 8) triadaNum = t.cajaNumero || 1;
            }
          }

          const atencionTriada = this.data.atenciones?.find(a => 
            a.ticketId === t.id && (a.cajaId >= 200 || a.cajaId % 1000 >= 200)
          );

          let duracionSegundos = atencionTriada?.duracionSegundos || t.duracionAtencionSegundos || 60;
          let esperaSegundos = t.duracionEsperaSegundos || 60;

          items.push({
            ...t,
            id: `${t.id}-triada`,
            etapa: 'TRIADA',
            cajaNumero: triadaNum,
            cajaId: 200 + triadaNum,
            estacionTexto: `Triada ${triadaNum}`,
            usuarioNombre: atencionTriada?.usuarioId
              ? (this.data.usuarios.find(u => u.id === atencionTriada.usuarioId)?.nombre || t.usuarioNombre || 'Operador Triada')
              : (t.usuarioNombre || 'Operador Triada'),
            duracionSegundos,
            esperaSegundos,
            duracionFormato: `${Math.floor(duracionSegundos / 60)}m ${duracionSegundos % 60}s`,
            esperaFormato: `${Math.floor(esperaSegundos / 60)}m ${esperaSegundos % 60}s`
          });
        }

        if (!hasCaja && !hasTriada) {
          items.push({
            ...t,
            estacionTexto: t.cajaNumero !== undefined ? `Caja ${t.cajaNumero}` : 'Atención',
            duracionSegundos: t.duracionAtencionSegundos || 0,
            esperaSegundos: t.duracionEsperaSegundos || 0,
            duracionFormato: '0m 0s',
            esperaFormato: '0m 0s'
          });
        }
      }
    }

    return items.sort((a, b) => {
      const timeA = a.fechaFinalizacion || a.fechaLlamado || a.fechaCreacion;
      const timeB = b.fechaFinalizacion || b.fechaLlamado || b.fechaCreacion;
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });
  }

  // --- Cajas ---
  public getCajas(sedeId?: string): Caja[] {
    if (sedeId) {
      return this.data.cajas.filter(c => c.sedeId === sedeId);
    }
    return this.data.cajas;
  }

  public getCajaById(id: number): Caja | undefined {
    return this.data.cajas.find(c => c.id === id);
  }

  public updateCaja(id: number, patch: Partial<Caja>): Caja | null {
    const caja = this.data.cajas.find(c => c.id === id);
    if (!caja) return null;
    Object.assign(caja, patch, { ultimaActividad: new Date().toISOString() });
    this.scheduleSave();
    this.syncToSupabase('cajas', caja);
    return caja;
  }

  public toggleCajaActiva(id: number, activa: boolean): Caja | null {
    const caja = this.data.cajas.find(c => c.id === id);
    if (!caja) return null;
    caja.activa = activa;
    if (!activa && caja.estado === 'DISPONIBLE') {
      caja.estado = 'INACTIVA';
    }
    this.scheduleSave();
    this.syncToSupabase('cajas', caja);
    return caja;
  }

  public reiniciarCaja(cajaId: number, ticketIdOpcional?: string): { caja: Caja; ticket: Ticket | null } | null {
    const caja = this.data.cajas.find(c => c.id === cajaId);
    if (!caja) return null;

    const now = new Date().toISOString();

    // 1. Buscar el ticket a restaurar
    let ticket: Ticket | null = null;

    if (ticketIdOpcional) {
      ticket = this.data.tickets.find(t => t.id === ticketIdOpcional) || null;
    }

    // Si no se pasó ticket específico, buscar el ticket actual de la caja
    if (!ticket && caja.ticketActualId) {
      ticket = this.data.tickets.find(t => t.id === caja.ticketActualId) || null;
    }

    // Si aún no hay ticket, buscar cualquier ticket activo vinculado a esta caja
    if (!ticket) {
      ticket = this.data.tickets.find(t => 
        t.cajaId === caja.id && 
        (t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION')
      ) || null;
    }

    // Si aún no hay, buscar el último ticket histórico o atascado asociado a esta caja
    if (!ticket) {
      const ticketsCaja = this.data.tickets
        .filter(t => t.cajaId === caja.id && (t.sedeId === caja.sedeId || !t.sedeId))
        .sort((a, b) => new Date(b.fechaAsignacion || b.fechaCreacion).getTime() - new Date(a.fechaAsignacion || a.fechaCreacion).getTime());
      if (ticketsCaja.length > 0) {
        ticket = ticketsCaja[0];
      }
    }

    // Si aún no hay y hay turnos en espera para esta etapa, tomar el primer turno en espera
    if (!ticket) {
      const etapaBuscada = caja.tipo === 'TRIADA' ? 'TRIADA' : 'CAJA';
      const enEspera = this.data.tickets
        .filter(t => t.estado === 'ESPERANDO' && (t.etapa === etapaBuscada || (!t.etapa && etapaBuscada === 'CAJA')) && (t.sedeId === caja.sedeId || !t.sedeId))
        .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());
      if (enEspera.length > 0) {
        ticket = enEspera[0];
      }
    }

    // 2. Si se encontró el ticket: restaurarlo al estado ASIGNADO en esta caja para poder avanzar
    if (ticket) {
      ticket.estado = 'ASIGNADO';
      ticket.cajaId = caja.id;
      ticket.cajaNumero = caja.numero;
      ticket.usuarioId = caja.usuarioActualId || ticket.usuarioId || null;
      ticket.usuarioNombre = caja.usuarioNombre || ticket.usuarioNombre || null;
      ticket.etapa = caja.tipo === 'TRIADA' ? 'TRIADA' : 'CAJA';
      ticket.fechaAsignacion = now;
      ticket.fechaLlamado = null;
      ticket.fechaInicio = null;
      ticket.fechaFinalizacion = null;
      ticket.duracionAtencionSegundos = undefined;
      ticket.llamadosContador = 0;

      caja.activa = true;
      caja.estado = 'OCUPADA';
      caja.ticketActualId = ticket.id;
      caja.ticketActualCodigo = ticket.codigo;
      caja.ultimaActividad = now;

      this.scheduleSave();
      this.syncToSupabase('tickets', ticket);
      this.syncToSupabase('cajas', caja);

      return { caja, ticket };
    } else {
      // Si no había ningún ticket para restaurar, reiniciar la caja limpia
      const estadoCaja = (caja.activa && caja.usuarioActualId) ? 'DISPONIBLE' : 'DESCONECTADA';
      caja.activa = true;
      caja.estado = estadoCaja;
      caja.ticketActualId = null;
      caja.ticketActualCodigo = null;
      caja.ultimaActividad = now;

      this.scheduleSave();
      this.syncToSupabase('cajas', caja);

      return { caja, ticket: null };
    }
  }

  // --- Tickets ---
  public getTickets(sedeId?: string): Ticket[] {
    if (sedeId) {
      return this.data.tickets.filter(t => t.sedeId === sedeId);
    }
    return [...this.data.tickets];
  }

  public getTicketById(id: string): Ticket | undefined {
    return this.data.tickets.find(t => t.id === id);
  }

  public createTicket(
    tramite = 'Cedulación',
    prefijo = 'C',
    ciudadanoNombre?: string,
    ciudadanoApellido?: string,
    preferencial = false,
    sedeId = 'ancon'
  ): Ticket {
    const correlativoKey = `${sedeId}_${preferencial ? 'P_' : ''}${prefijo}`;
    const actual = (this.data.ultimoCorrelativo[correlativoKey] || 0) + 1;
    this.data.ultimoCorrelativo[correlativoKey] = actual;

    const numeroPadded = actual.toString().padStart(3, '0');
    const codigo = preferencial ? `P-${prefijo}${numeroPadded}` : `${prefijo}${numeroPadded}`;
    const now = new Date().toISOString();

    // Si es preferencial, activar y asegurar disponibilidad de Caja 0 (Ventanilla Preferencial)
    if (preferencial) {
      const caja0 = this.data.cajas.find(c => c.sedeId === sedeId && c.numero === 0);
      if (caja0) {
        caja0.activa = true;
        if (caja0.estado === 'INACTIVA' || caja0.estado === 'DESCONECTADA') {
          // Mantener o preparar estado para recibir
        }
      }
    }

    const nuevo: Ticket = {
      id: `ticket-${preferencial ? 'pref-' : ''}${prefijo}-${actual}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      numero: actual,
      codigo,
      tramite,
      prefijo,
      ciudadanoNombre: ciudadanoNombre?.trim() || null,
      ciudadanoApellido: ciudadanoApellido?.trim() || null,
      estado: 'ESPERANDO',
      cajaId: null,
      cajaNumero: null,
      usuarioId: null,
      usuarioNombre: null,
      fechaCreacion: now,
      fechaAsignacion: null,
      fechaLlamado: null,
      fechaInicio: null,
      fechaFinalizacion: null,
      llamadosContador: 0,
      etapa: 'CAJA',
      preferencial: Boolean(preferencial),
      sedeId
    };

    this.data.tickets.push(nuevo);
    this.scheduleSave();
    this.syncToSupabase('tickets', nuevo);
    return nuevo;
  }

  public updateTicket(id: string, patch: Partial<Ticket>): Ticket | null {
    const ticket = this.data.tickets.find(t => t.id === id);
    if (!ticket) return null;
    Object.assign(ticket, patch);
    this.scheduleSave();
    this.syncToSupabase('tickets', ticket);
    return ticket;
  }

  // --- Atenciones ---
  public recordAtencion(atencion: Omit<Atencion, 'id'>): Atencion {
    const item: Atencion = {
      ...atencion,
      id: `atn-${Date.now()}`
    };
    this.data.atenciones.push(item);
    this.scheduleSave();
    return item;
  }

  public getAtenciones(): Atencion[] {
    return this.data.atenciones || [];
  }

  // --- Eventos / Auditoría ---
  public recordEvento(evento: EventoRealtime): void {
    this.data.eventos.unshift(evento);
    if (this.data.eventos.length > 500) {
      this.data.eventos.length = 500;
    }
    this.scheduleSave();
    
    this.syncToSupabase('tracking_tickets', {
      ticketId: evento.payload?.id || evento.codigo || '',
      tipoEvento: evento.type,
      numero: evento.payload?.numero?.toString() || '',
      codigo: evento.codigo || '',
      caja: evento.caja,
      cajaId: evento.cajaId,
      funcionario: evento.funcionario || '',
      ciudadano: evento.ciudadano || '',
      sedeId: evento.sedeId || 'ancon',
      payload: evento.payload || {},
      timestamp: evento.timestamp || new Date().toISOString()
    });
  }

  public getEventos(limit = 100): EventoRealtime[] {
    return this.data.eventos.slice(0, limit);
  }

  // --- Métricas y Estadísticas ---
  public getMetricas(sedeId?: string): MetricasSistema {
    const filterSede = sedeId || 'ancon';
    const tickets = this.data.tickets.filter(t => t.sedeId === filterSede);
    const finalizados = tickets.filter(t => t.estado === 'FINALIZADO');
    const noPresentaron = tickets.filter(t => t.estado === 'NO_PRESENTO');
    const esperando = tickets.filter(t => t.estado === 'ESPERANDO');
    const enAtencion = tickets.filter(t => t.estado === 'EN_ATENCION' || t.estado === 'LLAMANDO' || t.estado === 'ASIGNADO');

    let totalEsperaSegundos = 0;
    let countConEspera = 0;
    let totalAtencionSegundos = 0;
    let countConAtencion = 0;
    let totalLatenciaAsignacionMs = 0;
    let countConAsignacion = 0;

    for (const t of tickets) {
      if (t.fechaCreacion && t.fechaAsignacion) {
        const ms = new Date(t.fechaAsignacion).getTime() - new Date(t.fechaCreacion).getTime();
        if (ms >= 0) {
          totalLatenciaAsignacionMs += ms;
          countConAsignacion++;
        }
      }

      if (t.fechaCreacion && t.fechaInicio) {
        const sec = (new Date(t.fechaInicio).getTime() - new Date(t.fechaCreacion).getTime()) / 1000;
        if (sec >= 0) {
          totalEsperaSegundos += sec;
          countConEspera++;
        }
      }

      if (t.fechaInicio && t.fechaFinalizacion) {
        const sec = (new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000;
        if (sec >= 0) {
          totalAtencionSegundos += sec;
          countConAtencion++;
        }
      }
    }

    return {
      totalTicketsHoy: tickets.length,
      esperandoCount: esperando.length,
      enAtencionCount: enAtencion.length,
      finalizadosCount: finalizados.length,
      noPresentaronCount: noPresentaron.length,
      tiempoPromedioEsperaSegundos: countConEspera > 0 ? Math.round(totalEsperaSegundos / countConEspera) : 0,
      tiempoPromedioAtencionSegundos: countConAtencion > 0 ? Math.round(totalAtencionSegundos / countConAtencion) : 0,
      latenciaAsignacionPromedioMs: countConAsignacion > 0 ? Math.round(totalLatenciaAsignacionMs / countConAsignacion) : 0
    };
  }

  // --- Snapshot Global ---
  public getSnapshot(sedeId?: string): EstadoGlobalSnapshot {
    const filterSede = sedeId || 'ancon';
    const tickets = this.data.tickets.filter(t => t.sedeId === filterSede);
    const ticketsEsperando = tickets.filter(t => t.estado === 'ESPERANDO');
    const ticketsActivos = tickets.filter(t => 
      t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION'
    );

    // Últimos turnos llamados para la pantalla pública (ordenados por fechaLlamado descendente)
    const ultimosLlamados = tickets
      .filter(t => t.fechaLlamado !== null && (t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION' || t.estado === 'FINALIZADO'))
      .sort((a, b) => new Date(b.fechaLlamado!).getTime() - new Date(a.fechaLlamado!).getTime())
      .slice(0, 16);

    // Para la pantalla pública, el turno mostrado activo es exclusivamente el que está siendo LLAMADO en este momento.
    // Al dar "Iniciar atención" en caja o triada, el ticket pasa a EN_ATENCION y debe irse de la pantalla.
    const ticketsLlamando = tickets
      .filter(t => t.fechaLlamado !== null && t.estado === 'LLAMANDO')
      .sort((a, b) => new Date(b.fechaLlamado!).getTime() - new Date(a.fechaLlamado!).getTime());

    const ultimoLlamadoGlobal = ticketsLlamando.length > 0 ? ticketsLlamando[0] : null;

    return {
      cajas: this.getCajas(filterSede),
      ticketsEsperando,
      ticketsActivos,
      ultimosLlamados,
      metricas: this.getMetricas(filterSede),
      ultimoLlamadoGlobal
    };
  }

  // Reset para pruebas automatizadas o demostraciones si se desea
  public resetTestData(): void {
    this.data.tickets = [];
    this.data.atenciones = [];
    this.data.eventos = [];
    this.data.ultimoCorrelativo = { C: 0, E: 0, O: 0, R: 0 };
    this.data.cajas = SEED_CAJAS.map(c => ({
      ...c,
      estado: 'DESCONECTADA',
      usuarioActualId: null,
      usuarioNombre: null,
      ticketActualId: null,
      ticketActualCodigo: null,
      activa: true
    }));
    this.scheduleSave();
  }

  // --- Personalización Visual e Identidad Institucional ---
  public getConfiguracionVisual(): ConfiguracionVisual {
    if (!this.data.configuracionVisual) {
      this.data.configuracionVisual = { ...DEFAULT_CONFIGURACION_VISUAL };
    }
    return { ...this.data.configuracionVisual };
  }

  public updateConfiguracionVisual(patch: Partial<ConfiguracionVisual>): ConfiguracionVisual {
    if (!this.data.configuracionVisual) {
      this.data.configuracionVisual = { ...DEFAULT_CONFIGURACION_VISUAL };
    }
    this.data.configuracionVisual = {
      ...this.data.configuracionVisual,
      ...patch
    };
    this.scheduleSave();
    return { ...this.data.configuracionVisual };
  }

  public resetConfiguracionVisual(): ConfiguracionVisual {
    this.data.configuracionVisual = { ...DEFAULT_CONFIGURACION_VISUAL };
    this.scheduleSave();
    return { ...this.data.configuracionVisual };
  }

  public async diagnosticarSupabase() {
    const urlConfigured = !!supabaseUrl;
    const keyConfigured = !!supabaseKey;
    let databaseConnection = false;
    let regionalesQuery = false;
    let regionalesCount = 0;
    let errorMsg = null;

    if (supabase) {
      try {
        const { data, error, count } = await supabase
          .from('regionales')
          .select('*', { count: 'exact' });
        
        if (error) {
          errorMsg = error.message;
        } else {
          databaseConnection = true;
          regionalesQuery = true;
          regionalesCount = count !== null && count !== undefined ? count : (data ? data.length : 0);
        }
      } catch (err: any) {
        errorMsg = err.message || err;
      }
    }

    return {
      supabase_url_configured: urlConfigured,
      supabase_key_configured: keyConfigured,
      database_connection: databaseConnection,
      regionales_query: regionalesQuery,
      regionales_count: regionalesCount,
      ...(errorMsg ? { error_details: errorMsg } : {})
    };
  }
}

export const db = new Database();
