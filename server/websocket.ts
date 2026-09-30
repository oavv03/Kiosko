import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { db } from './db.js';
import { dispatcher } from './dispatcher.js';
import { EventoRealtime, TipoEvento, RolUsuario } from '../src/types.js';

interface ClientConnection {
  ws: WebSocket;
  id: string;
  role: RolUsuario | 'KIOSK' | 'UNKNOWN';
  usuarioId?: string | null;
  usuarioNombre?: string | null;
  cajaId?: number | null;
  sedeId?: string;
  isAlive: boolean;
  connectedAt: string;
  lastPing: number;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public init(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const clientConn: ClientConnection = {
        ws,
        id: clientId,
        role: 'UNKNOWN',
        isAlive: true,
        connectedAt: new Date().toISOString(),
        lastPing: Date.now(),
        sedeId: 'ancon'
      };

      this.clients.set(clientId, clientConn);

      // Enviar snapshot inicial del estado del sistema (default ancon)
      ws.send(JSON.stringify({
        type: 'ESTADO_SISTEMA',
        timestamp: new Date().toISOString(),
        payload: db.getSnapshot('ancon')
      }));

      ws.on('message', (data: string) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleClientMessage(clientId, msg);
        } catch (err) {
          console.error('Error procesando mensaje de websocket:', err);
        }
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      ws.on('close', () => {
        this.handleClientDisconnect(clientId);
      });

      ws.on('error', (err) => {
        console.warn(`Error en socket ${clientId}:`, err.message);
        this.handleClientDisconnect(clientId);
      });
    });

    // Conectar el dispatcher para que use este gestor de broadcast
    dispatcher.setBroadcast((evento: EventoRealtime) => {
      this.broadcast(evento);
    });

    // Heartbeat watchdog cada 10 segundos
    this.heartbeatInterval = setInterval(() => {
      this.checkHeartbeats();
    }, 10000);

    console.log('[WEBSOCKET] Servidor WebSocket inicializado en ruta /ws');
  }

  private handleClientMessage(clientId: string, msg: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (msg.action) {
      case 'REGISTER': {
        const { role, usuarioId, cajaId, sedeId } = msg;
        client.role = role || 'UNKNOWN';
        client.usuarioId = usuarioId || null;
        client.cajaId = cajaId ? Number(cajaId) : null;
        client.sedeId = sedeId || 'ancon';

        if (usuarioId) {
          const user = db.getUsuarioById(usuarioId);
          if (user) {
            client.usuarioNombre = user.nombre;
            client.sedeId = user.sedeId || client.sedeId || 'ancon';
          }
        }

        // Si es un funcionario en una caja específica
        if (client.cajaId && client.usuarioId) {
          const caja = db.getCajaById(client.cajaId);
          if (caja) {
            client.sedeId = caja.sedeId || client.sedeId || 'ancon';
            // Si la caja ya tenía un ticket en proceso, se conserva su estado ocupada, sino DISPONIBLE
            const estadoInicial = caja.ticketActualId ? 'OCUPADA' : 'DISPONIBLE';
            db.updateCaja(client.cajaId, {
              estado: estadoInicial,
              usuarioActualId: client.usuarioId,
              usuarioNombre: client.usuarioNombre,
              socketId: clientId
            });

            this.broadcast({
              type: 'CAJA_CONECTADA',
              caja: caja.numero,
              cajaId: caja.id,
              funcionario: client.usuarioNombre || undefined,
              timestamp: new Date().toISOString(),
              sedeId: client.sedeId
            });

            if (estadoInicial === 'DISPONIBLE') {
              this.broadcast({
                type: 'CAJA_DISPONIBLE',
                caja: caja.numero,
                cajaId: caja.id,
                funcionario: client.usuarioNombre || undefined,
                timestamp: new Date().toISOString(),
                sedeId: client.sedeId
              });

              // Despachar inmediatamente turnos en cola a esta caja disponible
              dispatcher.triggerDispatch(client.sedeId);
            }
          }
        } else {
          // Enviar snapshot filtrado
          client.ws.send(JSON.stringify({
            type: 'ESTADO_SISTEMA',
            timestamp: new Date().toISOString(),
            payload: db.getSnapshot(client.sedeId)
          }));
        }
        break;
      }

      case 'PING': {
        client.isAlive = true;
        client.lastPing = Date.now();
        client.ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date().toISOString() }));
        break;
      }

      case 'REQUEST_SYNC': {
        const reqSede = msg.sedeId || client.sedeId || 'ancon';
        if (msg.sedeId) {
          client.sedeId = msg.sedeId;
        }
        client.ws.send(JSON.stringify({
          type: 'ESTADO_SISTEMA',
          timestamp: new Date().toISOString(),
          payload: db.getSnapshot(reqSede)
        }));
        break;
      }
    }
  }

  private handleClientDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);

    // Si era un funcionario en una caja, actualizar estado a DESCONECTADA
    if (client.cajaId && client.role === 'FUNCIONARIO') {
      const caja = db.getCajaById(client.cajaId);
      if (caja && caja.socketId === clientId) {
        // Si tenía un ticket asignado pero aún no en atención, revertirlo a ESPERANDO para que otra caja lo atienda
        if (caja.ticketActualId) {
          const ticket = db.getTicketById(caja.ticketActualId);
          if (ticket && ticket.estado === 'ASIGNADO') {
            db.updateTicket(ticket.id, {
              estado: 'ESPERANDO',
              cajaId: null,
              cajaNumero: null,
              usuarioId: null,
              usuarioNombre: null,
              fechaAsignacion: null
            });
            console.log(`[DISCONNECT] Ticket ${ticket.codigo} regresado a ESPERANDO por desconexión de Caja ${caja.numero}`);
          }
        }

        db.updateCaja(client.cajaId, {
          estado: 'DESCONECTADA',
          usuarioActualId: null,
          usuarioNombre: null,
          ticketActualId: null,
          ticketActualCodigo: null,
          socketId: null
        });

        const eventoDesconexion: EventoRealtime = {
          type: 'CAJA_DESCONECTADA',
          caja: caja.numero,
          cajaId: caja.id,
          funcionario: client.usuarioNombre || undefined,
          timestamp: new Date().toISOString()
        };

        db.recordEvento(eventoDesconexion);
        this.broadcast(eventoDesconexion);

        // Despachar tickets que hayan quedado pendientes si hay otras cajas conectadas
        dispatcher.triggerDispatch();
      }
    }
  }

  private checkHeartbeats() {
    const now = Date.now();
    for (const [clientId, client] of this.clients.entries()) {
      // Si no ha respondido en más de 25 segundos, dar por desconectado
      if (now - client.lastPing > 25000) {
        console.log(`[HEARTBEAT] Timeout en cliente ${clientId}, desconectando.`);
        client.ws.terminate();
        this.handleClientDisconnect(clientId);
        continue;
      }

      // Enviar ping estándar de websocket
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      }
    }
  }

  public broadcast(evento: EventoRealtime) {
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        const clienteSede = client.sedeId || 'ancon';
        const eventoSede = evento.sedeId || 'ancon';

        // Solo enviar eventos de la misma Sede, exceptuando configuraciones globales
        if (evento.type !== 'CONFIGURACION_ACTUALIZADA' && eventoSede !== clienteSede) {
          continue;
        }

        const payload = JSON.stringify({
          ...evento,
          snapshot: db.getSnapshot(clienteSede) // Snapshot específico de su Sede
        });

        try {
          client.ws.send(payload);
        } catch (err) {
          console.warn(`Error enviando a cliente ${client.id}:`, err);
        }
      }
    }
  }

  public close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.wss) {
      this.wss.close();
    }
  }
}

export const wsManager = new WebSocketManager();
