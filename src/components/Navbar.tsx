import React from 'react';
import { 
  Ticket as TicketIcon, 
  Monitor, 
  Tv, 
  Settings, 
  Volume2, 
  VolumeX, 
  ExternalLink,
  Wifi,
  WifiOff,
  Camera,
  Palette
} from 'lucide-react';
import { wsClient } from '../services/websocketClient';
import { Caja } from '../types';
import { LogoInstitucional } from './LogoInstitucional';
import { useCustomization } from '../context/CustomizationContext';

export type AppView = 'kiosk' | 'caja' | 'triada' | 'pantalla-caja' | 'pantalla-triada' | 'pantalla' | 'admin';

interface NavbarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  adminTab?: 'metricas' | 'caja' | 'triada' | 'personalizacion';
  onAdminTabChange?: (tab: 'metricas' | 'caja' | 'triada' | 'personalizacion') => void;
  cajaSeleccionadaId: number;
  onCajaChange: (id: number) => void;
  connectionStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED';
  audioEnabled: boolean;
  onToggleAudio: () => void;
  cajas: Caja[];
  triadaEsperandoCount?: number;
  currentSedeId?: string;
  onSedeChange?: (sedeId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  adminTab = 'metricas',
  onAdminTabChange,
  cajaSeleccionadaId,
  onCajaChange,
  connectionStatus,
  audioEnabled,
  onToggleAudio,
  cajas,
  triadaEsperandoCount = 0,
  currentSedeId = 'ancon',
  onSedeChange
}) => {
  const { configuracion } = useCustomization();

  const openInNewWindow = (view: AppView, cajaId?: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    if (view === 'admin' && adminTab) {
      url.searchParams.set('tab', adminTab);
    } else {
      url.searchParams.delete('tab');
    }
    if (cajaId) {
      url.searchParams.set('cajaId', cajaId.toString());
    } else {
      url.searchParams.delete('cajaId');
    }
    window.open(url.toString(), '_blank');
  };

  const cajasAtencion = cajas.filter(c => c.tipo !== 'TRIADA');
  const modulosTriada = cajas.filter(c => c.tipo === 'TRIADA');

  return (
    <header 
      className="backdrop-blur-md border-b sticky top-0 z-50 px-4 py-2.5 transition-colors duration-200"
      style={{
        backgroundColor: `${configuracion.surfaceColor}FA`,
        borderColor: configuracion.borderColor
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Logo y estado de conexión */}
        <div className="flex items-center gap-3">
          <LogoInstitucional variant="navbar" />

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Indicador de conexión */}
          <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700">
            {connectionStatus === 'CONNECTED' ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 font-medium">En vivo</span>
              </>
            ) : connectionStatus === 'CONNECTING' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-400">Conectando...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                <span className="text-rose-400">Reconectando</span>
              </>
            )}
          </div>

          {/* Selector de Sede */}
          <div className="flex items-center gap-1">
            <select
              value={currentSedeId}
              onChange={(e) => onSedeChange?.(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs font-bold py-1 px-2.5 rounded-lg cursor-pointer max-w-[220px] truncate focus:outline-none focus:border-blue-500"
              title="Seleccionar sede o dirección regional del Tribunal Electoral"
              style={{
                borderColor: configuracion.borderColor,
                color: configuracion.textColor,
                backgroundColor: configuracion.backgroundColor
              }}
            >
              <option value="ancon">TE Ancón (Principal)</option>
              <option value="bocas_del_toro">Reg. Bocas del Toro</option>
              <option value="cocle">Reg. Coclé</option>
              <option value="colon">Reg. Colón</option>
              <option value="chiriqui">Reg. Chiriquí</option>
              <option value="darien">Reg. Darién</option>
              <option value="herrera">Reg. Herrera</option>
              <option value="los_santos">Reg. Los Santos</option>
              <option value="panama_centro">Reg. Panamá Centro</option>
              <option value="panama_norte">Reg. Panamá Norte</option>
              <option value="panama_este">Reg. Panamá Este</option>
              <option value="panama_oeste">Reg. Panamá Oeste</option>
              <option value="san_miguelito">Reg. San Miguelito</option>
              <option value="veraguas">Reg. Veraguas</option>
              <option value="guna_yala">Reg. Guna Yala</option>
              <option value="arraijan">Reg. Arraiján</option>
            </select>
          </div>
        </div>

        {/* Selector de vistas principales */}
        <nav 
          className="flex items-center gap-1 p-1 rounded-xl border flex-wrap"
          style={{
            backgroundColor: configuracion.backgroundColor,
            borderColor: configuracion.borderColor
          }}
        >
          <button
            onClick={() => onViewChange('kiosk')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'kiosk'
                ? 'text-white shadow-sm'
                : 'hover:text-white'
            }`}
            style={{
              backgroundColor: currentView === 'kiosk' ? configuracion.buttonColor : 'transparent',
              color: currentView === 'kiosk' ? '#FFFFFF' : configuracion.textColor
            }}
          >
            <TicketIcon className="w-3.5 h-3.5" />
            <span>Kiosco</span>
          </button>

          {/* PANTALLA DE CAJAS */}
          <button
            onClick={() => onViewChange('pantalla-caja')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'pantalla-caja' || currentView === 'pantalla'
                ? 'text-white shadow-sm ring-1 ring-blue-400/50'
                : 'hover:text-white'
            }`}
            style={{
              backgroundColor: (currentView === 'pantalla-caja' || currentView === 'pantalla') ? configuracion.primaryColor : 'transparent',
              color: (currentView === 'pantalla-caja' || currentView === 'pantalla') ? '#FFFFFF' : configuracion.textColor
            }}
            title="Pantalla de TV para Sala de Cajas (Ventanillas 0 a 8)"
          >
            <Tv className="w-3.5 h-3.5 text-blue-300" />
            <span>Pantalla Cajas</span>
          </button>

          {/* PANTALLA DE TRIADA / FOTOGRAFÍA */}
          <button
            onClick={() => onViewChange('pantalla-triada')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentView === 'pantalla-triada'
                ? 'text-white shadow-sm ring-1 ring-indigo-400/50'
                : 'text-indigo-300 hover:text-white'
            }`}
            style={{
              backgroundColor: currentView === 'pantalla-triada' ? configuracion.secondaryColor : 'transparent',
              color: currentView === 'pantalla-triada' ? '#FFFFFF' : configuracion.textColor
            }}
            title="Pantalla de TV para Sala de Triada (Fotografía y Biometría 1 a 8)"
          >
            <Camera className="w-3.5 h-3.5 text-indigo-400" />
            <span>Pantalla Triada</span>
          </button>

          {/* ADMINISTRACIÓN (CONTIENE CONTROL CENTRAL, CAJAS, TRIADA Y PERSONALIZACIÓN) */}
          <div className="flex items-center">
            <button
              onClick={() => onViewChange('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'hover:text-white'
              }`}
              style={{
                color: currentView === 'admin' ? '#FFFFFF' : configuracion.textColor
              }}
              title="Panel Administrativo: Métricas, Cajas, Triada y Personalización"
            >
              <Settings className="w-3.5 h-3.5 text-blue-400" />
              <span>Admin</span>
              {triadaEsperandoCount > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                  {triadaEsperandoCount}
                </span>
              )}
            </button>

            {/* Sub-pestañas de Admin si está activa la vista admin */}
            {currentView === 'admin' && (
              <div 
                className="flex items-center gap-0.5 p-0.5 rounded-lg border ml-1"
                style={{
                  backgroundColor: `${configuracion.surfaceColor}EE`,
                  borderColor: configuracion.borderColor
                }}
              >
                <button
                  type="button"
                  onClick={() => onAdminTabChange?.('metricas')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    adminTab === 'metricas'
                      ? 'text-white shadow-xs'
                      : 'hover:text-white'
                  }`}
                  style={{
                    backgroundColor: adminTab === 'metricas' ? configuracion.buttonColor : 'transparent',
                    color: adminTab === 'metricas' ? '#FFFFFF' : configuracion.mutedTextColor
                  }}
                  title="Supervisión y Métricas"
                >
                  Métricas
                </button>
                <button
                  type="button"
                  onClick={() => onAdminTabChange?.('caja')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer ${
                    adminTab === 'caja'
                      ? 'text-white shadow-xs'
                      : 'hover:text-white'
                  }`}
                  style={{
                    backgroundColor: adminTab === 'caja' ? configuracion.buttonColor : 'transparent',
                    color: adminTab === 'caja' ? '#FFFFFF' : configuracion.mutedTextColor
                  }}
                  title="Operar Ventanillas de Caja (0 a 8)"
                >
                  Cajas
                </button>
                <button
                  type="button"
                  onClick={() => onAdminTabChange?.('triada')}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    adminTab === 'triada'
                      ? 'text-white shadow-xs'
                      : 'hover:text-white'
                  }`}
                  style={{
                    backgroundColor: adminTab === 'triada' ? configuracion.secondaryColor : 'transparent',
                    color: adminTab === 'triada' ? '#FFFFFF' : configuracion.mutedTextColor
                  }}
                  title="Operar Módulos de Triada / Fotografía (1 a 8)"
                >
                  <span>Triada</span>
                  {triadaEsperandoCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
              </div>
            )}
          </div>
        </nav>

        {/* Selector de Estación de Trabajo del Funcionario */}
        <div className="flex items-center gap-2">
          {(currentView === 'caja' || currentView === 'triada' || (currentView === 'admin' && (adminTab === 'caja' || adminTab === 'triada'))) && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs shadow-sm ${
              adminTab === 'triada' || currentView === 'triada'
                ? 'bg-indigo-950/80 border-indigo-700/80'
                : 'bg-blue-950/80 border-blue-700/80'
            }`}>
              <span className={`font-bold hidden sm:inline ${
                adminTab === 'triada' || currentView === 'triada' ? 'text-indigo-300' : 'text-blue-300'
              }`}>
                Estación:
              </span>
              <select
                id="navbar-station-select"
                value={cajaSeleccionadaId}
                onChange={(e) => onCajaChange(Number(e.target.value))}
                className="bg-slate-900 text-white font-bold rounded px-2 py-0.5 border border-slate-700 focus:outline-none focus:border-blue-500 text-xs cursor-pointer"
                title="Elegir estación de trabajo en la que opera el funcionario"
              >
                <optgroup label="Ventanillas de Caja (0 a 8)">
                  {cajasAtencion.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                  {modulosTriada.map((c) => (
                    <option key={c.id} value={c.id}>
                      Triada {c.numero}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          {/* Toggle de sonido */}
          <button
            onClick={onToggleAudio}
            title={audioEnabled ? 'Sonido activado (clic para silenciar)' : 'Sonido silenciado'}
            className={`p-2 rounded-lg border transition-colors cursor-pointer ${
              audioEnabled 
                ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700' 
                : 'bg-slate-800/50 border-slate-800 text-slate-500 hover:text-slate-400'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Abrir en ventana independiente para pruebas simultáneas */}
          <button
            onClick={() => openInNewWindow(currentView, (adminTab === 'caja' || adminTab === 'triada' || currentView === 'caja' || currentView === 'triada') ? cajaSeleccionadaId : undefined)}
            title="Abrir esta vista en una ventana separada para pruebas simultáneas"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Nueva Ventana</span>
          </button>
        </div>
      </div>
    </header>
  );
};
