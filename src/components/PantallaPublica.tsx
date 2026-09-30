import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Tv, 
  Volume2, 
  Clock, 
  Maximize2, 
  Minimize2, 
  Sparkles, 
  Calendar, 
  User, 
  Bell, 
  MapPin,
  Eye,
  Camera,
  Layers,
  ArrowRight,
  Users,
  CheckCircle2,
  Activity
} from 'lucide-react';
import { Ticket, Caja, SEDES } from '../types';
import { useCustomization } from '../context/CustomizationContext';
import { LogoInstitucional } from './LogoInstitucional';

export type TipoPantallaPublica = 'CAJA' | 'TRIADA' | 'TODAS';

interface PantallaPublicaProps {
  tipoPantalla?: TipoPantallaPublica;
  onCambiarTipoPantalla?: (tipo: TipoPantallaPublica) => void;
  ultimoLlamado: Ticket | null;
  ultimoLlamadoCaja?: Ticket | null;
  ultimoLlamadoTriada?: Ticket | null;
  ultimosLlamados: Ticket[];
  ticketsActivos?: Ticket[];
  cajas?: Caja[];
  ticketsEsperando?: Ticket[];
  audioEnabled: boolean;
  onToggleAudio: () => void;
  sedeId?: string;
}

export const PantallaPublica: React.FC<PantallaPublicaProps> = ({
  tipoPantalla: tipoProp = 'CAJA',
  onCambiarTipoPantalla,
  ultimoLlamado,
  ultimoLlamadoCaja,
  ultimoLlamadoTriada,
  ultimosLlamados = [],
  ticketsActivos = [],
  cajas = [],
  ticketsEsperando = [],
  audioEnabled,
  onToggleAudio,
  sedeId = 'ancon'
}) => {
  const { configuracion } = useCustomization();
  const [tipoLocal, setTipoLocal] = useState<TipoPantallaPublica>(tipoProp === 'TODAS' && sedeId !== 'ancon' ? 'CAJA' : tipoProp);
  const [horaActual, setHoraActual] = useState(new Date());
  const [esPantallaCompleta, setEsPantallaCompleta] = useState(false);
  const [destacarNuevo, setDestacarNuevo] = useState(false);
  // Control de panel lateral para pantalla limpia o completa
  const [modoExclusivo, setModoExclusivo] = useState(false);
  // Estado para el llamado temporal en pantalla exclusiva gigante ("solo se vea el llamado en grande temporalmente")
  const [llamadoSoloGrande, setLlamadoSoloGrande] = useState<Ticket | null>(null);
  const [tiempoRestanteGrande, setTiempoRestanteGrande] = useState<number>(0);

  // Alternador automático de pantalla única para sedes regionales
  const [cicloSegundos, setCicloSegundos] = useState(10); // Configurable, default 10s
  const [estaAlternando, setEstaAlternando] = useState(false); // Desactivado por defecto (se prioriza el cambio reactivo inteligente)

  // Obtener Sede actual
  const sedeActual = SEDES.find(s => s.id === sedeId) || SEDES[0];

  // Cambio automático reactivo inteligente: cuando se llama a un turno (CAJA o TRIADA),
  // la pantalla única compartida de la sede regional cambia automáticamente de modo al instante.
  useEffect(() => {
    if (sedeId !== 'ancon' && ultimoLlamado && ultimoLlamado.estado === 'LLAMANDO') {
      const etapa = ultimoLlamado.etapa;
      if (etapa === 'TRIADA') {
        setTipoLocal('TRIADA');
      } else {
        setTipoLocal('CAJA');
      }
    }
  }, [ultimoLlamado?.id, ultimoLlamado?.fechaLlamado, ultimoLlamado?.llamadosContador, sedeId]);

  // Sincronizar prop con estado local, pero si es TODAS y no es ancon, empezar en CAJA
  useEffect(() => {
    if (tipoProp === 'TODAS' && sedeId !== 'ancon') {
      setTipoLocal('CAJA');
    } else {
      setTipoLocal(tipoProp);
    }
  }, [tipoProp, sedeId]);

  useEffect(() => {
    const debeAlternar = (tipoProp === 'TODAS' || tipoLocal === 'TODAS') && (sedeId !== 'ancon');
    if (!debeAlternar || !estaAlternando) return;

    const interval = setInterval(() => {
      setTipoLocal((prev) => (prev === 'CAJA' ? 'TRIADA' : 'CAJA'));
    }, cicloSegundos * 1000);

    return () => clearInterval(interval);
  }, [tipoProp, sedeId, cicloSegundos, estaAlternando, tipoLocal]);

  const setTipo = (nuevoTipo: TipoPantallaPublica) => {
    setTipoLocal(nuevoTipo);
    if (onCambiarTipoPantalla) {
      onCambiarTipoPantalla(nuevoTipo);
    }
  };

  // Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => setHoraActual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Escuchar evento de pantalla completa nativo
  useEffect(() => {
    const handleFullscreenChange = () => {
      setEsPantallaCompleta(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Filtrar módulos de atención según la pantalla activa
  const cajasMostradas = cajas.filter((c) => {
    if (tipoLocal === 'CAJA') return c.tipo !== 'TRIADA';
    if (tipoLocal === 'TRIADA') return c.tipo === 'TRIADA';
    return true;
  });

  // Turnos que están activamente en esta sala (llamando o en atención en los módulos)
  const turnosEnSala = (ticketsActivos.length > 0 ? ticketsActivos : ultimosLlamados)
    .filter((t) => {
      const etapaMatch = tipoLocal === 'CAJA' ? t.etapa !== 'TRIADA' : (tipoLocal === 'TRIADA' ? t.etapa === 'TRIADA' : true);
      return etapaMatch && (t.estado === 'EN_ATENCION' || t.estado === 'LLAMANDO');
    })
    .filter((t, idx, self) => idx === self.findIndex(s => s.id === t.id || s.codigo === t.codigo));

  // Seleccionar el ticket activamente en llamado según la pantalla activa:
  // En las pantallas de Caja y Triada solo se muestra el turno que está siendo activamente LLAMADO.
  // Cuando en caja o en triada se da "Iniciar atención", el ticket pasa a EN_ATENCION y DEBE IRSE DE LA PANTALLA.
  const ticketLlamandoSala: Ticket | null = (() => {
    if (tipoLocal === 'CAJA') {
      if (ultimoLlamadoCaja && ultimoLlamadoCaja.estado === 'LLAMANDO' && ultimoLlamadoCaja.etapa !== 'TRIADA') {
        return ultimoLlamadoCaja;
      }
      const findLlamando = ultimosLlamados.find(t => t.etapa !== 'TRIADA' && t.estado === 'LLAMANDO');
      if (findLlamando) return findLlamando;
      if (ultimoLlamado && ultimoLlamado.estado === 'LLAMANDO' && ultimoLlamado.etapa !== 'TRIADA') {
        return ultimoLlamado;
      }
      return null;
    }
    if (tipoLocal === 'TRIADA') {
      if (ultimoLlamadoTriada && ultimoLlamadoTriada.estado === 'LLAMANDO' && ultimoLlamadoTriada.etapa === 'TRIADA') {
        return ultimoLlamadoTriada;
      }
      const findLlamando = ultimosLlamados.find(t => t.etapa === 'TRIADA' && t.estado === 'LLAMANDO');
      if (findLlamando) return findLlamando;
      if (ultimoLlamado && ultimoLlamado.estado === 'LLAMANDO' && ultimoLlamado.etapa === 'TRIADA') {
        return ultimoLlamado;
      }
      return null;
    }
    return (ultimoLlamado?.estado === 'LLAMANDO' ? ultimoLlamado : null)
      || ultimosLlamados.find(t => t.estado === 'LLAMANDO')
      || null;
  })();

  // El ticket principal mostrado en pantalla:
  // SOLO se muestra si está en LLAMANDO. Al dar "Iniciar atención", el ticket se va de la pantalla de inmediato.
  const ticketMostrado: Ticket | null = ticketLlamandoSala;

  // Determinar si el ticket mostrado está en pleno llamado activo o destacándose
  const esLlamandoActivo = ticketMostrado?.estado === 'LLAMANDO' || destacarNuevo;

  // Activar vista temporal donde SOLO se ve el llamado en grande cuando hay un llamado activo
  useEffect(() => {
    if (ticketLlamandoSala && ticketLlamandoSala.estado === 'LLAMANDO') {
      setLlamadoSoloGrande(ticketLlamandoSala);
      setTiempoRestanteGrande(10); // 10 segundos en pantalla completa sólo el llamado
      setDestacarNuevo(true);
    }
  }, [
    ticketLlamandoSala?.id,
    ticketLlamandoSala?.codigo,
    ticketLlamandoSala?.fechaLlamado,
    ticketLlamandoSala?.llamadosContador,
    ticketLlamandoSala?.cajaNumero,
    ticketLlamandoSala?.estado
  ]);

  // Temporizador para el llamado exclusivo en grande (10s a 0s)
  useEffect(() => {
    if (!llamadoSoloGrande || tiempoRestanteGrande <= 0) {
      if (llamadoSoloGrande && tiempoRestanteGrande <= 0) {
        setLlamadoSoloGrande(null);
      }
      return;
    }

    const timer = setInterval(() => {
      setTiempoRestanteGrande((prev) => {
        if (prev <= 1) {
          setLlamadoSoloGrande(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [llamadoSoloGrande, tiempoRestanteGrande]);

  // Si el ticket que estaba en pantalla grande pasa a ser atendido (EN_ATENCION) o cambia de estado,
  // se cierra la vista grande INMEDIATAMENTE sin retrasos para que se vaya de la pantalla.
  useEffect(() => {
    if (llamadoSoloGrande) {
      const todos = [...ticketsActivos, ...ultimosLlamados];
      const match = todos.find(t => t.id === llamadoSoloGrande.id || t.codigo === llamadoSoloGrande.codigo);
      if (match && match.estado !== 'LLAMANDO') {
        setLlamadoSoloGrande(null);
        setTiempoRestanteGrande(0);
      }
    }
  }, [ticketsActivos, ultimosLlamados, llamadoSoloGrande]);

  // Animación de parpadeo y resalte cuando cambia o se re-llama el turno mostrado
  useEffect(() => {
    if (ticketMostrado) {
      setDestacarNuevo(true);
      const duracion = ticketMostrado.estado === 'LLAMANDO' ? 8000 : 3500;
      const timeout = setTimeout(() => setDestacarNuevo(false), duracion);
      return () => clearTimeout(timeout);
    }
  }, [ticketMostrado?.codigo, ticketMostrado?.fechaLlamado, ticketMostrado?.llamadosContador, ticketMostrado?.cajaNumero, ticketMostrado?.estado]);

  // Función para probar o forzar el llamado en pantalla grande manualmente
  const mostrarEnGrandeManual = (ticket: Ticket | null) => {
    if (ticket) {
      setLlamadoSoloGrande(ticket);
      setTiempoRestanteGrande(10);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setEsPantallaCompleta(true))
        .catch(() => setEsPantallaCompleta(prev => !prev));
    } else {
      document.exitFullscreen()
        .then(() => setEsPantallaCompleta(false))
        .catch(() => setEsPantallaCompleta(false));
    }
  };

  // Filtrar historial de llamados según la pantalla (excluyendo el mostrado principal para evitar duplicar)
  const historialFiltrado = ultimosLlamados.filter((t) => {
    if (tipoLocal === 'CAJA' && t.etapa === 'TRIADA') return false;
    if (tipoLocal === 'TRIADA' && t.etapa !== 'TRIADA') return false;
    return true;
  }).slice(0, 8);

  // Filtrar cola de turnos en espera para esta sala
  const esperandoEnEstaSala = ticketsEsperando.filter((t) => {
    if (t.estado !== 'ESPERANDO') return false;
    if (tipoLocal === 'CAJA') return t.etapa !== 'TRIADA';
    if (tipoLocal === 'TRIADA') return t.etapa === 'TRIADA';
    return true;
  });

  // Formatear nombre completo
  const nombreCiudadano = ticketMostrado
    ? [ticketMostrado.ciudadanoNombre, ticketMostrado.ciudadanoApellido].filter(Boolean).join(' ')
    : '';

  const esModoTriada = tipoLocal === 'TRIADA';

  // -------------------------------------------------------------
  // VISTA EXCLUSIVA TEMPORAL: EN PANTALLA SOLO SE VE EL LLAMADO EN GRANDE
  // ("a resaltar me refiero que en pantalla solo se vea el llamado en grande temporalmente")
  // -------------------------------------------------------------
  if (llamadoSoloGrande) {
    const nombreCompletoGrande = [llamadoSoloGrande.ciudadanoNombre, llamadoSoloGrande.ciudadanoApellido].filter(Boolean).join(' ');
    const esTriadaGrande = llamadoSoloGrande.etapa === 'TRIADA' || tipoLocal === 'TRIADA';

    return (
      <div className={`fixed inset-0 z-50 flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden animate-fadeIn ${
        esTriadaGrande ? 'bg-white text-slate-900' : 'bg-slate-950 text-slate-100'
      }`}>
        {/* Luces y resplandores neón de fondo */}
        <div className={`absolute -top-32 -right-32 w-[650px] h-[650px] rounded-full pointer-events-none transition-all duration-700 ${
          esTriadaGrande ? 'bg-indigo-100/60 blur-[130px]' : 'bg-cyan-500/35 blur-[140px]'
        }`} />
        <div className={`absolute -bottom-32 -left-32 w-[650px] h-[650px] rounded-full pointer-events-none transition-all duration-700 ${
          esTriadaGrande ? 'bg-purple-100/50 blur-[130px]' : 'bg-blue-600/35 blur-[140px]'
        }`} />

        {/* Cabecera del llamado exclusivo */}
        <div className={`relative z-10 flex items-center justify-between border-b pb-4 ${
          esTriadaGrande ? 'border-slate-200' : 'border-slate-800/80'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-2xl border shadow-xl ${
              esTriadaGrande 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-indigo-100' 
                : 'bg-cyan-500/30 border-cyan-400 text-cyan-300 shadow-cyan-500/30'
            }`}>
              <Bell className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <span className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-widest border ${
                esTriadaGrande 
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-300 shadow-sm' 
                  : 'bg-cyan-950 text-cyan-300 border-cyan-400 shadow-lg shadow-cyan-500/40'
              }`}>
                <span className={`w-2.5 h-2.5 rounded-full ${esTriadaGrande ? 'bg-indigo-600' : 'bg-current'} animate-ping`} />
                <span>¡LLAMANDO AHORA A SALA!</span>
              </span>
              <p className={`text-xs sm:text-sm mt-0.5 ${esTriadaGrande ? 'text-slate-500' : 'text-slate-400'}`}>
                {esTriadaGrande ? 'Fotografía, Huellas y Biometría • Sala 2' : 'Atención al Ciudadano en Ventanilla • Sala 1'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className={`text-xs block capitalize ${esTriadaGrande ? 'text-slate-500' : 'text-slate-400'}`}>
                {horaActual.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className={`text-xl font-black font-mono tracking-wider ${esTriadaGrande ? 'text-slate-900' : 'text-white'}`}>
                {horaActual.toLocaleTimeString('es-ES')}
              </span>
            </div>

            <button
              onClick={() => setLlamadoSoloGrande(null)}
              className={`px-4 py-2 rounded-xl border font-bold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5 shadow-md ${
                esTriadaGrande
                  ? 'bg-white border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-950'
                  : 'bg-slate-900/90 border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white shadow-lg'
              }`}
            >
              <span>Ver Sala Ahora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* CUERPO CENTRAL GIGANTE: SOLO SE VE EL LLAMADO */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center my-auto py-4">
          {/* 1. Nombre del Ciudadano en Grande */}
          <div className="mb-4 sm:mb-6 max-w-5xl mx-auto">
            <span className={`text-sm sm:text-lg font-black tracking-widest uppercase mb-1 block ${
              esTriadaGrande ? 'text-indigo-600 font-extrabold' : 'text-cyan-400'
            }`}>
              CIUDADANO(A) LLAMADO(A):
            </span>
            <h2 className={`text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black capitalize font-display tracking-tight leading-tight ${
              esTriadaGrande ? 'text-slate-950 drop-shadow-sm' : 'text-white drop-shadow-2xl'
            }`}>
              {nombreCompletoGrande || 'Ciudadano'}
            </h2>
          </div>

          {/* 2. Código de Turno Colosal */}
          <div className={`p-6 sm:p-10 rounded-3xl border-4 shadow-2xl transition-all my-2 sm:my-4 ${
            esTriadaGrande
              ? 'bg-slate-50/95 border-indigo-400 shadow-xl ring-8 ring-indigo-100'
              : 'bg-slate-900/90 border-cyan-400 shadow-cyan-500/40 ring-8 ring-cyan-500/30 pulse-glow-caja'
          }`}>
            <div className={`text-8xl sm:text-9xl md:text-[13rem] lg:text-[16rem] font-black tracking-tighter font-display leading-none ${
              esTriadaGrande ? 'text-indigo-950 drop-shadow-sm' : 'text-cyan-100 drop-shadow-2xl'
            }`}>
              {llamadoSoloGrande.codigo}
            </div>
            <div className={`mt-3 text-lg sm:text-2xl font-extrabold ${esTriadaGrande ? 'text-slate-700' : 'text-slate-300'}`}>
              {llamadoSoloGrande.tramite}
            </div>
          </div>

          {/* 3. Destino en Colosal Tamaño */}
          <div className="mt-4 sm:mt-6 max-w-5xl mx-auto">
            <div className={`flex items-center justify-center gap-2 text-xs sm:text-base font-extrabold tracking-widest uppercase mb-2 ${
              esTriadaGrande ? 'text-slate-600' : 'text-slate-400'
            }`}>
              <MapPin className={`w-5 h-5 animate-bounce ${esTriadaGrande ? 'text-indigo-600' : 'text-emerald-400'}`} />
              <span>POR FAVOR DIRÍJASE INMEDIATAMENTE A:</span>
            </div>

            <div className={`inline-block px-10 py-4 sm:px-16 sm:py-6 rounded-3xl font-black text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-display shadow-2xl border-4 animate-pulse ${
              esTriadaGrande
                ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white border-indigo-300 shadow-indigo-500/40'
                : (llamadoSoloGrande.cajaNumero === 0
                    ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-slate-950 border-white shadow-amber-500/70'
                    : 'bg-gradient-to-r from-cyan-400 via-blue-600 to-indigo-600 text-white border-cyan-200 shadow-cyan-500/70')
            }`}>
              {llamadoSoloGrande.etapa === 'TRIADA'
                ? `TRIADA ${llamadoSoloGrande.cajaNumero !== undefined && llamadoSoloGrande.cajaNumero !== null ? llamadoSoloGrande.cajaNumero : 1}`
                : (Number(llamadoSoloGrande.cajaNumero) === 0
                    ? 'CAJA 0 • PREFERENCIAL'
                    : `CAJA ${llamadoSoloGrande.cajaNumero !== undefined && llamadoSoloGrande.cajaNumero !== null ? llamadoSoloGrande.cajaNumero : 1}`)}
            </div>
          </div>
        </div>

        {/* Barra de progreso temporal en la parte inferior */}
        <div className="relative z-10 w-full max-w-2xl mx-auto">
          <div className={`flex items-center justify-between text-xs font-medium mb-1.5 ${
            esTriadaGrande ? 'text-slate-600' : 'text-slate-400'
          }`}>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${esTriadaGrande ? 'bg-indigo-600' : 'bg-cyan-400'} animate-ping`} />
              Mostrando llamado en grande ({tiempoRestanteGrande}s restantes)
            </span>
            <span>Luego quedará visible en la sala</span>
          </div>
          <div className={`w-full h-2 rounded-full overflow-hidden ${esTriadaGrande ? 'bg-slate-200' : 'bg-slate-800'}`}>
            <div 
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                esTriadaGrande ? 'bg-gradient-to-r from-indigo-600 to-purple-600' : 'bg-gradient-to-r from-cyan-400 to-blue-500'
              }`}
              style={{ width: `${(tiempoRestanteGrande / 10) * 100}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // Función para obtener fondo personalizado en pantalla TV
  const getFondoTvStyle = () => {
    if (esModoTriada) return {};
    if (configuracion.pantallaFondoTipo === 'imagen' && configuracion.pantallaFondoValor) {
      return {
        backgroundImage: `linear-gradient(rgba(3, 7, 18, 0.85), rgba(3, 7, 18, 0.92)), url(${configuracion.pantallaFondoValor})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (configuracion.pantallaFondoTipo === 'degradado' && configuracion.pantallaFondoValor) {
      return { background: configuracion.pantallaFondoValor };
    }
    if (configuracion.pantallaFondoTipo === 'color' && configuracion.pantallaFondoValor) {
      return { backgroundColor: configuracion.pantallaFondoValor };
    }
    return {};
  };

  // -------------------------------------------------------------
  // VISTA NORMAL DE LA SALA: QUEDA EN LA SALA
  // ("ya cuando se va quede en la sala")
  // -------------------------------------------------------------
  return (
    <div 
      style={getFondoTvStyle()}
      className={`flex flex-col p-4 sm:p-6 select-none transition-colors duration-300 ${
      esModoTriada ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'
    } ${
      esPantallaCompleta ? 'fixed inset-0 z-50 overflow-y-auto' : 'min-h-[calc(100vh-65px)]'
    }`}>
      {/* Barra de cabecera institucional para TV */}
      <div className={`flex flex-wrap items-center justify-between border-b pb-4 mb-4 gap-3 ${
        esModoTriada ? 'border-slate-200' : 'border-slate-800/80'
      }`}>
        <div className="flex items-center gap-3">
          <LogoInstitucional variant="tv" />
          <div className={`p-2.5 rounded-2xl border shadow-lg ${
            esModoTriada
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-indigo-100'
              : 'bg-blue-600/20 border-blue-500/40 text-blue-400 shadow-blue-500/10'
          }`}>
            {esModoTriada ? <Camera className="w-6 h-6" /> : <Tv className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className={`text-xl sm:text-2xl font-black tracking-tight font-display ${
                esModoTriada ? 'text-slate-900' : 'text-white'
              }`}>
                {sedeActual.nombre}
              </h1>

              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${
                esModoTriada
                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200 shadow-sm'
                  : 'bg-blue-950/80 text-blue-300 border-blue-700/80'
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${esModoTriada ? 'bg-indigo-600' : 'bg-blue-400'}`} />
                {tipoLocal === 'CAJA' && 'SALA 1 • VENTANILLAS'}
                {tipoLocal === 'TRIADA' && 'SALA 2 • FOTOGRAFÍA'}
                {tipoLocal === 'TODAS' && 'SALA GENERAL'}
              </span>

              {sedeActual.configPantallas === 'ALTERNADO' && (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase border ${
                  estaAlternando
                    ? (esModoTriada ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-900 text-slate-300 border-slate-700')
                    : (esModoTriada ? 'bg-indigo-100 text-indigo-900 border-indigo-300' : 'bg-blue-950 text-blue-300 border-blue-800')
                }`}>
                  {estaAlternando ? `🔁 Alternancia por Tiempo (${cicloSegundos}s)` : '⚡ Alternancia Inteligente por Llamados'}
                </span>
              )}

              {esLlamandoActivo && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border animate-bounce ${
                  esModoTriada
                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-200'
                    : 'bg-cyan-950 text-cyan-300 border-cyan-400 shadow-lg shadow-cyan-500/30'
                }`}>
                  <Bell className="w-3 h-3 animate-spin" />
                  <span>¡Llamado Activo!</span>
                </span>
              )}
            </div>
            <p className={`text-xs sm:text-sm ${esModoTriada ? 'text-slate-500' : 'text-slate-400'}`}>
              {tipoLocal === 'CAJA' && 'Atención al Ciudadano • Caja 0 Preferencial y Cajas 1 a 8'}
              {tipoLocal === 'TRIADA' && 'Toma de Fotografía, Huellas y Biometría • Módulos 1 a 8'}
              {tipoLocal === 'TODAS' && 'Atención General • Monitoreo Global de Cajas y Triada'}
            </p>
          </div>
        </div>

        {/* Selector de Pantallas & Controles de TV */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {/* Alternar automático para regionales */}
          {sedeActual.configPantallas === 'ALTERNADO' && (
            <div className={`flex items-center gap-2 p-1.5 rounded-xl border text-xs font-bold ${
              esModoTriada ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
            }`}>
              <span className={esModoTriada ? 'text-slate-600' : 'text-slate-400'}>Ciclo:</span>
              <select
                value={cicloSegundos}
                onChange={(e) => setCicloSegundos(Number(e.target.value))}
                className="bg-transparent border-none text-xs font-black cursor-pointer focus:outline-none"
                style={{
                  color: esModoTriada ? '#4f46e5' : '#38bdf8'
                }}
                title="Configurar intervalo de cambio automático entre Cajas y Triada"
              >
                <option value="5" className="bg-slate-900 text-white">5s</option>
                <option value="10" className="bg-slate-900 text-white">10s</option>
                <option value="15" className="bg-slate-900 text-white">15s</option>
                <option value="20" className="bg-slate-900 text-white">20s</option>
                <option value="30" className="bg-slate-900 text-white">30s</option>
              </select>

              <button
                type="button"
                onClick={() => setEstaAlternando(!estaAlternando)}
                className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider transition-colors cursor-pointer ${
                  estaAlternando
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-rose-500 text-white shadow-xs'
                }`}
              >
                {estaAlternando ? 'Play' : 'Pausa'}
              </button>
            </div>
          )}

          {/* Switcher rápido de Pantalla */}
          <div className={`flex items-center p-1 rounded-xl border text-xs ${
            esModoTriada ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900 border-slate-800'
          }`}>
            <button
              onClick={() => setTipo('CAJA')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                tipoLocal === 'CAJA'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : esModoTriada ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Pantalla Cajas</span>
            </button>

            <button
              onClick={() => setTipo('TRIADA')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                tipoLocal === 'TRIADA'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : esModoTriada ? 'text-slate-600 hover:text-slate-900' : 'text-indigo-400/80 hover:text-indigo-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Pantalla Triada</span>
            </button>
          </div>

          {/* Reloj Digital */}
          <div className="text-right hidden sm:block">
            <div className={`flex items-center gap-2 text-xs justify-end ${esModoTriada ? 'text-slate-500' : 'text-slate-400'}`}>
              <Calendar className={`w-3.5 h-3.5 ${esModoTriada ? 'text-indigo-600' : 'text-blue-400'}`} />
              <span className="capitalize">{horaActual.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
            </div>
            <div className={`text-lg font-black font-mono tracking-wider ${esModoTriada ? 'text-slate-900' : 'text-white'}`}>
              {horaActual.toLocaleTimeString('es-ES')}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center gap-2">
            {ticketMostrado && (
              <button
                onClick={() => mostrarEnGrandeManual(ticketMostrado)}
                title="Ver llamado en pantalla gigante (Modo exclusivo temporal)"
                className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-md ${
                  esModoTriada
                    ? 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                    : 'border-cyan-500/60 bg-cyan-950/60 text-cyan-300 hover:bg-cyan-900/70'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Ver Llamado en Grande</span>
              </button>
            )}

            <button
              onClick={() => setModoExclusivo(!modoExclusivo)}
              title={modoExclusivo ? 'Mostrar panel lateral con historial y turnos en sala' : 'Ocultar panel lateral (Modo teatro)'}
              className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                modoExclusivo 
                  ? esModoTriada ? 'bg-white border-slate-200 text-slate-600 hover:text-slate-900' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  : `${esModoTriada ? 'bg-indigo-600 border-indigo-500' : 'bg-blue-600 border-blue-500'} text-white shadow-md`
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden md:inline">
                {modoExclusivo ? 'Ver Paneles' : 'Panel Activo'}
              </span>
            </button>

            <button
              onClick={onToggleAudio}
              title={audioEnabled ? 'Silenciar altavoz de llamados' : 'Activar altavoz de llamados'}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                esModoTriada 
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              <Volume2 className={`w-5 h-5 ${audioEnabled ? (esModoTriada ? 'text-indigo-600' : 'text-blue-400') : (esModoTriada ? 'text-slate-400' : 'text-slate-600')}`} />
            </button>

            <button
              onClick={toggleFullscreen}
              title="Pantalla Completa (F11)"
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                esModoTriada 
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {esPantallaCompleta ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* DISPONIBILIDAD DE MÓDULOS DE ESTA SALA */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
            esModoTriada ? 'text-slate-600' : 'text-slate-400'
          }`}>
            {esModoTriada ? (
              <>
                <Camera className="w-3.5 h-3.5 text-indigo-600" />
                <span>MÓDULOS DE FOTOGRAFÍA Y TRIADA (1 A 8)</span>
              </>
            ) : (
              <>
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                <span>VENTANILLAS DE ATENCIÓN (CAJAS 0 A 8)</span>
              </>
            )}
          </span>
          <div className={`flex items-center gap-3 text-[11px] font-medium ${
            esModoTriada ? 'text-slate-600' : 'text-slate-400'
          }`}>
            <span>
              <strong className={esModoTriada ? 'text-emerald-700 font-black' : 'text-emerald-400 font-black'}>
                {cajasMostradas.filter(c => c.estado === 'DISPONIBLE').length}
              </strong> disponibles
            </span>
            <span>•</span>
            <span>
              <strong className={esModoTriada ? 'text-amber-700 font-black' : 'text-amber-400 font-black'}>
                {esperandoEnEstaSala.length}
              </strong> en espera
            </span>
          </div>
        </div>

        <div className={`grid gap-2.5 sm:gap-3 ${
          cajasMostradas.length <= 8 
            ? 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-8' 
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-9'
        }`}>
          {cajasMostradas.map((caja) => {
            const estaDisponible = caja.estado === 'DISPONIBLE';
            const estaOcupada = caja.estado === 'OCUPADA';
            const esTriada = caja.tipo === 'TRIADA';

            // Buscar si esta caja tiene un ticket llamando o en atención
            const esCajaLlamando = ticketMostrado && esLlamandoActivo && (
              (ticketMostrado.cajaId !== undefined && ticketMostrado.cajaId !== null && caja.id === ticketMostrado.cajaId) ||
              (Number(caja.numero) === Number(ticketMostrado.cajaNumero) && (caja.tipo === ticketMostrado.etapa || (!caja.tipo && ticketMostrado.etapa === 'CAJA')))
            );

            // Código del ticket que se está atendiendo en esta caja
            const codigoAtendiendo = caja.ticketActualCodigo 
              || turnosEnSala.find(t => (t.cajaId === caja.id) || (Number(t.cajaNumero) === Number(caja.numero)))?.codigo;

            return (
              <div
                key={caja.id}
                className={`p-3 rounded-2xl border transition-all duration-300 shadow-sm ${
                  esCajaLlamando
                    ? (esTriada 
                        ? 'bg-indigo-50 border-indigo-400 ring-4 ring-indigo-200 shadow-md scale-105 z-10 animate-pulse text-slate-900' 
                        : 'bg-blue-900/90 border-cyan-300 ring-4 ring-cyan-400/90 shadow-cyan-500/60 scale-105 z-10 animate-pulse text-white')
                    : estaDisponible
                    ? (esModoTriada
                        ? 'bg-white border-emerald-300 hover:border-emerald-500 text-slate-900 shadow-sm'
                        : 'bg-emerald-950/40 border-emerald-500/70 shadow-emerald-900/20 text-slate-300')
                    : estaOcupada
                    ? (esModoTriada 
                        ? 'bg-white border-slate-200 text-slate-900 shadow-sm' 
                        : 'bg-slate-900/90 border-blue-600/60 shadow-blue-950 text-slate-300')
                    : (esModoTriada
                        ? 'bg-slate-100 border-slate-200 opacity-60 text-slate-400'
                        : 'bg-slate-900/40 border-slate-800 opacity-50 text-slate-500')
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs sm:text-sm font-black font-display ${
                    esModoTriada ? 'text-slate-900' : 'text-white'
                  }`}>
                    {esTriada ? `Triada ${caja.numero}` : (caja.numero === 0 ? 'Caja 0 (Pref)' : `Caja ${caja.numero}`)}
                  </span>
                  {esCajaLlamando ? (
                    <span className="relative flex h-3.5 w-3.5">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-90 ${esModoTriada ? 'bg-indigo-500' : 'bg-cyan-400'}`} />
                      <span className={`relative inline-flex rounded-full h-3.5 w-3.5 shadow-md ${esModoTriada ? 'bg-indigo-600' : 'bg-cyan-300'}`} />
                    </span>
                  ) : estaDisponible ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    </span>
                  ) : estaOcupada ? (
                    <span className={`h-2.5 w-2.5 rounded-full ${esModoTriada ? 'bg-indigo-600' : 'bg-cyan-400'}`} />
                  ) : (
                    <span className={`h-2.5 w-2.5 rounded-full ${esModoTriada ? 'bg-slate-300' : 'bg-slate-600'}`} />
                  )}
                </div>

                <div className="text-xs">
                  {esCajaLlamando && (
                    <div className="flex items-center gap-1">
                      <span className={`inline-block px-2 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider animate-pulse ${
                        esModoTriada ? 'bg-indigo-600 text-white' : 'bg-cyan-400 text-slate-950'
                      }`}>
                        LLAMANDO
                      </span>
                      {codigoAtendiendo && (
                        <span className={`inline-block px-1.5 py-0.5 rounded-md font-black text-[11px] ${
                          esModoTriada ? 'bg-indigo-100 text-indigo-950' : 'bg-white text-slate-950'
                        }`}>
                          {codigoAtendiendo}
                        </span>
                      )}
                    </div>
                  )}

                  {!esCajaLlamando && estaDisponible && (
                    <span className={`inline-block px-2 py-0.5 rounded-md font-extrabold text-[10px] ${
                      esModoTriada ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      DISPONIBLE
                    </span>
                  )}

                  {!esCajaLlamando && estaOcupada && (
                    <span className={`inline-block px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider ${
                      esModoTriada ? 'bg-indigo-50 text-indigo-800 border border-indigo-200' : 'bg-amber-500/20 text-amber-300'
                    }`}>
                      OCUPADA
                    </span>
                  )}

                  {!esCajaLlamando && !estaDisponible && !estaOcupada && (
                    <span className={`inline-block px-2 py-0.5 rounded-md font-medium text-[10px] ${
                      esModoTriada ? 'bg-slate-200 text-slate-500' : 'bg-slate-800 text-slate-400'
                    }`}>
                      CERRADO
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: TICKET EN TURNO Y TURNOS EN SALA */}
      <div className={`flex-1 grid gap-6 items-stretch ${
        modoExclusivo ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-12'
      }`}>
        {/* PANEL CENTRAL: TICKET EN TURNO */}
        <div className={`flex flex-col ${modoExclusivo ? 'col-span-1' : 'lg:col-span-8'}`}>
          <div className={`flex-1 rounded-3xl border transition-all duration-500 flex flex-col items-center justify-center p-6 sm:p-10 relative overflow-hidden shadow-2xl ${
            esLlamandoActivo 
              ? (esModoTriada
                  ? 'bg-gradient-to-b from-indigo-50/80 via-white to-slate-50 border-indigo-300 shadow-xl ring-4 ring-indigo-200 text-slate-900'
                  : 'bg-gradient-to-b from-blue-950 via-slate-900 to-slate-950 border-cyan-400 shadow-cyan-500/40 pulse-glow-caja ring-4 ring-cyan-500/50 text-slate-100')
              : (esModoTriada ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900/90 border-slate-800 text-slate-100')
          }`}>
            {/* Decoraciones de resplandor de fondo */}
            <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
              esLlamandoActivo 
                ? (esModoTriada ? 'bg-indigo-100/70 opacity-100' : 'bg-cyan-500/30 opacity-100')
                : (esModoTriada ? 'bg-slate-100 opacity-50' : 'bg-blue-500/10 opacity-50')
            }`} />
            <div className={`absolute -bottom-32 -left-32 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
              esLlamandoActivo
                ? (esModoTriada ? 'bg-purple-100/60 opacity-100' : 'bg-blue-500/30 opacity-100')
                : (esModoTriada ? 'bg-slate-100 opacity-40' : 'bg-slate-800/10 opacity-40')
            }`} />

            {ticketMostrado ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${ticketMostrado.codigo}-${ticketMostrado.fechaLlamado}-${ticketMostrado.cajaNumero}-${ticketMostrado.estado}`}
                  initial={{ scale: 0.92, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                  className="w-full text-center relative z-10 max-w-3xl mx-auto"
                >
                  {/* Encabezado: RESALTE MÁXIMO DEL LLAMADO ACTIVO */}
                  <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
                    <div className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-full border-2 text-xs sm:text-base font-black uppercase tracking-widest shadow-2xl animate-bounce ${
                      esModoTriada
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 border-indigo-300 text-white shadow-indigo-300'
                        : 'bg-gradient-to-r from-cyan-400 to-blue-500 border-white text-slate-950 shadow-cyan-500/60'
                    }`}>
                      <Bell className="w-5 h-5 animate-pulse" />
                      <span>{esModoTriada ? '¡LLAMANDO A FOTOGRAFÍA! • ACÉRQUESE AL MÓDULO' : '¡LLAMANDO AHORA A SALA! • ACÉRQUESE A VENTANILLA'}</span>
                    </div>

                    {ticketMostrado.modoLlamado === 'PITIDO' ? (
                      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-xs font-semibold ${
                        esModoTriada ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-amber-950/70 border-amber-600/60 text-amber-300'
                      }`}>
                        <Bell className={`w-3.5 h-3.5 ${esModoTriada ? 'text-amber-600' : 'text-amber-400'}`} />
                        <span>Aviso por Pitido</span>
                      </div>
                    ) : (
                      <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full border text-xs font-semibold ${
                        esModoTriada
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                          : 'bg-cyan-950/80 border-cyan-600 text-cyan-200'
                      }`}>
                        <Volume2 className={`w-3.5 h-3.5 ${esModoTriada ? 'text-indigo-600' : 'text-emerald-400'}`} />
                        <span>Altavoz Institucional</span>
                      </div>
                    )}

                    {ticketMostrado.llamadosContador && ticketMostrado.llamadosContador > 1 && (
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold ${
                        esModoTriada ? 'bg-rose-50 border-rose-300 text-rose-800' : 'bg-rose-950/70 border-rose-600/60 text-rose-300'
                      }`}>
                        <span>Llamado #{ticketMostrado.llamadosContador}</span>
                      </div>
                    )}
                  </div>

                  {/* 1. SECCIÓN DESTACADA: NOMBRE DEL CIUDADANO */}
                  <div className={`mb-6 p-4 sm:p-6 rounded-3xl border-2 shadow-xl transition-all duration-300 ${
                    esModoTriada
                      ? 'bg-slate-50 border-slate-200'
                      : 'bg-slate-950/90 border-cyan-300 shadow-cyan-500/20'
                  }`}>
                    <div className={`flex items-center justify-center gap-2 text-xs sm:text-sm font-black uppercase tracking-widest mb-1.5 ${
                      esModoTriada ? 'text-indigo-700' : 'text-cyan-300'
                    }`}>
                      <User className="w-4 h-4" />
                      <span>CIUDADANO(A) LLAMADO(A):</span>
                    </div>
                    <div className={`text-3xl sm:text-5xl md:text-6xl font-black tracking-wide capitalize font-display ${
                      esModoTriada ? 'text-slate-950' : 'text-white drop-shadow-lg'
                    }`}>
                      {nombreCiudadano || 'Ciudadano en Espera'}
                    </div>
                  </div>

                  {/* 2. CÓDIGO DE TURNO GIGANTE Y TRÁMITE */}
                  <div className="py-2">
                    <div className={`text-8xl sm:text-9xl md:text-[11.5rem] font-black tracking-tight font-display drop-shadow-sm leading-none transition-all duration-300 ${
                      esModoTriada
                        ? 'text-indigo-950 scale-105'
                        : 'text-cyan-100 scale-105 drop-shadow-2xl'
                    }`}>
                      {ticketMostrado.codigo}
                    </div>
                    <div className={`mt-4 inline-block px-6 py-2.5 rounded-2xl border text-base sm:text-xl font-bold shadow-md ${
                      esModoTriada
                        ? 'bg-slate-100 border-slate-200 text-slate-800'
                        : 'bg-slate-800/90 border-slate-700 text-slate-200'
                    }`}>
                      {ticketMostrado.tramite}
                    </div>
                  </div>

                  {/* 3. SECCIÓN DE DESTINO: A DÓNDE DEBE DIRIGIRSE */}
                  <div className={`mt-8 pt-6 border-t ${esModoTriada ? 'border-slate-200' : 'border-slate-800/80'}`}>
                    <div className={`flex items-center justify-center gap-2 text-xs sm:text-sm font-extrabold tracking-widest uppercase mb-3 ${
                      esModoTriada ? 'text-indigo-700' : 'text-cyan-300'
                    }`}>
                      <MapPin className={`w-5 h-5 ${esLlamandoActivo ? 'animate-bounce' : ''}`} />
                      <span>POR FAVOR DIRÍJASE INMEDIATAMENTE A:</span>
                    </div>

                    {/* Bloque Gigante de Destino */}
                    <div className={`inline-block px-10 py-5 sm:px-16 sm:py-8 rounded-3xl text-white font-black text-5xl sm:text-7xl md:text-8xl font-display shadow-2xl border-4 transition-all duration-300 animate-pulse ${
                      esModoTriada
                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 border-indigo-300 shadow-indigo-300'
                        : (ticketMostrado.cajaNumero === 0
                            ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-amber-500/60 border-white text-amber-950'
                            : 'bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-cyan-500/60 border-cyan-200')
                    }`}>
                      {ticketMostrado.etapa === 'TRIADA' 
                        ? `TRIADA ${ticketMostrado.cajaNumero !== undefined && ticketMostrado.cajaNumero !== null ? ticketMostrado.cajaNumero : 1}` 
                        : (Number(ticketMostrado.cajaNumero) === 0 
                            ? 'CAJA 0 • PREFERENCIAL' 
                            : `CAJA ${ticketMostrado.cajaNumero !== undefined && ticketMostrado.cajaNumero !== null ? ticketMostrado.cajaNumero : 1}`)}
                    </div>

                    {esModoTriada && (
                      <div className="mt-3 text-indigo-700 font-bold text-sm tracking-wide">
                        📷 Fotografía, Firma y Biometría
                      </div>
                    )}

                    <div className="mt-4 flex items-center justify-center">
                      <button
                        onClick={() => mostrarEnGrandeManual(ticketMostrado)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                          esModoTriada
                            ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700 shadow-sm'
                            : 'bg-slate-900/80 hover:bg-slate-800 border-slate-700/80 text-slate-300 hover:text-white'
                        }`}
                        title="Ver este turno en pantalla grande"
                      >
                        <Maximize2 className={`w-3.5 h-3.5 ${esModoTriada ? 'text-indigo-600' : 'text-cyan-400'}`} />
                        <span>Ver en pantalla grande</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <div className="text-center py-20">
                <Clock className={`w-20 h-20 mx-auto mb-4 opacity-70 animate-pulse ${esModoTriada ? 'text-indigo-600' : 'text-blue-400'}`} />
                <h3 className={`text-3xl font-bold ${esModoTriada ? 'text-slate-900' : 'text-slate-300'}`}>
                  {esModoTriada ? 'Sala de Fotografía Lista' : 'Sala de Cajas Lista'}
                </h3>
                <p className={`text-base mt-2 max-w-md mx-auto ${esModoTriada ? 'text-slate-600' : 'text-slate-400'}`}>
                  {esModoTriada
                    ? 'Los ciudadanos remitidos desde ventanilla para fotografía y biometría serán llamados aquí de forma automática.'
                    : 'Tome su turno en el kiosco institucional. Su código de turno y ventanilla asignada aparecerán aquí.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Lateral: Turnos en Sala y Registro de Llamados */}
        {!modoExclusivo && (
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* SECCIÓN 1: PRÓXIMOS TURNOS EN ESPERA */}
            <div className={`border rounded-3xl p-5 shadow-xl transition-colors ${
              esModoTriada ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
            }`}>
              <div className={`flex items-center justify-between pb-3 border-b mb-3 ${
                esModoTriada ? 'border-slate-200' : 'border-slate-800'
              }`}>
                <h2 className={`text-base font-bold flex items-center gap-2 ${
                  esModoTriada ? 'text-slate-900' : 'text-white'
                }`}>
                  <Clock className={`w-4 h-4 ${esModoTriada ? 'text-indigo-600' : 'text-cyan-400'}`} />
                  <span>Próximos Turnos en Espera</span>
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                  esModoTriada ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-slate-800 text-amber-400'
                }`}>
                  {esperandoEnEstaSala.length} en fila
                </span>
              </div>

              {esperandoEnEstaSala.length === 0 ? (
                <div className={`text-center py-5 text-xs ${esModoTriada ? 'text-slate-500' : 'text-slate-500'}`}>
                  No hay turnos en espera para esta sala en este momento.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {esperandoEnEstaSala.slice(0, 6).map((t, idx) => {
                    const nombreT = [t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ');
                    return (
                      <div
                        key={t.id}
                        className={`p-3 rounded-2xl border transition-all ${
                          esModoTriada 
                            ? 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30' 
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xl font-black font-display ${esModoTriada ? 'text-slate-900' : 'text-white'}`}>
                            {t.codigo}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-lg text-xs font-extrabold border ${
                            esModoTriada
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-800/80 text-amber-400 border-amber-500/20'
                          }`}>
                            #{idx + 1} en espera
                          </span>
                        </div>
                        <div className={`mt-1 flex items-center justify-between text-xs ${esModoTriada ? 'text-slate-600' : 'text-slate-400'}`}>
                          <span className={`truncate max-w-[150px] font-medium ${esModoTriada ? 'text-slate-800' : 'text-slate-300'}`}>
                            {nombreT || 'Ciudadano'}
                          </span>
                          <span className={`text-[10px] ${esModoTriada ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t.tramite}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: HISTORIAL RECIENTE DE LLAMADOS */}
            <div className={`flex-1 flex flex-col border rounded-3xl p-5 shadow-xl transition-colors ${
              esModoTriada ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <div className={`flex items-center justify-between pb-3 border-b mb-3 ${
                esModoTriada ? 'border-slate-200' : 'border-slate-800'
              }`}>
                <h2 className={`text-base font-bold flex items-center gap-2 ${
                  esModoTriada ? 'text-slate-900' : 'text-white'
                }`}>
                  <Clock className={`w-4 h-4 ${esModoTriada ? 'text-indigo-600' : 'text-blue-400'}`} />
                  <span>{esModoTriada ? 'Llamados en Fotografía' : 'Llamados en Cajas'}</span>
                </h2>
                <span className={`text-xs font-medium ${esModoTriada ? 'text-slate-500' : 'text-slate-400'}`}>Últimos</span>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[300px] pr-1">
                {historialFiltrado.length === 0 ? (
                  <div className={`h-full flex items-center justify-center text-center text-xs py-8 ${
                    esModoTriada ? 'text-slate-500' : 'text-slate-500'
                  }`}>
                    Los llamados anteriores de esta sala se listarán aquí.
                  </div>
                ) : (
                  historialFiltrado.map((ticket) => {
                    const nombreItem = [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ');
                    const estaEnSala = ticket.estado === 'EN_ATENCION';
                    return (
                      <div
                        key={ticket.id}
                        className={`p-3 rounded-2xl border transition-colors ${
                          esModoTriada
                            ? 'bg-slate-50 border-slate-200 hover:border-slate-300'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xl sm:text-2xl font-black font-display ${
                            esModoTriada ? 'text-slate-900' : 'text-white'
                          }`}>
                            {ticket.codigo}
                          </span>
                          
                          <span className={`px-2.5 py-0.5 rounded-xl border font-black text-xs ${
                            ticket.etapa === 'TRIADA'
                              ? esModoTriada
                                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                : 'bg-indigo-950 border-indigo-700/60 text-indigo-300'
                              : 'bg-blue-950 border-blue-700/60 text-blue-300'
                          }`}>
                            {ticket.etapa === 'TRIADA' ? 'Triada' : 'Caja'} {ticket.cajaNumero}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-xs">
                          <div className={`flex items-center gap-1.5 font-semibold truncate max-w-[180px] ${
                            esModoTriada ? 'text-slate-700' : 'text-slate-300'
                          }`}>
                            <User className={`w-3 h-3 shrink-0 ${esModoTriada ? 'text-indigo-600' : 'text-blue-400'}`} />
                            <span className="truncate">{nombreItem || 'Ciudadano'}</span>
                          </div>
                          <span className={`text-[10px] font-bold ${
                            estaEnSala 
                              ? (esModoTriada ? 'text-emerald-700' : 'text-emerald-400') 
                              : (esModoTriada ? 'text-slate-500' : 'text-slate-500')
                          }`}>
                            {estaEnSala ? 'En Sala' : (ticket.fechaLlamado ? new Date(ticket.fechaLlamado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BARRA INFERIOR DE COLA EN ESPERA DE ESTA SALA */}
      <div className={`mt-4 p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs transition-colors ${
        esModoTriada
          ? 'bg-white border-slate-200 text-slate-800 shadow-sm'
          : 'bg-slate-900/60 border-slate-800/80 text-slate-300'
      }`}>
        <div className={`flex items-center gap-2 ${esModoTriada ? 'text-slate-800' : 'text-slate-300'}`}>
          <Users className={`w-4 h-4 ${esModoTriada ? 'text-indigo-600' : 'text-blue-400'}`} />
          <span className="font-bold">
            {esModoTriada ? 'Cola para Fotografía / Triada:' : 'Cola para Cajas:'}
          </span>
          <span className={`px-2 py-0.5 rounded-full font-extrabold ${
            esModoTriada ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-slate-800 text-white'
          }`}>
            {esperandoEnEstaSala.length} {esperandoEnEstaSala.length === 1 ? 'persona' : 'personas'}
          </span>
        </div>

        {esperandoEnEstaSala.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-xl py-0.5">
            <span className={`${esModoTriada ? 'text-slate-500' : 'text-slate-500'} text-[11px] whitespace-nowrap`}>Próximos:</span>
            {esperandoEnEstaSala.slice(0, 8).map((t) => (
              <span
                key={t.id}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wide border ${
                  esModoTriada
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-blue-950/60 border-blue-800/60 text-blue-300'
                }`}
              >
                {t.codigo}
              </span>
            ))}
            {esperandoEnEstaSala.length > 8 && (
              <span className={`${esModoTriada ? 'text-slate-500' : 'text-slate-500'} text-[11px] whitespace-nowrap`}>
                +{esperandoEnEstaSala.length - 8} más
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
