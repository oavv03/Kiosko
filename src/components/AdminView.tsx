import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Clock, 
  Users, 
  RotateCcw, 
  Power, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  UserPlus, 
  Terminal, 
  Trash2, 
  Key, 
  Lock, 
  User, 
  Sliders, 
  Sparkles, 
  Camera, 
  Monitor, 
  MapPin, 
  LogIn, 
  LogOut, 
  Edit2, 
  AlertCircle, 
  Check, 
  Building2,
  Palette,
  FileSpreadsheet,
  Database
} from 'lucide-react';
import { Caja, Ticket, Usuario, RolUsuario, MetricasSistema, EventoRealtime } from '../types';
import { useCustomization } from '../context/CustomizationContext';
import { CajaView } from './CajaView';
import { TriadaView } from './TriadaView';
import { PersonalizacionView } from './PersonalizacionView';
import { CierreDiarioView } from './CierreDiarioView';

interface AdminViewProps {
  cajas: Caja[];
  metricas: MetricasSistema;
  usuarios: Usuario[];
  ticketsEsperando: Ticket[];
  ticketsActivos: Ticket[];
  cajaId?: number;
  onCajaChange?: (id: number) => void;
  activeTab?: 'metricas' | 'caja' | 'triada' | 'personalizacion';
  onTabChange?: (tab: 'metricas' | 'caja' | 'triada' | 'personalizacion') => void;
  onCajaToggle?: (id: number, activa: boolean) => void;
  onRefresh?: () => void;
  triadaEsperandoCount?: number;
  currentSedeId?: string;
  onSedeChange?: (sedeId: string) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  cajas,
  metricas,
  usuarios,
  ticketsEsperando,
  ticketsActivos,
  cajaId = 1,
  onCajaChange,
  activeTab = 'metricas',
  onTabChange,
  onCajaToggle,
  onRefresh,
  triadaEsperandoCount = 0,
  currentSedeId = 'ancon',
  onSedeChange
}) => {
  const { configuracion } = useCustomization();
  const [currentTab, setCurrentTab] = useState<'metricas' | 'caja' | 'triada'>(() => {
    if (activeTab === 'caja') return 'caja';
    if (activeTab === 'triada') return 'triada';
    return 'metricas';
  });

  const [superAdminSection, setSuperAdminSection] = useState<'metricas' | 'usuarios' | 'personalizacion' | 'cierre-diario'>(() => {
    return activeTab === 'personalizacion' ? 'personalizacion' : 'metricas';
  });

  useEffect(() => {
    if (activeTab === 'personalizacion') {
      setCurrentTab('metricas');
      setSuperAdminSection('personalizacion');
    } else if (activeTab === 'caja' || activeTab === 'triada' || activeTab === 'metricas') {
      setCurrentTab(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (tab: 'metricas' | 'caja' | 'triada' | 'personalizacion') => {
    if (tab === 'personalizacion') {
      setCurrentTab('metricas');
      setSuperAdminSection('personalizacion');
      onTabChange?.('metricas');
    } else {
      setCurrentTab(tab);
      onTabChange?.(tab);
    }
  };
  // Estado de autenticación exclusiva del Super Admin para el panel central y métricas
  const [sessionSuperAdmin, setSessionSuperAdmin] = useState<Usuario | null>(() => {
    try {
      const stored = localStorage.getItem('superadmin_session');
      if (stored) {
        const u = JSON.parse(stored);
        if (u && (u.rol === 'SUPER_ADMIN' || u.rol === 'ADMINISTRADOR')) return u;
      }
    } catch {}
    return null;
  });
  const [superAdminLoginUser, setSuperAdminLoginUser] = useState('');
  const [superAdminLoginPass, setSuperAdminLoginPass] = useState('');
  const [superAdminLoginError, setSuperAdminLoginError] = useState<string | null>(null);
  const [superAdminLoginLoading, setSuperAdminLoginLoading] = useState(false);

  const [eventos, setEventos] = useState<EventoRealtime[]>([]);

  // Estados para creación de nuevo usuario y asignación a caja o triada
  const [showUserModal, setShowUserModal] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoUsuario, setNuevoUsuario] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState<RolUsuario>('FUNCIONARIO');
  const [nuevaCajaId, setNuevaCajaId] = useState<number | null>(1);

  // Estados para reubicar / asignar estación a un funcionario existente
  const [showUbicarModal, setShowUbicarModal] = useState(false);
  const [usuarioAUbicar, setUsuarioAUbicar] = useState<Usuario | null>(null);
  const [estacionSeleccionadaModal, setEstacionSeleccionadaModal] = useState<number | null>(null);
  const [tabTipoUbicar, setTabTipoUbicar] = useState<'CAJA' | 'TRIADA'>('CAJA');
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);

  // Estados para editar datos de usuario
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [usuarioAEditar, setUsuarioAEditar] = useState<Usuario | null>(null);
  const [editUserNombre, setEditUserNombre] = useState('');
  const [editUserUsuario, setEditUserUsuario] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserRol, setEditUserRol] = useState<RolUsuario>('FUNCIONARIO');
  const [editUserCajaId, setEditUserCajaId] = useState<number | null>(null);

  // Estados para la edición de cubículos
  const [showEditCajaModal, setShowEditCajaModal] = useState(false);
  const [cajaAEditar, setCajaAEditar] = useState<Caja | null>(null);
  const [editNumero, setEditNumero] = useState<number>(1);
  const [editNombre, setEditNombre] = useState('');
  const [editTipo, setEditTipo] = useState<'CAJA' | 'TRIADA'>('CAJA');

  // Estados para seleccionar y reiniciar cubículo por si un ticket no avanza o surge error
  const [cajaReinicioSeleccionadaId, setCajaReinicioSeleccionadaId] = useState<number | null>(() => {
    return cajas.length > 0 ? cajas[0].id : 1;
  });
  const [ticketReinicioSeleccionadoId, setTicketReinicioSeleccionadoId] = useState<string>('AUTO');
  const [reiniciandoCajaId, setReiniciandoCajaId] = useState<number | null>(null);
  const [mensajeReinicio, setMensajeReinicio] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const ejecutarReinicioCaja = async (idCaja: number, idTicket?: string) => {
    setReiniciandoCajaId(idCaja);
    setMensajeReinicio(null);
    try {
      const payloadBody: any = {};
      if (idTicket && idTicket !== 'AUTO') {
        payloadBody.ticketId = idTicket;
      }
      const res = await fetch(`/api/cajas/${idCaja}/reiniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al reiniciar el cubículo');
      }

      setMensajeReinicio({
        tipo: 'success',
        texto: data.message || `Caja reiniciada exitosamente.`
      });

      setCajaReinicioSeleccionadaId(idCaja);
      if (data.ticket?.id) {
        setTicketReinicioSeleccionadoId(data.ticket.id);
      }

      if (onRefresh) onRefresh();
      fetchEventos();
    } catch (err: any) {
      setMensajeReinicio({
        tipo: 'error',
        texto: err.message || 'No se pudo reiniciar el cubículo.'
      });
    } finally {
      setReiniciandoCajaId(null);
      setTimeout(() => {
        setMensajeReinicio(prev => prev?.tipo === 'success' ? null : prev);
      }, 7000);
    }
  };

  // Cargar eventos de auditoría
  const fetchEventos = async () => {
    try {
      const res = await fetch('/api/eventos?limit=50');
      if (res.ok) {
        const data = await res.json();
        setEventos(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const iniciarEdicionCaja = (caja: Caja) => {
    setCajaAEditar(caja);
    setEditNumero(caja.numero);
    setEditNombre(caja.nombre);
    setEditTipo(caja.tipo || 'CAJA');
    setShowEditCajaModal(true);
  };

  const guardarEdicionCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cajaAEditar) return;
    try {
      const res = await fetch(`/api/cajas/${cajaAEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: editNumero,
          nombre: editNombre,
          tipo: editTipo
        })
      });
      if (res.ok) {
        setShowEditCajaModal(false);
        setCajaAEditar(null);
        if (onRefresh) onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEventos();
    const interval = setInterval(fetchEventos, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleCaja = async (caja: Caja) => {
    try {
      const res = await fetch(`/api/cajas/${caja.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !caja.activa })
      });
      if (res.ok && onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  const resetBaseDeDatos = async () => {
    if (!confirm('¿Desea reiniciar todos los turnos y restablecer las cajas?')) return;
    try {
      await fetch('/api/test/reset', { method: 'POST' });
      if (onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  // Autenticación de Super Administrador para acceder a Panel Central y Métricas
  const handleSuperAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuperAdminLoginLoading(true);
    setSuperAdminLoginError(null);
    try {
      const res = await fetch('/api/auth/superadmin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: superAdminLoginUser.trim(),
          password: superAdminLoginPass.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSuperAdminLoginError(data.error || 'Credenciales inválidas de Super Administrador');
        return;
      }
      setSessionSuperAdmin(data.user);
      localStorage.setItem('superadmin_session', JSON.stringify(data.user));
      if (data.token) {
        localStorage.setItem('superadmin_token', data.token);
      }
      setSuperAdminLoginUser('');
      setSuperAdminLoginPass('');
    } catch (err: any) {
      setSuperAdminLoginError(err.message || 'Error al conectar con el servidor');
    } finally {
      setSuperAdminLoginLoading(false);
    }
  };

  const handleSuperAdminLogout = () => {
    setSessionSuperAdmin(null);
    localStorage.removeItem('superadmin_session');
    localStorage.removeItem('superadmin_token');
  };

  // Creación de usuario por el Super Admin
  const crearFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre) return;

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoNombre,
          usuario: nuevoUsuario.trim() || (nuevoNombre.split(' ')[0].toLowerCase() + Math.floor(Math.random() * 1000)),
          password: nuevoPassword.trim() || '123',
          rol: nuevoRol,
          cajaAsignadaId: nuevaCajaId === null || nuevaCajaId === 0 ? null : nuevaCajaId,
          sedeId: currentSedeId
        })
      });
      if (res.ok) {
        setShowUserModal(false);
        setNuevoNombre('');
        setNuevoUsuario('');
        setNuevoEmail('');
        setNuevoPassword('');
        setNuevoRol('FUNCIONARIO_CAJA');
        setNuevaCajaId(null);
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Ubicación / Asignación de usuario a Caja o Triada
  const abrirUbicarModal = (user: Usuario) => {
    setUsuarioAUbicar(user);
    setEstacionSeleccionadaModal(user.cajaAsignadaId ?? null);
    const assignedCaja = cajas.find(c => c.id === user.cajaAsignadaId);
    if (assignedCaja && assignedCaja.tipo === 'TRIADA') {
      setTabTipoUbicar('TRIADA');
    } else {
      setTabTipoUbicar('CAJA');
    }
    setShowUbicarModal(true);
  };

  const guardarUbicacion = async () => {
    if (!usuarioAUbicar) return;
    setGuardandoUbicacion(true);
    try {
      const targetCaja = cajas.find(c => c.id === estacionSeleccionadaModal);
      let rolActualizado = usuarioAUbicar.rol;
      if (targetCaja) {
        if (usuarioAUbicar.rol === 'SUPER_ADMIN') {
          rolActualizado = 'SUPER_ADMIN';
        } else if (usuarioAUbicar.rol === 'SUPERVISOR_CAJA' || usuarioAUbicar.rol === 'SUPERVISOR_TRIADA') {
          rolActualizado = targetCaja.tipo === 'TRIADA' ? 'SUPERVISOR_TRIADA' : 'SUPERVISOR_CAJA';
        } else {
          rolActualizado = targetCaja.tipo === 'TRIADA' ? 'FUNCIONARIO_TRIADA' : 'FUNCIONARIO_CAJA';
        }
      }

      const res = await fetch(`/api/usuarios/${usuarioAUbicar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cajaAsignadaId: estacionSeleccionadaModal,
          rol: rolActualizado
        })
      });
      if (res.ok) {
        setShowUbicarModal(false);
        setUsuarioAUbicar(null);
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGuardandoUbicacion(false);
    }
  };

  // Edición de usuario
  const abrirEditarUsuario = (user: Usuario) => {
    setUsuarioAEditar(user);
    setEditUserNombre(user.nombre);
    setEditUserUsuario(user.usuario || user.email.split('@')[0]);
    setEditUserEmail(user.email);
    setEditUserPassword(user.password || '');
    setEditUserRol(user.rol);
    setEditUserCajaId(user.cajaAsignadaId ?? null);
    setShowEditUserModal(true);
  };

  const guardarEdicionUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioAEditar) return;
    try {
      const res = await fetch(`/api/usuarios/${usuarioAEditar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editUserNombre,
          usuario: editUserUsuario,
          email: editUserEmail,
          password: editUserPassword,
          rol: editUserRol,
          cajaAsignadaId: editUserCajaId === null || editUserCajaId === 0 ? null : editUserCajaId
        })
      });
      if (res.ok) {
        setShowEditUserModal(false);
        setUsuarioAEditar(null);
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const eliminarUsuario = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar al funcionario "${nombre}"?`)) return;
    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: 'DELETE' });
      if (res.ok && onRefresh) onRefresh();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Selector de Navegación dentro de Administración */}
      <div 
        className="border p-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md transition-colors"
        style={{
          backgroundColor: configuracion.surfaceColor || '#FFFFFF',
          borderColor: configuracion.borderColor || '#E2E8F0'
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleTabChange('metricas')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              currentTab === 'metricas'
                ? 'text-white shadow-md'
                : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: currentTab === 'metricas' ? (configuracion.buttonColor || '#1D4ED8') : 'transparent',
              color: currentTab === 'metricas' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
            }}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Panel Central y Métricas</span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('caja')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              currentTab === 'caja'
                ? 'text-white shadow-md'
                : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: currentTab === 'caja' ? (configuracion.primaryColor || '#1D4ED8') : 'transparent',
              color: currentTab === 'caja' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
            }}
          >
            <Monitor className="w-4 h-4" />
            <span>Atención en Cajas (Ventanillas 0-8)</span>
            {ticketsEsperando.filter(t => t.etapa !== 'TRIADA').length > 0 && (
              <span 
                className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
                style={{
                  backgroundColor: `${configuracion.primaryColor || '#1D4ED8'}20`,
                  color: configuracion.primaryColor || '#1D4ED8',
                  borderColor: `${configuracion.primaryColor || '#1D4ED8'}40`
                }}
              >
                {ticketsEsperando.filter(t => t.etapa !== 'TRIADA').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('triada')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
              currentTab === 'triada'
                ? 'text-white shadow-md'
                : 'hover:opacity-80'
            }`}
            style={{
              backgroundColor: currentTab === 'triada' ? (configuracion.secondaryColor || '#4F46E5') : 'transparent',
              color: currentTab === 'triada' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
            }}
          >
            <Camera className="w-4 h-4" />
            <span>Módulos de Triada / Fotografía (1 a 8)</span>
            {triadaEsperandoCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black animate-pulse">
                {triadaEsperandoCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const url = new URL(window.location.href);
              url.searchParams.set('view', 'reportes');
              window.location.href = url.toString();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-400 hover:text-white bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-800/80 transition-all cursor-pointer shadow-sm"
            title="Ir a la sección de Reportes y Auditoría para Supervisores"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Centro de Reportes</span>
          </button>

          <span 
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border hidden sm:inline-block"
            style={{
              backgroundColor: configuracion.backgroundColor || '#F8FAFC',
              borderColor: configuracion.borderColor || '#E2E8F0',
              color: configuracion.mutedTextColor || '#64748B'
            }}
          >
            {currentTab === 'metricas' ? 'Control Central (Super Admin)' : currentTab === 'caja' ? 'Estación de Caja' : 'Módulo de Triada'}
          </span>
        </div>
      </div>

      {/* 1. VISTA DE CAJA DENTRO DE ADMIN */}
      {currentTab === 'caja' && (
        <div className="space-y-4">
          <CajaView
            cajaId={cajaId}
            cajas={cajas}
            ticketsEsperando={ticketsEsperando}
            ticketsActivos={ticketsActivos}
            usuarios={usuarios}
            onCambiarCaja={onCajaChange}
          />
        </div>
      )}

      {/* 2. VISTA DE TRIADA DENTRO DE ADMIN */}
      {currentTab === 'triada' && (
        <div className="space-y-4">
          <TriadaView
            cajaId={cajaId}
            cajas={cajas}
            ticketsEsperando={ticketsEsperando}
            ticketsActivos={ticketsActivos}
            usuarios={usuarios}
            onCambiarCaja={onCajaChange}
          />
        </div>
      )}

      {/* 3. VISTA DE SUPERVISIÓN Y MÉTRICAS - FORMULARIO DE LOGIN SUPER ADMIN */}
      {currentTab === 'metricas' && !sessionSuperAdmin && (
        <div className="py-10 px-4 flex justify-center items-center">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-blue-950/80 border border-blue-800/60 text-blue-400 mb-3 shadow-inner">
                <Lock className="w-7 h-7 text-blue-400" />
              </div>
              <div className="inline-block px-3 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-2">
                Acceso Restringido • Super Admin
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Panel Central y Métricas
              </h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Para ingresar al panel central, gestión de usuarios y personalización del sistema debe autenticarse con su usuario y contraseña de Super Administrador.
              </p>
            </div>

            <form onSubmit={handleSuperAdminLogin} className="space-y-4 relative z-10">
              {superAdminLoginError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{superAdminLoginError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span>Usuario</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="oavega"
                  value={superAdminLoginUser}
                  onChange={(e) => setSuperAdminLoginUser(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  <span>Contraseña</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={superAdminLoginPass}
                  onChange={(e) => setSuperAdminLoginPass(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={superAdminLoginLoading}
                className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                {superAdminLoginLoading ? (
                  <span>Verificando credenciales...</span>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Ingresar al Panel Central</span>
                  </>
                )}
              </button>

              <div className="pt-3 border-t border-slate-800/80">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-300 block">Super Administrador:</span>
                    <span className="font-mono text-blue-300">oavega</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuperAdminLoginUser('oavega');
                      setSuperAdminLoginPass('1234561');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 font-medium text-[11px] cursor-pointer transition-colors"
                  >
                    Rellenar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. VISTA DE SUPERVISIÓN Y MÉTRICAS (PANEL SUPER ADMIN AUTENTICADO) */}
      {currentTab === 'metricas' && sessionSuperAdmin && (
        <div className="space-y-8">
          {/* Barra de Sesión de Super Admin */}
          <div className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-800/50 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">
                    {sessionSuperAdmin.nombre}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                    Super Administrador
                  </span>
                </div>
                <div className="text-xs text-slate-400">
                  Sesión activa como <span className="font-mono text-slate-300">@{sessionSuperAdmin.usuario || sessionSuperAdmin.email.split('@')[0]}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSuperAdminLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-rose-950/50 border border-slate-700 hover:border-rose-800 text-xs font-semibold text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                title="Cerrar sesión de Super Administrador"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>

          {/* Sub-navegación interna de funciones exclusivas de Super Admin */}
          <div 
            className="flex items-center gap-2 p-1.5 rounded-2xl border flex-wrap shadow-sm transition-colors"
            style={{
              backgroundColor: configuracion.surfaceColor || '#FFFFFF',
              borderColor: configuracion.borderColor || '#E2E8F0'
            }}
          >
            <button
              type="button"
              onClick={() => setSuperAdminSection('metricas')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                superAdminSection === 'metricas'
                  ? 'text-white shadow-md'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: superAdminSection === 'metricas' ? (configuracion.buttonColor || '#1D4ED8') : 'transparent',
                color: superAdminSection === 'metricas' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
              }}
            >
              <Activity className="w-4 h-4" />
              <span>Métricas y Supervisión</span>
            </button>

            <button
              type="button"
              onClick={() => setSuperAdminSection('usuarios')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                superAdminSection === 'usuarios'
                  ? 'text-white shadow-md'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: superAdminSection === 'usuarios' ? (configuracion.buttonColor || '#1D4ED8') : 'transparent',
                color: superAdminSection === 'usuarios' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
              }}
            >
              <Users className="w-4 h-4" />
              <span>Gestión de Funcionarios</span>
            </button>

            <button
              type="button"
              onClick={() => setSuperAdminSection('personalizacion')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                superAdminSection === 'personalizacion'
                  ? 'text-white shadow-md'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: superAdminSection === 'personalizacion' ? (configuracion.primaryColor || '#1D4ED8') : 'transparent',
                color: superAdminSection === 'personalizacion' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
              }}
            >
              <Palette className="w-4 h-4" />
              <span>Personalización del Sistema</span>
            </button>

            <button
              type="button"
              onClick={() => setSuperAdminSection('cierre-diario')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                superAdminSection === 'cierre-diario'
                  ? 'text-white shadow-md'
                  : 'hover:opacity-80'
              }`}
              style={{
                backgroundColor: superAdminSection === 'cierre-diario' ? (configuracion.buttonColor || '#1D4ED8') : 'transparent',
                color: superAdminSection === 'cierre-diario' ? '#FFFFFF' : (configuracion.mutedTextColor || '#64748B')
              }}
            >
              <Database className="w-4 h-4" />
              <span>Cierre Diario y Supabase Storage</span>
            </button>
          </div>

          {/* 0. SECCIÓN CIERRE DIARIO Y SUPABASE STORAGE (EXCLUSIVA SUPER ADMIN) */}
          {superAdminSection === 'cierre-diario' && (
            <div className="space-y-6">
              <CierreDiarioView />
            </div>
          )}

          {/* 1. SECCIÓN PERSONALIZACIÓN DEL SISTEMA (EXCLUSIVA SUPER ADMIN) */}
          {superAdminSection === 'personalizacion' && (
            <div className="space-y-6">
              <PersonalizacionView />
            </div>
          )}

          {/* 2. SECCIÓN MÉTRICAS Y SUPERVISIÓN */}
          {superAdminSection === 'metricas' && (
            <div className="space-y-8">
              {/* Encabezado del Panel de Administración */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 mb-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                    Control Central
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Panel de Administración y Métricas
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Supervisión en tiempo real de cajas, colas, latencia de asignación y registro de auditoría.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={resetBaseDeDatos}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800 text-xs font-semibold text-rose-300 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-rose-400" />
                    <span>Reiniciar Turnos</span>
                  </button>
                </div>
              </div>

      {/* Tarjetas de Métricas de Latencia y Tiempos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Hoy</span>
          <div className="text-2xl font-black text-white mt-1 font-display">
            {metricas.totalTicketsHoy}
          </div>
          <span className="text-[10px] text-slate-500">Tickets creados</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-blue-400">En Espera</span>
          <div className="text-2xl font-black text-blue-400 mt-1 font-display">
            {metricas.esperandoCount}
          </div>
          <span className="text-[10px] text-slate-500">En cola global</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-amber-400">En Atención</span>
          <div className="text-2xl font-black text-amber-400 mt-1 font-display">
            {metricas.enAtencionCount}
          </div>
          <span className="text-[10px] text-slate-500">En ventanillas</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-emerald-400">Finalizados</span>
          <div className="text-2xl font-black text-emerald-400 mt-1 font-display">
            {metricas.finalizadosCount}
          </div>
          <span className="text-[10px] text-slate-500">Atendidos con éxito</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-slate-400">Espera Promedio</span>
          <div className="text-2xl font-black text-white mt-1 font-display">
            {metricas.tiempoPromedioEsperaSegundos}s
          </div>
          <span className="text-[10px] text-slate-500">Tiempo antes de atención</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-[11px] font-bold uppercase text-indigo-400">Latencia Asignación</span>
          <div className="text-2xl font-black text-indigo-400 mt-1 font-display">
            {metricas.latenciaAsignacionPromedioMs}ms
          </div>
          <span className="text-[10px] text-slate-500">Creación → Asignación</span>
        </div>
      </div>

      {/* HERRAMIENTA DESTACADA: SELECCIÓN Y REINICIO RÁPIDO DE CUBÍCULO POR BLOQUEO / ERROR */}
      {(() => {
        const cajaSeleccionadaParaReinicio = cajas.find(c => c.id === cajaReinicioSeleccionadaId) || cajas[0];
        const ticketActualEnCajaReinicio = cajaSeleccionadaParaReinicio?.ticketActualId 
          ? (ticketsActivos.find(t => t.id === cajaSeleccionadaParaReinicio.ticketActualId) || ticketsEsperando.find(t => t.id === cajaSeleccionadaParaReinicio.ticketActualId))
          : null;

        return (
          <div className="p-6 rounded-3xl bg-gradient-to-r from-amber-950/30 via-slate-900 to-indigo-950/30 border border-amber-500/40 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Encabezado de la herramienta */}
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5 pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                  <RotateCcw className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider">
                      Recuperación Operativa • Anti-Bloqueo
                    </span>
                    <span className="text-xs text-slate-400">
                      Sede: <strong className="text-slate-200 capitalize">{currentSedeId}</strong>
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white mt-1 tracking-tight">
                    Seleccionar y Reiniciar Caja / Recuperar Turno Atascado
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                    Si un ticket no avanza, se queda congelado o surge algún error en la terminal, seleccione la caja o triada correspondiente y presione <strong>Reiniciar y Reasignar Turno</strong>. El sistema restaurará el cubículo a estado activo y le hará caer el <strong>mismo ticket</strong> para poder llamarlo, iniciar atención y avanzar sin perder el turno.
                  </p>
                </div>
              </div>
            </div>

            {/* Notificación de resultado tras reiniciar */}
            {mensajeReinicio && (
              <div className={`mb-5 p-4 rounded-2xl border text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg ${
                mensajeReinicio.tipo === 'success'
                  ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-200 shadow-emerald-950/30'
                  : 'bg-rose-950/80 border-rose-600/70 text-rose-200 shadow-rose-950/30'
              }`}>
                <div className="flex items-center gap-3">
                  {mensajeReinicio.tipo === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <span className="font-semibold">{mensajeReinicio.texto}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMensajeReinicio(null)}
                  className="px-2 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-xs font-bold cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Controles interactivos de Selección y Reinicio */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* 1. Selector de Cubículo */}
              <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-amber-300 block mb-2 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-amber-400" />
                    <span>1. Seleccionar Cubículo:</span>
                  </label>
                  <select
                    value={cajaSeleccionadaParaReinicio?.id || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setCajaReinicioSeleccionadaId(id);
                      setTicketReinicioSeleccionadoId('AUTO');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500 cursor-pointer shadow-inner"
                  >
                    <optgroup label="Ventanillas de Caja (0 a 8)">
                      {cajas.filter(c => c.tipo !== 'TRIADA').map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} {c.nombre ? `— ${c.nombre.replace(/^Caja \d+\s*-\s*/i, '')}` : ''} [{c.estado}{c.ticketActualCodigo ? ` • Turno: ${c.ticketActualCodigo}` : ' • Libre'}]
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                      {cajas.filter(c => c.tipo === 'TRIADA').map((c) => (
                        <option key={c.id} value={c.id}>
                          Triada {c.numero} {c.nombre ? `— ${c.nombre.replace(/^Triada \d+\s*-\s*/i, '')}` : ''} [{c.estado}{c.ticketActualCodigo ? ` • Turno: ${c.ticketActualCodigo}` : ' • Libre'}]
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {/* Resumen del cubículo actualmente seleccionado */}
                {cajaSeleccionadaParaReinicio && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">
                        {cajaSeleccionadaParaReinicio.tipo === 'TRIADA' ? 'Módulo Triada' : 'Caja'} {cajaSeleccionadaParaReinicio.numero}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        cajaSeleccionadaParaReinicio.estado === 'OCUPADA'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : cajaSeleccionadaParaReinicio.estado === 'DISPONIBLE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-slate-800 text-slate-400'
                      }`}>
                        {cajaSeleccionadaParaReinicio.estado}
                      </span>
                    </div>
                    <span className="text-slate-400 truncate max-w-[180px]">
                      Operador: <strong className="text-slate-300">{cajaSeleccionadaParaReinicio.usuarioNombre || 'Sin operador'}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* 2. Turno que caerá / se restaurará */}
              <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-2 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    <span>2. Turno que Caerá en la Caja:</span>
                  </span>

                  {cajaSeleccionadaParaReinicio?.ticketActualCodigo ? (
                    <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-black text-white font-display">
                            {cajaSeleccionadaParaReinicio.ticketActualCodigo}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase border border-amber-500/30">
                            Mismo Turno Actual
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-0.5 font-medium truncate max-w-[200px]">
                          {[ticketActualEnCajaReinicio?.ciudadanoNombre, ticketActualEnCajaReinicio?.ciudadanoApellido].filter(Boolean).join(' ') || ticketActualEnCajaReinicio?.tramite || 'Turno activo'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-bold text-amber-400 block">
                          Listo para reasignar
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {ticketActualEnCajaReinicio?.estado || 'En atención'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <select
                        value={ticketReinicioSeleccionadoId}
                        onChange={(e) => setTicketReinicioSeleccionadoId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                      >
                        <option value="AUTO">
                          Auto: Primer turno disponible en espera
                        </option>
                        {ticketsActivos.map(t => (
                          <option key={t.id} value={t.id}>
                            Turno {t.codigo} ({t.tramite}) — {[t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'Ciudadano'} [{t.estado}]
                          </option>
                        ))}
                        {ticketsEsperando.map(t => (
                          <option key={t.id} value={t.id}>
                            Turno {t.codigo} ({t.tramite}) — En cola de espera
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-slate-400 block">
                        La caja actualmente no tiene ticket activo; se asignará automáticamente el seleccionado.
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 mt-2">
                  ✓ El ticket regresará a estado <strong className="text-emerald-400">ASIGNADO</strong> listo para llamar o atender.
                </div>
              </div>

              {/* 3. Botones de Acción de Reinicio */}
              <div className="lg:col-span-3 flex flex-col justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (cajaSeleccionadaParaReinicio) {
                      ejecutarReinicioCaja(cajaSeleccionadaParaReinicio.id, ticketReinicioSeleccionadoId);
                    }
                  }}
                  disabled={reiniciandoCajaId !== null || !cajaSeleccionadaParaReinicio}
                  className="w-full py-4 px-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer text-center"
                >
                  <RotateCcw className={`w-5 h-5 shrink-0 ${reiniciandoCajaId === cajaSeleccionadaParaReinicio?.id ? 'animate-spin' : ''}`} />
                  <span>
                    {reiniciandoCajaId === cajaSeleccionadaParaReinicio?.id ? (
                      'Reiniciando estación...'
                    ) : cajaSeleccionadaParaReinicio?.ticketActualCodigo ? (
                      <>Reiniciar y Reasignar {cajaSeleccionadaParaReinicio.ticketActualCodigo}</>
                    ) : (
                      <>Reiniciar {cajaSeleccionadaParaReinicio?.tipo === 'TRIADA' ? 'Triada' : 'Caja'} {cajaSeleccionadaParaReinicio?.numero}</>
                    )}
                  </span>
                </button>

                {cajaSeleccionadaParaReinicio && (
                  <button
                    type="button"
                    onClick={() => {
                      onCajaChange?.(cajaSeleccionadaParaReinicio.id);
                      handleTabChange(cajaSeleccionadaParaReinicio.tipo === 'TRIADA' ? 'triada' : 'caja');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5 text-blue-400" />
                    <span>Ir a Terminal ({cajaSeleccionadaParaReinicio.tipo === 'TRIADA' ? 'Triada' : 'Caja'} {cajaSeleccionadaParaReinicio.numero})</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Monitor de Cajas y Módulos de Triada en Vivo */}
      <div className="space-y-6">
        {/* 1. SECCIÓN DE CAJAS DE ATENCIÓN (Caja 0 a 8) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                <span>Cajas de Atención Regular ({cajas.filter(c => c.tipo !== 'TRIADA').length} Cajas: Caja 0 Preferencial y Cajas 1 a 8)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Cubículos para la primera etapa de recepción y trámites generales.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {cajas.filter(c => c.tipo !== 'TRIADA' && c.activa).length} de {cajas.filter(c => c.tipo !== 'TRIADA').length} activas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {cajas.filter(c => c.tipo !== 'TRIADA').map((caja) => (
              <div
                key={caja.id}
                className={`p-4 rounded-2xl border transition-all ${
                  !caja.activa
                    ? 'bg-slate-950/60 border-slate-800 opacity-60'
                    : caja.estado === 'DISPONIBLE'
                    ? 'bg-slate-900 border-emerald-500/40 shadow-emerald-950/20 shadow-md'
                    : caja.estado === 'OCUPADA'
                    ? 'bg-slate-900 border-amber-500/40 shadow-amber-950/20 shadow-md'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
                      {caja.numero}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">
                        Caja {caja.numero} {caja.numero === 0 ? '(Preferencial)' : ''}
                      </h4>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[160px]">
                        {caja.nombre.replace(/^Caja \d+\s*-\s*/i, '') || 'Ventanilla'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Botón Reiniciar caja directo */}
                    <button
                      onClick={() => ejecutarReinicioCaja(caja.id, caja.ticketActualId || undefined)}
                      disabled={reiniciandoCajaId === caja.id}
                      title={caja.ticketActualCodigo ? `Reiniciar Caja ${caja.numero} y reasignar turno ${caja.ticketActualCodigo}` : `Reiniciar Caja ${caja.numero}`}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-amber-500 bg-slate-950 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${reiniciandoCajaId === caja.id ? 'animate-spin text-amber-400' : ''}`} />
                    </button>

                    {/* Botón Editar cubículo */}
                    <button
                      onClick={() => iniciarEdicionCaja(caja)}
                      title="Editar número o nombre de cubículo"
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-blue-500 bg-slate-950 text-slate-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>

                    {/* Switch Activa/Inactiva */}
                    <button
                      onClick={() => toggleCaja(caja)}
                      title={caja.activa ? 'Desactivar caja' : 'Activar caja'}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        caja.activa 
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60' 
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Estado:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                      caja.estado === 'DISPONIBLE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : caja.estado === 'OCUPADA'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {caja.estado}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Operador:</span>
                    <span className="font-medium text-slate-200 truncate max-w-[130px]">
                      {caja.usuarioNombre || 'Sin operador'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Ticket activo:</span>
                    <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded">
                      {caja.ticketActualCodigo || 'Ninguno'}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  {/* Botón de Reiniciar y recaer ticket en esta caja */}
                  {caja.ticketActualCodigo ? (
                    <button
                      type="button"
                      onClick={() => ejecutarReinicioCaja(caja.id, caja.ticketActualId || undefined)}
                      disabled={reiniciandoCajaId === caja.id}
                      className="w-full py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/70 border border-amber-700/60 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${reiniciandoCajaId === caja.id ? 'animate-spin' : ''}`} />
                      <span>Reiniciar y recaer {caja.ticketActualCodigo}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => ejecutarReinicioCaja(caja.id)}
                      disabled={reiniciandoCajaId === caja.id}
                      className="w-full py-1 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3 h-3 ${reiniciandoCajaId === caja.id ? 'animate-spin' : ''}`} />
                      <span>Reiniciar cubículo</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onCajaChange?.(caja.id);
                      handleTabChange('caja');
                    }}
                    className="w-full py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Atender en Caja {caja.numero}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. SECCIÓN DE MÓDULOS DE TRIADA / FOTOGRAFÍA (Triada 1 a 8) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-indigo-400" />
                <span>Módulos de Triada / Fotografía ({cajas.filter(c => c.tipo === 'TRIADA').length} Módulos: Triada 1 a 8)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Cubículos para la segunda etapa del recorrido (toma de fotografía, huellas y biometría).
              </p>
            </div>
            <span className="text-xs text-slate-400">
              {cajas.filter(c => c.tipo === 'TRIADA' && c.activa).length} de {cajas.filter(c => c.tipo === 'TRIADA').length} activas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {cajas.filter(c => c.tipo === 'TRIADA').map((triada) => (
              <div
                key={triada.id}
                className={`p-4 rounded-2xl border transition-all ${
                  !triada.activa
                    ? 'bg-slate-950/60 border-slate-800 opacity-60'
                    : triada.estado === 'DISPONIBLE'
                    ? 'bg-indigo-950/20 border-emerald-500/40 shadow-emerald-950/20 shadow-md'
                    : triada.estado === 'OCUPADA'
                    ? 'bg-indigo-950/30 border-amber-500/40 shadow-amber-950/20 shadow-md'
                    : 'bg-slate-900 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
                      {triada.numero}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white">Triada {triada.numero}</h4>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[130px]">
                        {triada.nombre.replace(/^Triada \d+\s*-\s*/i, '') || 'Fotografía y Biometría'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Botón Reiniciar triada directo */}
                    <button
                      onClick={() => ejecutarReinicioCaja(triada.id, triada.ticketActualId || undefined)}
                      disabled={reiniciandoCajaId === triada.id}
                      title={triada.ticketActualCodigo ? `Reiniciar Triada ${triada.numero} y reasignar turno ${triada.ticketActualCodigo}` : `Reiniciar Triada ${triada.numero}`}
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-amber-500 bg-slate-950 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${reiniciandoCajaId === triada.id ? 'animate-spin text-amber-400' : ''}`} />
                    </button>

                    {/* Botón Editar cubículo */}
                    <button
                      onClick={() => iniciarEdicionCaja(triada)}
                      title="Editar número o nombre de cubículo"
                      className="p-1.5 rounded-lg border border-slate-800 hover:border-indigo-500 bg-slate-950 text-slate-400 hover:text-indigo-300 transition-colors cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                    </button>

                    {/* Switch Activa/Inactiva */}
                    <button
                      onClick={() => toggleCaja(triada)}
                      title={triada.activa ? 'Desactivar módulo' : 'Activar módulo'}
                      className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                        triada.activa 
                          ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60' 
                          : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Estado:</span>
                    <span className={`font-bold px-2 py-0.5 rounded-md text-[10px] ${
                      triada.estado === 'DISPONIBLE'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : triada.estado === 'OCUPADA'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-400'
                    }`}>
                      {triada.estado}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Operador:</span>
                    <span className="font-medium text-slate-200 truncate max-w-[120px]">
                      {triada.usuarioNombre || 'Sin operador'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Ticket activo:</span>
                    <span className="font-extrabold text-white bg-slate-800 px-2 py-0.5 rounded">
                      {triada.ticketActualCodigo || 'Ninguno'}
                    </span>
                  </div>
                </div>

                <div className="mt-2.5 space-y-1.5">
                  {/* Botón de Reiniciar y recaer ticket en este módulo */}
                  {triada.ticketActualCodigo ? (
                    <button
                      type="button"
                      onClick={() => ejecutarReinicioCaja(triada.id, triada.ticketActualId || undefined)}
                      disabled={reiniciandoCajaId === triada.id}
                      className="w-full py-1.5 rounded-xl bg-amber-950/50 hover:bg-amber-900/70 border border-amber-700/60 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${reiniciandoCajaId === triada.id ? 'animate-spin' : ''}`} />
                      <span>Reiniciar y recaer {triada.ticketActualCodigo}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => ejecutarReinicioCaja(triada.id)}
                      disabled={reiniciandoCajaId === triada.id}
                      className="w-full py-1 rounded-xl bg-slate-950 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-slate-200 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className={`w-3 h-3 ${reiniciandoCajaId === triada.id ? 'animate-spin' : ''}`} />
                      <span>Reiniciar módulo</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onCajaChange?.(triada.id);
                      handleTabChange('triada');
                    }}
                    className="w-full py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Atender en Triada {triada.numero}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registro de Auditoría de Eventos en Tiempo Real */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            Auditoría de Eventos en Tiempo Real (WebSockets)
          </h3>
          <span className="text-xs text-slate-500">Últimos {eventos.length} eventos emitidos</span>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {eventos.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No hay eventos registrados recientemente.
            </div>
          ) : (
            eventos.map((ev, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    ev.type.includes('LLAMADO')
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : ev.type.includes('CREADO')
                      ? 'bg-blue-950 text-blue-400 border border-blue-800'
                      : ev.type.includes('FINALIZADO')
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {ev.type}
                  </span>

                  <span className="font-semibold text-white">
                    {ev.codigo ? `Turno ${ev.codigo}` : ''}
                    {ev.ciudadano ? ` • ${ev.ciudadano}` : ''}
                    {ev.caja ? ` → Caja ${ev.caja}` : ''}
                    {ev.funcionario ? ` (${ev.funcionario})` : ''}
                  </span>
                </div>

                <span className="text-[11px] font-mono text-slate-500">
                  {new Date(ev.timestamp).toLocaleTimeString([], { hour12: false })}.{new Date(ev.timestamp).getMilliseconds().toString().padStart(3, '0')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )}

  {/* 3. SECCIÓN GESTIÓN DE FUNCIONARIOS Y CUBÍCULOS (EXCLUSIVA SUPER ADMIN) */}
  {superAdminSection === 'usuarios' && (
    <div className="space-y-8">
      {/* Gestión de Usuarios y Credenciales para las Cajas */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-400" />
              Usuarios y Credenciales de Acceso a Cajas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              El Super Admin crea y administra los usuarios y contraseñas utilizados para operar las cajas.
            </p>
          </div>

          <button
            onClick={() => setShowUserModal(true)}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/30 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Nuevo Usuario / Funcionario</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Funcionario</th>
                <th className="py-3 px-4">Usuario (Login)</th>
                <th className="py-3 px-4">Contraseña</th>
                <th className="py-3 px-4">Rol</th>
                <th className="py-3 px-4">Caja Asignada</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 font-bold text-xs">
                        {u.nombre.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-bold">{u.nombre}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-blue-300 font-semibold">
                      @{u.usuario || u.email.split('@')[0]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/80">
                      {u.password || '••••••'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.rol === 'SUPER_ADMIN' || u.rol === 'ADMINISTRADOR'
                        ? 'bg-purple-950 text-purple-300 border border-purple-800'
                        : u.rol === 'SUPERVISOR_CAJA'
                          ? 'bg-blue-950 text-blue-300 border border-blue-800'
                          : u.rol === 'SUPERVISOR_TRIADA'
                            ? 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                            : u.rol === 'FUNCIONARIO_CAJA'
                              ? 'bg-sky-950 text-sky-300 border border-sky-800'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {u.rol === 'SUPER_ADMIN' 
                        ? 'SUPER ADMIN' 
                        : u.rol === 'ADMINISTRADOR'
                          ? 'ADMINISTRADOR'
                          : u.rol === 'SUPERVISOR_CAJA'
                            ? 'SUPERVISOR DE CAJA'
                            : u.rol === 'SUPERVISOR_TRIADA'
                              ? 'SUPERVISOR DE TRIADA'
                              : u.rol === 'FUNCIONARIO_CAJA' 
                                ? 'FUNCIONARIO CAJA' 
                                : u.rol === 'FUNCIONARIO_TRIADA' 
                                  ? 'FUNCIONARIO TRIADA' 
                                  : u.rol}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {(() => {
                      const mod = cajas.find(c => c.id === u.cajaAsignadaId);
                      if (!mod) return <span className="text-slate-500 italic">Sin estación fija</span>;
                      return (
                        <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-flex items-center gap-1.5 ${
                          mod.tipo === 'TRIADA'
                            ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800'
                            : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                        }`}>
                          {mod.tipo === 'TRIADA' ? <Camera className="w-3 h-3 text-indigo-400" /> : <Monitor className="w-3 h-3 text-blue-400" />}
                          <span>{mod.tipo === 'TRIADA' ? `Triada ${mod.numero}` : `Caja ${mod.numero}`}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => abrirUbicarModal(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-blue-950/80 hover:bg-blue-900 border border-blue-800 text-blue-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 font-semibold text-[11px]"
                        title="Ubicar funcionario en Caja o Triada"
                      >
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        <span>Ubicar</span>
                      </button>

                      <button
                        onClick={() => abrirEditarUsuario(u)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Editar datos de usuario"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                      </button>

                      {u.rol !== 'SUPER_ADMIN' && u.usuario?.toLowerCase() !== 'oavega' && u.usuario !== 'superadmin' && u.usuario !== 'admin' && (
                        <button
                          onClick={() => eliminarUsuario(u.id, u.nombre)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}
</div>
)}

  {/* Modal para Crear Funcionario */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-1">Registrar Nuevo Usuario / Funcionario</h3>
            <p className="text-xs text-slate-400 mb-5">
              Crea las credenciales de usuario y contraseña con las que se iniciará sesión en las cajas.
            </p>

            <form onSubmit={crearFuncionario} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Méndez"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Usuario (Login)</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: lmendez"
                    value={nuevoUsuario}
                    onChange={(e) => setNuevoUsuario(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contraseña</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: 123456"
                    value={nuevoPassword}
                    onChange={(e) => setNuevoPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rol de Acceso / Permisos</label>
                <select
                  value={nuevoRol}
                  onChange={(e) => {
                    const r = e.target.value as RolUsuario;
                    setNuevoRol(r);
                    setNuevaCajaId(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="FUNCIONARIO_CAJA">Funcionario de Caja (Exclusivo Cajas 0 a 8)</option>
                  <option value="SUPERVISOR_CAJA">Supervisor de Caja (Supervisión Cajas 0 a 8)</option>
                  <option value="FUNCIONARIO_TRIADA">Funcionario de Triada (Exclusivo Triadas 1 a 8)</option>
                  <option value="SUPERVISOR_TRIADA">Supervisor de Triada (Supervisión Triadas 1 a 8)</option>
                  <option value="SUPER_ADMIN">Super Administrador</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Ubicación / Estación Inicial</label>
                <select
                  value={nuevaCajaId ?? ''}
                  onChange={(e) => setNuevaCajaId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sin estación fija (Flotante / Rotativo)</option>
                  {nuevoRol !== 'FUNCIONARIO_TRIADA' && nuevoRol !== 'SUPERVISOR_TRIADA' && (
                    <optgroup label="Ventanillas de Caja (0 a 8)">
                      {cajas.filter(c => c.tipo !== 'TRIADA').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} - {c.nombre.replace(/^Caja \d+\s*-\s*/i, '')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {nuevoRol !== 'FUNCIONARIO_CAJA' && nuevoRol !== 'SUPERVISOR_CAJA' && (
                    <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                      {cajas.filter(c => c.tipo === 'TRIADA').map(c => (
                        <option key={c.id} value={c.id}>
                          Triada {c.numero} - {c.nombre.replace(/^Triada \d+\s*-\s*/i, '')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer"
                >
                  Guardar Funcionario y Credenciales
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para UBICAR Funcionario en Caja o Triada */}
      {showUbicarModal && usuarioAUbicar && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-950 text-blue-300 border border-blue-800 mb-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-400" />
                  Asignación de Estación de Trabajo
                </span>
                <h3 className="text-xl font-bold text-white">
                  Ubicar a {usuarioAUbicar.nombre}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Seleccione si este funcionario atenderá en una <strong>Ventanilla de Caja (0 a 8)</strong> o en un <strong>Módulo de Triada / Fotografía (1 a 8)</strong>.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowUbicarModal(false);
                  setUsuarioAUbicar(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Pestañas para elegir tipo de estación */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
              {usuarioAUbicar?.rol !== 'FUNCIONARIO_TRIADA' && usuarioAUbicar?.rol !== 'SUPERVISOR_TRIADA' && (
                <button
                  type="button"
                  onClick={() => setTabTipoUbicar('CAJA')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    tabTipoUbicar === 'CAJA'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Ventanillas de Caja (0 a 8)</span>
                </button>
              )}

              {usuarioAUbicar?.rol !== 'FUNCIONARIO_CAJA' && usuarioAUbicar?.rol !== 'SUPERVISOR_CAJA' && (
                <button
                  type="button"
                  onClick={() => setTabTipoUbicar('TRIADA')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    tabTipoUbicar === 'TRIADA'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>Módulos Triada / Fotografía (1 a 8)</span>
                </button>
              )}
            </div>

            {/* Cuadrícula interactiva de selección de estación */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Seleccione el cubículo:</span>
                <button
                  type="button"
                  onClick={() => setEstacionSeleccionadaModal(null)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                    estacionSeleccionadaModal === null
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  ✕ Sin estación fija (Flotante)
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[260px] overflow-y-auto pr-1">
                {cajas
                  .filter(c => tabTipoUbicar === 'TRIADA' ? c.tipo === 'TRIADA' : c.tipo !== 'TRIADA')
                  .map(c => {
                    const isSelected = estacionSeleccionadaModal === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setEstacionSeleccionadaModal(c.id)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? tabTipoUbicar === 'TRIADA'
                              ? 'bg-indigo-950/80 border-indigo-500 shadow-md shadow-indigo-600/20'
                              : 'bg-blue-950/80 border-blue-500 shadow-md shadow-blue-600/20'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-black ${
                            isSelected ? 'text-white' : 'text-slate-300'
                          }`}>
                            {c.tipo === 'TRIADA' ? `Triada ${c.numero}` : c.numero === 0 ? 'Caja 0' : `Caja ${c.numero}`}
                          </span>
                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-[10px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {c.nombre.replace(/^(Caja|Triada) \d+\s*-\s*/i, '')}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500 font-mono">
                          {c.usuarioNombre ? `Ocupado por ${c.usuarioNombre}` : 'Libre'}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Resumen de selección y botones de acción */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Estación elegida:</span>
              <span className="font-bold text-white">
                {estacionSeleccionadaModal === null ? (
                  <span className="text-amber-400">Sin estación fija (Flotante)</span>
                ) : (() => {
                  const target = cajas.find(c => c.id === estacionSeleccionadaModal);
                  return target ? `${target.tipo === 'TRIADA' ? 'Triada ' : 'Caja '}${target.numero} - ${target.nombre}` : 'Estación elegida';
                })()}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowUbicarModal(false);
                  setUsuarioAUbicar(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarUbicacion}
                disabled={guardandoUbicacion}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{guardandoUbicacion ? 'Guardando...' : 'Confirmar Ubicación'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para EDITAR Usuario */}
      {showEditUserModal && usuarioAEditar && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-amber-400" />
              <span>Editar Usuario y Credenciales</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Actualice los datos de acceso, rol y estación asignada.
            </p>

            <form onSubmit={guardarEdicionUsuario} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  required
                  value={editUserNombre}
                  onChange={(e) => setEditUserNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Usuario (Login)</label>
                  <input
                    type="text"
                    required
                    value={editUserUsuario}
                    onChange={(e) => setEditUserUsuario(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Contraseña</label>
                  <input
                    type="text"
                    required
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Rol / Permisos</label>
                <select
                  value={editUserRol}
                  onChange={(e) => {
                    const r = e.target.value as RolUsuario;
                    setEditUserRol(r);
                    setEditUserCajaId(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="FUNCIONARIO_CAJA">Funcionario de Caja (Exclusivo Cajas 0 a 8)</option>
                  <option value="SUPERVISOR_CAJA">Supervisor de Caja (Supervisión Cajas 0 a 8)</option>
                  <option value="FUNCIONARIO_TRIADA">Funcionario de Triada (Exclusivo Triadas 1 a 8)</option>
                  <option value="SUPERVISOR_TRIADA">Supervisor de Triada (Supervisión Triadas 1 a 8)</option>
                  <option value="SUPER_ADMIN">Super Administrador</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Estación de Trabajo</label>
                <select
                  value={editUserCajaId ?? ''}
                  onChange={(e) => setEditUserCajaId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sin estación fija (Flotante)</option>
                  {editUserRol !== 'FUNCIONARIO_TRIADA' && editUserRol !== 'SUPERVISOR_TRIADA' && (
                    <optgroup label="Ventanillas de Caja (0 a 8)">
                      {cajas.filter(c => c.tipo !== 'TRIADA').map(c => (
                        <option key={c.id} value={c.id}>
                          {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} - {c.nombre.replace(/^Caja \d+\s*-\s*/i, '')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {editUserRol !== 'FUNCIONARIO_CAJA' && editUserRol !== 'SUPERVISOR_CAJA' && (
                    <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                      {cajas.filter(c => c.tipo === 'TRIADA').map(c => (
                        <option key={c.id} value={c.id}>
                          Triada {c.numero} - {c.nombre.replace(/^Triada \d+\s*-\s*/i, '')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditUserModal(false);
                    setUsuarioAEditar(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Editar Cubículo / Caja */}
      {showEditCajaModal && cajaAEditar && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <span>Editar Cubículo / Módulo</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Configure el número y nombre identificativo del cubículo de atención.
            </p>

            <form onSubmit={guardarEdicionCaja} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Número de Módulo</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editNumero}
                  onChange={(e) => setEditNumero(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Nombre / Trámite Asociado</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Caja 1 - Cedulación"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Tipo de Etapa</label>
                <select
                  value={editTipo}
                  onChange={(e) => setEditTipo(e.target.value as 'CAJA' | 'TRIADA')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="CAJA">CAJA (Atención Regular)</option>
                  <option value="TRIADA">TRIADA (Fotografía)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditCajaModal(false);
                    setCajaAEditar(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
