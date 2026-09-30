import { db } from './db.js';
import { Caja, Ticket, EventoRealtime } from '../src/types.js';

type BroadcastFn = (evento: EventoRealtime) => void;

class Dispatcher {
  private isProcessing = false;
  private queuePending = false;
  private broadcastFn: BroadcastFn | null = null;
  private lastAssignedBoxIndexCaja = -1; // Puntero round-robin exclusivo para Cajas
  private lastAssignedBoxIndexTriada = -1; // Puntero round-robin exclusivo para Triadas

  public setBroadcast(fn: BroadcastFn) {
    this.broadcastFn = fn;
  }

  /**
   * Ejecuta la asignación de forma atómica y serializada.
   * Evita cualquier race condition ante concurrencia masiva.
   */
  public async triggerDispatch(sedeId?: string): Promise<void> {
    if (this.isProcessing) {
      this.queuePending = true;
      return;
    }

    this.isProcessing = true;

    try {
      if (sedeId) {
        this.processWaitingQueueForSede(sedeId);
      } else {
        const sedesList = [
          'ancon', 'bocas_del_toro', 'cocle', 'colon', 'chiriqui', 'darien', 'herrera',
          'los_santos', 'panama_centro', 'panama_norte', 'panama_este', 'panama_oeste',
          'san_miguelito', 'veraguas', 'guna_yala', 'arraijan'
        ];
        for (const s of sedesList) {
          this.processWaitingQueueForSede(s);
        }
      }
    } catch (err) {
      console.error('Error en proceso de despacho de turnos:', err);
    } finally {
      this.isProcessing = false;
      if (this.queuePending) {
        this.queuePending = false;
        await this.triggerDispatch(sedeId);
      }
    }
  }

  private processWaitingQueueForSede(sedeId: string): void {
    const allCajas = db.getCajas(sedeId);
    const allTickets = db.getTickets(sedeId);

    const STAGES: ('CAJA' | 'TRIADA')[] = ['CAJA', 'TRIADA'];

    for (const stage of STAGES) {
      // 1. Obtener módulos activos y disponibles del tipo correspondiente sin ticket asignado en esta Sede
      const disponibles = allCajas.filter(c => 
        c.activa !== false &&
        (c.tipo === stage || (!c.tipo && stage === 'CAJA')) &&
        c.estado === 'DISPONIBLE' &&
        !c.ticketActualId
      );

      if (disponibles.length === 0) {
        continue; // No hay módulos disponibles para esta etapa
      }

      // 2. Obtener tickets en espera para esta etapa en esta Sede
      // Si es CAJA, priorizar los turnos preferenciales al frente de la cola
      const ticketsEsperando = allTickets
        .filter(t => t.estado === 'ESPERANDO' && (t.etapa === stage || (!t.etapa && stage === 'CAJA')))
        .sort((a, b) => {
          // Si uno es preferencial y el otro no, el preferencial tiene máxima prioridad
          if (stage === 'CAJA') {
            if (a.preferencial && !b.preferencial) return -1;
            if (!a.preferencial && b.preferencial) return 1;
          }
          return new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime();
        });

      if (ticketsEsperando.length === 0) {
        continue; // No hay tickets esperando para esta etapa
      }

      // 3. Distribuir usando Round-Robin balanceado sobre los módulos disponibles:
      const cajasOrdenadas = [...disponibles].sort((a, b) => a.numero - b.numero);

      for (const ticket of ticketsEsperando) {
        // Reevaluar disponibilidad en cada paso dentro del ciclo atómico
        const disponiblesFiltro = cajasOrdenadas.filter(c => 
          c.activa !== false &&
          (c.tipo === stage || (!c.tipo && stage === 'CAJA')) &&
          c.estado === 'DISPONIBLE' && 
          !c.ticketActualId
        );
        if (disponiblesFiltro.length === 0) break;

        let cajaSeleccionada: Caja | null = null;

        // Si es turno preferencial en CAJA, intentar asignar primero a Caja 0 (Ventanilla Preferencial)
        if (stage === 'CAJA' && ticket.preferencial) {
          const cajaCero = disponiblesFiltro.find(c => c.numero === 0);
          if (cajaCero) {
            cajaSeleccionada = cajaCero;
          }
        }

        // Si no se asignó a Caja 0 (o es turno regular o Caja 0 está ocupada), usar Round-Robin entre las cajas disponibles
        if (!cajaSeleccionada) {
          // Para turnos regulares, preferir cajas 1 a 8 si existen disponibles
          const cajasCandidatas = (stage === 'CAJA' && !ticket.preferencial)
            ? (disponiblesFiltro.some(c => c.numero > 0) ? disponiblesFiltro.filter(c => c.numero > 0) : disponiblesFiltro)
            : disponiblesFiltro;

          const lastIndex = stage === 'TRIADA' ? this.lastAssignedBoxIndexTriada : this.lastAssignedBoxIndexCaja;
          const siguiente = cajasCandidatas.find(c => c.numero > lastIndex);
          if (siguiente) {
            cajaSeleccionada = siguiente;
          } else {
            // Da la vuelta al inicio (round-robin wrap-around)
            cajaSeleccionada = cajasCandidatas[0];
          }
        }

        if (stage === 'TRIADA') {
          this.lastAssignedBoxIndexTriada = cajaSeleccionada.numero;
        } else {
          this.lastAssignedBoxIndexCaja = cajaSeleccionada.numero;
        }

        this.asignarTicketACaja(ticket, cajaSeleccionada);
      }
    }
  }

