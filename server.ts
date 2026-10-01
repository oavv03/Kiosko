import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { db } from './server/db.js';
import { dispatcher } from './server/dispatcher.js';
import { wsManager } from './server/websocket.js';
import { EventoRealtime } from './src/types.js';

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

app.use(express.json({ limit: '10mb' }));

// Inicializar servidor de WebSockets en el mismo puerto HTTP
wsManager.init(server);

async function startServer() {
  // Sincronizar con Supabase si está disponible antes de procesar solicitudes
  await db.initSupabase();

  // --- RUTAS DE API ---

  // 1. Healthcheck
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Diagnóstico seguro de conexión a Supabase
  app.get('/api/diagnostico-supabase', async (req, res) => {
    const diag = await db.diagnosticarSupabase();
    res.json(diag);
  });

  // 1.5. Configuración Visual e Identidad Institucional
  app.get('/api/configuracion', (req, res) => {
    res.json(db.getConfiguracionVisual());
  });

  app.put('/api/configuracion', (req, res) => {
    const configActualizada = db.updateConfiguracionVisual(req.body);
    wsManager.broadcast({
      type: 'CONFIGURACION_ACTUALIZADA',
      timestamp: new Date().toISOString(),
      payload: configActualizada
    });
    res.json(configActualizada);
  });

  app.post('/api/configuracion/reset', (req, res) => {
    const configDefault = db.resetConfiguracionVisual();
    wsManager.broadcast({
      type: 'CONFIGURACION_ACTUALIZADA',
      timestamp: new Date().toISOString(),
      payload: configDefault
    });
    res.json(configDefault);
  });

  // 2. Estado global del sistema (Snapshot)
  app.get('/api/estado', (req, res) => {
    const sedeId = req.query.sedeId as string || 'ancon';
    res.json(db.getSnapshot(sedeId));
  });

  // 3. Cajas
  app.get('/api/cajas', (req, res) => {
    const sedeId = req.query.sedeId as string || 'ancon';
    res.json(db.getCajas(sedeId));
  });

  app.post('/api/cajas/:id/toggle', (req, res) => {
    const id = Number(req.params.id);
    const { activa } = req.body;
    const caja = db.toggleCajaActiva(id, Boolean(activa));
    if (!caja) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    wsManager.broadcast({
      type: caja.activa ? 'CAJA_DISPONIBLE' : 'CAJA_DESCONECTADA',
      caja: caja.numero,
      cajaId: caja.id,
      timestamp: new Date().toISOString(),
      sedeId: caja.sedeId
    });

    if (caja.activa) {
      dispatcher.triggerDispatch(caja.sedeId);
    }

    res.json(caja);
  });

  // Editar cubículo / caja (Administrador)
  app.put('/api/cajas/:id', (req, res) => {
    const id = Number(req.params.id);
    const { numero, nombre, tipo, activa, sedeId } = req.body;

    const patch: any = {};
    if (numero !== undefined) patch.numero = Number(numero);
    if (nombre !== undefined) patch.nombre = String(nombre);
    if (tipo !== undefined) patch.tipo = tipo;
    if (activa !== undefined) patch.activa = Boolean(activa);
    if (sedeId !== undefined) patch.sedeId = String(sedeId);

    const updated = db.updateCaja(id, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Cubículo no encontrado' });
    }

    wsManager.broadcast({
      type: 'ESTADO_SISTEMA',
      timestamp: new Date().toISOString(),
      sedeId: updated.sedeId,
      payload: db.getSnapshot(updated.sedeId)
    });

    res.json(updated);
  });

  // 4. Usuarios y Autenticación
  app.get('/api/usuarios', (req, res) => {
    const sedeId = req.query.sedeId as string || 'ancon';
    res.json(db.getUsuarios(sedeId));
  });

  app.post('/api/usuarios', (req, res) => {
    const { nombre, usuario, email, password, rol, cajaAsignadaId, sedeId } = req.body;
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const nuevo = db.createUsuario({
      nombre,
      usuario: usuario || email.split('@')[0],
      email,
      password: password || '123',
      rol: rol || 'FUNCIONARIO',
      activo: true,
      cajaAsignadaId: cajaAsignadaId ? Number(cajaAsignadaId) : null,
      sedeId: sedeId || 'ancon'
    });
    res.json(nuevo);
  });

  app.delete('/api/usuarios/:id', (req, res) => {
    const ok = db.deleteUsuario(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true });
  });

  // Actualizar usuario / Ubicar en caja o triada (Super Admin)
  app.put('/api/usuarios/:id', (req, res) => {
    const { nombre, usuario, email, password, rol, cajaAsignadaId, activo, sedeId } = req.body;
    const patch: any = {};
    if (nombre !== undefined) patch.nombre = String(nombre).trim();
    if (usuario !== undefined) patch.usuario = String(usuario).trim();
    if (email !== undefined) patch.email = String(email).trim();
    if (password !== undefined) patch.password = String(password).trim();
    if (rol !== undefined) patch.rol = rol;
    if (cajaAsignadaId !== undefined) {
      patch.cajaAsignadaId = (cajaAsignadaId === null || cajaAsignadaId === '' || cajaAsignadaId === 'null') ? null : Number(cajaAsignadaId);
    }
    if (activo !== undefined) patch.activo = Boolean(activo);
    if (sedeId !== undefined) patch.sedeId = String(sedeId);

    const updated = db.updateUsuario(req.params.id, patch);
    if (!updated) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json(updated);
  });

  // Login exclusivo para el Panel Central y Métricas de Super Admin
  app.post('/api/auth/superadmin-login', async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Debe ingresar usuario y contraseña' });
    }
    const user = db.authenticateUser(usuario, password);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas de Super Administrador' });
    }
    if (user.rol !== 'SUPER_ADMIN' && user.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Acceso denegado: Solo el Super Administrador puede acceder al panel central y métricas' });
    }
    res.json({ success: true, user });
  });

  // Login para terminal de Caja por Usuario y Contraseña
  app.post('/api/auth/login', async (req, res) => {
    const { usuario, password, cajaId } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Debe ingresar usuario y contraseña' });
    }
    const user = db.authenticateUser(usuario, password);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Si se especificó cajaId, conectar al usuario en esa caja
    if (cajaId) {
      const idNum = Number(cajaId);

      // Desconectar al usuario de cualquier otra caja previa si estaba conectado
      const todasCajas = db.getCajas();
      todasCajas.forEach(c => {
        if (c.id !== idNum && c.usuarioActualId === user.id) {
          db.updateCaja(c.id, {
            usuarioActualId: null,
            usuarioNombre: null,
            estado: 'DESCONECTADA'
          });
          wsManager.broadcast({
            type: 'CAJA_DESCONECTADA',
            caja: c.numero,
            cajaId: c.id,
            timestamp: new Date().toISOString()
          });
        }
      });

      const caja = db.getCajaById(idNum);
      if (caja) {
        const nuevoEstado = caja.ticketActualId ? 'OCUPADA' : 'DISPONIBLE';
        db.updateCaja(idNum, {
          usuarioActualId: user.id,
          usuarioNombre: user.nombre,
          estado: nuevoEstado,
          activa: true
        });

        const now = new Date().toISOString();
        wsManager.broadcast({
          type: 'CAJA_CONECTADA',
          caja: caja.numero,
          cajaId: caja.id,
          funcionario: user.nombre,
          timestamp: now
        });

        // Al quedar disponible, despachar inmediatamente turnos en espera
        if (nuevoEstado === 'DISPONIBLE') {
          await dispatcher.triggerDispatch();
        }
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        nombre: user.nombre,
        usuario: user.usuario,
        email: user.email,
        rol: user.rol,
        cajaAsignadaId: cajaId ? Number(cajaId) : user.cajaAsignadaId
      }
    });
  });

  // Cambiar de caja para funcionario autenticado
  app.post('/api/auth/cambiar-caja', async (req, res) => {
    const { usuarioId, cajaIdActual, nuevoCajaId } = req.body;
    if (!usuarioId || !nuevoCajaId) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const user = db.getUsuarioById(usuarioId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const idActual = cajaIdActual ? Number(cajaIdActual) : null;
    const idNuevo = Number(nuevoCajaId);

    // Liberar caja actual si corresponde
    if (idActual) {
      const cajaAntigua = db.getCajaById(idActual);
      if (cajaAntigua && cajaAntigua.usuarioActualId === user.id) {
        db.updateCaja(idActual, {
          usuarioActualId: null,
          usuarioNombre: null,
          estado: 'DESCONECTADA'
        });
        wsManager.broadcast({
          type: 'CAJA_DESCONECTADA',
          caja: cajaAntigua.numero,
          cajaId: cajaAntigua.id,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Conectar en la nueva caja
    const cajaNueva = db.getCajaById(idNuevo);
    if (!cajaNueva) {
      return res.status(404).json({ error: 'Caja destino no encontrada' });
    }

    const nuevoEstado = cajaNueva.ticketActualId ? 'OCUPADA' : 'DISPONIBLE';
    db.updateCaja(idNuevo, {
      usuarioActualId: user.id,
      usuarioNombre: user.nombre,
      estado: nuevoEstado,
      activa: true
    });

    const now = new Date().toISOString();
    wsManager.broadcast({
      type: 'CAJA_CONECTADA',
      caja: cajaNueva.numero,
      cajaId: cajaNueva.id,
      funcionario: user.nombre,
      timestamp: now
    });

    if (nuevoEstado === 'DISPONIBLE') {
      await dispatcher.triggerDispatch();
    }

    res.json({ success: true, caja: db.getCajaById(idNuevo) });
  });

  // Logout de la terminal de Caja
  app.post('/api/auth/logout', (req, res) => {
    const { cajaId } = req.body;
    if (cajaId) {
      const idNum = Number(cajaId);
      const caja = db.getCajaById(idNum);
      if (caja) {
        db.updateCaja(idNum, {
          usuarioActualId: null,
          usuarioNombre: null,
          estado: 'DESCONECTADA'
        });
        wsManager.broadcast({
          type: 'CAJA_DESCONECTADA',
          caja: caja.numero,
          cajaId: caja.id,
          timestamp: new Date().toISOString()
        });
      }
    }
    res.json({ success: true });
  });

  // Historial descargable del día para una caja específica
  app.get('/api/cajas/:id/historial-hoy', (req, res) => {
    const cajaId = Number(req.params.id);
    const tickets = db.getHistorialCajaHoy(cajaId);
    res.json({ tickets });
  });

  // Historial descargable por rangos (diario, semanal, mensual, anual)
  app.get('/api/cajas/:id/historial', (req, res) => {
    const cajaId = Number(req.params.id);
    const rango = (req.query.rango as 'diario' | 'semanal' | 'mensual' | 'anual') || 'diario';
    const tickets = db.getHistorialCajaRange(cajaId, rango);
    res.json({ tickets });
  });

  app.get('/api/cajas/:id/historial-hoy/csv', (req, res) => {
    const cajaId = Number(req.params.id);
    const tickets = db.getHistorialCajaHoy(cajaId);
    const hoyStr = new Date().toISOString().split('T')[0];

    let csv = 'Codigo,Tramite,Ciudadano,Estado,Hora Emision,Hora Llamado,Hora Inicio,Hora Fin,Espera,Duracion Atencion,Modo Llamado,Funcionario\n';
    tickets.forEach(t => {
      const ciudadano = `"${[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'N/A'}"`;
      const hCreacion = t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleTimeString() : '';
      const hLlamado = t.fechaLlamado ? new Date(t.fechaLlamado).toLocaleTimeString() : '';
      const hInicio = t.fechaInicio ? new Date(t.fechaInicio).toLocaleTimeString() : '';
      const hFin = t.fechaFinalizacion ? new Date(t.fechaFinalizacion).toLocaleTimeString() : '';
      const modo = t.modoLlamado || 'VOZ';
      const func = `"${t.usuarioNombre || ''}"`;

      csv += `${t.codigo},"${t.tramite}",${ciudadano},${t.estado},${hCreacion},${hLlamado},${hInicio},${hFin},"${t.esperaFormato}","${t.duracionFormato}",${modo},${func}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="historial_caja_${cajaId}_${hoyStr}.csv"`);
    res.send('\uFEFF' + csv);
  });

  // 5. Crear Ticket (Emisión de turno en Kiosco)
  app.post('/api/tickets', async (req, res) => {
    const { tramite = 'Cedulación', prefijo = 'C', nombre, apellido, preferencial = false, sedeId = 'ancon' } = req.body;
    const ticket = db.createTicket(tramite, prefijo, nombre, apellido, Boolean(preferencial), sedeId as string);

    const ciudadano = [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || undefined;

    const eventoCreado: EventoRealtime = {
      type: 'TICKET_CREADO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      ciudadano,
      timestamp: ticket.fechaCreacion,
      sedeId: ticket.sedeId,
      payload: {
        tramite: ticket.tramite,
        prefijo: ticket.prefijo,
        nombre: ticket.ciudadanoNombre,
        apellido: ticket.ciudadanoApellido,
        preferencial: ticket.preferencial
      }
    };

    db.recordEvento(eventoCreado);
    wsManager.broadcast(eventoCreado);

    // Intentar asignación inmediata de forma atómica y segura en esta Sede
    await dispatcher.triggerDispatch(ticket.sedeId);

    // Obtener el ticket actualizado (por si ya fue asignado de inmediato)
    const ticketFinal = db.getTicketById(ticket.id) || ticket;
    res.json(ticketFinal);
  });

  // 6. Funcionario: LLAMAR turno
  app.post('/api/cajas/:id/llamar', (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    if (!caja.ticketActualId) {
      return res.status(400).json({ error: 'La caja no tiene un ticket asignado para llamar' });
    }

    const ticket = db.getTicketById(caja.ticketActualId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const { modo = 'VOZ' } = req.body || {}; // 'VOZ' (nombre + box) o 'PITIDO' (solo campanilla)

    const now = new Date().toISOString();
    const nuevosLlamados = (ticket.llamadosContador || 0) + 1;

    db.updateTicket(ticket.id, {
      estado: 'LLAMANDO',
      fechaLlamado: now,
      llamadosContador: nuevosLlamados,
      modoLlamado: modo,
      cajaId: caja.id,
      cajaNumero: caja.numero,
      usuarioId: caja.usuarioActualId,
      usuarioNombre: caja.usuarioNombre
    });

    db.updateCaja(cajaId, {
      estado: 'OCUPADA',
      ultimaActividad: now
    });

    const ciudadano = [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || undefined;

    const eventoLlamado: EventoRealtime = {
      type: 'TICKET_LLAMADO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || 'Funcionario',
      ciudadano,
      timestamp: now,
      sedeId: caja.sedeId,
      payload: {
        llamadosContador: nuevosLlamados,
        tramite: ticket.tramite,
        nombre: ticket.ciudadanoNombre,
        apellido: ticket.ciudadanoApellido,
        modoLlamado: modo,
        destinoTipo: caja.tipo || 'CAJA',
        etapa: ticket.etapa || caja.tipo || 'CAJA',
        cajaNumero: caja.numero,
        cajaId: caja.id
      }
    };

    db.recordEvento(eventoLlamado);
    wsManager.broadcast(eventoLlamado);

    console.log(`[LLAMADO] Turno ${ticket.codigo} llamado a ${caja.tipo === 'TRIADA' ? 'Triada' : 'Caja'} ${caja.numero} en Sede ${caja.sedeId}`);
    res.json({ success: true, ticket: db.getTicketById(ticket.id), caja });
  });

  // 6.5. Llamar siguiente turno en cola automáticamente
  app.post('/api/cajas/:id/llamar-siguiente', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }

    const { modo = 'VOZ' } = req.body || {};
    const etapaBuscada: 'CAJA' | 'TRIADA' = caja.tipo === 'TRIADA' ? 'TRIADA' : 'CAJA';

    // Si la caja ya tiene un ticket asignado, llamarlo
    let ticket = caja.ticketActualId ? db.getTicketById(caja.ticketActualId) : null;

    if (!ticket) {
      // Buscar el siguiente ticket en espera para esta etapa en la Sede de esta caja
      const ticketsEnEspera = db.getTickets(caja.sedeId)
        .filter(t => t.estado === 'ESPERANDO' && (t.etapa === etapaBuscada || (!t.etapa && etapaBuscada === 'CAJA')))
        .sort((a, b) => new Date(a.fechaCreacion).getTime() - new Date(b.fechaCreacion).getTime());

      if (ticketsEnEspera.length === 0) {
        return res.status(400).json({ error: `No hay turnos en espera para ${etapaBuscada === 'TRIADA' ? 'Triada/Fotografía' : 'Caja'}` });
      }

      ticket = ticketsEnEspera[0];
      const now = new Date().toISOString();

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
    }

    const now = new Date().toISOString();
    const nuevosLlamados = (ticket.llamadosContador || 0) + 1;

    db.updateTicket(ticket.id, {
      estado: 'LLAMANDO',
      fechaLlamado: now,
      llamadosContador: nuevosLlamados,
      modoLlamado: modo,
      cajaId: caja.id,
      cajaNumero: caja.numero,
      usuarioId: caja.usuarioActualId,
      usuarioNombre: caja.usuarioNombre
    });

    db.updateCaja(cajaId, {
      estado: 'OCUPADA',
      ticketActualId: ticket.id,
      ticketActualCodigo: ticket.codigo,
      ultimaActividad: now
    });

    const ciudadano = [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || undefined;

    const eventoLlamado: EventoRealtime = {
      type: 'TICKET_LLAMADO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || 'Funcionario',
      ciudadano,
      timestamp: now,
      sedeId: caja.sedeId,
      payload: {
        llamadosContador: nuevosLlamados,
        tramite: ticket.tramite,
        nombre: ticket.ciudadanoNombre,
        apellido: ticket.ciudadanoApellido,
        modoLlamado: modo,
        destinoTipo: caja.tipo || 'CAJA',
        etapa: ticket.etapa || caja.tipo || 'CAJA'
      }
    };

    db.recordEvento(eventoLlamado);
    wsManager.broadcast(eventoLlamado);

    res.json({ success: true, ticket: db.getTicketById(ticket.id), caja: db.getCajaById(cajaId) });
  });

  // 7. Funcionario: INICIAR ATENCIÓN
  app.post('/api/cajas/:id/iniciar', (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja || !caja.ticketActualId) {
      return res.status(400).json({ error: 'No hay ticket activo para iniciar atención' });
    }

    const ticket = db.getTicketById(caja.ticketActualId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const now = new Date().toISOString();
    db.updateTicket(ticket.id, {
      estado: 'EN_ATENCION',
      fechaInicio: ticket.fechaInicio || now
    });

    db.updateCaja(cajaId, {
      estado: 'OCUPADA',
      ultimaActividad: now
    });

    const evento: EventoRealtime = {
      type: 'TICKET_EN_ATENCION',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || undefined,
      timestamp: now,
      sedeId: caja.sedeId
    };

    db.recordEvento(evento);
    wsManager.broadcast(evento);

    res.json({ success: true, ticket: db.getTicketById(ticket.id) });
  });

  // 8. Funcionario: FINALIZAR ATENCIÓN
  app.post('/api/cajas/:id/finalizar', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja || !caja.ticketActualId) {
      return res.status(400).json({ error: 'No hay ticket activo para finalizar' });
    }

    const ticket = db.getTicketById(caja.ticketActualId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const now = new Date().toISOString();
    const fechaInicioAtencion = ticket.fechaInicio || ticket.fechaLlamado || now;
    const duracionSegundos = Math.max(1, Math.round((new Date(now).getTime() - new Date(fechaInicioAtencion).getTime()) / 1000));

    db.updateTicket(ticket.id, {
      estado: 'FINALIZADO',
      fechaFinalizacion: now,
      duracionAtencionSegundos: duracionSegundos
    });

    db.recordAtencion({
      ticketId: ticket.id,
      ticketCodigo: ticket.codigo,
      cajaId: caja.id,
      usuarioId: caja.usuarioActualId || 'anonimo',
      fechaInicio: fechaInicioAtencion,
      fechaFin: now,
      duracionSegundos,
      resultado: 'FINALIZADO',
      sedeId: caja.sedeId
    });

    // Liberar la caja
    db.updateCaja(cajaId, {
      estado: 'DISPONIBLE',
      ticketActualId: null,
      ticketActualCodigo: null,
      ultimaActividad: now
    });

    const eventoFin: EventoRealtime = {
      type: 'TICKET_FINALIZADO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || undefined,
      timestamp: now,
      sedeId: caja.sedeId,
      payload: { duracionSegundos }
    };

    db.recordEvento(eventoFin);
    wsManager.broadcast(eventoFin);

    wsManager.broadcast({
      type: 'CAJA_DISPONIBLE',
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || undefined,
      timestamp: now,
      sedeId: caja.sedeId
    });

    // Asignar automáticamente el siguiente turno en cola a esta caja ahora disponible
    await dispatcher.triggerDispatch(caja.sedeId);

    res.json({ success: true, caja: db.getCajaById(cajaId) });
  });

  // 8.5. Funcionario: FINALIZAR ATENCIÓN Y ENVIAR A TRIADA
  app.post('/api/cajas/:id/finalizar-y-triada', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja || !caja.ticketActualId) {
      return res.status(400).json({ error: 'No hay ticket activo para finalizar y enviar a Triada' });
    }

    const ticket = db.getTicketById(caja.ticketActualId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const now = new Date().toISOString();
    const fechaInicioAtencion = ticket.fechaInicio || ticket.fechaLlamado || now;
    const duracionSegundos = Math.max(1, Math.round((new Date(now).getTime() - new Date(fechaInicioAtencion).getTime()) / 1000));

    // 1. Grabar atención anterior de la caja
    db.recordAtencion({
      ticketId: ticket.id,
      ticketCodigo: ticket.codigo,
      cajaId: caja.id,
      usuarioId: caja.usuarioActualId || 'anonimo',
      fechaInicio: fechaInicioAtencion,
      fechaFin: now,
      duracionSegundos,
      resultado: 'FINALIZADO',
      sedeId: caja.sedeId
    });

    // 2. Liberar la caja actual
    db.updateCaja(cajaId, {
      estado: 'DISPONIBLE',
      ticketActualId: null,
      ticketActualCodigo: null,
      ultimaActividad: now
    });

    // 3. Pasar ticket a estado esperando en etapa TRIADA y mantener su Sede
    db.updateTicket(ticket.id, {
      estado: 'ESPERANDO',
      etapa: 'TRIADA',
      cajaId: null,
      cajaNumero: null,
      usuarioId: null,
      usuarioNombre: null,
      fechaAsignacion: null,
      fechaLlamado: null,
      fechaInicio: null,
      fechaFinalizacion: null,
      llamadosContador: 0
    });

    const eventoTriada: EventoRealtime = {
      type: 'TICKET_CREADO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      ciudadano: [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || undefined,
      timestamp: now,
      sedeId: caja.sedeId,
      payload: {
        tramite: ticket.tramite,
        etapa: 'TRIADA',
        nombre: ticket.ciudadanoNombre,
        apellido: ticket.ciudadanoApellido
      }
    };

    db.recordEvento(eventoTriada);
    wsManager.broadcast(eventoTriada);

    wsManager.broadcast({
      type: 'CAJA_DISPONIBLE',
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || undefined,
      timestamp: now,
      sedeId: caja.sedeId
    });

    // Despachar inmediatamente para asignar a triada en esta Sede
    await dispatcher.triggerDispatch(caja.sedeId);

    res.json({ success: true, caja: db.getCajaById(cajaId) });
  });

  // 9. Funcionario: NO SE PRESENTÓ
  app.post('/api/cajas/:id/no-presento', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja || !caja.ticketActualId) {
      return res.status(400).json({ error: 'No hay ticket activo' });
    }

    const ticket = db.getTicketById(caja.ticketActualId);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket no encontrado' });
    }

    const now = new Date().toISOString();
    db.updateTicket(ticket.id, {
      estado: 'NO_PRESENTO',
      fechaFinalizacion: now
    });

    db.recordAtencion({
      ticketId: ticket.id,
      ticketCodigo: ticket.codigo,
      cajaId: caja.id,
      usuarioId: caja.usuarioActualId || 'anonimo',
      fechaInicio: ticket.fechaLlamado || now,
      fechaFin: now,
      duracionSegundos: 0,
      resultado: 'NO_PRESENTO',
      sedeId: caja.sedeId
    });

    // Liberar caja
    db.updateCaja(cajaId, {
      estado: 'DISPONIBLE',
      ticketActualId: null,
      ticketActualCodigo: null,
      ultimaActividad: now
    });

    const evento: EventoRealtime = {
      type: 'TICKET_NO_PRESENTO',
      ticketId: ticket.id,
      numero: ticket.numero.toString(),
      codigo: ticket.codigo,
      caja: caja.numero,
      cajaId: caja.id,
      timestamp: now,
      sedeId: caja.sedeId
    };

    db.recordEvento(evento);
    wsManager.broadcast(evento);

    wsManager.broadcast({
      type: 'CAJA_DISPONIBLE',
      caja: caja.numero,
      cajaId: caja.id,
      funcionario: caja.usuarioNombre || undefined,
      timestamp: now,
      sedeId: caja.sedeId
    });

    // Asignar automáticamente el siguiente ticket en espera en esta Sede
    await dispatcher.triggerDispatch(caja.sedeId);

    res.json({ success: true, caja: db.getCajaById(cajaId) });
  });

  // 10. Auditoría de eventos en tiempo real
  app.get('/api/eventos', (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json(db.getEventos(limit));
  });

  // 11. Endpoint de prueba / reinicio de datos
  app.post('/api/test/reset', (req, res) => {
    db.resetTestData();
    wsManager.broadcast({
      type: 'ESTADO_SISTEMA',
      timestamp: new Date().toISOString(),
      payload: db.getSnapshot()
    });
    res.json({ success: true, message: 'Datos reiniciados con éxito' });
  });

  // 12. Endpoint para simular y verificar el caso de prueba exacto del usuario:
  // Caja 1 disponible, Caja 2 disponible, Caja 3 ocupada, Caja 4 sin funcionario.
  // Tickets A001, A002, A003
  app.post('/api/test/setup-escenario', async (req, res) => {
    db.resetTestData();
    const now = new Date().toISOString();

    // Caja 1 -> disponible con funcionario Juan
    db.updateCaja(1, {
      estado: 'DISPONIBLE',
      usuarioActualId: 'user-juan',
      usuarioNombre: 'Juan Pérez',
      ticketActualId: null,
      ticketActualCodigo: null,
      activa: true
    });

    // Caja 2 -> disponible con funcionaria María
    db.updateCaja(2, {
      estado: 'DISPONIBLE',
      usuarioActualId: 'user-maria',
      usuarioNombre: 'María Gómez',
      ticketActualId: null,
      ticketActualCodigo: null,
      activa: true
    });

    // Caja 3 -> ocupada con funcionario Carlos atendiendo un turno anterior
    const tCarlos = db.createTicket('Organización Electoral', 'O', 'Carlos', 'Morales');
    db.updateTicket(tCarlos.id, {
      estado: 'EN_ATENCION',
      cajaId: 3,
      cajaNumero: 3,
      usuarioId: 'user-carlos',
      usuarioNombre: 'Carlos Díaz',
      fechaAsignacion: now,
      fechaLlamado: now,
      fechaInicio: now
    });
    db.updateCaja(3, {
      estado: 'OCUPADA',
      usuarioActualId: 'user-carlos',
      usuarioNombre: 'Carlos Díaz',
      ticketActualId: tCarlos.id,
      ticketActualCodigo: tCarlos.codigo,
      activa: true
    });

    // Caja 4 -> sin funcionario (desconectada)
    db.updateCaja(4, {
      estado: 'DESCONECTADA',
      usuarioActualId: null,
      usuarioNombre: null,
      ticketActualId: null,
      ticketActualCodigo: null,
      activa: true
    });

    // Ahora emitir tickets con nombre y apellido en los nuevos trámites
    const t1 = db.createTicket('Cedulación', 'C', 'Juan', 'Rodríguez'); // Debe ir a Caja 1
    await dispatcher.triggerDispatch();

    const t2 = db.createTicket('Extranjería', 'E', 'María', 'Fernández'); // Debe ir a Caja 2
    await dispatcher.triggerDispatch();

    const t3 = db.createTicket('Registro Civil', 'R', 'Pedro', 'González'); // Debe quedar en ESPERANDO
    await dispatcher.triggerDispatch();

    wsManager.broadcast({
      type: 'ESTADO_SISTEMA',
      timestamp: new Date().toISOString(),
      payload: db.getSnapshot()
    });

    res.json({
      success: true,
      mensaje: 'Escenario configurado según los requisitos de prueba',
      snapshot: db.getSnapshot()
    });
  });

  // --- VITE MIDDLEWARE / STATIC FILES ---
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Resolver la ruta a la carpeta dist de forma segura en CommonJS o cualquier entorno
    const candidateDirs = [
      typeof __dirname !== 'undefined' ? __dirname : '',
      path.join(process.cwd(), 'dist'),
      process.cwd()
    ].filter(Boolean);

    const distPath = candidateDirs.find((dir) => fs.existsSync(path.join(dir, 'index.html'))) || path.join(process.cwd(), 'dist');

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[SERVER] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error('[SERVER ERROR] Error fatal iniciando servidor:', err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});
