import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  IdCard, 
  Globe2, 
  Vote, 
  BookOpen, 
  Printer, 
  Clock, 
  AlertCircle,
  User,
  Sparkles,
  Camera,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { Ticket } from '../types';
import { useCustomization } from '../context/CustomizationContext';
import { LogoInstitucional } from './LogoInstitucional';

interface KioskViewProps {
  ticketsEsperandoCount: number;
  onTicketCreated?: (ticket: Ticket) => void;
  sedeId?: string;
}

interface TramiteOption {
  id: string;
  nombre: string;
  prefijo: string;
  descripcion: string;
  icono: React.ReactNode;
  accentClass: string;
}

// Trámites oficiales solicitados por la institución
const TRAMITES: TramiteOption[] = [
  {
    id: 'cedulacion',
    nombre: 'Cedulación',
    prefijo: 'C',
    descripcion: 'Expedición, renovación, actualización y duplicados de cédula de identidad',
    icono: <IdCard className="w-7 h-7" />,
    accentClass: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    id: 'extranjeria',
    nombre: 'Extranjería',
    prefijo: 'E',
    descripcion: 'Visas, permisos de residencia, prórrogas de permanencia y trámites migratorios',
    icono: <Globe2 className="w-7 h-7" />,
    accentClass: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    id: 'electoral',
    nombre: 'Organización Electoral',
    prefijo: 'O',
    descripcion: 'Inscripción en el padrón electoral, cambio de domicilio y certificados de votación',
    icono: <Vote className="w-7 h-7" />,
    accentClass: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  {
    id: 'registro_civil',
    nombre: 'Registro Civil',
    prefijo: 'R',
    descripcion: 'Partidas de nacimiento, certificados de matrimonio, defunción y actas de estado civil',
    icono: <BookOpen className="w-7 h-7" />,
    accentClass: 'text-purple-600 bg-purple-50 border-purple-200'
  }
];

export const KioskView: React.FC<KioskViewProps> = ({ 
  ticketsEsperandoCount, 
  onTicketCreated,
  sedeId = 'ancon'
}) => {
  const { configuracion } = useCustomization();
  const [nombreCompleto, setNombreCompleto] = useState('');
  const [esPreferencial, setEsPreferencial] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ticketEmitido, setTicketEmitido] = useState<Ticket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imprimiendo, setImprimiendo] = useState(false);

  const solicitarTicket = async (tramite: TramiteOption) => {
    if (loading) return;

    // Validación del dato del ciudadano
    if (!nombreCompleto.trim()) {
      setError('Por favor, ingrese el nombre y apellido del ciudadano antes de seleccionar el trámite.');
      // Scroll suave hacia el campo de nombre si es necesario
      const el = document.getElementById('input-ciudadano-nombre');
      if (el) el.focus();
      return;
    }

    setLoading(true);
    setError(null);

    // Separar de forma limpia en primer nombre y apellidos
    const partes = nombreCompleto.trim().split(/\s+/);
    const primerNombre = partes[0] || '';
    const restoApellidos = partes.slice(1).join(' ') || '';

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tramite: tramite.nombre,
          prefijo: tramite.prefijo,
          nombre: primerNombre,
          apellido: restoApellidos,
          preferencial: esPreferencial,
          sedeId
        })
      });

      if (!res.ok) throw new Error('Error al emitir el turno');

      const data: Ticket = await res.json();
      setTicketEmitido(data);
      if (onTicketCreated) onTicketCreated(data);

      // Limpiar campo para el siguiente ciudadano
      setNombreCompleto('');
      setEsPreferencial(false);

      // Auto ocultar ticket tras 15 segundos si no se interactúa
      setTimeout(() => {
        setTicketEmitido(null);
      }, 15000);
    } catch (err: any) {
      setError(err.message || 'No se pudo conectar con el emisor de tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleImprimir = () => {
    if (!ticketEmitido) return;
    setImprimiendo(true);

    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <title>Ticket ${ticketEmitido.codigo}</title>
            <style>
              @page {
                size: 80mm auto;
                margin: 0;
              }
              body {
                font-family: 'Courier New', Courier, monospace, sans-serif;
                width: 76mm;
                margin: 0 auto;
                padding: 10px 4px;
                text-align: center;
                color: #000;
                background: #fff;
              }
              .header {
                font-size: 15px;
                font-weight: 900;
                text-transform: uppercase;
                margin-bottom: 2px;
                letter-spacing: 0.5px;
              }
              .subheader {
                font-size: 10px;
                margin-bottom: 6px;
                color: #444;
              }
              .divider {
                border-top: 1px dashed #000;
                margin: 6px 0;
              }
              .label {
                font-size: 9px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: #555;
              }
              .citizen {
                font-size: 13px;
                font-weight: bold;
                margin: 2px 0 6px 0;
                text-transform: capitalize;
              }
              .ticket-number {
                font-size: 46px;
                font-weight: 900;
                line-height: 1;
                margin: 8px 0;
                letter-spacing: -1px;
              }
              .tramite-pill {
                display: inline-block;
                border: 1px solid #000;
                border-radius: 4px;
                padding: 3px 8px;
                font-size: 11px;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 6px;
              }
              .details {
                font-size: 10px;
                text-align: left;
                margin-top: 6px;
              }
              .details-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
              }
              .footer-msg {
                font-size: 9.5px;
                color: #222;
                margin-top: 8px;
                line-height: 1.3;
              }
              .barcode {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                letter-spacing: 3px;
                font-weight: bold;
                margin-top: 8px;
              }
            </style>
          </head>
          <body>
            <div class="header">${configuracion.nombreInstitucion || 'Institución Pública'}</div>
            <div class="subheader">${configuracion.nombreSistema || 'Sistema de Gestión de Turnos'} • Comprobante Oficial</div>
            <div class="divider"></div>
            
            <div class="label">Ciudadano(a)</div>
            <div class="citizen">${[ticketEmitido.ciudadanoNombre, ticketEmitido.ciudadanoApellido].filter(Boolean).join(' ') || ticketEmitido.ciudadanoNombre || 'Ciudadano'}</div>
            
            <div class="label">Número de Turno</div>
            <div class="ticket-number">${ticketEmitido.codigo}</div>
            <div class="tramite-pill">${ticketEmitido.tramite}</div>
            ${ticketEmitido.preferencial ? '<div style="background:#000; color:#fff; font-size:11px; font-weight:bold; padding:3px 6px; border-radius:3px; margin:4px 0;">★ TURNO PREFERENCIAL ♿ • CAJA 0</div>' : ''}
            
            <div class="divider"></div>
            <div class="details">
              <div class="details-row">
                <span>Fecha:</span>
                <span>${new Date(ticketEmitido.fechaCreacion).toLocaleDateString()}</span>
              </div>
              <div class="details-row">
                <span>Hora:</span>
                <span>${new Date(ticketEmitido.fechaCreacion).toLocaleTimeString()}</span>
              </div>
              <div class="details-row">
                <span>Estado:</span>
                <span>En espera de atención</span>
              </div>
            </div>
            
            <div class="divider"></div>
            <div class="footer-msg">
              Por favor permanezca atento a la <strong>Pantalla TV</strong> y al audio del llamado.
            </div>
            <div class="barcode">*${ticketEmitido.codigo}*</div>
          </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (errPrint) {
            console.warn('Fallback to standard window.print()', errPrint);
            window.print();
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
              } catch (e) {}
              setImprimiendo(false);
            }, 1200);
          }
        }, 300);
      } else {
        window.print();
        setImprimiendo(false);
      }
    } catch (e) {
      console.warn('Error with print iframe, using standard print', e);
      window.print();
      setImprimiendo(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-16">
      {/* 
        ========================================================================
        PORTAL PRINCIPAL - ESTRUCTURA VISUAL INSTITUCIONAL Y CENTRADA:
        1. Logo institucional en la parte superior y centrado.
        2. Debajo del logo, nombre o identificación de la institución.
        3. Debajo, título principal del sistema en letras grandes, modernas y de alto contraste.
        4. Debajo del título, descripción corta explicando qué puede hacer dentro del portal.
        5. Distribución limpia, moderna, institucional y profesional.
        6. Suficiente espacio en blanco para evitar saturación visual.
        7. Todos los elementos centrados y alineados.
        8. Responsive para computador, tablet y teléfono.
        ========================================================================
      */}

      <header className="flex flex-col items-center justify-center text-center mb-10 sm:mb-14">
        {/* 1. Logo institucional en la parte superior y centrado */}
        <div className="mb-4 sm:mb-5 flex justify-center items-center">
          <LogoInstitucional 
            variant="portal-hero" 
            showText={false}
            className="transition-transform duration-300 hover:scale-105"
          />
        </div>

        {/* 2. Debajo del logo, nombre o identificación de la institución */}
        <div className="mb-3">
          <span 
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors shadow-xs"
            style={{
              color: configuracion.primaryColor || '#1D4ED8',
              backgroundColor: `${configuracion.primaryColor || '#1D4ED8'}14`,
              border: `1px solid ${configuracion.primaryColor || '#1D4ED8'}30`
            }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{configuracion.nombreInstitucion || 'Tribunal Electoral'}</span>
          </span>
        </div>

        {/* 3. Debajo, título principal del sistema en letras grandes, modernas y de alto contraste */}
        <h1 
          className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight leading-tight max-w-3xl mx-auto font-display"
          style={{ color: configuracion.headerColor || configuracion.textColor || '#0F172A' }}
        >
          {configuracion.nombreSistema || 'Sistema de Gestión de Turnos'}
        </h1>

        {/* 4. Debajo del título, descripción corta explicando al usuario qué puede hacer */}
        <p 
          className="text-sm sm:text-base md:text-lg max-w-2xl mx-auto mt-3 sm:mt-4 leading-relaxed font-normal"
          style={{ color: configuracion.mutedTextColor || '#64748B' }}
        >
          {configuracion.textoBienvenida && configuracion.textoBienvenida !== 'Bienvenido, tome su turno'
            ? configuracion.textoBienvenida
            : 'Bienvenido al portal institucional de atención. Ingrese sus datos personales y seleccione el trámite institucional que requiere realizar para obtener su turno presencial.'}
        </p>

        {/* Indicador de estado de la fila / personas en espera */}
        <div className="mt-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs sm:text-sm font-medium border shadow-xs transition-colors"
          style={{
            backgroundColor: configuracion.surfaceColor || '#FFFFFF',
            borderColor: configuracion.borderColor || '#E2E8F0',
            color: configuracion.textColor || '#0F172A'
          }}
        >
          <Clock className="w-4 h-4" style={{ color: configuracion.primaryColor || '#1D4ED8' }} />
          <span>Personas en cola de espera en este momento:</span>
          <span 
            className="font-bold px-2.5 py-0.5 rounded-full text-xs text-white"
            style={{ backgroundColor: configuracion.primaryColor || '#1D4ED8' }}
          >
            {ticketsEsperandoCount}
          </span>
        </div>
      </header>

      {/* Formulario de Identificación del Ciudadano (Paso 1) */}
      <section 
        className="mb-8 sm:mb-10 p-6 sm:p-8 rounded-3xl border shadow-sm transition-all"
        style={{
          backgroundColor: configuracion.surfaceColor || '#FFFFFF',
          borderColor: configuracion.borderColor || '#E2E8F0'
        }}
      >
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b" style={{ borderColor: configuracion.borderColor || '#E2E8F0' }}>
          <div 
            className="p-2.5 rounded-2xl flex items-center justify-center"
            style={{
              backgroundColor: `${configuracion.primaryColor || '#1D4ED8'}15`,
              color: configuracion.primaryColor || '#1D4ED8',
              border: `1px solid ${configuracion.primaryColor || '#1D4ED8'}30`
            }}
          >
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 
              className="text-base sm:text-lg font-bold"
              style={{ color: configuracion.textColor || '#0F172A' }}
            >
              Paso 1: Identificación del Ciudadano
            </h2>
            <p className="text-xs sm:text-sm" style={{ color: configuracion.mutedTextColor || '#64748B' }}>
              Ingrese su nombre completo para identificar su turno en la pantalla pública y en la estación del funcionario.
            </p>
          </div>
        </div>

        <div>
          <label 
            htmlFor="input-ciudadano-nombre"
            className="block text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: configuracion.textColor || '#0F172A' }}
          >
            Nombre y Apellido / Nombre Completo <span style={{ color: configuracion.errorColor || '#EF4444' }}>*</span>
          </label>
          <input
            type="text"
            id="input-ciudadano-nombre"
            value={nombreCompleto}
            onChange={(e) => {
              setNombreCompleto(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Ej: Carlos Eduardo Rodríguez Gómez"
            className="w-full rounded-2xl px-4 py-3.5 text-base sm:text-lg border transition-all font-medium focus:outline-none focus:ring-2 shadow-xs"
            style={{
              backgroundColor: configuracion.backgroundColor || '#F8FAFC',
              borderColor: configuracion.borderColor || '#E2E8F0',
              color: configuracion.textColor || '#0F172A'
            }}
            autoComplete="name"
          />
        </div>

        {/* Opción de Atención Preferencial */}
        <div className="mt-6 pt-5 border-t" style={{ borderColor: configuracion.borderColor || '#E2E8F0' }}>
          <button
            type="button"
            id="btn-opcion-preferencial"
            onClick={() => setEsPreferencial(!esPreferencial)}
            className="w-full p-4 sm:p-5 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer"
            style={{
              backgroundColor: esPreferencial 
                ? `${configuracion.warningColor || '#F59E0B'}15` 
                : configuracion.backgroundColor || '#F8FAFC',
              borderColor: esPreferencial 
                ? (configuracion.warningColor || '#F59E0B') 
                : configuracion.borderColor || '#E2E8F0'
            }}
          >
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-colors shrink-0 text-xl"
                style={{
                  backgroundColor: esPreferencial 
                    ? (configuracion.warningColor || '#F59E0B') 
                    : `${configuracion.mutedTextColor || '#64748B'}20`,
                  color: esPreferencial ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
                }}
              >
                <span>♿</span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span 
                    className="text-sm sm:text-base font-extrabold"
                    style={{
                      color: esPreferencial 
                        ? (configuracion.warningColor || '#D97706') 
                        : (configuracion.textColor || '#0F172A')
                    }}
                  >
                    ¿Requiere Atención Preferencial?
                  </span>
                  {esPreferencial ? (
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-white shadow-xs"
                      style={{ backgroundColor: configuracion.warningColor || '#F59E0B' }}
                    >
                      Prioritario • Caja 0
                    </span>
                  ) : (
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border"
                      style={{
                        borderColor: configuracion.borderColor || '#E2E8F0',
                        color: configuracion.mutedTextColor || '#64748B'
                      }}
                    >
                      Opcional
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm mt-0.5" style={{ color: configuracion.mutedTextColor || '#64748B' }}>
                  Adultos mayores (60+), mujeres embarazadas, personas con discapacidad o movilidad reducida.
                </p>
              </div>
            </div>

            {/* Switch Toggle Accesible */}
            <div 
              className="w-13 h-7 rounded-full p-1 transition-colors flex items-center shrink-0 border"
              style={{
                backgroundColor: esPreferencial 
                  ? (configuracion.warningColor || '#F59E0B') 
                  : (configuracion.borderColor || '#CBD5E1'),
                borderColor: esPreferencial 
                  ? (configuracion.warningColor || '#F59E0B') 
                  : (configuracion.borderColor || '#CBD5E1'),
                justifyContent: esPreferencial ? 'flex-end' : 'flex-start'
              }}
            >
              <div className="w-5 h-5 rounded-full bg-white shadow-md transform transition-transform" />
            </div>
          </button>

          {esPreferencial && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 px-4 py-2.5 rounded-xl border flex items-center gap-2.5 text-xs sm:text-sm"
              style={{
                backgroundColor: `${configuracion.warningColor || '#F59E0B'}15`,
                borderColor: `${configuracion.warningColor || '#F59E0B'}40`,
                color: configuracion.textColor || '#0F172A'
              }}
            >
              <Sparkles className="w-4 h-4 shrink-0" style={{ color: configuracion.warningColor || '#F59E0B' }} />
              <span>
                <strong>Atención Prioritaria Activada:</strong> Su ticket se emitirá con prioridad y será llamado directamente a la <strong>Ventanilla Preferencial (Caja 0)</strong>.
              </span>
            </motion.div>
          )}
        </div>
      </section>

      {/* Alerta de validación si falta nombre */}
      {error && (
        <div 
          className="mb-8 p-4 sm:p-5 rounded-2xl border text-sm font-medium flex items-center gap-3 animate-pulse shadow-sm"
          style={{
            backgroundColor: `${configuracion.errorColor || '#EF4444'}15`,
            borderColor: `${configuracion.errorColor || '#EF4444'}40`,
            color: configuracion.errorColor || '#EF4444'
          }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selección de Trámite Institucional (Paso 2) */}
      <section className="mb-12">
        <div className="text-center sm:text-left mb-4 sm:mb-5">
          <h2 
            className="text-xs sm:text-sm font-bold uppercase tracking-wider px-1"
            style={{ color: configuracion.mutedTextColor || '#64748B' }}
          >
            Paso 2: Seleccione el trámite a realizar
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {TRAMITES.map((tramite) => (
            <button
              key={tramite.id}
              id={`btn-tramite-${tramite.id}`}
              onClick={() => solicitarTicket(tramite)}
              disabled={loading}
              className="group relative text-left p-6 sm:p-7 rounded-3xl border transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
              style={{
                backgroundColor: configuracion.surfaceColor || '#FFFFFF',
                borderColor: configuracion.borderColor || '#E2E8F0'
              }}
            >
              <div className="flex items-start justify-between">
                <div 
                  className="p-3.5 rounded-2xl border transition-colors shadow-xs"
                  style={{
                    backgroundColor: `${configuracion.primaryColor || '#1D4ED8'}10`,
                    borderColor: `${configuracion.primaryColor || '#1D4ED8'}25`,
                    color: configuracion.primaryColor || '#1D4ED8'
                  }}
                >
                  {tramite.icono}
                </div>
                <span 
                  className="text-3xl font-black opacity-30 group-hover:opacity-75 transition-opacity font-display"
                  style={{ color: configuracion.primaryColor || '#1D4ED8' }}
                >
                  {tramite.prefijo}
                </span>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 
                    className="text-xl font-extrabold tracking-tight group-hover:opacity-90 transition-opacity"
                    style={{ color: configuracion.textColor || '#0F172A' }}
                  >
                    {tramite.nombre}
                  </h3>
                  {tramite.id === 'cedulacion' && (
                    <span 
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border"
                      style={{
                        backgroundColor: `${configuracion.secondaryColor || '#4F46E5'}15`,
                        color: configuracion.secondaryColor || '#4F46E5',
                        borderColor: `${configuracion.secondaryColor || '#4F46E5'}30`
                      }}
                    >
                      <Camera className="w-3 h-3" />
                      Caja + Triada Foto
                    </span>
                  )}
                </div>
                <p 
                  className="text-xs sm:text-sm mt-1.5 leading-relaxed"
                  style={{ color: configuracion.mutedTextColor || '#64748B' }}
                >
                  {tramite.descripcion}
                </p>
              </div>

              <div 
                className="mt-6 flex items-center justify-between text-xs font-semibold pt-3.5 border-t"
                style={{ borderColor: configuracion.borderColor || '#E2E8F0' }}
              >
                <span 
                  className="flex items-center gap-1 group-hover:underline font-bold"
                  style={{ color: configuracion.primaryColor || '#1D4ED8' }}
                >
                  <span>Presione para emitir turno</span>
                  <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
                </span>
                <span 
                  className="px-2.5 py-1 rounded-lg border font-mono text-[11px]"
                  style={{
                    backgroundColor: configuracion.backgroundColor || '#F8FAFC',
                    borderColor: configuracion.borderColor || '#E2E8F0',
                    color: configuracion.mutedTextColor || '#64748B'
                  }}
                >
                  Serie {tramite.prefijo}00X
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Modal / Animación de Ticket Emitido */}
      <AnimatePresence>
        {ticketEmitido && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              id="ticket-imprimible"
              initial={{ scale: 0.9, y: 24 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 16 }}
              className="bg-white text-slate-900 w-full max-w-sm rounded-3xl p-6 sm:p-8 shadow-2xl relative border-t-8"
              style={{ borderTopColor: configuracion.primaryColor || '#1D4ED8' }}
            >
              {/* Encabezado del Ticket */}
              <div className="text-center pb-4 border-b border-dashed border-slate-300">
                <span 
                  className="text-xs uppercase tracking-wider font-extrabold block"
                  style={{ color: configuracion.primaryColor || '#1D4ED8' }}
                >
                  {configuracion.nombreInstitucion || 'Tribunal Electoral'}
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {configuracion.nombreSistema || 'Sistema de Gestión de Turnos'} • Comprobante Oficial
                </p>
              </div>

              {/* Datos del Ciudadano */}
              <div className="mt-4 text-center">
                <p className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">
                  Ciudadano(a)
                </p>
                <h4 className="text-lg font-black text-slate-900 capitalize">
                  {[ticketEmitido.ciudadanoNombre, ticketEmitido.ciudadanoApellido].filter(Boolean).join(' ') || ticketEmitido.ciudadanoNombre || 'Ciudadano'}
                </h4>
              </div>

              {/* Código de Turno */}
              <div className="py-4 text-center">
                <p className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider">
                  Número de Turno Asignado
                </p>
                <div 
                  className="text-6xl font-black tracking-tight my-1 font-display"
                  style={{ color: configuracion.primaryColor || '#1D4ED8' }}
                >
                  {ticketEmitido.codigo}
                </div>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-900 border border-slate-200">
                    {ticketEmitido.tramite}
                  </span>
                  {ticketEmitido.preferencial && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                      <span>♿</span> Preferencial • Caja 0
                    </span>
                  )}
                </div>
              </div>

              {/* Detalles y aviso */}
              <div className="space-y-2 pt-3 border-t border-dashed border-slate-300 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>Fecha y hora:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(ticketEmitido.fechaCreacion).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Estado del turno:</span>
                  <span className="font-bold text-emerald-600">
                    {ticketEmitido.estado === 'ASIGNADO' ? `Asignado a Caja ${ticketEmitido.cajaNumero}` : 'En espera de llamado'}
                  </span>
                </div>
              </div>

              {/* Mensaje de llamado */}
              <div className="mt-4 p-3 rounded-2xl bg-slate-100 text-center">
                <p className="text-xs font-medium text-slate-700">
                  Por favor permanezca atento a la <strong>Pantalla Pública</strong> y al sonido del llamado por voz.
                </p>
              </div>

              {/* Simulación visual de código de barras */}
              <div className="mt-4 pt-3 border-t border-dashed border-slate-300 text-center">
                <div className="flex justify-center items-center gap-1 h-7 opacity-80">
                  <span className="w-1 h-full bg-slate-900 inline-block" />
                  <span className="w-0.5 h-full bg-slate-900 inline-block" />
                  <span className="w-2 h-full bg-slate-900 inline-block" />
                  <span className="w-1 h-full bg-slate-900 inline-block" />
                  <span className="w-3 h-full bg-slate-900 inline-block" />
                  <span className="w-0.5 h-full bg-slate-900 inline-block" />
                  <span className="w-1.5 h-full bg-slate-900 inline-block" />
                  <span className="w-0.5 h-full bg-slate-900 inline-block" />
                  <span className="w-2.5 h-full bg-slate-900 inline-block" />
                  <span className="w-1 h-full bg-slate-900 inline-block" />
                  <span className="w-0.5 h-full bg-slate-900 inline-block" />
                  <span className="w-2 h-full bg-slate-900 inline-block" />
                </div>
                <p className="text-[10px] font-mono text-slate-500 mt-1">*{ticketEmitido.codigo}*</p>
              </div>

              {/* Botonera de acciones (No se imprime) */}
              <div className="mt-5 space-y-2 no-print">
                <button
                  id="btn-imprimir-ticket"
                  type="button"
                  onClick={handleImprimir}
                  disabled={imprimiendo}
                  className="w-full py-3.5 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer text-white"
                  style={{
                    backgroundColor: configuracion.buttonColor || '#1D4ED8'
                  }}
                >
                  <Printer className="w-4 h-4" />
                  <span>{imprimiendo ? 'ENVIANDO A IMPRESORA...' : 'IMPRIMIR TICKET'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTicketEmitido(null)}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
