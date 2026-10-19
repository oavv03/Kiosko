import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { db } from './server/db.js';
import { dispatcher } from './server/dispatcher.js';
import { wsManager } from './server/websocket.js';
import { cierreDiarioService, BUCKET_NAME } from './server/cierreDiario.js';
import { EventoRealtime } from './src/types.js';
import {
  securityHeadersMiddleware,
  createRateLimiter,
  toSafeUser,
  toSafeUsers,
  createSessionToken,
  sanitizeString,
  sanitizeCsvCell,
  validateImageUrl
} from './server/security.js';

export const app = express();
const PORT = Number(process.env.PORT) || 3000;
const server = http.createServer(app);

// 1. Cabeceras HTTP de seguridad (OWASP Top 10 Security Headers & CSP)
app.use(securityHeadersMiddleware);

// 2. Límite de tamaño de payload para mitigar ataques de denegación de servicio (DoS)
app.use(express.json({ limit: '10mb' }));

// 3. Limitadores de tasa (Rate Limiters) en memoria
const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Demasiados intentos de autenticación. Por favor intente más tarde.'
});

const ticketRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 45,
  message: 'Demasiadas solicitudes de emisión de turnos. Por favor espere unos momentos.'
});

const generalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 350,
  message: 'Límite de solicitudes de API alcanzado.'
});

// Proteger todas las rutas de API con rate limiting general
app.use('/api/', generalApiLimiter);

// Inicializar servidor de WebSockets en el mismo puerto HTTP
wsManager.init(server);

