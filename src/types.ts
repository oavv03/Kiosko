export interface Sede {
  id: string;
  nombre: string;
  ubicacion: string;
  configPantallas: 'INDEPENDIENTE' | 'ALTERNADO';
}

export const SEDES: Sede[] = [
  { id: 'ancon', nombre: 'Tribunal Electoral de Panamá — Sede Principal de Ancón', ubicacion: 'Avenida Omar Torrijos Herrera, Ancón', configPantallas: 'INDEPENDIENTE' },
  { id: 'bocas_del_toro', nombre: 'Dirección Regional de Bocas del Toro', ubicacion: 'Bocas del Toro', configPantallas: 'ALTERNADO' },
  { id: 'cocle', nombre: 'Dirección Regional de Coclé', ubicacion: 'Coclé', configPantallas: 'ALTERNADO' },
  { id: 'colon', nombre: 'Dirección Regional de Colón', ubicacion: 'Colón', configPantallas: 'ALTERNADO' },
  { id: 'chiriqui', nombre: 'Dirección Regional de Chiriquí', ubicacion: 'Chiriquí', configPantallas: 'ALTERNADO' },
  { id: 'darien', nombre: 'Dirección Regional de Darién', ubicacion: 'Darién', configPantallas: 'ALTERNADO' },
  { id: 'herrera', nombre: 'Dirección Regional de Herrera', ubicacion: 'Herrera', configPantallas: 'ALTERNADO' },
  { id: 'los_santos', nombre: 'Dirección Regional de Los Santos', ubicacion: 'Los Santos', configPantallas: 'ALTERNADO' },
  { id: 'panama_centro', nombre: 'Dirección Regional de Panamá Centro', ubicacion: 'Panamá Centro', configPantallas: 'ALTERNADO' },
  { id: 'panama_norte', nombre: 'Dirección Regional de Panamá Norte', ubicacion: 'Panamá Norte', configPantallas: 'ALTERNADO' },
  { id: 'panama_este', nombre: 'Dirección Regional de Panamá Este', ubicacion: 'Panamá Este', configPantallas: 'ALTERNADO' },
  { id: 'panama_oeste', nombre: 'Dirección Regional de Panamá Oeste', ubicacion: 'Panamá Oeste', configPantallas: 'ALTERNADO' },
  { id: 'san_miguelito', nombre: 'Dirección Regional de San Miguelito', ubicacion: 'San Miguelito', configPantallas: 'ALTERNADO' },
  { id: 'veraguas', nombre: 'Dirección Regional de Veraguas', ubicacion: 'Veraguas', configPantallas: 'ALTERNADO' },
  { id: 'guna_yala', nombre: 'Dirección Regional de Guna Yala', ubicacion: 'Guna Yala', configPantallas: 'ALTERNADO' },
  { id: 'arraijan', nombre: 'Regional Especial de Arraiján', ubicacion: 'Arraiján', configPantallas: 'ALTERNADO' },
];

export type RolUsuario = 'SUPER_ADMIN' | 'ADMINISTRADOR' | 'FUNCIONARIO' | 'PANTALLA';

export type EstadoCaja = 'DISPONIBLE' | 'OCUPADA' | 'INACTIVA' | 'DESCONECTADA';

export type EstadoTicket = 
  | 'ESPERANDO'
  | 'ASIGNADO'
  | 'LLAMANDO'
  | 'EN_ATENCION'
  | 'FINALIZADO'
  | 'NO_PRESENTO'
  | 'CANCELADO';

export type TipoEvento =
  | 'TICKET_CREADO'
  | 'TICKET_ASIGNADO'
  | 'TICKET_LLAMADO'
  | 'TICKET_EN_ATENCION'
  | 'TICKET_FINALIZADO'
  | 'TICKET_NO_PRESENTO'
  | 'TICKET_CANCELADO'
  | 'CAJA_CONECTADA'
  | 'CAJA_DESCONECTADA'
  | 'CAJA_DISPONIBLE'
  | 'CAJA_OCUPADA'
  | 'ESTADO_SISTEMA'
  | 'CONFIGURACION_ACTUALIZADA'
  | 'PONG';

