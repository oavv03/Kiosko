import React, { useState, useRef } from 'react';
import { 
  Palette, 
  Image as ImageIcon, 
  Building2, 
  Type, 
  Layout, 
  Eye, 
  RotateCcw, 
  Save, 
  X, 
  Check, 
  Upload, 
  Trash2, 
  Sparkles, 
  Monitor, 
  Tv, 
  Ticket as TicketIcon, 
  Bell, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Sliders, 
  Layers, 
  ExternalLink,
  Printer,
  QrCode,
  FileText
} from 'lucide-react';
import { useCustomization } from '../context/CustomizationContext';
import { LogoInstitucional } from './LogoInstitucional';
import { ConfiguracionVisual } from '../types';
import { imprimirTicket, TICKET_EJEMPLO } from '../utils/ticketPrinter';

// Paletas de muestra predefinidas para aplicar en un clic
const PALETAS_PREDEFINIDAS = [
  {
    nombre: 'Identidad Azul (Fondo Claro Neutro)',
    primaryColor: '#1D4ED8',
    secondaryColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    surfaceColor: '#FFFFFF',
    textColor: '#0F172A',
    mutedTextColor: '#64748B',
    buttonColor: '#1D4ED8',
    buttonHoverColor: '#1E40AF',
    borderColor: '#E2E8F0',
    headerColor: '#0F172A'
  },
  {
    nombre: 'Identidad Verde (Fondo Neutro)',
    primaryColor: '#059669',
    secondaryColor: '#10B981',
    backgroundColor: '#F6FBF7',
    surfaceColor: '#FFFFFF',
    textColor: '#064E3B',
    mutedTextColor: '#64748B',
    buttonColor: '#059669',
    buttonHoverColor: '#047857',
    borderColor: '#E2E8F0',
    headerColor: '#064E3B'
  },
  {
    nombre: 'Identidad Roja (Fondo Neutro)',
    primaryColor: '#DC2626',
    secondaryColor: '#EF4444',
    backgroundColor: '#FDF8F8',
    surfaceColor: '#FFFFFF',
    textColor: '#1F2937',
    mutedTextColor: '#6B7280',
    buttonColor: '#DC2626',
    buttonHoverColor: '#B91C1C',
    borderColor: '#E5E7EB',
    headerColor: '#1F2937'
  },
  {
    nombre: 'Identidad Ámbar / Oro (Fondo Claro)',
    primaryColor: '#D97706',
    secondaryColor: '#F59E0B',
    backgroundColor: '#FAFAFA',
    surfaceColor: '#FFFFFF',
    textColor: '#18181B',
    mutedTextColor: '#71717A',
    buttonColor: '#D97706',
    buttonHoverColor: '#B45309',
    borderColor: '#E4E4E7',
    headerColor: '#18181B'
  },
  {
    nombre: 'Modo Oscuro Institucional',
    primaryColor: '#3B82F6',
    secondaryColor: '#60A5FA',
    backgroundColor: '#0F172A',
    surfaceColor: '#1E293B',
    textColor: '#F8FAFC',
    mutedTextColor: '#94A3B8',
    buttonColor: '#2563EB',
    buttonHoverColor: '#1D4ED8',
    borderColor: '#334155',
    headerColor: '#FFFFFF'
  }
];