async function startServer() {
  // Sincronizar con Supabase si está disponible antes de procesar solicitudes
  await db.initSupabase();

  // Iniciar monitoreo autónomo de cierre diario para zona horaria America/Panama
  cierreDiarioService.iniciarAutomatizacionServidor();

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
    const body = req.body || {};

    // Validar URLs de logotipos para prevenir esquemas ejecutables maliciosos (javascript:, etc.)
    if (body.logoPrincipalUrl && !validateImageUrl(body.logoPrincipalUrl)) {
      return res.status(400).json({ error: 'URL o formato de logotipo principal no válido o inseguro' });
    }
    if (body.logoMovilUrl && !validateImageUrl(body.logoMovilUrl)) {
      return res.status(400).json({ error: 'URL o formato de logotipo móvil no válido o inseguro' });
    }
    if (body.ticketLogoUrl && !validateImageUrl(body.ticketLogoUrl)) {
      return res.status(400).json({ error: 'URL o formato de logotipo de ticket no válido o inseguro' });
    }
    if (body.faviconUrl && !validateImageUrl(body.faviconUrl)) {
      return res.status(400).json({ error: 'URL o formato de favicon no válido o inseguro' });
    }

    // Sanitizar textos configurables
    if (body.nombreSistema) body.nombreSistema = sanitizeString(body.nombreSistema, 120);
    if (body.nombreInstitucion) body.nombreInstitucion = sanitizeString(body.nombreInstitucion, 120);
    if (body.ticketEncabezado) body.ticketEncabezado = sanitizeString(body.ticketEncabezado, 100);
    if (body.ticketSubencabezado) body.ticketSubencabezado = sanitizeString(body.ticketSubencabezado, 100);
    if (body.ticketMensajeEspera) body.ticketMensajeEspera = sanitizeString(body.ticketMensajeEspera, 250);
    if (body.ticketPieMensaje) body.ticketPieMensaje = sanitizeString(body.ticketPieMensaje, 250);
    if (body.ticketNotaPie) body.ticketNotaPie = sanitizeString(body.ticketNotaPie, 150);

    const configActualizada = db.updateConfiguracionVisual(body);
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

  // Reiniciar caja por bloqueo o error y reasignar el mismo ticket para avanzar
  app.post('/api/cajas/:id/reiniciar', async (req, res) => {
    const id = Number(req.params.id);
    const { ticketId } = req.body || {};

    const resultado = db.reiniciarCaja(id, ticketId);
    if (!resultado) {
      return res.status(404).json({ error: 'Caja o módulo no encontrado' });
    }

    const { caja, ticket } = resultado;
    const now = new Date().toISOString();

    if (ticket) {
      const ciudadano = [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || undefined;

      const eventoReinicio: EventoRealtime = {
        type: 'TICKET_ASIGNADO',
        ticketId: ticket.id,
        numero: ticket.numero.toString(),
        codigo: ticket.codigo,
        caja: caja.numero,
        cajaId: caja.id,
        funcionario: caja.usuarioNombre || 'Operador',
        ciudadano,
        timestamp: now,
        sedeId: caja.sedeId,
        payload: {
          reiniciado: true,
          tramite: ticket.tramite,
          etapa: ticket.etapa,
          cajaNumero: caja.numero,
          cajaId: caja.id,
          nombre: ticket.ciudadanoNombre,
          apellido: ticket.ciudadanoApellido,
          destinoTipo: caja.tipo || 'CAJA'
        }
      };

      db.recordEvento(eventoReinicio);
      wsManager.broadcast(eventoReinicio);

      console.log(`[REINICIO CAJA] Caja ${caja.numero} (${caja.tipo || 'CAJA'}) reiniciada. Turno ${ticket.codigo} reasignado exitosamente.`);
    } else {
      wsManager.broadcast({
        type: 'CAJA_DISPONIBLE',
        caja: caja.numero,
        cajaId: caja.id,
        funcionario: caja.usuarioNombre || undefined,
        timestamp: now,
        sedeId: caja.sedeId
      });

      await dispatcher.triggerDispatch(caja.sedeId);
      console.log(`[REINICIO CAJA] Caja ${caja.numero} (${caja.tipo || 'CAJA'}) reiniciada a estado disponible.`);
    }

    // Difundir snapshot global a todas las pantallas, terminales y panel admin
    wsManager.broadcast({
      type: 'ESTADO_SISTEMA',
      timestamp: now,
      sedeId: caja.sedeId,
      payload: db.getSnapshot(caja.sedeId)
    });

    res.json({
      success: true,
      message: ticket
        ? `Caja ${caja.numero} reiniciada. Turno ${ticket.codigo} restaurado y reasignado para continuar atención.`
        : `Caja ${caja.numero} reiniciada a estado disponible.`,
      caja: db.getCajaById(caja.id),
      ticket: ticket ? db.getTicketById(ticket.id) : null
    });
  });

  // 4. Usuarios y Autenticación
  // Protegido: NUNCA se exponen las contraseñas en texto claro a clientes de API
  app.get('/api/usuarios', (req, res) => {
    const sedeId = req.query.sedeId as string || 'ancon';
    const usuarios = db.getUsuarios(sedeId);
    res.json(toSafeUsers(usuarios));
  });

  app.post('/api/usuarios', (req, res) => {
    const { nombre, usuario, email, password, rol, cajaAsignadaId, sedeId } = req.body;
    if (!nombre) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const cleanNombre = sanitizeString(nombre, 80);
    const cleanUsuario = sanitizeString(usuario || cleanNombre.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000), 50);
    const cleanEmail = sanitizeString(email || `${cleanUsuario}@te.gob.pa`, 80);

    const rolesValidos = [
      'SUPER_ADMIN', 
      'ADMINISTRADOR', 
      'FUNCIONARIO_CAJA', 
      'FUNCIONARIO_TRIADA',
      'SUPERVISOR_CAJA',
      'SUPERVISOR_TRIADA'
    ];
    const finalRol = rolesValidos.includes(rol) ? rol : 'FUNCIONARIO_CAJA';

    if (cajaAsignadaId) {
      const c = db.getCajaById(Number(cajaAsignadaId));
      if (c) {
        if ((finalRol === 'FUNCIONARIO_CAJA' || finalRol === 'SUPERVISOR_CAJA') && c.tipo === 'TRIADA') {
          return res.status(400).json({ error: 'Los usuarios creados para caja son exclusivos para las 8 cajas, NO DEBEN entrar a triada.' });
        }
        if ((finalRol === 'FUNCIONARIO_TRIADA' || finalRol === 'SUPERVISOR_TRIADA') && c.tipo === 'CAJA') {
          return res.status(400).json({ error: 'Los usuarios creados para triada son exclusivos para las 8 triadas, NO DEBEN entrar a caja.' });
        }
      }
    }

    const nuevo = db.createUsuario({
      nombre: cleanNombre,
      usuario: cleanUsuario,
      email: cleanEmail,
      password: password ? String(password).trim() : '123',
      rol: finalRol as any,
      activo: true,
      cajaAsignadaId: cajaAsignadaId ? Number(cajaAsignadaId) : null,
      sedeId: sedeId ? sanitizeString(sedeId, 30) : 'ancon'
    });
    res.json(toSafeUser(nuevo));
  });

  app.delete('/api/usuarios/:id', (req, res) => {
    const ok = db.deleteUsuario(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ success: true });
  });

  // Actualizar usuario / Ubicar en caja o triada (Super Admin)
  app.put('/api/usuarios/:id', (req, res) => {
    const { nombre, usuario, email, password, rol, cajaAsignadaId, activo, sedeId } = req.body;
    const existing = db.getUsuarioById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const effectiveRol = rol !== undefined ? rol : existing.rol;
    const effectiveCajaId = cajaAsignadaId !== undefined
      ? (cajaAsignadaId === null || cajaAsignadaId === '' || cajaAsignadaId === 'null' ? null : Number(cajaAsignadaId))
      : existing.cajaAsignadaId;

    if (effectiveCajaId) {
      const c = db.getCajaById(effectiveCajaId);
      if (c) {
        if ((effectiveRol === 'FUNCIONARIO_CAJA' || effectiveRol === 'SUPERVISOR_CAJA') && c.tipo === 'TRIADA') {
          return res.status(400).json({ error: 'Los usuarios creados para caja son exclusivos para las 8 cajas, NO DEBEN entrar a triada.' });
        }
        if ((effectiveRol === 'FUNCIONARIO_TRIADA' || effectiveRol === 'SUPERVISOR_TRIADA') && c.tipo === 'CAJA') {
          return res.status(400).json({ error: 'Los usuarios creados para triada son exclusivos para las 8 triadas, NO DEBEN entrar a caja.' });
        }
      }
    }

    const patch: any = {};
    if (nombre !== undefined) patch.nombre = sanitizeString(nombre, 80);
    if (usuario !== undefined) patch.usuario = sanitizeString(usuario, 50);
    if (email !== undefined) patch.email = sanitizeString(email, 80);
    if (password !== undefined) patch.password = String(password).trim();
    if (rol !== undefined) patch.rol = rol;
    if (cajaAsignadaId !== undefined) {
      patch.cajaAsignadaId = effectiveCajaId;
    }
    if (activo !== undefined) patch.activo = Boolean(activo);
    if (sedeId !== undefined) patch.sedeId = sanitizeString(sedeId, 30);

    const updated = db.updateUsuario(req.params.id, patch);
    res.json(toSafeUser(updated));
  });

  // Login exclusivo para el Panel Central y Métricas de Super Admin con Rate Limiting y Session Token
  app.post('/api/auth/superadmin-login', authRateLimiter, async (req, res) => {
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

    const safeUser = toSafeUser(user)!;
    const token = createSessionToken(safeUser);
    res.json({ success: true, user: safeUser, token });
  });

  // Login para la Sección de Reportes (Supervisores de Caja, Supervisores de Triada y Administradores)
  app.post('/api/auth/supervisor-login', authRateLimiter, async (req, res) => {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Debe ingresar usuario y contraseña' });
    }
    const user = db.authenticateUser(usuario, password);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    // Validar jerarquía estricta: Funcionario operativo NO puede acceder
    const rolesPermitidos = ['SUPERVISOR_CAJA', 'SUPERVISOR_TRIADA', 'SUPER_ADMIN', 'ADMINISTRADOR'];
    if (!rolesPermitidos.includes(user.rol)) {
      return res.status(403).json({ 
        error: 'Acceso denegado: Su usuario tiene rol de funcionario operativo. Esta sección de reportes está reservada para Supervisores y Administradores.' 
      });
    }

    const safeUser = toSafeUser(user)!;
    const token = createSessionToken(safeUser);
    res.json({ success: true, user: safeUser, token });
  });

  // Login para terminal de Caja por Usuario y Contraseña con Rate Limiting
  app.post('/api/auth/login', authRateLimiter, async (req, res) => {
    const { usuario, password, cajaId } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Debe ingresar usuario y contraseña' });
    }
    const user = db.authenticateUser(usuario, password);
    if (!user) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }

    // Validar restricción de acceso según rol de acceso (Caja vs Triada)
    if (cajaId) {
      const idNum = Number(cajaId);
      const caja = db.getCajaById(idNum);
      if (caja) {
        if (caja.tipo === 'CAJA' && (user.rol === 'FUNCIONARIO_TRIADA' || user.rol === 'SUPERVISOR_TRIADA')) {
          return res.status(403).json({ error: 'Acceso denegado: Los usuarios de Triada son exclusivos para las 8 Triadas, NO DEBEN entrar a Caja.' });
        }
        if (caja.tipo === 'TRIADA' && (user.rol === 'FUNCIONARIO_CAJA' || user.rol === 'SUPERVISOR_CAJA')) {
          return res.status(403).json({ error: 'Acceso denegado: Los usuarios creados para Caja son exclusivos para las 8 cajas, NO DEBEN entrar a Triada.' });
        }
      }
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
        db.updateUser(user.id, {
          cajaAsignadaId: idNum
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

    // Validar restricción de acceso según rol antes de cambiar
    const cajaNueva = db.getCajaById(idNuevo);
    if (!cajaNueva) {
      return res.status(404).json({ error: 'Caja destino no encontrada' });
    }

    if (cajaNueva.tipo === 'CAJA' && user.rol === 'FUNCIONARIO_TRIADA') {
      return res.status(403).json({ error: 'Acceso denegado: Los usuarios de Triada son exclusivos para las 8 Triadas, NO DEBEN entrar a Caja.' });
    }
    if (cajaNueva.tipo === 'TRIADA' && user.rol === 'FUNCIONARIO_CAJA') {
      return res.status(403).json({ error: 'Acceso denegado: Los usuarios creados para Caja son exclusivos para las 8 cajas, NO DEBEN entrar a Triada.' });
    }

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
    const rawId = req.params.id;
    const tipo = (req.query.tipo as 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS') || undefined;
    const sedeId = (req.query.sedeId as string) || undefined;
    const cajaId = Number(rawId);
    const tickets = db.getHistorialCajaHoy(cajaId, tipo, sedeId);
    res.json({ tickets });
  });

  // Helper para combinar turnos operativos en memoria con turnos archivados en Supabase Storage
  async function obtenerTicketsCombinados(params: {
    rawId: string;
    tipo?: 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS';
    rango?: 'diario' | 'semanal' | 'mensual' | 'anual';
    sedeId?: string;
    fechaInicio?: string;
    fechaFin?: string;
  }) {
    const { rawId, tipo = 'CAJA', rango = 'diario', sedeId, fechaInicio, fechaFin } = params;

    // 1. Tickets operativos en memoria
    let ticketsOperativos: any[] = [];
    if (rawId === 'todas' || rawId === 'all') {
      ticketsOperativos = db.getHistorialGeneralRange(tipo, rango, sedeId, fechaInicio, fechaFin);
    } else {
      ticketsOperativos = db.getHistorialCajaRange(Number(rawId), rango, tipo, sedeId, fechaInicio, fechaFin);
    }

    // 2. Tickets históricos desde Supabase Storage si se especifica rango o fechaInicio
    let ticketsStorage: any[] = [];
    let archivosPaths: string[] = [];

    if (fechaInicio) {
      try {
        const areaStorage: 'CAJA' | 'TRIADA' | 'TODAS' = tipo === 'CAJA' ? 'CAJA' : (tipo === 'TRIADA' ? 'TRIADA' : 'TODAS');
        const histRango = await cierreDiarioService.consultarHistorialRango({
          fechaInicio,
          fechaFin: fechaFin || fechaInicio,
          sedeId: sedeId && sedeId !== 'todas' ? sedeId : undefined,
          area: areaStorage
        });

        if (histRango && histRango.tickets && histRango.tickets.length > 0) {
          archivosPaths = histRango.archivosPaths;
          let filtrados = histRango.tickets;

          if (rawId !== 'todas' && rawId !== 'all') {
            const numCaja = Number(rawId);
            filtrados = filtrados.filter((t: any) =>
              t.cajaId === numCaja ||
              t.cajaNumero === numCaja ||
              (t.cajasHistorialIds && t.cajasHistorialIds.includes(numCaja))
            );
          } else {
            if (tipo === 'CAJA') {
              filtrados = filtrados.filter((t: any) => t.area === 'CAJA' || t.etapa === 'CAJA');
            } else if (tipo === 'TRIADA') {
              filtrados = filtrados.filter((t: any) => t.area === 'TRIADA' || t.etapa === 'TRIADA');
            }
          }

          ticketsStorage = filtrados.map((t: any) => {
            const duracionSeg = t.duracionAtencionSegundos || t.duracionSegundos || 0;
            const esperaSeg = t.duracionEsperaSegundos || t.esperaSegundos || 0;
            const esTriada = t.area === 'TRIADA' || t.etapa === 'TRIADA' || tipo === 'TRIADA';
            let cNum = t.cajaNumero;
            if (cNum === undefined) {
              if (t.cajaId !== undefined) {
                cNum = t.cajaId === 100 ? 0 : (t.cajaId >= 200 ? ((t.cajaId % 1000) - 200) : (t.cajaId % 1000));
              } else {
                cNum = 1;
              }
            }
            const estTxt = t.estacionTexto || (esTriada ? `Triada ${cNum || 1}` : (cNum === 0 ? 'Caja 0 (Pref.)' : `Caja ${cNum}`));

            return {
              ...t,
              area: esTriada ? 'TRIADA' : 'CAJA',
              etapa: esTriada ? 'TRIADA' : 'CAJA',
              cajaNumero: cNum,
              estacionTexto: estTxt,
              duracionSegundos: duracionSeg,
              esperaSegundos: esperaSeg,
              duracionAtencionSegundos: duracionSeg,
              duracionEsperaSegundos: esperaSeg,
              duracionFormato: `${Math.floor(duracionSeg / 60)}m ${duracionSeg % 60}s`,
              esperaFormato: `${Math.floor(esperaSeg / 60)}m ${esperaSeg % 60}s`
            };
          });
        }
      } catch (errStorage) {
        console.warn('[REPORTES] Error leyendo historial de storage:', errStorage);
      }
    }

    // 3. Unificar evitando duplicados por ID
    const mapa = new Map<string, any>();
    for (const t of ticketsOperativos) {
      if (t && t.id) mapa.set(t.id, t);
    }
    for (const t of ticketsStorage) {
      if (t && t.id && !mapa.has(t.id)) {
        mapa.set(t.id, t);
      }
    }

    const combinados = Array.from(mapa.values()).sort((a, b) => {
      const timeA = a.fechaFinalizacion || a.fechaLlamado || a.fechaCreacion || '';
      const timeB = b.fechaFinalizacion || b.fechaLlamado || b.fechaCreacion || '';
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    });

    let origen: 'OPERATIVO' | 'SUPABASE_STORAGE' | 'HIBRIDO_STORAGE' = 'OPERATIVO';
    if (ticketsStorage.length > 0 && ticketsOperativos.length === 0) {
      origen = 'SUPABASE_STORAGE';
    } else if (ticketsStorage.length > 0 && ticketsOperativos.length > 0) {
      origen = 'HIBRIDO_STORAGE';
    }

    return {
      tickets: combinados,
      origen,
      archivoPath: archivosPaths[0],
      archivosPaths
    };
  }

  // Historial descargable por rangos de fechas (calendario o rangos predefinidos)
  app.get('/api/cajas/:id/historial', async (req, res) => {
    const rawId = req.params.id;
    const rango = (req.query.rango as 'diario' | 'semanal' | 'mensual' | 'anual') || 'diario';
    const tipo = (req.query.tipo as 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS') || undefined;
    const sedeId = (req.query.sedeId as string) || undefined;
    const fechaInicio = (req.query.fechaInicio as string) || undefined;
    const fechaFin = (req.query.fechaFin as string) || undefined;

    const resultado = await obtenerTicketsCombinados({
      rawId,
      tipo,
      rango,
      sedeId,
      fechaInicio,
      fechaFin
    });

    res.json(resultado);
  });

  // Historial descargable en CSV por rangos de fechas
  app.get('/api/cajas/:id/historial/csv', async (req, res) => {
    const rawId = req.params.id;
    const rango = (req.query.rango as 'diario' | 'semanal' | 'mensual' | 'anual') || 'diario';
    const tipo = (req.query.tipo as 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS') || 'CAJA';
    const sedeId = (req.query.sedeId as string) || undefined;
    const fechaInicio = (req.query.fechaInicio as string) || undefined;
    const fechaFin = (req.query.fechaFin as string) || undefined;

    const resultado = await obtenerTicketsCombinados({
      rawId,
      tipo,
      rango,
      sedeId,
      fechaInicio,
      fechaFin
    });

    const tickets = resultado.tickets;

    const hoyStr = new Date().toISOString().split('T')[0];

    // Mitigación de CSV Formula Injection: desarmar =, +, -, @, \t, \r y escapar comillas
    let csv = 'Codigo,Tramite,Ciudadano,Estacion,Etapa,Estado,Hora Emision,Hora Llamado,Hora Inicio,Hora Fin,Espera,Duracion Atencion,Modo Llamado,Funcionario\n';
    tickets.forEach(t => {
      const nombreCompleto = [t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'N/A';
      const ciudadano = sanitizeCsvCell(nombreCompleto);
      const tramite = sanitizeCsvCell(t.tramite);
      const estacion = sanitizeCsvCell(t.estacionTexto || (t.cajaNumero !== undefined ? (t.etapa === 'TRIADA' ? `Triada ${t.cajaNumero}` : `Caja ${t.cajaNumero}`) : 'N/A'));
      const etapa = sanitizeCsvCell(t.etapa || 'N/A');
      const estado = sanitizeCsvCell(t.estado);
      const hCreacion = sanitizeCsvCell(t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleTimeString() : '');
      const hLlamado = sanitizeCsvCell(t.fechaLlamado ? new Date(t.fechaLlamado).toLocaleTimeString() : '');
      const hInicio = sanitizeCsvCell(t.fechaInicio ? new Date(t.fechaInicio).toLocaleTimeString() : '');
      const hFin = sanitizeCsvCell(t.fechaFinalizacion ? new Date(t.fechaFinalizacion).toLocaleTimeString() : '');
      const modo = sanitizeCsvCell(t.modoLlamado || 'VOZ');
      const func = sanitizeCsvCell(t.usuarioNombre || '');
      const espera = sanitizeCsvCell(t.esperaFormato || '');
      const duracion = sanitizeCsvCell(t.duracionFormato || '');
      const codigo = sanitizeCsvCell(t.codigo);

      csv += `${codigo},${tramite},${ciudadano},${estacion},${etapa},${estado},${hCreacion},${hLlamado},${hInicio},${hFin},${espera},${duracion},${modo},${func}\n`;
    });

    const filePrefix = rawId === 'todas' ? `consolidado_${tipo.toLowerCase()}` : `estacion_${rawId}`;
    const dateSuffix = fechaInicio && fechaFin ? `${fechaInicio}_a_${fechaFin}` : rango;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filePrefix}_${dateSuffix}.csv"`);
    res.send('\uFEFF' + csv);
  });

  app.get('/api/cajas/:id/historial-hoy/csv', (req, res) => {
    const rawId = req.params.id;
    const tipo = (req.query.tipo as 'CAJA' | 'TRIADA' | 'TODAS' | 'AMBOS') || undefined;
    const sedeId = (req.query.sedeId as string) || undefined;
    const cajaId = Number(rawId);
    const tickets = db.getHistorialCajaHoy(cajaId, tipo, sedeId);
    const hoyStr = new Date().toISOString().split('T')[0];

    // Mitigación de CSV Formula Injection: desarmar =, +, -, @, \t, \r y escapar comillas
    let csv = 'Codigo,Tramite,Ciudadano,Estado,Hora Emision,Hora Llamado,Hora Inicio,Hora Fin,Espera,Duracion Atencion,Modo Llamado,Funcionario\n';
    tickets.forEach(t => {
      const nombreCompleto = [t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'N/A';
      const ciudadano = sanitizeCsvCell(nombreCompleto);
      const tramite = sanitizeCsvCell(t.tramite);
      const estado = sanitizeCsvCell(t.estado);
      const hCreacion = sanitizeCsvCell(t.fechaCreacion ? new Date(t.fechaCreacion).toLocaleTimeString() : '');
      const hLlamado = sanitizeCsvCell(t.fechaLlamado ? new Date(t.fechaLlamado).toLocaleTimeString() : '');
      const hInicio = sanitizeCsvCell(t.fechaInicio ? new Date(t.fechaInicio).toLocaleTimeString() : '');
      const hFin = sanitizeCsvCell(t.fechaFinalizacion ? new Date(t.fechaFinalizacion).toLocaleTimeString() : '');
      const modo = sanitizeCsvCell(t.modoLlamado || 'VOZ');
      const func = sanitizeCsvCell(t.usuarioNombre || '');
      const espera = sanitizeCsvCell(t.esperaFormato || '');
      const duracion = sanitizeCsvCell(t.duracionFormato || '');
      const codigo = sanitizeCsvCell(t.codigo);

      csv += `${codigo},${tramite},${ciudadano},${estado},${hCreacion},${hLlamado},${hInicio},${hFin},${espera},${duracion},${modo},${func}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="historial_caja_${cajaId}_${hoyStr}.csv"`);
    res.send('\uFEFF' + csv);
  });

  // --- CIERRE DIARIO Y CONSULTA DE HISTORIAL EN SUPABASE STORAGE ---

  // Estado del cierre diario y monitoreo de jornada
  app.get('/api/cierre-diario/estado', async (req, res) => {
    try {
      const panamaInfo = cierreDiarioService.getPanamaDate();
      const fechasDisponibles = await cierreDiarioService.listarFechasDisponibles();
      const cierresLocales = cierreDiarioService.getCierresLocales();

      // Horarios oficiales
      // Sede principal: 7:00 a.m. a 3:00 p.m.
      // Sedes regionales: 7:30 a.m. a 3:30 p.m.
      const horaActualMinutos = panamaInfo.horaNum * 60 + panamaInfo.minutoNum;
      const cierreSedePrincipalMinutos = 15 * 60; // 15:00 = 3:00 p.m.
      const cierreRegionalesMinutos = 15 * 60 + 30; // 15:30 = 3:30 p.m.

      const sedePrincipalAbierta = horaActualMinutos >= 7 * 60 && horaActualMinutos < cierreSedePrincipalMinutos;
      const regionalesAbiertas = horaActualMinutos >= (7 * 60 + 30) && horaActualMinutos < cierreRegionalesMinutos;
      const jornadaActiva = sedePrincipalAbierta || regionalesAbiertas;

      // Verificar si la fecha de hoy ya fue cerrada
      const yaCerradoHoy = fechasDisponibles.some(f => f.fecha === panamaInfo.fechaStr && (f as any).estado !== 'ERROR');

      res.json({
        zonaHoraria: 'America/Panama',
        horaPanama: `${panamaInfo.horaNum.toString().padStart(2, '0')}:${panamaInfo.minutoNum.toString().padStart(2, '0')}`,
        fechaHoyPanama: panamaInfo.fechaStr,
        sedePrincipalHorario: '7:00 a. m. a 3:00 p. m.',
        regionalesHorario: '7:30 a. m. a 3:30 p. m.',
        sedePrincipalAbierta,
        regionalesAbiertas,
        jornadaActiva,
        yaCerradoHoy,
        bucketStorage: BUCKET_NAME,
        fechasArchivadas: fechasDisponibles,
        totalFechasArchivadas: fechasDisponibles.length,
        cierresLocales
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error consultando estado de cierre diario' });
    }
  });

  // Ejecución manual o forzada del cierre diario
  app.post('/api/cierre-diario/ejecutar', async (req, res) => {
    try {
      const { fecha, forzar = false } = req.body || {};
      const fechaObjetivo = fecha ? sanitizeString(fecha, 10) : undefined;
      const panamaInfo = cierreDiarioService.getPanamaDate();
      const fechaFinal = fechaObjetivo || panamaInfo.fechaStr;

      // Si es la fecha de hoy y no se fuerza, verificar si las sedes aún están abiertas
      if (!fechaObjetivo || fechaObjetivo === panamaInfo.fechaStr) {
        const horaActualMinutos = panamaInfo.horaNum * 60 + panamaInfo.minutoNum;
        const cierreRegionalesMinutos = 15 * 60 + 30; // 15:30
        if (horaActualMinutos < cierreRegionalesMinutos && !forzar) {
          return res.status(400).json({
            error: 'La jornada aún está activa en las sedes regionales (cierran a las 3:30 p. m.). Debe esperar al fin de jornada o activar la opción forzar cierre.',
            horaActualPanama: `${panamaInfo.horaNum.toString().padStart(2, '0')}:${panamaInfo.minutoNum.toString().padStart(2, '0')}`
          });
        }
      }

      const resultado = await cierreDiarioService.ejecutarCierreDiario(fechaFinal);
      if (!resultado.success) {
        return res.status(500).json(resultado);
      }

      // Notificar por WebSocket a administradores
      wsManager.broadcast({
        type: 'ESTADO_SISTEMA',
        timestamp: new Date().toISOString(),
        payload: {
          tipo: 'CIERRE_DIARIO_COMPLETADO',
          fecha: resultado.fecha,
          totalTickets: resultado.totalTickets,
          archivoPath: resultado.archivoPath
        }
      });

      res.json(resultado);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error ejecutando cierre diario' });
    }
  });

  // Listar todas las fechas históricas disponibles en Supabase Storage
  app.get('/api/historial/fechas', async (req, res) => {
    try {
      const fechas = await cierreDiarioService.listarFechasDisponibles();
      res.json({ fechas, total: fechas.length });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Error listando fechas históricas' });
    }
  });

  // Consultar tickets históricos directamente desde Supabase Storage (soporta área: CAJA | TRIADA | TODAS)
  app.get('/api/historial/consulta', async (req, res) => {
    try {
      const fecha = req.query.fecha as string;
      if (!fecha) {
        return res.status(400).json({ error: 'El parámetro fecha (YYYY-MM-DD) es obligatorio' });
      }

      const cleanFecha = sanitizeString(fecha, 10);
      const sedeId = req.query.sedeId ? sanitizeString(req.query.sedeId as string, 30) : undefined;
      const tramite = req.query.tramite ? sanitizeString(req.query.tramite as string, 60) : undefined;
      const estado = req.query.estado ? sanitizeString(req.query.estado as string, 30) : undefined;
      const busqueda = req.query.busqueda ? sanitizeString(req.query.busqueda as string, 100) : undefined;
      const area = (req.query.area as 'CAJA' | 'TRIADA' | 'TODAS') || 'TODAS';

      const resultado = await cierreDiarioService.consultarHistorialStorage({
        fecha: cleanFecha,
        sedeId,
        tramite,
        estado,
        busqueda,
        area
      });

      res.json(resultado);
    } catch (err: any) {
      res.status(404).json({ error: err.message || 'Error consultando historial en Supabase Storage' });
    }
  });

  // Descargar archivo crudo JSON de historial directamente desde Supabase Storage (por área o consolidado)
  app.get('/api/historial/archivo/:fecha/descargar', async (req, res) => {
    try {
      const fecha = sanitizeString(req.params.fecha, 10);
      const area = (req.query.area as 'CAJA' | 'TRIADA' | 'TODAS') || 'TODAS';
      const resultado = await cierreDiarioService.consultarHistorialStorage({ fecha, area });
      const [year, month, day] = fecha.split('-');

      const sufijoArea = area === 'CAJA' ? '_caja' : (area === 'TRIADA' ? '_triada' : '');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="tickets${sufijoArea}_${year}_${month}_${day}.json"`);
      res.send(JSON.stringify({
        metadatos: resultado.metadatos,
        tickets: resultado.tickets
      }, null, 2));
    } catch (err: any) {
      res.status(404).json({ error: err.message || 'Archivo histórico no encontrado' });
    }
  });

  // 5. Crear Ticket (Emisión de turno en Kiosco con Rate Limiting y Sanitización estricta)
  app.post('/api/tickets', ticketRateLimiter, async (req, res) => {
    const { tramite = 'Cedulación', prefijo = 'C', nombre, apellido, preferencial = false, sedeId = 'ancon' } = req.body || {};

    // Validación estricta contra inyección de código y etiquetas HTML (XSS)
    const regexInyeccion = /[<>{}\\]|script|alert|onerror|onload|javascript:|data:/i;
    if (nombre && regexInyeccion.test(String(nombre))) {
      return res.status(400).json({ error: 'El nombre ingresado contiene caracteres o etiquetas no permitidas.' });
    }
    if (apellido && regexInyeccion.test(String(apellido))) {
      return res.status(400).json({ error: 'El apellido ingresado contiene caracteres o etiquetas no permitidas.' });
    }
    if (tramite && regexInyeccion.test(String(tramite))) {
      return res.status(400).json({ error: 'El trámite ingresado contiene caracteres o etiquetas no permitidas.' });
    }

    const cleanTramite = sanitizeString(tramite, 60) || 'Cedulación';
    const cleanPrefijo = sanitizeString(prefijo, 4).toUpperCase() || 'C';
    const cleanNombre = nombre ? sanitizeString(nombre, 60) : undefined;
    const cleanApellido = apellido ? sanitizeString(apellido, 60) : undefined;
    const cleanSedeId = sanitizeString(sedeId, 30) || 'ancon';

    const ticket = db.createTicket(cleanTramite, cleanPrefijo, cleanNombre, cleanApellido, Boolean(preferencial), cleanSedeId);

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

  // Helper para resolver el ticket activo de una caja o triada de forma resiliente
  const buscarTicketActivoCaja = (caja: any, ticketIdPropuesto?: string) => {
    let ticket: any = null;
    if (ticketIdPropuesto) {
      ticket = db.getTicketById(ticketIdPropuesto) || null;
    }
    if (!ticket && caja.ticketActualId) {
      ticket = db.getTicketById(caja.ticketActualId) || null;
    }
    if (!ticket) {
      // Buscar cualquier ticket activo asignado a esta caja o módulo
      ticket = db.getTickets(caja.sedeId).find(t => 
        (t.cajaId === caja.id || (caja.tipo === 'TRIADA' && t.etapa === 'TRIADA' && Number(t.cajaNumero) === Number(caja.numero))) &&
        (t.estado === 'ASIGNADO' || t.estado === 'LLAMANDO' || t.estado === 'EN_ATENCION')
      ) || null;
    }
    return ticket;
  };

  // 6. Funcionario: LLAMAR turno
  app.post('/api/cajas/:id/llamar', (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    const { modo = 'VOZ', ticketId } = req.body || {}; // 'VOZ' (nombre + box) o 'PITIDO' (solo campanilla)
    const ticket = buscarTicketActivoCaja(caja, ticketId);

    if (!ticket) {
      return res.status(400).json({ error: 'La caja no tiene un ticket asignado para llamar' });
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

    if (!caja) {
      return res.status(404).json({ error: 'Caja o módulo no encontrado' });
    }

    const { ticketId } = req.body || {};
    const ticket = buscarTicketActivoCaja(caja, ticketId);

    if (!ticket) {
      return res.status(400).json({ error: 'No hay ticket activo para iniciar atención' });
    }

    const now = new Date().toISOString();
    db.updateTicket(ticket.id, {
      estado: 'EN_ATENCION',
      fechaInicio: ticket.fechaInicio || now,
      cajaId: caja.id,
      cajaNumero: caja.numero
    });

    db.updateCaja(cajaId, {
      estado: 'OCUPADA',
      ticketActualId: ticket.id,
      ticketActualCodigo: ticket.codigo,
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

    res.json({ success: true, ticket: db.getTicketById(ticket.id), caja: db.getCajaById(cajaId) });
  });

  // 8. Funcionario: FINALIZAR ATENCIÓN
  app.post('/api/cajas/:id/finalizar', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Caja o módulo no encontrado' });
    }

    const { ticketId } = req.body || {};
    const ticket = buscarTicketActivoCaja(caja, ticketId);

    if (!ticket) {
      // Limpiar inconsistencias si la caja tenía datos huérfanos
      const estadoLimpio = (caja.activa && caja.usuarioActualId) ? 'DISPONIBLE' : 'DESCONECTADA';
      db.updateCaja(cajaId, {
        estado: estadoLimpio,
        ticketActualId: null,
        ticketActualCodigo: null,
        ultimaActividad: new Date().toISOString()
      });
      return res.status(400).json({ error: 'No hay ticket activo para finalizar' });
    }

    const now = new Date().toISOString();
    const fechaInicioAtencion = ticket.fechaInicio || ticket.fechaLlamado || now;
    const duracionSegundos = Math.max(1, Math.round((new Date(now).getTime() - new Date(fechaInicioAtencion).getTime()) / 1000));

    const historialFin = Array.isArray(ticket.cajasHistorialIds) 
      ? [...ticket.cajasHistorialIds] 
      : (ticket.cajaId ? [ticket.cajaId] : []);
    if (!historialFin.includes(caja.id)) {
      historialFin.push(caja.id);
    }

    const areaFinalizada: 'CAJA' | 'TRIADA' = caja.tipo === 'TRIADA' ? 'TRIADA' : 'CAJA';
    db.updateTicket(ticket.id, {
      estado: 'FINALIZADO',
      fechaFinalizacion: now,
      duracionAtencionSegundos: duracionSegundos,
      cajasHistorialIds: historialFin,
      etapa: areaFinalizada,
      area: areaFinalizada
    });

    db.recordAtencion({
      ticketId: ticket.id,
      ticketCodigo: ticket.codigo,
      cajaId: caja.id,
      usuarioId: caja.usuarioActualId || ticket.usuarioId || 'anonimo',
      fechaInicio: fechaInicioAtencion,
      fechaFin: now,
      duracionSegundos,
      resultado: 'FINALIZADO',
      sedeId: caja.sedeId
    });

    // Limpiar también cualquier otro turno huérfano secundario asignado previamente a este mismo cubículo
    const ticketsHuerfanos = db.getTickets(caja.sedeId).filter(tk => 
      tk.id !== ticket.id &&
      (tk.cajaId === caja.id || (caja.tipo === 'TRIADA' && tk.etapa === 'TRIADA' && Number(tk.cajaNumero) === Number(caja.numero))) &&
      (tk.estado === 'ASIGNADO' || tk.estado === 'LLAMANDO' || tk.estado === 'EN_ATENCION')
    );
    for (const th of ticketsHuerfanos) {
      db.updateTicket(th.id, {
        estado: 'FINALIZADO',
        fechaFinalizacion: now,
        duracionAtencionSegundos: 1
      });
    }

    // Liberar la caja respetando si el funcionario sigue conectado o no
    const nuevoEstado = (caja.activa && caja.usuarioActualId) ? 'DISPONIBLE' : 'DESCONECTADA';
    db.updateCaja(cajaId, {
      estado: nuevoEstado,
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

    if (nuevoEstado === 'DISPONIBLE') {
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
    } else {
      wsManager.broadcast({
        type: 'CAJA_DESCONECTADA',
        caja: caja.numero,
        cajaId: caja.id,
        timestamp: now,
        sedeId: caja.sedeId
      });
    }

    res.json({ success: true, caja: db.getCajaById(cajaId) });
  });

  // 8.5. Funcionario: FINALIZAR ATENCIÓN Y ENVIAR A TRIADA
  app.post('/api/cajas/:id/finalizar-y-triada', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Caja o módulo no encontrado' });
    }

    const { ticketId } = req.body || {};
    const ticket = buscarTicketActivoCaja(caja, ticketId);

    if (!ticket) {
      return res.status(400).json({ error: 'No hay ticket activo para finalizar y enviar a Triada' });
    }

    const now = new Date().toISOString();
    const fechaInicioAtencion = ticket.fechaInicio || ticket.fechaLlamado || now;
    const duracionSegundos = Math.max(1, Math.round((new Date(now).getTime() - new Date(fechaInicioAtencion).getTime()) / 1000));

    // 1. Grabar atención anterior de la caja
    db.recordAtencion({
      ticketId: ticket.id,
      ticketCodigo: ticket.codigo,
      cajaId: caja.id,
      usuarioId: caja.usuarioActualId || ticket.usuarioId || 'anonimo',
      fechaInicio: fechaInicioAtencion,
      fechaFin: now,
      duracionSegundos,
      resultado: 'FINALIZADO',
      sedeId: caja.sedeId
    });

    // 2. Liberar la caja actual respetando estado real de conexión
    const nuevoEstado = (caja.activa && caja.usuarioActualId) ? 'DISPONIBLE' : 'DESCONECTADA';
    db.updateCaja(cajaId, {
      estado: nuevoEstado,
      ticketActualId: null,
      ticketActualCodigo: null,
      ultimaActividad: now
    });

    // 3. Pasar ticket a estado esperando en etapa TRIADA y mantener su Sede
    const historialTriada = Array.isArray(ticket.cajasHistorialIds) 
      ? [...ticket.cajasHistorialIds] 
      : [];
    if (!historialTriada.includes(caja.id)) {
      historialTriada.push(caja.id);
    }

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
      llamadosContador: 0,
      cajasHistorialIds: historialTriada
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

    if (nuevoEstado === 'DISPONIBLE') {
      wsManager.broadcast({
        type: 'CAJA_DISPONIBLE',
        caja: caja.numero,
        cajaId: caja.id,
        funcionario: caja.usuarioNombre || undefined,
        timestamp: now,
        sedeId: caja.sedeId
      });
    } else {
      wsManager.broadcast({
        type: 'CAJA_DESCONECTADA',
        caja: caja.numero,
        cajaId: caja.id,
        timestamp: now,
        sedeId: caja.sedeId
      });
    }

    // Despachar inmediatamente para asignar a triada en esta Sede
    await dispatcher.triggerDispatch(caja.sedeId);

    res.json({ success: true, caja: db.getCajaById(cajaId) });
  });

  // 9. Funcionario: NO SE PRESENTÓ
  app.post('/api/cajas/:id/no-presento', async (req, res) => {
    const cajaId = Number(req.params.id);
    const caja = db.getCajaById(cajaId);

    if (!caja) {
      return res.status(404).json({ error: 'Caja o módulo no encontrado' });
    }

    const { ticketId } = req.body || {};
    const ticket = buscarTicketActivoCaja(caja, ticketId);

    if (!ticket) {
      return res.status(400).json({ error: 'No hay ticket activo' });
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
      usuarioId: caja.usuarioActualId || ticket.usuarioId || 'anonimo',
      fechaInicio: ticket.fechaLlamado || now,
      fechaFin: now,
      duracionSegundos: 0,
      resultado: 'NO_PRESENTO',
      sedeId: caja.sedeId
    });

    // Liberar caja respetando estado de conexión
    const nuevoEstado = (caja.activa && caja.usuarioActualId) ? 'DISPONIBLE' : 'DESCONECTADA';
    db.updateCaja(cajaId, {
      estado: nuevoEstado,
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

    if (nuevoEstado === 'DISPONIBLE') {
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
    } else {
      wsManager.broadcast({
        type: 'CAJA_DESCONECTADA',
        caja: caja.numero,
        cajaId: caja.id,
        timestamp: now,
        sedeId: caja.sedeId
      });
    }

    res.json({ success: true, caja: db.getCajaById(cajaId) });
  });

  // 10. Auditoría de eventos en tiempo real
  app.get('/api/eventos', (req, res) => {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    res.json(db.getEventos(limit));
  });

  // 11. Endpoint de prueba / reinicio de datos
  app.post('/api/test/reset', (req, res) => {
    if (process.env.NODE_ENV === 'production' || req.headers['x-simulate-env'] === 'production') {
      return res.status(403).json({ error: 'Endpoint deshabilitado en producción por políticas de seguridad' });
    }
    db.resetTestData();
    wsManager.broadcast({
      type: 'ESTADO_SISTEMA',
      timestamp: new Date().toISOString(),
      payload: db.getSnapshot()
    });
    res.json({ success: true, message: 'Datos reiniciados con éxito' });
  });

  // 12. Endpoint de estado de prueba (sin generación de turnos por defecto)
  app.post('/api/test/setup-escenario', async (req, res) => {
    if (process.env.NODE_ENV === 'production' || req.headers['x-simulate-env'] === 'production') {
      return res.status(403).json({ error: 'Endpoint deshabilitado en producción por políticas de seguridad' });
    }

    res.json({
      success: true,
      mensaje: 'Los turnos son generados exclusivamente desde el Kiosco del sistema',
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

export const serverReadyPromise = startServer().catch((err) => {
  console.error('[SERVER ERROR] Error fatal iniciando servidor:', err);
  if (!process.env.VERCEL) {
    process.exit(1);
  }
});
