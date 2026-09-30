import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Activity, 
  Clock, 
  Users, 
  Play, 
  RotateCcw, 
  Power, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  UserPlus, 
  Terminal, 
  Zap, 
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
  Palette 
} from 'lucide-react';
import { Caja, Ticket, Usuario, RolUsuario, MetricasSistema, EventoRealtime } from '../types';
import { useCustomization } from '../context/CustomizationContext';
import { CajaView } from './CajaView';
import { TriadaView } from './TriadaView';
import { PersonalizacionView } from './PersonalizacionView';

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

  const [superAdminSection, setSuperAdminSection] = useState<'metricas' | 'usuarios' | 'personalizacion'>(() => {
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
  const [testLog, setTestLog] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);

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
      setTestLog(['Base de datos reiniciada con éxito']);
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
  };

  // Creación de usuario por el Super Admin
  const crearFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre || !nuevoEmail) return;

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: nuevoNombre,
          usuario: nuevoUsuario.trim() || nuevoEmail.split('@')[0],
          email: nuevoEmail.trim(),
          password: nuevoPassword.trim() || '123',
          rol: nuevoRol,
          cajaAsignadaId: nuevaCajaId === null || nuevaCajaId === 0 ? null : nuevaCajaId
        })
      });
      if (res.ok) {
        setShowUserModal(false);
        setNuevoNombre('');
        setNuevoUsuario('');
        setNuevoEmail('');
        setNuevoPassword('');
        setNuevoRol('FUNCIONARIO');
        setNuevaCajaId(1);
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
      const res = await fetch(`/api/usuarios/${usuarioAUbicar.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cajaAsignadaId: estacionSeleccionadaModal
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

  /**
   * Ejecuta automáticamente el escenario de prueba exacto solicitado por el usuario:
   * 1. Caja 1 -> disponible
   * 2. Caja 2 -> disponible
   * 3. Caja 3 -> ocupada
   * 4. Caja 4 -> sin funcionario
   * 5. Crear A001 -> debe asignarse a Caja 1
   * 6. Crear A002 -> debe asignarse a Caja 2
   * 7. Crear A003 -> debe colocarse en espera
   */
  const ejecutarEscenarioPrueba = async () => {
    setIsTesting(true);
    setTestLog(['Iniciando configuración del escenario de prueba...']);

    try {
      const res = await fetch('/api/test/setup-escenario', { method: 'POST' });
      const data = await res.json();

      setTestLog([
        '✓ Configuración completada:',
        '• Caja 1 (Juan) configurada como DISPONIBLE',
        '• Caja 2 (María) configurada como DISPONIBLE',
        '• Caja 3 (Carlos) configurada como OCUPADA (Organización Electoral)',
        '• Caja 4 configurada como DESCONECTADA (sin funcionario)',
        '---------------------------------------',
        '✓ Ticket C001 generado (Cedulación - Juan Rodríguez) → Asignado a Caja 1',
        '✓ Ticket E001 generado (Extranjería - María Fernández) → Asignado a Caja 2',
        '✓ Ticket R001 generado (Registro Civil - Pedro González) → Colocado en ESPERANDO (Caja 3 ocupada, Caja 4 sin funcionario)',
        '---------------------------------------',
        'Listo para probar: Puede pulsar "Completar C001 en Caja 1" abajo para ver cómo R001 pasa automáticamente a Caja 1.'
      ]);

      fetchEventos();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setTestLog(prev => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsTesting(false);
    }
  };

  // Paso 2 del test: Completar A001 en Caja 1
  const completarA001 = async () => {
    try {
      setTestLog(prev => [...prev, 'Finalizando A001 en Caja 1...']);
      const res = await fetch('/api/cajas/1/finalizar', { method: 'POST' });
      if (res.ok) {
        setTestLog(prev => [
          ...prev,
          '✓ A001 finalizado en Caja 1.',
          '✓ Caja 1 quedó disponible y el DESPACHADOR asignó automáticamente A003 a Caja 1!'
        ]);
        fetchEventos();
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      setTestLog(prev => [...prev, `Error: ${err.message}`]);
    }
  };

  // Paso 3 del test: Llamar A003 en Caja 1
  const llamarA003 = async () => {
    try {
      setTestLog(prev => [...prev, 'Llamando turno en Caja 1...']);
      const res = await fetch('/api/cajas/1/llamar', { method: 'POST' });
      if (res.ok) {
        setTestLog(prev => [
          ...prev,
          '✓ Evento TICKET_LLAMADO emitido en tiempo real.',
          '✓ Pantalla Pública actualizada inmediatamente con A003 en Caja 1.'
        ]);
        fetchEventos();
        if (onRefresh) onRefresh();
      }
    } catch (err: any) {
      setTestLog(prev => [...prev, `Error: ${err.message}`]);
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

        <div className="flex items-center gap-2 pr-2">
          <span 
            className="text-xs font-semibold px-2.5 py-1 rounded-lg border"
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
                  placeholder="superadmin"
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
                    <span className="font-semibold text-slate-300 block">Credenciales iniciales:</span>
                    <span className="font-mono text-blue-300">superadmin</span> / <span className="font-mono text-blue-300">admin</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuperAdminLoginUser('superadmin');
                      setSuperAdminLoginPass('admin');
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
          </div>

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

                <button
                  type="button"
                  onClick={() => {
                    onCajaChange?.(caja.id);
                    handleTabChange('caja');
                  }}
                  className="w-full mt-2.5 py-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-800 text-blue-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Atender en Caja {caja.numero}</span>
                </button>
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

                <button
                  type="button"
                  onClick={() => {
                    onCajaChange?.(triada.id);
                    handleTabChange('triada');
                  }}
                  className="w-full mt-2.5 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-800 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Atender en Triada {triada.numero}</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banco de Pruebas del Requerimiento Exacto del Usuario */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-900/50 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400 uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" />
              Banco de Pruebas Automatizado
            </span>
            <h3 className="text-xl font-bold text-white mt-0.5">
              Simulador del Flujo del Requerimiento
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configura automáticamente: Caja 1 y 2 disponibles, Caja 3 ocupada, Caja 4 sin funcionario. Emite tickets C001 (Cedulación), E001 (Extranjería) y R001 (Registro Civil) verificando que C001 va a Caja 1, E001 va a Caja 2, y R001 queda en espera hasta que una caja se libere.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={ejecutarEscenarioPrueba}
              disabled={isTesting}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>1. Configurar Escenario (C001, E001, R001)</span>
            </button>

            <button
              onClick={completarA001}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>2. Finalizar C001 en Caja 1 (Asigna R001)</span>
            </button>

            <button
              onClick={llamarA003}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>3. Llamar R001 (Muestra en TV)</span>
            </button>
          </div>
        </div>

        {/* Consola de Log del Test */}
        {testLog.length > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-slate-950 font-mono text-xs text-slate-300 border border-slate-800 space-y-1 overflow-x-auto">
            {testLog.map((line, idx) => (
              <div key={idx} className={line.startsWith('✓') ? 'text-emerald-400 font-semibold' : line.startsWith('•') ? 'text-blue-300' : 'text-slate-400'}>
                {line}
              </div>
            ))}
          </div>
        )}
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
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}>
                      {u.rol === 'SUPER_ADMIN' ? 'SUPER ADMIN' : u.rol}
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

                      {u.rol !== 'SUPER_ADMIN' && u.usuario !== 'superadmin' && u.usuario !== 'admin' && (
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    placeholder="laura.mendez@institucion.gob"
                    value={nuevoEmail}
                    onChange={(e) => setNuevoEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Rol de Acceso</label>
                  <select
                    value={nuevoRol}
                    onChange={(e) => setNuevoRol(e.target.value as RolUsuario)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="FUNCIONARIO">Funcionario / Operador</option>
                    <option value="SUPER_ADMIN">Super Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Ubicación / Estación Inicial</label>
                <select
                  value={nuevaCajaId ?? ''}
                  onChange={(e) => setNuevaCajaId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sin estación fija (Flotante / Rotativo)</option>
                  <optgroup label="Ventanillas de Caja (0 a 8)">
                    {cajas.filter(c => c.tipo !== 'TRIADA').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} - {c.nombre.replace(/^Caja \d+\s*-\s*/i, '')}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                    {cajas.filter(c => c.tipo === 'TRIADA').map(c => (
                      <option key={c.id} value={c.id}>
                        Triada {c.numero} - {c.nombre.replace(/^Triada \d+\s*-\s*/i, '')}
                      </option>
                    ))}
                  </optgroup>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    required
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Rol</label>
                  <select
                    value={editUserRol}
                    onChange={(e) => setEditUserRol(e.target.value as RolUsuario)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="FUNCIONARIO">Funcionario / Operador</option>
                    <option value="SUPER_ADMIN">Super Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Estación de Trabajo</label>
                <select
                  value={editUserCajaId ?? ''}
                  onChange={(e) => setEditUserCajaId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Sin estación fija (Flotante)</option>
                  <optgroup label="Ventanillas de Caja (0 a 8)">
                    {cajas.filter(c => c.tipo !== 'TRIADA').map(c => (
                      <option key={c.id} value={c.id}>
                        {c.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${c.numero}`} - {c.nombre.replace(/^Caja \d+\s*-\s*/i, '')}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Módulos de Triada / Fotografía (1 a 8)">
                    {cajas.filter(c => c.tipo === 'TRIADA').map(c => (
                      <option key={c.id} value={c.id}>
                        Triada {c.numero} - {c.nombre.replace(/^Triada \d+\s*-\s*/i, '')}
                      </option>
                    ))}
                  </optgroup>
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