  private asignarTicketACaja(ticket: Ticket, caja: Caja): void {
    const now = new Date().toISOString();

    // Actualización atómica en base de datos
    db.updateTicket(ticket.id, {
      estado: 'ASIGNADO',
      cajaId: caja.id,
      cajaNumero: caja.numero,
      usuarioId: caja.usuarioActualId,
      usuarioNombre: caja.usuarioNombre,
      fechaAsignacion: now
    });

    db.updateCaja(caja.id, {
      estado: 'OCUPADA',
      ticketActualId: ticket.id,
      ticketActualCodigo: ticket.codigo,
      ultimaActividad: now
    });

    // Actualizar las instancias en memoria locales para el ciclo del despachador
    ticket.estado = 'ASIGNADO';
    ticket.cajaId = caja.id;
    ticket.cajaNumero = caja.numero;
    caja.estado = 'OCUPADA';
    caja.ticketActualId = ticket.id;
    caja.ticketActualCodigo = ticket.codigo;

    // Registrar evento de asignación
    const eventoAsignado: EventoRealtime = {
      type: 'TICKET_ASIGNADO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || undefined,
      ciudadano: [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || undefined,
      timestamp: now,
      sedeId: caja.sedeId,
      payload: {
        tramite: ticket.tramite,
        fechaCreacion: ticket.fechaCreacion,
        fechaAsignacion: now,
        nombre: ticket.ciudadanoNombre,
        apellido: ticket.ciudadanoApellido
      }
    };

    db.recordEvento(eventoAsignado);

    // Notificar inmediatamente vía WebSocket
    if (this.broadcastFn) {
      this.broadcastFn(eventoAsignado);
      
      // También notificar el cambio de estado de la caja
      this.broadcastFn({
        type: 'CAJA_OCUPADA',
        caja: caja.numero,
        cajaId: caja.id,
        funcionario: caja.usuarioNombre || undefined,
        timestamp: now,
        sedeId: caja.sedeId
      });
    }

    console.log(`[DISPATCHER] Turno ${ticket.codigo} asignado atómicamente a Caja ${caja.numero} (${caja.usuarioNombre}) en Sede ${caja.sedeId}`);
  }
}

export const dispatcher = new Dispatcher();
