import { EventoRealtime, EstadoGlobalSnapshot, RolUsuario } from '../types';
import { soundManager } from '../utils/audio';

type EventCallback = (evento: EventoRealtime & { snapshot?: EstadoGlobalSnapshot }) => void;
type StatusCallback = (status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED') => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Set<EventCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
  private status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' = 'DISCONNECTED';
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private currentRegistration: { role: RolUsuario | 'KIOSK'; usuarioId?: string | null; cajaId?: number | null; sedeId?: string } | null = null;
  private audioEnabled = true;
  private audioFilter: 'ALL' | 'CAJA' | 'TRIADA' = 'ALL';

  constructor() {
    this.connect();
  }

  public setAudioEnabled(enabled: boolean) {
    this.audioEnabled = enabled;
  }

  public isAudioEnabled(): boolean {
    return this.audioEnabled;
  }

  public setAudioFilter(filter: 'ALL' | 'CAJA' | 'TRIADA') {
    this.audioFilter = filter;
  }

  public getAudioFilter(): 'ALL' | 'CAJA' | 'TRIADA' {
    return this.audioFilter;
  }

  public getStatus() {
    return this.status;
  }

  private pollingIntervalId: any = null;
  private lastPayloadString = '';
  private lastCalledTicketId = '';
  private lastCalledCounter = 0;

  private setStatus(newStatus: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED') {
    this.status = newStatus;
    this.statusListeners.forEach(cb => cb(newStatus));
    if (newStatus === 'CONNECTED') {
      this.stopPollingFallback();
    } else {
      this.startPollingFallback();
    }
  }

  private startPollingFallback() {
    if (this.pollingIntervalId) return;
    console.log('[WS CLIENT] WebSocket desconectado. Activando sondeo (polling) de respaldo para Vercel...');
    this.pollingIntervalId = setInterval(async () => {
      if (this.status === 'CONNECTED') {
        this.stopPollingFallback();
        return;
      }
      try {
        const sedeId = this.currentRegistration?.sedeId || 'ancon';
        const response = await fetch(`/api/estado?sedeId=${sedeId}`);
        if (!response.ok) return;
        const snapshot = await response.json();
        
        const payloadString = JSON.stringify(snapshot);
        if (payloadString === this.lastPayloadString) {
          return;
        }
        this.lastPayloadString = payloadString;

        // Construir y disparar el evento de estado del sistema
        const simulatedEvent = {
          type: 'ESTADO_SISTEMA' as const,
          timestamp: new Date().toISOString(),
          sedeId,
          payload: snapshot
        };

        // Si hay algún ticket llamando, detectarlo para disparar audio
        const ticketsLlamando = snapshot.ticketsActivos?.filter((t: any) => t.estado === 'LLAMANDO') || [];
        if (ticketsLlamando.length > 0) {
          const mainTicket = ticketsLlamando[0];
          const triggerAudio = mainTicket.id !== this.lastCalledTicketId || mainTicket.llamadosContador !== this.lastCalledCounter;
          
          if (triggerAudio) {
            this.lastCalledTicketId = mainTicket.id;
            this.lastCalledCounter = mainTicket.llamadosContador || 0;

            const simulatedCallEvent = {
              type: 'TICKET_LLAMADO' as const,
              codigo: mainTicket.codigo,
              caja: mainTicket.cajaNumero,
              cajaId: mainTicket.cajaId,
              destinoTipo: mainTicket.etapa === 'TRIADA' ? 'TRIADA' as const : 'CAJA' as const,
              ciudadano: [mainTicket.ciudadanoNombre, mainTicket.ciudadanoApellido].filter(Boolean).join(' '),
              payload: {
                modoLlamado: mainTicket.modoLlamado || 'VOZ',
                nombre: mainTicket.ciudadanoNombre || '',
                apellido: mainTicket.ciudadanoApellido || '',
                destinoTipo: mainTicket.etapa === 'TRIADA' ? 'TRIADA' : 'CAJA',
                cajaNumero: mainTicket.cajaNumero || 1
              }
            };

            this.listeners.forEach(cb => {
              try {
                cb(simulatedCallEvent as any);
              } catch (err) {
                console.error('Error en callback de llamado de simulación:', err);
              }
            });
          }
        }

        this.listeners.forEach(cb => {
          try {
            cb(simulatedEvent as any);
          } catch (err) {
            console.error('Error en callback de suscriptor de simulación:', err);
          }
        });
      } catch (err) {
        console.warn('[WS CLIENT] Falló polling de respaldo:', err);
      }
    }, 2500);
  }

  private stopPollingFallback() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }
  }

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => this.statusListeners.delete(callback);
  }

  public subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public register(role: RolUsuario | 'KIOSK', usuarioId?: string | null, cajaId?: number | null, sedeId?: string) {
    this.currentRegistration = { role, usuarioId, cajaId, sedeId };
    this.send({
      action: 'REGISTER',
      role,
      usuarioId,
      cajaId,
      sedeId
    });
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private connect() {
    if (typeof window === 'undefined') return;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.setStatus('CONNECTING');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS CLIENT] Conectado al servidor en tiempo real');
        this.setStatus('CONNECTED');

        // Re-registrar si teníamos datos de sesión
        if (this.currentRegistration) {
          this.register(
            this.currentRegistration.role,
            this.currentRegistration.usuarioId,
            this.currentRegistration.cajaId,
            this.currentRegistration.sedeId
          );
        }

        // Heartbeat cada 8 segundos
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          this.send({ action: 'PING' });
        }, 8000);
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          // Si es un llamado de turno, reproducir la notificación auditiva (voz o pitido según configure la caja)
          if (payload.type === 'TICKET_LLAMADO' && this.audioEnabled) {
            const modoLlamado = payload.payload?.modoLlamado || 'VOZ';
            const nombreCiudadano = payload.payload?.nombre || (payload.ciudadano ? payload.ciudadano.split(' ')[0] : '');
            const apellidoCiudadano = payload.payload?.apellido || (payload.ciudadano ? payload.ciudadano.split(' ').slice(1).join(' ') : '');
            const destinoTipo = payload.destinoTipo || payload.payload?.destinoTipo || (payload.payload?.etapa === 'TRIADA' ? 'TRIADA' : 'CAJA');

            // Solo reproducir si coincide con el filtro de la pantalla actual
            const matchesFilter = this.audioFilter === 'ALL' || this.audioFilter === destinoTipo;

            if (matchesFilter) {
              const numEstacion = payload.caja !== undefined && payload.caja !== null
                ? payload.caja
                : (payload.payload?.cajaNumero !== undefined ? payload.payload.cajaNumero : 1);

              soundManager.playCallNotification({
                modo: modoLlamado,
                codigo: payload.codigo || '',
                cajaNumero: numEstacion,
                destinoTipo: destinoTipo,
                nombre: nombreCiudadano,
                apellido: apellidoCiudadano
              });
            }
          }

          // Notificar a todos los suscriptores
          this.listeners.forEach(cb => {
            try {
              cb(payload);
            } catch (err) {
              console.error('Error en callback de suscriptor de websocket:', err);
            }
          });
        } catch (err) {
          console.error('Error procesando mensaje entrante de websocket:', err);
        }
      };

      this.ws.onclose = () => {
        this.setStatus('DISCONNECTED');
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[WS CLIENT] Error de conexión socket:', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[WS CLIENT] Fallo instanciando websocket:', err);
      this.setStatus('DISCONNECTED');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        console.log('[WS CLIENT] Intentando reconexión automática...');
        this.connect();
      }, 2000);
    }
  }
}

export const wsClient = new WebSocketClient();