export interface ConfiguracionVisual {
  nombreSistema: string;
  nombreInstitucion: string;
  nombreCorto: string;
  tituloNavegador: string;
  textoBienvenida: string;
  pieDePagina: string;
  version: string;
  nombreApp: string;

  logoPrincipalUrl: string;
  logoMovilUrl: string;
  faviconUrl: string;

  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonColor: string;
  buttonHoverColor: string;
  headerColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;

  fontFamily: string;
  interfaceSize: 'compact' | 'normal' | 'large';
  borderRadius: 'none' | 'small' | 'medium' | 'large' | 'full';
  themeMode: 'dark' | 'light' | 'auto';

  pantallaFondoTipo: 'color' | 'degradado' | 'imagen';
  pantallaFondoValor: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  usuario?: string;
  email: string;
  password?: string;
  rol: RolUsuario;
  activo: boolean;
  cajaAsignadaId?: number | null;
  sedeId?: string;
  fechaCreacion: string;
}

export interface Caja {
  id: number;
  numero: number;
  nombre: string;
  estado: EstadoCaja;
  usuarioActualId?: string | null;
  usuarioNombre?: string | null;
  ticketActualId?: string | null;
  ticketActualCodigo?: string | null;
  ultimaActividad: string;
  socketId?: string | null;
  activa: boolean; // Si la caja está habilitada administrativamente
  tipo?: 'CAJA' | 'TRIADA'; // Tipo de módulo: Caja de atención o Triada/Fotografía
  sedeId?: string;
}

export interface Ticket {
  id: string;
  numero: number;
  codigo: string; // ej: "C001"
  tramite: string; // "Cedulación", "Extranjería", "Organización Electoral", "Registro Civil"
  prefijo: string; // "C", "E", "O", "R"
  ciudadanoNombre?: string | null;
  ciudadanoApellido?: string | null;
  estado: EstadoTicket;
  cajaId?: number | null;
  cajaNumero?: number | null;
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  etapa?: 'CAJA' | 'TRIADA'; // Etapa actual del recorrido
  preferencial?: boolean; // Indica si es atención preferencial (Adultos mayores, discapacidad, etc.)
  sedeId?: string;
  
  // Timestamps para latencia y estadísticas
  fechaCreacion: string; // ticket_created_at
  fechaAsignacion?: string | null; // ticket_assigned_at
  fechaLlamado?: string | null; // ticket_called_at
  fechaInicio?: string | null; // ticket_started_at
  fechaFinalizacion?: string | null; // ticket_finished_at
  
  duracionEsperaSegundos?: number;
  duracionAtencionSegundos?: number;
  llamadosContador?: number;
  modoLlamado?: 'VOZ' | 'PITIDO';
}

export interface Atencion {
  id: string;
  ticketId: string;
  ticketCodigo: string;
  cajaId: number;
  usuarioId: string;
  fechaInicio: string;
  fechaFin: string;
  duracionSegundos: number;
  resultado: 'FINALIZADO' | 'NO_PRESENTO';
  sedeId?: string;
}

export interface EventoRealtime {
  type: TipoEvento;
  ticketId?: string;
  numero?: string;
  codigo?: string;
  caja?: number;
  cajaId?: number;
  funcionario?: string;
  ciudadano?: string;
  timestamp: string;
  payload?: any;
  sedeId?: string;
}

export interface MetricasSistema {
  totalTicketsHoy: number;
  esperandoCount: number;
  enAtencionCount: number;
  finalizadosCount: number;
  noPresentaronCount: number;
  tiempoPromedioEsperaSegundos: number;
  tiempoPromedioAtencionSegundos: number;
  latenciaAsignacionPromedioMs: number;
}

export interface EstadoGlobalSnapshot {
  cajas: Caja[];
  ticketsEsperando: Ticket[];
  ticketsActivos: Ticket[];
  ultimosLlamados: Ticket[];
  metricas: MetricasSistema;
  ultimoLlamadoGlobal: Ticket | null;
}
