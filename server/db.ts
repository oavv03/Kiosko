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
  pantallaFondoValor: '#0B1329'
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

// Semilla inicial predeterminada
// Semilla inicial predeterminada
const SEED_USUARIOS: Usuario[] = [
  {
    id: 'user-superadmin',
    nombre: 'Super Administrador',
    usuario: 'superadmin',
    email: 'superadmin@institucion.gob',
    password: 'admin',
    rol: 'SUPER_ADMIN',
    activo: true,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-admin',
    nombre: 'Administrador General',
    usuario: 'admin',
    email: 'admin@institucion.gob',
    password: 'admin',
    rol: 'SUPER_ADMIN',
    activo: true,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-juan',
    nombre: 'Juan Pérez',
    usuario: 'juan',
    email: 'juan.perez@institucion.gob',
    password: '123',
    rol: 'FUNCIONARIO',
    activo: true,
    cajaAsignadaId: 1,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-maria',
    nombre: 'María Gómez',
    usuario: 'maria',
    email: 'maria.gomez@institucion.gob',
    password: '123',
    rol: 'FUNCIONARIO',
    activo: true,
    cajaAsignadaId: 2,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-carlos',
    nombre: 'Carlos Díaz',
    usuario: 'carlos',
    email: 'carlos.diaz@institucion.gob',
    password: '123',
    rol: 'FUNCIONARIO',
    activo: true,
    cajaAsignadaId: 3,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-ana',
    nombre: 'Ana Torres',
    usuario: 'ana',
    email: 'ana.torres@institucion.gob',
    password: '123',
    rol: 'FUNCIONARIO',
    activo: true,
    cajaAsignadaId: 4,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-triada1',
    nombre: 'Fotógrafo Triada 1',
    usuario: 'triada1',
    email: 'triada1@institucion.gob',
    password: '123',
    rol: 'FUNCIONARIO',
    activo: true,
    cajaAsignadaId: 201,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
  },
  {
    id: 'user-triada2',
    nombre: 'Fotógrafo Triada 2',
    usuario: 'triada2',
    email: 'triada2@institucion.gob',
    password: '123',
    rol: 'FUNCIONARIO',
    activo: true,
    cajaAsignadaId: 202,
    sedeId: 'ancon',
    fechaCreacion: new Date().toISOString()
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
      // Evitar guardar socketId o estados volátiles si existieran
    }
    return res;
  }

  private mapFromSupabase(table: string, record: any): any {
    const res: any = {};
    for (const k of Object.keys(record)) {
      const camel = k.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      res[camel] = record[k];
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
      
      // 1. Cargar Usuarios
      const { data: dbUsuarios, error: errU } = await supabase.from('usuarios').select('*');
      if (errU) throw errU;
      if (dbUsuarios && dbUsuarios.length > 0) {
        this.data.usuarios = dbUsuarios.map((u: any) => this.mapFromSupabase('usuarios', u));
      }

      // 2. Cargar Cajas
      const { data: dbCajas, error: errC } = await supabase.from('cajas').select('*');
      if (errC) throw errC;
      if (dbCajas && dbCajas.length > 0) {
        this.data.cajas = dbCajas.map((c: any) => this.mapFromSupabase('cajas', c));
      }

      // 3. Cargar Tickets
      const { data: dbTickets, error: errT } = await supabase.from('tickets').select('*');
      if (errT) throw errT;
      if (dbTickets && dbTickets.length > 0) {
        this.data.tickets = dbTickets.map((t: any) => this.mapFromSupabase('tickets', t));
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
          if (!c.tipo) {
            c.tipo = 'CAJA';
          }
          if (!c.sedeId) {
            c.sedeId = 'ancon';
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

        // Garantizar que usuarios tengan usuario, contraseña y existan los usuarios semilla
        for (const su of SEED_USUARIOS) {
          const existing = parsed.usuarios.find(u => u.id === su.id || u.usuario === su.usuario);
          if (!existing) {
            parsed.usuarios.push({ ...su });
          } else {
            if (su.rol === 'SUPER_ADMIN') {
              existing.rol = 'SUPER_ADMIN';
            }
            if (!existing.sedeId) {
              existing.sedeId = su.sedeId || 'ancon';
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
        (u.email && u.email.toLowerCase() === cleanUser)
      )
    );
    if (!found) return null;
    // Si tiene contraseña configurada, verificarla
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
  public getHistorialCajaHoy(cajaId: number) {
    const hoyStr = new Date().toISOString().split('T')[0];
    const tickets = this.data.tickets.filter(t => {
      if (t.cajaId !== cajaId) return false;
      const fCreacion = t.fechaCreacion ? t.fechaCreacion.split('T')[0] : '';
      const fFin = t.fechaFinalizacion ? t.fechaFinalizacion.split('T')[0] : '';
      const fLlamado = t.fechaLlamado ? t.fechaLlamado.split('T')[0] : '';
      return fCreacion === hoyStr || fFin === hoyStr || fLlamado === hoyStr;
    });

    return tickets.map(t => {
      let duracionSegundos = 0;
      if (t.fechaInicio && t.fechaFinalizacion) {
        duracionSegundos = Math.max(0, Math.floor((new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000));
      }
      let esperaSegundos = 0;
      if (t.fechaCreacion && t.fechaLlamado) {
        esperaSegundos = Math.max(0, Math.floor((new Date(t.fechaLlamado).getTime() - new Date(t.fechaCreacion).getTime()) / 1000));
      }

      return {
        ...t,
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

  // --- Historial de Caja por Rangos de Tiempo (Diario, Semanal, Mensual, Anual) ---
  public getHistorialCajaRange(cajaId: number, rango: 'diario' | 'semanal' | 'mensual' | 'anual') {
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

    const tickets = this.data.tickets.filter(t => {
      if (t.cajaId !== cajaId) return false;
      const tDate = new Date(t.fechaFinalizacion || t.fechaLlamado || t.fechaCreacion);
      return tDate >= limitDate;
    });

    return tickets.map(t => {
      let duracionSegundos = 0;
      if (t.fechaInicio && t.fechaFinalizacion) {
        duracionSegundos = Math.max(0, Math.floor((new Date(t.fechaFinalizacion).getTime() - new Date(t.fechaInicio).getTime()) / 1000));
      }
      let esperaSegundos = 0;
      if (t.fechaCreacion && t.fechaLlamado) {
        esperaSegundos = Math.max(0, Math.floor((new Date(t.fechaLlamado).getTime() - new Date(t.fechaCreacion).getTime()) / 1000));
      }

      return {
        ...t,
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
