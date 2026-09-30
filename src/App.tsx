import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, AppView } from './components/Navbar';
import { KioskView } from './components/KioskView';
import { PantallaPublica } from './components/PantallaPublica';
import { AdminView } from './components/AdminView';
import { wsClient } from './services/websocketClient';
import { 
  Caja, 
  Ticket, 
  Usuario, 
  MetricasSistema, 
  EstadoGlobalSnapshot,
  EventoRealtime 
} from './types';
import { useCustomization } from './context/CustomizationContext';

export default function App() {
  const { configuracion } = useCustomization();
  
  // Sede seleccionada activa
  const [currentSedeId, setCurrentSedeId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('sedeId') || params.get('sede') || 'ancon';
  });

  const [adminTab, setAdminTab] = useState<'metricas' | 'caja' | 'triada' | 'personalizacion'>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    const tabParam = params.get('tab');
    if (tabParam === 'caja' || viewParam === 'caja') return 'caja';
    if (tabParam === 'triada' || viewParam === 'triada') return 'triada';
    if (tabParam === 'personalizacion' || viewParam === 'personalizacion') return 'personalizacion';
    return 'metricas';
  });

  // Vista actual y caja seleccionada (soporta URL params para multiventana)
  const [currentView, setCurrentView] = useState<AppView>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as AppView;
    if (viewParam === 'caja' || viewParam === 'triada' || (viewParam as string) === 'personalizacion') {
      return 'admin';
    }
    return viewParam && ['kiosk', 'pantalla-caja', 'pantalla-triada', 'pantalla', 'admin'].includes(viewParam)
      ? viewParam
      : 'kiosk';
  });

  const [cajaId, setCajaId] = useState<number>(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('cajaId');
    if (id) return Number(id);
    
    // Default cajaId para cada Sede para evitar mezclar y empezar en Caja 1 de la Sede correspondiente
    const sedesList = [
      'ancon', 'bocas_del_toro', 'cocle', 'colon', 'chiriqui', 'darien', 'herrera',
      'los_santos', 'panama_centro', 'panama_norte', 'panama_este', 'panama_oeste',
      'san_miguelito', 'veraguas', 'guna_yala', 'arraijan'
    ];
    const sIdx = sedesList.indexOf(params.get('sedeId') || params.get('sede') || 'ancon');
    const actualIdx = sIdx >= 0 ? sIdx : 0;
    return actualIdx * 1000 + 1; // Caja 1 de la Sede
  });

  // Estado global sincronizado en tiempo real
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [ticketsEsperando, setTicketsEsperando] = useState<Ticket[]>([]);
  const [ticketsActivos, setTicketsActivos] = useState<Ticket[]>([]);
  const [ultimosLlamados, setUltimosLlamados] = useState<Ticket[]>([]);
  const [ultimoLlamadoGlobal, setUltimoLlamadoGlobal] = useState<Ticket | null>(null);
  const [ultimoLlamadoCaja, setUltimoLlamadoCaja] = useState<Ticket | null>(null);
  const [ultimoLlamadoTriada, setUltimoLlamadoTriada] = useState<Ticket | null>(null);
  const [metricas, setMetricas] = useState<MetricasSistema>({
    totalTicketsHoy: 0,
    esperandoCount: 0,
    enAtencionCount: 0,
    finalizadosCount: 0,
    noPresentaronCount: 0,
    tiempoPromedioEsperaSegundos: 0,
    tiempoPromedioAtencionSegundos: 0,
    latenciaAsignacionPromedioMs: 0
  });
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  // Estado de la conexión de WebSocket
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTED' | 'CONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Sincronizar filtro de audio según la vista
  useEffect(() => {
    if (currentView === 'pantalla-caja') {
      wsClient.setAudioFilter('CAJA');
    } else if (currentView === 'pantalla-triada') {
      wsClient.setAudioFilter('TRIADA');
    } else {
      wsClient.setAudioFilter('ALL');
    }
  }, [currentView]);

  const handleAdminTabChange = (tab: 'metricas' | 'caja' | 'triada' | 'personalizacion') => {
    setAdminTab(tab);
    setCurrentView('admin');
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'admin');
    url.searchParams.set('tab', tab);
    url.searchParams.set('sedeId', currentSedeId);
    window.history.replaceState({}, '', url.toString());

    if (tab === 'caja' || tab === 'triada') {
      wsClient.register('FUNCIONARIO', null, cajaId, currentSedeId);
    } else {
      wsClient.register('ADMINISTRADOR', null, null, currentSedeId);
    }
  };

  const handleSedeChange = (sedeId: string) => {
    setCurrentSedeId(sedeId);
    
    // Default de cajaId para el funcionario cuando cambia de Sede
    const sedesList = [
      'ancon', 'bocas_del_toro', 'cocle', 'colon', 'chiriqui', 'darien', 'herrera',
      'los_santos', 'panama_centro', 'panama_norte', 'panama_este', 'panama_oeste',
      'san_miguelito', 'veraguas', 'guna_yala', 'arraijan'
    ];
    const sIdx = sedesList.indexOf(sedeId);
    const actualIdx = sIdx >= 0 ? sIdx : 0;
    const nuevaCajaId = actualIdx * 1000 + 1; // Caja 1 de la nueva Sede
    setCajaId(nuevaCajaId);

    const url = new URL(window.location.href);
    url.searchParams.set('sedeId', sedeId);
    url.searchParams.set('cajaId', nuevaCajaId.toString());
    window.history.replaceState({}, '', url.toString());

    // Re-registrar en WebSocket con el nuevo SedeId y la nueva estación
    if (currentView === 'pantalla' || currentView === 'pantalla-caja' || currentView === 'pantalla-triada') {
      wsClient.register('PANTALLA', null, null, sedeId);
    } else if (currentView === 'kiosk') {
      wsClient.register('KIOSK', null, null, sedeId);
    } else if (currentView === 'admin') {
      if (adminTab === 'caja' || adminTab === 'triada') {
        wsClient.register('FUNCIONARIO', null, nuevaCajaId, sedeId);
      } else {
        wsClient.register('ADMINISTRADOR', null, null, sedeId);
      }
    }
  };

  // Sincronizar URL cuando cambia la vista o caja
  const handleViewChange = (view: AppView) => {
    if (view === 'caja') {
      setCurrentView('admin');
      handleAdminTabChange('caja');
      return;
    }
    if (view === 'triada') {
      setCurrentView('admin');
      handleAdminTabChange('triada');
      return;
    }

    setCurrentView(view);
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    url.searchParams.set('sedeId', currentSedeId);
    if (view === 'admin') {
      url.searchParams.set('tab', adminTab);
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());

    // Notificar registro en socket
    if (view === 'pantalla' || view === 'pantalla-caja' || view === 'pantalla-triada') {
      wsClient.register('PANTALLA', null, null, currentSedeId);
    } else if (view === 'kiosk') {
      wsClient.register('KIOSK', null, null, currentSedeId);
    } else if (view === 'admin') {
      if (adminTab === 'caja' || adminTab === 'triada') {
        wsClient.register('FUNCIONARIO', null, cajaId, currentSedeId);
      } else {
        wsClient.register('ADMINISTRADOR', null, null, currentSedeId);
      }
    }
  };

  const handleCajaChange = (id: number) => {
    setCajaId(id);
    const target = cajas.find(c => c.id === id);
    if (target) {
      if (target.tipo === 'TRIADA' && adminTab !== 'triada') {
        setAdminTab('triada');
      } else if (target.tipo !== 'TRIADA' && adminTab !== 'caja') {
        setAdminTab('caja');
      }
    }
    const url = new URL(window.location.href);
    url.searchParams.set('cajaId', id.toString());
    if (currentView === 'admin' && target) {
      url.searchParams.set('tab', target.tipo === 'TRIADA' ? 'triada' : 'caja');
    }
    window.history.replaceState({}, '', url.toString());
    wsClient.register('FUNCIONARIO', null, id, currentSedeId);
  };

  // Función para aplicar snapshot completo
  const aplicarSnapshot = useCallback((snap: EstadoGlobalSnapshot) => {
    if (!snap) return;
    setCajas(snap.cajas || []);
    setTicketsEsperando(snap.ticketsEsperando || []);
    setTicketsActivos(snap.ticketsActivos || []);
    setUltimosLlamados(snap.ultimosLlamados || []);
    if (snap.ultimoLlamadoGlobal !== undefined) {
      setUltimoLlamadoGlobal(snap.ultimoLlamadoGlobal);
    }

    if (snap.ultimosLlamados && snap.ultimosLlamados.length > 0) {
      // Para Pantalla de Cajas: SOLO turnos activamente en estado LLAMANDO.
      const callCaja = snap.ultimosLlamados.find(t => t.etapa !== 'TRIADA' && t.estado === 'LLAMANDO');
      setUltimoLlamadoCaja(callCaja || null);

      // Para Pantalla de Triada: SOLO turnos activamente en estado LLAMANDO.
      const callTriada = snap.ultimosLlamados.find(t => t.etapa === 'TRIADA' && t.estado === 'LLAMANDO');
      setUltimoLlamadoTriada(callTriada || null);
    } else {
      setUltimoLlamadoCaja(null);
      setUltimoLlamadoTriada(null);
    }
    if (snap.metricas) {
      setMetricas(snap.metricas);
    }
  }, []);

  // Cargar estado inicial y usuarios desde la API REST
  const recargarEstadoInicial = useCallback(async () => {
    try {
      const [resEstado, resUsuarios] = await Promise.all([
        fetch(`/api/estado?sedeId=${currentSedeId}`),
        fetch(`/api/usuarios?sedeId=${currentSedeId}`)
      ]);

      if (resEstado.ok) {
        const snap = await resEstado.json();
        aplicarSnapshot(snap);
      }

      if (resUsuarios.ok) {
        const users = await resUsuarios.json();
        setUsuarios(users);
      }
    } catch (err) {
      console.warn('Error obteniendo estado inicial:', err);
    }
  }, [aplicarSnapshot, currentSedeId]);

  // Suscripción a eventos de WebSocket en tiempo real
  useEffect(() => {
    recargarEstadoInicial();

    // Listener de estado de conexión
    const unsubStatus = wsClient.onStatusChange((status) => {
      setConnectionStatus(status);
      if (status === 'CONNECTED') {
        recargarEstadoInicial();
        // Registrar según el modo actual al conectar
        if (currentView === 'pantalla' || currentView === 'pantalla-caja' || currentView === 'pantalla-triada') {
          wsClient.register('PANTALLA', null, null, currentSedeId);
        } else if (currentView === 'kiosk') {
          wsClient.register('KIOSK', null, null, currentSedeId);
        } else if (currentView === 'admin') {
          if (adminTab === 'caja' || adminTab === 'triada') {
            wsClient.register('FUNCIONARIO', null, cajaId, currentSedeId);
          } else {
            wsClient.register('ADMINISTRADOR', null, null, currentSedeId);
          }
        }
      }
    });

    // Suscripción a todos los eventos entrantes del servidor
    const unsubEvents = wsClient.subscribe((evento: EventoRealtime & { snapshot?: EstadoGlobalSnapshot }) => {
      // Si el evento viene con snapshot actualizado (garantía total de sincronía)
      if (evento.snapshot) {
        aplicarSnapshot(evento.snapshot);
      }

      // Si el evento es TICKET_LLAMADO, actualizar el último llamado global y el específico
      if (evento.type === 'TICKET_LLAMADO' && evento.codigo) {
        const etapa = (evento.payload && evento.payload.etapa) || (evento.payload && evento.payload.destinoTipo === 'TRIADA' ? 'TRIADA' : 'CAJA');
        const ticketLlamado: Ticket = {
          id: evento.ticketId || '',
          numero: Number(evento.numero) || 0,
          codigo: evento.codigo,
          tramite: (evento.payload && evento.payload.tramite) || 'Atención',
          prefijo: evento.codigo[0],
          ciudadanoNombre: (evento.payload && evento.payload.nombre) || (evento.ciudadano ? evento.ciudadano.split(' ')[0] : undefined),
          ciudadanoApellido: (evento.payload && evento.payload.apellido) || (evento.ciudadano ? evento.ciudadano.split(' ').slice(1).join(' ') : undefined),
          modoLlamado: evento.payload && evento.payload.modoLlamado,
          estado: 'LLAMANDO',
          etapa: etapa as 'CAJA' | 'TRIADA',
          cajaNumero: (evento.caja !== undefined && evento.caja !== null)
            ? Number(evento.caja)
            : (evento.payload?.cajaNumero !== undefined ? Number(evento.payload.cajaNumero) : 1),
          usuarioNombre: evento.funcionario,
          fechaCreacion: new Date().toISOString(),
          fechaLlamado: evento.timestamp,
          llamadosContador: (evento.payload && evento.payload.llamadosContador) || 1,
          sedeId: evento.sedeId
        };

        setUltimoLlamadoGlobal(ticketLlamado);
        if (etapa === 'TRIADA') {
          setUltimoLlamadoTriada(ticketLlamado);
        } else {
          setUltimoLlamadoCaja(ticketLlamado);
        }
      }

      // Si el evento es TICKET_EN_ATENCION, el ticket pasa a atención y DEBE IRSE inmediatamente de la pantalla
      if (evento.type === 'TICKET_EN_ATENCION' && evento.ticketId) {
        const tid = evento.ticketId;
        setTicketsActivos(prev => prev.map(t => t.id === tid ? { ...t, estado: 'EN_ATENCION' } : t));
        setUltimosLlamados(prev => prev.map(t => t.id === tid ? { ...t, estado: 'EN_ATENCION' } : t));
        setUltimoLlamadoGlobal(prev => (prev && prev.id === tid ? null : prev));
        setUltimoLlamadoCaja(prev => (prev && prev.id === tid ? null : prev));
        setUltimoLlamadoTriada(prev => (prev && prev.id === tid ? null : prev));
      }

      // Si el ticket finaliza o no se presentó, también se retira de la pantalla
      if ((evento.type === 'TICKET_FINALIZADO' || evento.type === 'TICKET_NO_PRESENTO') && evento.ticketId) {
        const tid = evento.ticketId;
        setUltimoLlamadoGlobal(prev => (prev && prev.id === tid ? null : prev));
        setUltimoLlamadoCaja(prev => (prev && prev.id === tid ? null : prev));
        setUltimoLlamadoTriada(prev => (prev && prev.id === tid ? null : prev));
      }
    });

    return () => {
      unsubStatus();
      unsubEvents();
    };
  }, [aplicarSnapshot, recargarEstadoInicial, currentSedeId, cajaId, currentView, adminTab]);

  const toggleAudio = () => {
    const nuevo = !audioEnabled;
    setAudioEnabled(nuevo);
    wsClient.setAudioEnabled(nuevo);
  };

  const triadaEsperandoCount = ticketsEsperando.filter(
    t => t.etapa === 'TRIADA' && t.estado === 'ESPERANDO'
  ).length;

  return (
    <div 
      className="min-h-screen flex flex-col font-sans transition-colors duration-200"
      style={{
        backgroundColor: configuracion.backgroundColor,
        color: configuracion.textColor
      }}
    >
      {/* Barra de navegación superior con conmutador de vistas y multiventana */}
      {/* Barra de navegación superior con conmutador de vistas y Sede selector */}
      <Navbar
        currentView={currentView}
        onViewChange={handleViewChange}
        adminTab={adminTab}
        onAdminTabChange={handleAdminTabChange}
        cajaSeleccionadaId={cajaId}
        onCajaChange={handleCajaChange}
        connectionStatus={connectionStatus}
        audioEnabled={audioEnabled}
        onToggleAudio={toggleAudio}
        cajas={cajas}
        triadaEsperandoCount={triadaEsperandoCount}
        currentSedeId={currentSedeId}
        onSedeChange={handleSedeChange}
      />

      {/* Contenido Principal según la vista seleccionada */}
      <main className="flex-1 flex flex-col">
        {currentView === 'kiosk' && (
          <KioskView
            ticketsEsperandoCount={ticketsEsperando.filter(t => t.etapa !== 'TRIADA').length}
            onTicketCreated={() => {}}
            sedeId={currentSedeId}
          />
        )}

        {/* PANTALLA DE CAJAS (0 A 8) */}
        {currentView === 'pantalla-caja' && (
          <PantallaPublica
            tipoPantalla="CAJA"
            onCambiarTipoPantalla={(tipo) => {
              if (tipo === 'CAJA') handleViewChange('pantalla-caja');
              else if (tipo === 'TRIADA') handleViewChange('pantalla-triada');
              else handleViewChange('pantalla');
            }}
            ultimoLlamado={ultimoLlamadoGlobal}
            ultimoLlamadoCaja={ultimoLlamadoCaja}
            ultimoLlamadoTriada={ultimoLlamadoTriada}
            ultimosLlamados={ultimosLlamados}
            ticketsActivos={ticketsActivos}
            cajas={cajas}
            ticketsEsperando={ticketsEsperando}
            audioEnabled={audioEnabled}
            onToggleAudio={toggleAudio}
            sedeId={currentSedeId}
          />
        )}

        {/* PANTALLA DE TRIADA Y FOTOGRAFÍA (1 A 8) */}
        {currentView === 'pantalla-triada' && (
          <PantallaPublica
            tipoPantalla="TRIADA"
            onCambiarTipoPantalla={(tipo) => {
              if (tipo === 'CAJA') handleViewChange('pantalla-caja');
              else if (tipo === 'TRIADA') handleViewChange('pantalla-triada');
              else handleViewChange('pantalla');
            }}
            ultimoLlamado={ultimoLlamadoGlobal}
            ultimoLlamadoCaja={ultimoLlamadoCaja}
            ultimoLlamadoTriada={ultimoLlamadoTriada}
            ultimosLlamados={ultimosLlamados}
            ticketsActivos={ticketsActivos}
            cajas={cajas}
            ticketsEsperando={ticketsEsperando}
            audioEnabled={audioEnabled}
            onToggleAudio={toggleAudio}
            sedeId={currentSedeId}
          />
        )}

        {/* PANTALLA GENERAL (TODAS) */}
        {currentView === 'pantalla' && (
          <PantallaPublica
            tipoPantalla="TODAS"
            onCambiarTipoPantalla={(tipo) => {
              if (tipo === 'CAJA') handleViewChange('pantalla-caja');
              else if (tipo === 'TRIADA') handleViewChange('pantalla-triada');
              else handleViewChange('pantalla');
            }}
            ultimoLlamado={ultimoLlamadoGlobal}
            ultimoLlamadoCaja={ultimoLlamadoCaja}
            ultimoLlamadoTriada={ultimoLlamadoTriada}
            ultimosLlamados={ultimosLlamados}
            ticketsActivos={ticketsActivos}
            cajas={cajas}
            ticketsEsperando={ticketsEsperando}
            audioEnabled={audioEnabled}
            onToggleAudio={toggleAudio}
            sedeId={currentSedeId}
          />
        )}

        {/* PANEL ADMINISTRATIVO Y OPERATIVO (INCLUYE CONTROL CENTRAL, CAJAS Y TRIADA) */}
        {currentView === 'admin' && (
          <AdminView
            cajas={cajas}
            metricas={metricas}
            usuarios={usuarios}
            ticketsEsperando={ticketsEsperando}
            ticketsActivos={ticketsActivos}
            cajaId={cajaId}
            onCajaChange={handleCajaChange}
            activeTab={adminTab}
            onTabChange={handleAdminTabChange}
            onRefresh={recargarEstadoInicial}
            triadaEsperandoCount={triadaEsperandoCount}
            currentSedeId={currentSedeId}
            onSedeChange={handleSedeChange}
          />
        )}
      </main>
    </div>
  );
}