export const PersonalizacionView: React.FC = () => {
  const { 
    configuracion, 
    previewConfig, 
    isDirty, 
    saving, 
    updatePreview, 
    saveConfiguration, 
    cancelPreview, 
    resetToDefaults 
  } = useCustomization();

  const [activeTab, setActiveTab] = useState<'identidad' | 'logos' | 'ticket' | 'colores' | 'estilos' | 'vista-previa'>('identidad');
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [imprimiendoPrueba, setImprimiendoPrueba] = useState(false);

  const fileInputLogoRef = useRef<HTMLInputElement>(null);
  const fileInputLogoMovilRef = useRef<HTMLInputElement>(null);
  const fileInputFaviconRef = useRef<HTMLInputElement>(null);
  const fileInputFondoTvRef = useRef<HTMLInputElement>(null);
  const fileInputTicketLogoRef = useRef<HTMLInputElement>(null);

  // Manejador genérico para leer archivos y convertirlos a base64
  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>, 
    targetKey: 'logoPrincipalUrl' | 'logoMovilUrl' | 'faviconUrl' | 'pantallaFondoValor' | 'ticketLogoUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de tipo de archivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Formato de imagen no soportado. Por favor seleccione un archivo PNG, JPG, SVG o WEBP.');
      return;
    }

    // Límite de tamaño: 4MB
    if (file.size > 4 * 1024 * 1024) {
      alert('La imagen es demasiado pesada. El tamaño máximo permitido es de 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updatePreview({ [targetKey]: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const ok = await saveConfiguration();
    if (ok) {
      setSuccessMessage('¡Configuración de identidad y diseño guardada exitosamente!');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const handleResetConfirm = async () => {
    setShowConfirmReset(false);
    const ok = await resetToDefaults();
    if (ok) {
      setSuccessMessage('Configuración restablecida a los valores predeterminados de fábrica.');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const aplicarPaleta = (p: typeof PALETAS_PREDEFINIDAS[0]) => {
    updatePreview({
      primaryColor: p.primaryColor,
      secondaryColor: p.secondaryColor,
      backgroundColor: p.backgroundColor,
      surfaceColor: p.surfaceColor,
      textColor: p.textColor,
      mutedTextColor: p.mutedTextColor,
      buttonColor: p.buttonColor,
      buttonHoverColor: p.buttonHoverColor,
      borderColor: p.borderColor,
      headerColor: p.headerColor
    });
  };

  const handleImprimirPrueba = async () => {
    setImprimiendoPrueba(true);
    try {
      await imprimirTicket(TICKET_EJEMPLO, previewConfig);
    } catch (err) {
      console.warn('Error imprimiendo prueba de ticket:', err);
    } finally {
      setImprimiendoPrueba(false);
    }
  };

  const restablecerTextosTicket = () => {
    updatePreview({
      ticketEncabezado: previewConfig.nombreInstitucion || 'Tribunal Electoral',
      ticketSubencabezado: 'Comprobante Oficial de Turno',
      ticketMensajeEspera: 'Por favor permanezca atento a la Pantalla Pública y al audio del llamado.',
      ticketPieMensaje: '¡Gracias por su visita! Conserve este comprobante hasta finalizar su atención.',
      ticketNotaPie: 'Validez únicamente para el día de emisión.',
      ticketMostrarLogo: true,
      ticketLogoTamano: 'mediano',
      ticketMostrarCiudadano: true,
      ticketMostrarTramite: true,
      ticketMostrarFechaHora: true,
      ticketMostrarCodigoBarras: true,
      ticketMostrarQr: true,
      ticketAnchoPapel: '80mm',
      ticketEstiloFuente: 'monospace',
      ticketEspaciado: 'normal'
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Encabezado del Módulo */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-blue-950/80 text-blue-400 border border-blue-800/60 inline-flex items-center gap-1.5">
              <Sliders className="w-3 h-3" />
              Administración Central
            </span>
            {isDirty && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                Cambios pendientes sin guardar
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Personalización del Sistema e Identidad Institucional
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Modifique el nombre institucional, logotipos, colores, tipografía y fondos del sistema en tiempo real sin alterar el código ni la lógica de turnos.
          </p>
        </div>

        {/* Botones de Acción Globales */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {isDirty && (
            <button
              type="button"
              onClick={cancelPreview}
              disabled={saving}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Cancelar cambios</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowConfirmReset(true)}
            disabled={saving}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-rose-300 hover:text-rose-200 border border-slate-800 hover:border-rose-800/80 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Restaurar colores y textos originales del sistema"
          >
            <RotateCcw className="w-4 h-4 text-rose-400" />
            <span>Restaurar predeterminados</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando en BD...' : 'Guardar cambios'}</span>
          </button>
        </div>
      </div>

      {/* Notificación de Éxito */}
      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navegación por pestañas del panel */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('identidad')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'identidad'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Identidad Institucional</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('logos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'logos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>2. Logotipos y Favicon</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ticket')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ticket'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <TicketIcon className="w-4 h-4" />
          <span>3. Personalizar Ticket</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('colores')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'colores'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>4. Colores y Paleta</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('estilos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'estilos'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Type className="w-4 h-4" />
          <span>5. Tipografía y Estilos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vista-previa')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'vista-previa'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
              : 'text-indigo-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>6. Vista Previa en Vivo</span>
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 1: IDENTIDAD INSTITUCIONAL */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'identidad' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Building2 className="w-4 h-4 text-blue-400" />
              <span>Nombres y Textos Principales</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nombre de la Institución
              </label>
              <input
                type="text"
                value={previewConfig.nombreInstitucion}
                onChange={(e) => updatePreview({ nombreInstitucion: e.target.value })}
                placeholder="Ej: Tribunal Electoral"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Aparece en encabezados, reportes, tickets impresos y pantallas públicas.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Nombre del Sistema
              </label>
              <input
                type="text"
                value={previewConfig.nombreSistema}
                onChange={(e) => updatePreview({ nombreSistema: e.target.value })}
                placeholder="Ej: Sistema de Gestión de Turnos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Título del software visible en la barra superior y pantallas de sala.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Siglas / Nombre Corto
                </label>
                <input
                  type="text"
                  value={previewConfig.nombreCorto}
                  onChange={(e) => updatePreview({ nombreCorto: e.target.value })}
                  placeholder="Ej: TE"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Número de Versión
                </label>
                <input
                  type="text"
                  value={previewConfig.version}
                  onChange={(e) => updatePreview({ version: e.target.value })}
                  placeholder="Ej: 1.0.0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Título de la Pestaña del Navegador
              </label>
              <input
                type="text"
                value={previewConfig.tituloNavegador}
                onChange={(e) => updatePreview({ tituloNavegador: e.target.value })}
                placeholder="Ej: Sistema de Gestión de Turnos | Tribunal Electoral"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Texto dinámico que figura en la barra de títulos de Chrome, Edge o Firefox.
              </p>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Mensajes y Textos al Público</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Texto de Bienvenida en Kiosco
              </label>
              <input
                type="text"
                value={previewConfig.textoBienvenida}
                onChange={(e) => updatePreview({ textoBienvenida: e.target.value })}
                placeholder="Ej: Bienvenido, tome su turno"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Encabezado que ven los ciudadanos en la terminal táctil de emisión.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Texto de Pie de Página (Copyright / Institucional)
              </label>
              <textarea
                rows={3}
                value={previewConfig.pieDePagina}
                onChange={(e) => updatePreview({ pieDePagina: e.target.value })}
                placeholder="Ej: © 2026 Tribunal Electoral • Sistema Oficial de Atención"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800">
              <span className="text-xs font-bold text-slate-300 block mb-2">
                Vista previa rápida del encabezado de marca:
              </span>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <LogoInstitucional overrideConfig={previewConfig} />
                <span className="text-[11px] font-mono text-slate-400">
                  v{previewConfig.version}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 2: LOGOTIPOS Y FAVICON */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'logos' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Logo Principal */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div>
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block">
                Logo Principal
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Emblema Institucional
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Se exhibe en la barra superior, kiosco, pantallas públicas y tickets.
              </p>
            </div>

            <div className="h-36 rounded-2xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
              {previewConfig.logoPrincipalUrl ? (
                <img
                  src={previewConfig.logoPrincipalUrl}
                  alt="Logo Principal"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <LogoInstitucional variant="kiosk" overrideConfig={previewConfig} showText={false} />
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    (Emblema predeterminado activo)
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputLogoRef}
                onChange={(e) => handleFileUpload(e, 'logoPrincipalUrl')}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputLogoRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
              >
                <Upload className="w-4 h-4" />
                <span>Cargar imagen (PNG, JPG, SVG, WEBP)</span>
              </button>

              {previewConfig.logoPrincipalUrl && (
                <button
                  type="button"
                  onClick={() => updatePreview({ logoPrincipalUrl: '' })}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar logo y usar predeterminado</span>
                </button>
              )}
            </div>
          </div>

          {/* Logo Móvil / Pantallas Pequeñas */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div>
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                Logo Reducido / Móvil
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Versión Compacta
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Optimizado para pantallas móviles o anchos reducidos. Si está vacío, se usará el principal.
              </p>
            </div>

            <div className="h-36 rounded-2xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center p-4 relative overflow-hidden">
              {previewConfig.logoMovilUrl ? (
                <img
                  src={previewConfig.logoMovilUrl}
                  alt="Logo Móvil"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <LogoInstitucional variant="small" overrideConfig={previewConfig} showText={false} />
                  <span className="text-[11px] text-slate-500 mt-2 block">
                    (Se usa el logo principal o emblema)
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputLogoMovilRef}
                onChange={(e) => handleFileUpload(e, 'logoMovilUrl')}
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputLogoMovilRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Cargar logo móvil</span>
              </button>

              {previewConfig.logoMovilUrl && (
                <button
                  type="button"
                  onClick={() => updatePreview({ logoMovilUrl: '' })}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Quitar logo móvil</span>
                </button>
              )}
            </div>
          </div>

          {/* Favicon */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                Favicon
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">
                Ícono de Pestaña
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Ícono que se muestra en la pestaña del navegador web.
              </p>
            </div>

            <div className="h-36 rounded-2xl bg-slate-950 border border-dashed border-slate-800 flex items-center justify-center p-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center shadow-inner overflow-hidden">
                  {previewConfig.faviconUrl ? (
                    <img src={previewConfig.faviconUrl} alt="Favicon" className="w-8 h-8 object-contain" />
                  ) : (
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-sm"
                      style={{ backgroundColor: previewConfig.primaryColor }}
                    >
                      {previewConfig.nombreCorto ? previewConfig.nombreCorto.slice(0, 1) : 'Q'}
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-slate-400 font-mono">
                  {previewConfig.faviconUrl ? 'Favicon personalizado' : 'Favicon dinámico SVG'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputFaviconRef}
                onChange={(e) => handleFileUpload(e, 'faviconUrl')}
                accept="image/png,image/jpeg,image/svg+xml,image/x-icon,image/webp"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputFaviconRef.current?.click()}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>Cargar Favicon (ICO / PNG / SVG)</span>
              </button>

              {previewConfig.faviconUrl && (
                <button
                  type="button"
                  onClick={() => updatePreview({ faviconUrl: '' })}
                  className="w-full py-2 rounded-xl bg-slate-800 hover:bg-rose-950 text-slate-300 hover:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Restablecer favicon predeterminado</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 3: PERSONALIZACIÓN DEL TICKET IMPRESO Y KIOSKO */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'ticket' && (
        <div className="space-y-6">
          {/* Banner superior de opciones rápidas */}
          <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/60 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <TicketIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Personalización del Ticket Térmico y Comprobante Oficial
                </h3>
                <p className="text-xs text-blue-200/80">
                  Configure logotipos, encabezados, indicaciones para el ciudadano, código de barras/QR y papel térmico.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={restablecerTextosTicket}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                title="Restaurar textos oficiales del ticket"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Textos</span>
              </button>

              <button
                type="button"
                onClick={handleImprimirPrueba}
                disabled={imprimiendoPrueba}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{imprimiendoPrueba ? 'Imprimiendo prueba...' : 'Probar Impresión de Ticket'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* COLUMNA IZQUIERDA: CONTROLES DE EDICIÓN (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* 1. SECCIÓN: LOGOTIPO DEL TICKET */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                    <h4 className="text-sm font-bold text-white">1. Logotipo del Ticket</h4>
                  </div>

                  {/* Switch para activar/desactivar logo en el ticket */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs font-medium text-slate-400">Mostrar Logo</span>
                    <input
                      type="checkbox"
                      checked={previewConfig.ticketMostrarLogo !== false}
                      onChange={(e) => updatePreview({ ticketMostrarLogo: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 relative"></div>
                  </label>
                </div>

                {previewConfig.ticketMostrarLogo !== false ? (
                  <div className="space-y-4">
                    {/* Visualización del logo actual del ticket */}
                    <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-16 rounded-xl bg-white p-1.5 flex items-center justify-center border border-slate-700 overflow-hidden shrink-0">
                          {previewConfig.ticketLogoUrl || previewConfig.logoPrincipalUrl ? (
                            <img
                              src={previewConfig.ticketLogoUrl || previewConfig.logoPrincipalUrl}
                              alt="Logo Ticket"
                              className="max-h-full max-w-full object-contain filter grayscale contrast-125"
                            />
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 text-center uppercase">
                              Sin Logo
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-white block">
                            {previewConfig.ticketLogoUrl
                              ? 'Logo Exclusivo del Ticket Activo'
                              : previewConfig.logoPrincipalUrl
                              ? 'Usando Logo Principal de la Institución'
                              : 'No hay logotipo cargado actualmente'}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {previewConfig.ticketLogoUrl
                              ? 'Imagen optimizada para impresión térmica.'
                              : 'Heredando el logo del sistema institucional.'}
                          </span>
                        </div>
                      </div>

                      {previewConfig.ticketLogoUrl && (
                        <button
                          type="button"
                          onClick={() => updatePreview({ ticketLogoUrl: '' })}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors cursor-pointer"
                          title="Quitar logo exclusivo y volver a heredar logo principal"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Botonera de carga y copia */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="file"
                        ref={fileInputTicketLogoRef}
                        onChange={(e) => handleFileUpload(e, 'ticketLogoUrl')}
                        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputTicketLogoRef.current?.click()}
                        className="py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Subir Logo para Ticket</span>
                      </button>

                      {previewConfig.logoPrincipalUrl && (
                        <button
                          type="button"
                          onClick={() => updatePreview({ ticketLogoUrl: previewConfig.logoPrincipalUrl })}
                          className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-blue-400" />
                          <span>Copiar Logo Principal</span>
                        </button>
                      )}
                    </div>

                    {/* Selector de tamaño de logo */}
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-2">
                        Tamaño del Logotipo en el Ticket
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'pequeno', label: 'Pequeño', desc: '45px alto' },
                          { id: 'mediano', label: 'Mediano', desc: '65px (Recomendado)' },
                          { id: 'grande', label: 'Grande', desc: '85px alto' }
                        ].map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => updatePreview({ ticketLogoTamano: t.id as any })}
                            className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                              (previewConfig.ticketLogoTamano || 'mediano') === t.id
                                ? 'bg-blue-600/20 border-blue-500 text-white'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            <span className="text-xs font-bold block">{t.label}</span>
                            <span className="text-[10px] text-slate-400">{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>
                        <strong>Consejo para impresoras térmicas:</strong> Utilice imágenes con fondo blanco o transparente y alto contraste (logotipos en negro o tonos oscuros) para evitar manchas de tinta o difuminados en el papel térmico.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/60 text-center">
                    <p className="text-xs text-slate-400">
                      El logotipo está actualmente <strong>desactivado</strong> para los tickets impresos. Solo se mostrará el nombre institucional en texto.
                    </p>
                  </div>
                )}
              </div>

              {/* 2. SECCIÓN: TEXTOS DEL TICKET */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-sm font-bold text-white">2. Textos y Mensajes del Ticket</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">Edición en tiempo real</span>
                </div>

                {/* Encabezado Institucional */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Encabezado Institucional Principal
                  </label>
                  <input
                    type="text"
                    value={previewConfig.ticketEncabezado ?? previewConfig.nombreInstitucion ?? ''}
                    onChange={(e) => updatePreview({ ticketEncabezado: e.target.value })}
                    placeholder="Ej: Tribunal Electoral de Panamá"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-semibold"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Aparece en la parte superior del comprobante en tipografía destacada y mayúsculas.
                  </p>
                </div>

                {/* Subencabezado */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Subencabezado / Tipo de Comprobante o Sede
                  </label>
                  <input
                    type="text"
                    value={previewConfig.ticketSubencabezado ?? 'Comprobante Oficial de Turno'}
                    onChange={(e) => updatePreview({ ticketSubencabezado: e.target.value })}
                    placeholder="Ej: Sede Principal Ancón • Comprobante Oficial"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Línea secundaria debajo del encabezado (puede incluir la sede o dirección regional).
                  </p>
                </div>

                {/* Mensaje de espera */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Mensaje de Espera / Indicaciones para el Ciudadano
                  </label>
                  <textarea
                    rows={2}
                    value={previewConfig.ticketMensajeEspera ?? 'Por favor permanezca atento a la Pantalla Pública y al audio del llamado.'}
                    onChange={(e) => updatePreview({ ticketMensajeEspera: e.target.value })}
                    placeholder="Ej: Por favor permanezca atento a la Pantalla Pública y al audio del llamado."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Instrucción visible debajo de los detalles para orientar a la persona en sala.
                  </p>
                </div>

                {/* Mensaje de pie */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Mensaje de Despedida / Pie
                    </label>
                    <input
                      type="text"
                      value={previewConfig.ticketPieMensaje ?? '¡Gracias por su visita! Conserve este comprobante hasta finalizar su atención.'}
                      onChange={(e) => updatePreview({ ticketPieMensaje: e.target.value })}
                      placeholder="Ej: ¡Gracias por su visita!"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Nota de Validez / Advertencia
                    </label>
                    <input
                      type="text"
                      value={previewConfig.ticketNotaPie ?? 'Validez únicamente para el día de emisión.'}
                      onChange={(e) => updatePreview({ ticketNotaPie: e.target.value })}
                      placeholder="Ej: Validez únicamente para el día de emisión."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. SECCIÓN: ELEMENTOS VISIBLES EN EL TICKET ("Y DEMÁS") */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    <h4 className="text-sm font-bold text-white">3. Elementos Visibles en el Ticket</h4>
                  </div>
                  <span className="text-[11px] text-slate-400">Activar / Desactivar bloques</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    {
                      key: 'ticketMostrarCiudadano',
                      label: 'Nombre del Ciudadano',
                      desc: 'Muestra el nombre completo ingresado en el kiosko',
                      val: previewConfig.ticketMostrarCiudadano !== false
                    },
                    {
                      key: 'ticketMostrarTramite',
                      label: 'Nombre del Trámite',
                      desc: 'Muestra la insignia del trámite (ej: Cedulación)',
                      val: previewConfig.ticketMostrarTramite !== false
                    },
                    {
                      key: 'ticketMostrarFechaHora',
                      label: 'Fecha y Hora de Emisión',
                      desc: 'Muestra la fecha del día y hora exacta del turno',
                      val: previewConfig.ticketMostrarFechaHora !== false
                    },
                    {
                      key: 'ticketMostrarCodigoBarras',
                      label: 'Código de Barras 1D',
                      desc: 'Imprime código de barras lineal para lectores ópticos',
                      val: previewConfig.ticketMostrarCodigoBarras !== false
                    },
                    {
                      key: 'ticketMostrarQr',
                      label: 'Código QR 2D',
                      desc: 'Imprime código QR para verificación digital del turno',
                      val: previewConfig.ticketMostrarQr === true
                    }
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-3 cursor-pointer transition-colors"
                    >
                      <div>
                        <span className="text-xs font-bold text-white block">{item.label}</span>
                        <span className="text-[10px] text-slate-400 leading-tight block mt-0.5">{item.desc}</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => updatePreview({ [item.key]: e.target.checked } as any)}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 bg-slate-900 border-slate-700 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* 4. SECCIÓN: FORMATO DE PAPEL TÉRMICO Y TIPOGRAFÍA */}
              <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <Printer className="w-4 h-4 text-purple-400" />
                  <h4 className="text-sm font-bold text-white">4. Formato de Papel Térmico y Tipografía</h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Ancho de papel */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Ancho de Papel Térmico
                    </label>
                    <select
                      value={previewConfig.ticketAnchoPapel || '80mm'}
                      onChange={(e) => updatePreview({ ticketAnchoPapel: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="80mm">80 mm (Estándar POS)</option>
                      <option value="58mm">58 mm (Compacto POS)</option>
                    </select>
                  </div>

                  {/* Estilo de fuente */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Tipografía del Comprobante
                    </label>
                    <select
                      value={previewConfig.ticketEstiloFuente || 'monospace'}
                      onChange={(e) => updatePreview({ ticketEstiloFuente: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="monospace">Monoespaciada Térmica (Courier)</option>
                      <option value="sans-serif">Sans-serif Moderna (Limpia)</option>
                    </select>
                  </div>

                  {/* Espaciado */}
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                      Densidad / Espaciado
                    </label>
                    <select
                      value={previewConfig.ticketEspaciado || 'normal'}
                      onChange={(e) => updatePreview({ ticketEspaciado: e.target.value as any })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      <option value="compacto">Compacto (Ahorra Papel)</option>
                      <option value="normal">Normal (Equilibrado)</option>
                      <option value="amplio">Amplio (Mayor legibilidad)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* COLUMNA DERECHA: VISTA PREVIA EN VIVO DEL TICKET (5 cols, sticky) */}
            <div className="lg:col-span-5 sticky top-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Vista Previa en Vivo (Papel Térmico)
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800">
                  {previewConfig.ticketAnchoPapel || '80mm'}
                </span>
              </div>

              {/* Render del rollo de ticket térmico */}
              <div className="p-4 sm:p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl flex justify-center">
                <div 
                  className={`bg-white text-black p-5 sm:p-6 shadow-2xl relative transition-all duration-200 ${
                    previewConfig.ticketAnchoPapel === '58mm' ? 'w-[260px]' : 'w-[320px] sm:w-[340px]'
                  }`}
                  style={{
                    fontFamily: previewConfig.ticketEstiloFuente === 'sans-serif' ? 'system-ui, sans-serif' : "'Courier New', Courier, monospace",
                    borderRadius: '2px',
                    boxShadow: '0 20px 35px -10px rgba(0,0,0,0.5), 0 0 1px 1px rgba(0,0,0,0.05)'
                  }}
                >
                  {/* Corte dentado superior simulado */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-repeat-x flex justify-between overflow-hidden opacity-30">
                    {Array.from({ length: 30 }).map((_, i) => (
                      <span key={i} className="inline-block w-2.5 h-1 border-b border-dashed border-slate-400"></span>
                    ))}
                  </div>

                  {/* 1. Logotipo del Ticket */}
                  {previewConfig.ticketMostrarLogo !== false && (previewConfig.ticketLogoUrl || previewConfig.logoPrincipalUrl) && (
                    <div className="text-center mb-3 pt-2">
                      <img
                        src={previewConfig.ticketLogoUrl || previewConfig.logoPrincipalUrl}
                        alt="Logo Ticket"
                        className="mx-auto object-contain filter grayscale contrast-125"
                        style={{
                          maxHeight: previewConfig.ticketLogoTamano === 'pequeno' ? '45px' : previewConfig.ticketLogoTamano === 'grande' ? '85px' : '65px',
                          maxWidth: '85%'
                        }}
                      />
                    </div>
                  )}

                  {/* 2. Encabezado */}
                  <div className="text-center">
                    <h3 className="text-sm font-black uppercase tracking-tight leading-tight">
                      {previewConfig.ticketEncabezado || previewConfig.nombreInstitucion || 'Tribunal Electoral'}
                    </h3>
                    {(previewConfig.ticketSubencabezado || previewConfig.nombreSistema) && (
                      <p className="text-[10px] text-slate-700 mt-0.5 leading-snug">
                        {previewConfig.ticketSubencabezado || `${previewConfig.nombreSistema} • Comprobante Oficial`}
                      </p>
                    )}
                  </div>

                  <div className="my-2.5 border-t border-dashed border-black" />

                  {/* 3. Ciudadano */}
                  {previewConfig.ticketMostrarCiudadano !== false && (
                    <div className="text-center my-1.5">
                      <span className="text-[9px] uppercase tracking-wider text-slate-600 block">Ciudadano(a)</span>
                      <p className="text-xs font-bold capitalize leading-tight">
                        Carlos Eduardo Rodríguez Gómez
                      </p>
                    </div>
                  )}

                  {/* 4. Turno Gigante */}
                  <div className="text-center my-2">
                    <span className="text-[9px] uppercase tracking-wider text-slate-600 block">Número de Turno</span>
                    <div className="text-5xl font-black tracking-tight leading-none my-1 font-mono">
                      C001
                    </div>
                    {previewConfig.ticketMostrarTramite !== false && (
                      <span className="inline-block border border-black rounded px-2 py-0.5 text-[10px] font-bold uppercase mt-1">
                        Cedulación
                      </span>
                    )}
                  </div>

                  {/* 5. Fecha y Hora */}
                  {previewConfig.ticketMostrarFechaHora !== false && (
                    <>
                      <div className="my-2 border-t border-dashed border-black" />
                      <div className="text-[10px] space-y-0.5">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Fecha:</span>
                          <span className="font-semibold">{new Date().toLocaleDateString('es-PA')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Hora:</span>
                          <span className="font-semibold">{new Date().toLocaleTimeString('es-PA')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Estado:</span>
                          <span className="font-semibold">En espera de atención</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* 6. Mensaje de espera */}
                  {previewConfig.ticketMensajeEspera && (
                    <>
                      <div className="my-2 border-t border-dashed border-black" />
                      <p className="text-[9.5px] text-center leading-snug text-slate-900">
                        {previewConfig.ticketMensajeEspera}
                      </p>
                    </>
                  )}

                  {/* 7. Código de barras */}
                  {previewConfig.ticketMostrarCodigoBarras !== false && (
                    <div className="my-3 text-center">
                      <div className="flex justify-center items-center gap-[1.5px] h-6 mx-auto">
                        <span className="w-[2px] h-full bg-black inline-block" />
                        <span className="w-[1px] h-full bg-black inline-block" />
                        <span className="w-[3px] h-full bg-black inline-block" />
                        <span className="w-[1px] h-full bg-black inline-block" />
                        <span className="w-[2px] h-full bg-black inline-block" />
                        <span className="w-[4px] h-full bg-black inline-block" />
                        <span className="w-[1px] h-full bg-black inline-block" />
                        <span className="w-[2px] h-full bg-black inline-block" />
                        <span className="w-[3px] h-full bg-black inline-block" />
                        <span className="w-[1px] h-full bg-black inline-block" />
                        <span className="w-[2px] h-full bg-black inline-block" />
                      </div>
                      <span className="text-[10px] font-mono tracking-widest block mt-0.5 font-bold">*C001*</span>
                    </div>
                  )}

                  {/* 8. Código QR */}
                  {previewConfig.ticketMostrarQr === true && (
                    <div className="my-2.5 text-center">
                      <div className="inline-block p-1 bg-white border border-black rounded">
                        <QrCode className="w-12 h-12 text-black mx-auto" />
                      </div>
                      <span className="text-[8px] text-slate-600 block mt-0.5">Verificación Digital de Turno</span>
                    </div>
                  )}

                  {/* 9. Pie de ticket */}
                  {(previewConfig.ticketPieMensaje || previewConfig.ticketNotaPie) && (
                    <>
                      <div className="my-2 border-t border-dashed border-black" />
                      {previewConfig.ticketPieMensaje && (
                        <p className="text-[9px] text-center font-bold leading-tight text-slate-800">
                          {previewConfig.ticketPieMensaje}
                        </p>
                      )}
                      {previewConfig.ticketNotaPie && (
                        <p className="text-[8px] text-center italic text-slate-600 mt-1">
                          {previewConfig.ticketNotaPie}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Botón de acción para imprimir prueba */}
              <button
                type="button"
                onClick={handleImprimirPrueba}
                disabled={imprimiendoPrueba}
                className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-98"
              >
                <Printer className="w-4 h-4" />
                <span>{imprimiendoPrueba ? 'ENVIANDO A IMPRESORA...' : 'IMPRIMIR TICKET DE PRUEBA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 4: COLORES Y PALETA */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'colores' && (
        <div className="space-y-6">
          {/* Paletas de muestra en 1 clic */}
          <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Paletas de Identidad Institucional Recomendadas (1 Clic)
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {PALETAS_PREDEFINIDAS.map((pal, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => aplicarPaleta(pal)}
                  className="p-3 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-600 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span 
                      className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: pal.primaryColor }}
                    />
                    <span 
                      className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: pal.surfaceColor }}
                    />
                    <span 
                      className="w-4 h-4 rounded-full border border-white/20 shadow-xs"
                      style={{ backgroundColor: pal.backgroundColor }}
                    />
                  </div>
                  <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors block">
                    {pal.nombre}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Grilla de variables de diseño */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Color Principal */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color Principal (Primary)</span>
                <span className="text-[11px] text-slate-400">Acciones clave, logos y selección</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.primaryColor}
                  onChange={(e) => updatePreview({ primaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.primaryColor}
                  onChange={(e) => updatePreview({ primaryColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color Secundario */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color Secundario</span>
                <span className="text-[11px] text-slate-400">Módulos de triada y contrastes</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.secondaryColor}
                  onChange={(e) => updatePreview({ secondaryColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.secondaryColor}
                  onChange={(e) => updatePreview({ secondaryColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Fondo Principal */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color de Fondo General</span>
                <span className="text-[11px] text-slate-400">Fondo de toda la aplicación</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.backgroundColor}
                  onChange={(e) => updatePreview({ backgroundColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.backgroundColor}
                  onChange={(e) => updatePreview({ backgroundColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Tarjetas / Superficies */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color de Tarjetas (Surface)</span>
                <span className="text-[11px] text-slate-400">Contenedores, cubículos y paneles</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.surfaceColor}
                  onChange={(e) => updatePreview({ surfaceColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.surfaceColor}
                  onChange={(e) => updatePreview({ surfaceColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Textos Principales */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color de Texto Principal</span>
                <span className="text-[11px] text-slate-400">Títulos y lectura de turnos</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.textColor}
                  onChange={(e) => updatePreview({ textColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.textColor}
                  onChange={(e) => updatePreview({ textColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Textos Secundarios */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Texto Atenuado (Muted)</span>
                <span className="text-[11px] text-slate-400">Subtítulos, fechas y rótulos</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.mutedTextColor}
                  onChange={(e) => updatePreview({ mutedTextColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.mutedTextColor}
                  onChange={(e) => updatePreview({ mutedTextColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Botones */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color de Botones</span>
                <span className="text-[11px] text-slate-400">Fondo de botones principales</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.buttonColor}
                  onChange={(e) => updatePreview({ buttonColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.buttonColor}
                  onChange={(e) => updatePreview({ buttonColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Botones al pasar el mouse (Hover) */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color Botón Hover</span>
                <span className="text-[11px] text-slate-400">Al interactuar con el mouse</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.buttonHoverColor}
                  onChange={(e) => updatePreview({ buttonHoverColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.buttonHoverColor}
                  onChange={(e) => updatePreview({ buttonHoverColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Bordes */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-white block">Color de Bordes</span>
                <span className="text-[11px] text-slate-400">Líneas divisorias y contornos</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.borderColor}
                  onChange={(e) => updatePreview({ borderColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.borderColor}
                  onChange={(e) => updatePreview({ borderColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Éxito */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 block">Color de Éxito</span>
                <span className="text-[11px] text-slate-400">Turnos finalizados y activos</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.successColor}
                  onChange={(e) => updatePreview({ successColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.successColor}
                  onChange={(e) => updatePreview({ successColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Advertencia */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-amber-400 block">Color de Advertencia</span>
                <span className="text-[11px] text-slate-400">Turnos en espera y avisos</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.warningColor}
                  onChange={(e) => updatePreview({ warningColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.warningColor}
                  onChange={(e) => updatePreview({ warningColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>

            {/* Color de Error */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-rose-400 block">Color de Error</span>
                <span className="text-[11px] text-slate-400">No presentados y alertas</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={previewConfig.errorColor}
                  onChange={(e) => updatePreview({ errorColor: e.target.value })}
                  className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0"
                />
                <input
                  type="text"
                  value={previewConfig.errorColor}
                  onChange={(e) => updatePreview({ errorColor: e.target.value })}
                  className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-white text-center"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 4: TIPOGRAFÍA Y ESTILOS */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'estilos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tipografía */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Type className="w-4 h-4 text-blue-400" />
              <span>Tipografía Principal del Sistema</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Fuente tipográfica
              </label>
              <select
                value={previewConfig.fontFamily}
                onChange={(e) => updatePreview({ fontFamily: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
              >
                <option value="Plus Jakarta Sans">Plus Jakarta Sans (Recomendada institucional)</option>
                <option value="Outfit">Outfit (Moderna y geométrica)</option>
                <option value="Inter">Inter (Corporativa y limpia)</option>
                <option value="Montserrat">Montserrat (Distintiva)</option>
                <option value="Roboto">Roboto (Universal)</option>
              </select>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <span className="text-[11px] font-mono text-slate-400 block">Ejemplo de renderizado:</span>
              <p className="text-xl font-bold text-white tracking-tight" style={{ fontFamily: previewConfig.fontFamily }}>
                Turno C001 • Atención en Ventanilla 1
              </p>
              <p className="text-xs text-slate-400" style={{ fontFamily: previewConfig.fontFamily }}>
                Cédula de Identidad y Registro Civil. Institución Pública del Estado.
              </p>
            </div>
          </div>

          {/* Radio de esquinas y escala */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Layout className="w-4 h-4 text-indigo-400" />
              <span>Geometría y Escala</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Redondeo de Esquinas en Tarjetas y Botones
              </label>
              <select
                value={previewConfig.borderRadius}
                onChange={(e) => updatePreview({ borderRadius: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="none">Sin esquinas redondeadas (0px - Estilo clásico)</option>
                <option value="small">Pequeño (6px - Sutil)</option>
                <option value="medium">Mediano (12px - Estándar recomendado)</option>
                <option value="large">Grande (20px - Moderno)</option>
                <option value="full">Completamente redondeado (Píldora)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Densidad y Tamaño General de la Interfaz
              </label>
              <select
                value={previewConfig.interfaceSize}
                onChange={(e) => updatePreview({ interfaceSize: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="compact">Compacto (Mayor densidad de datos)</option>
                <option value="normal">Normal (Equilibrio estándar)</option>
                <option value="large">Amplio (Mayor visibilidad y accesibilidad)</option>
              </select>
            </div>

            {/* Fondo de pantalla pública de turnos */}
            <div className="pt-3 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Fondo de la Pantalla Pública de Turnos (TV)
              </label>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <button
                  type="button"
                  onClick={() => updatePreview({ pantallaFondoTipo: 'color', pantallaFondoValor: '#020617' })}
                  className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    previewConfig.pantallaFondoTipo === 'color'
                      ? 'bg-blue-950 border-blue-500 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Color Sólido Oscuro
                </button>
                <button
                  type="button"
                  onClick={() => updatePreview({ pantallaFondoTipo: 'degradado', pantallaFondoValor: 'linear-gradient(135deg, #090D16 0%, #030712 100%)' })}
                  className={`py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                    previewConfig.pantallaFondoTipo === 'degradado'
                      ? 'bg-blue-950 border-blue-500 text-blue-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  Degradado Elegante
                </button>
              </div>

              {previewConfig.pantallaFondoTipo === 'color' && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={previewConfig.pantallaFondoValor.startsWith('#') ? previewConfig.pantallaFondoValor : '#020617'}
                    onChange={(e) => updatePreview({ pantallaFondoValor: e.target.value })}
                    className="w-9 h-9 rounded-lg bg-transparent border-0 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={previewConfig.pantallaFondoValor}
                    onChange={(e) => updatePreview({ pantallaFondoValor: e.target.value })}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* PESTAÑA 5: VISTA PREVIA EN VIVO */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'vista-previa' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-800/60 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Eye className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <span className="text-sm font-bold text-white block">
                  Simulación en Tiempo Real de Componentes
                </span>
                <span className="text-xs text-indigo-200">
                  Esta muestra refleja fielmente cómo se visualizan botones, formularios, alertas, tarjetas y la pantalla de turnos con los colores y logos elegidos.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Aplicar y Guardar</span>
              </button>
            </div>
          </div>

          {/* Lienzo de simulación con variables aplicadas */}
          <div 
            className="p-6 rounded-3xl border shadow-2xl transition-all space-y-8"
            style={{
              backgroundColor: previewConfig.backgroundColor,
              borderColor: previewConfig.borderColor,
              fontFamily: previewConfig.fontFamily
            }}
          >
            {/* 1. Muestra de Menú / Barra Superior */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: previewConfig.mutedTextColor }}>
                A. Barra Superior Simulada
              </span>
              <div 
                className="p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 shadow-md"
                style={{
                  backgroundColor: previewConfig.surfaceColor,
                  borderColor: previewConfig.borderColor
                }}
              >
                <LogoInstitucional overrideConfig={previewConfig} />

                <div className="flex items-center gap-2">
                  <span 
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
                    style={{ backgroundColor: previewConfig.buttonColor }}
                  >
                    <TicketIcon className="w-3.5 h-3.5" />
                    <span>Kiosco</span>
                  </span>
                  <span 
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5"
                    style={{
                      borderColor: previewConfig.borderColor,
                      color: previewConfig.textColor
                    }}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Pantallas</span>
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Muestra de Botones y Formularios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div 
                className="p-5 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: previewConfig.surfaceColor,
                  borderColor: previewConfig.borderColor
                }}
              >
                <h4 className="text-sm font-bold" style={{ color: previewConfig.headerColor }}>
                  B. Botones y Estados Interactivos
                </h4>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-transform hover:scale-105"
                    style={{ backgroundColor: previewConfig.buttonColor }}
                  >
                    Botón Primario
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md"
                    style={{ backgroundColor: previewConfig.secondaryColor }}
                  >
                    Botón Secundario
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-semibold border"
                    style={{
                      borderColor: previewConfig.borderColor,
                      color: previewConfig.textColor
                    }}
                  >
                    Botón Bordeado
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white"
                    style={{ backgroundColor: previewConfig.errorColor }}
                  >
                    Acción Peligrosa
                  </button>
                </div>
              </div>

              <div 
                className="p-5 rounded-2xl border space-y-3"
                style={{
                  backgroundColor: previewConfig.surfaceColor,
                  borderColor: previewConfig.borderColor
                }}
              >
                <h4 className="text-sm font-bold" style={{ color: previewConfig.headerColor }}>
                  C. Formulario de Entrada
                </h4>

                <div>
                  <label className="text-xs font-semibold block mb-1" style={{ color: previewConfig.textColor }}>
                    Nombre del Ciudadano
                  </label>
                  <input
                    type="text"
                    readOnly
                    value="Laura Gómez Hernández"
                    className="w-full rounded-xl px-3.5 py-2 text-xs border"
                    style={{
                      backgroundColor: previewConfig.backgroundColor,
                      borderColor: previewConfig.borderColor,
                      color: previewConfig.textColor
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 3. Muestra de Tarjetas de Métricas y Cubículo */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider block mb-2" style={{ color: previewConfig.mutedTextColor }}>
                D. Tarjetas de Estadísticas y Cubículo de Atención
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: previewConfig.surfaceColor,
                    borderColor: previewConfig.borderColor
                  }}
                >
                  <span className="text-[11px] font-bold uppercase block" style={{ color: previewConfig.mutedTextColor }}>
                    Total Atendidos
                  </span>
                  <div className="text-2xl font-black mt-1" style={{ color: previewConfig.headerColor }}>
                    148
                  </div>
                </div>

                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: previewConfig.surfaceColor,
                    borderColor: previewConfig.borderColor
                  }}
                >
                  <span className="text-[11px] font-bold uppercase block" style={{ color: previewConfig.primaryColor }}>
                    En Cola
                  </span>
                  <div className="text-2xl font-black mt-1" style={{ color: previewConfig.primaryColor }}>
                    7
                  </div>
                </div>

                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: previewConfig.surfaceColor,
                    borderColor: previewConfig.borderColor
                  }}
                >
                  <span className="text-[11px] font-bold uppercase block" style={{ color: previewConfig.warningColor }}>
                    En Atención
                  </span>
                  <div className="text-2xl font-black mt-1" style={{ color: previewConfig.warningColor }}>
                    5
                  </div>
                </div>

                <div 
                  className="p-4 rounded-2xl border"
                  style={{
                    backgroundColor: previewConfig.surfaceColor,
                    borderColor: previewConfig.borderColor
                  }}
                >
                  <span className="text-[11px] font-bold uppercase block" style={{ color: previewConfig.successColor }}>
                    Completados
                  </span>
                  <div className="text-2xl font-black mt-1" style={{ color: previewConfig.successColor }}>
                    136
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Muestra de Alertas */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div 
                className="p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium"
                style={{
                  backgroundColor: `${previewConfig.successColor}15`,
                  borderColor: `${previewConfig.successColor}40`,
                  color: previewConfig.successColor
                }}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Trámite C001 completado</span>
              </div>

              <div 
                className="p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium"
                style={{
                  backgroundColor: `${previewConfig.warningColor}15`,
                  borderColor: `${previewConfig.warningColor}40`,
                  color: previewConfig.warningColor
                }}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>3 minutos en espera</span>
              </div>

              <div 
                className="p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium"
                style={{
                  backgroundColor: `${previewConfig.errorColor}15`,
                  borderColor: `${previewConfig.errorColor}40`,
                  color: previewConfig.errorColor
                }}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Turno no se presentó</span>
              </div>
            </div>

            {/* 5. Muestra de Pantalla de Turnos Pública Simulada */}
            <div 
              className="p-6 rounded-3xl border shadow-xl relative overflow-hidden"
              style={{
                backgroundColor: previewConfig.surfaceColor,
                borderColor: previewConfig.borderColor
              }}
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b" style={{ borderColor: previewConfig.borderColor }}>
                <div className="flex items-center gap-2">
                  <Bell className="w-5 h-5" style={{ color: previewConfig.primaryColor }} />
                  <span className="text-sm font-black uppercase tracking-tight" style={{ color: previewConfig.headerColor }}>
                    Simulación de Pantalla de TV (Llamado Activo)
                  </span>
                </div>
                <span className="text-xs font-mono font-bold" style={{ color: previewConfig.mutedTextColor }}>
                  {previewConfig.nombreInstitucion}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center text-center">
                <div 
                  className="p-6 rounded-2xl border"
                  style={{
                    backgroundColor: previewConfig.backgroundColor,
                    borderColor: previewConfig.primaryColor
                  }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: previewConfig.mutedTextColor }}>
                    Turno Llamado
                  </span>
                  <div 
                    className="text-5xl font-black my-2 font-mono tracking-tighter"
                    style={{ color: previewConfig.primaryColor }}
                  >
                    C001
                  </div>
                  <span className="text-sm font-bold" style={{ color: previewConfig.textColor }}>
                    Juan Rodríguez • Cedulación
                  </span>
                </div>

                <div 
                  className="p-6 rounded-2xl border"
                  style={{
                    backgroundColor: previewConfig.backgroundColor,
                    borderColor: previewConfig.secondaryColor
                  }}
                >
                  <span className="text-xs font-bold uppercase tracking-wider block" style={{ color: previewConfig.mutedTextColor }}>
                    Pase a la Estación
                  </span>
                  <div 
                    className="text-5xl font-black my-2 tracking-tighter"
                    style={{ color: previewConfig.secondaryColor }}
                  >
                    Caja 1
                  </div>
                  <span className="text-sm font-semibold" style={{ color: previewConfig.mutedTextColor }}>
                    Ventanilla de Atención al Público
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación para Restaurar Valores Predeterminados */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-lg font-bold text-white">
                ¿Restaurar valores predeterminados?
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Esta acción restablecerá el nombre institucional, logotipos, colores originales y tipografía a los valores de fábrica del sistema.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md cursor-pointer transition-colors"
              >
                Sí, restablecer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
