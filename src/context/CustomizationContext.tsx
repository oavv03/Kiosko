import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ConfiguracionVisual } from '../types';
import { wsClient } from '../services/websocketClient';

export const DEFAULT_CONFIGURACION_VISUAL: ConfiguracionVisual = {
  nombreSistema: 'Sistema de Gestión de Turnos',
  nombreInstitucion: 'Tribunal Electoral',
  nombreCorto: 'TE',
  tituloNavegador: 'Sistema de Gestión de Turnos | Tribunal Electoral',
  textoBienvenida: 'Bienvenido, tome su turno',
  pieDePagina: '© 2026 Tribunal Electoral • Sistema Oficial de Atención y Asignación de Turnos',
  version: '1.0.0',
  nombreApp: 'Turnos Realtime',

  logoPrincipalUrl: '',
  logoMovilUrl: '',
  faviconUrl: '',

  primaryColor: '#1D4ED8',
  secondaryColor: '#2563EB',
  backgroundColor: '#F8FAFC',
  surfaceColor: '#FFFFFF',
  textColor: '#0F172A',
  mutedTextColor: '#64748B',
  buttonColor: '#1D4ED8',
  buttonHoverColor: '#1E40AF',
  headerColor: '#0F172A',
  borderColor: '#E2E8F0',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  errorColor: '#EF4444',

  fontFamily: 'Plus Jakarta Sans',
  interfaceSize: 'normal',
  borderRadius: 'medium',
  themeMode: 'light',

  pantallaFondoTipo: 'color',
  pantallaFondoValor: '#0B1329'
};

interface CustomizationContextType {
  configuracion: ConfiguracionVisual;
  previewConfig: ConfiguracionVisual;
  isDirty: boolean;
  loading: boolean;
  saving: boolean;
  updatePreview: (patch: Partial<ConfiguracionVisual>) => void;
  saveConfiguration: () => Promise<boolean>;
  cancelPreview: () => void;
  resetToDefaults: () => Promise<boolean>;
}

const CustomizationContext = createContext<CustomizationContextType | null>(null);

function mapRadiusValue(r: ConfiguracionVisual['borderRadius']): string {
  switch (r) {
    case 'none': return '0px';
    case 'small': return '6px';
    case 'medium': return '12px';
    case 'large': return '20px';
    case 'full': return '9999px';
    default: return '12px';
  }
}

function mapScaleValue(s: ConfiguracionVisual['interfaceSize']): string {
  switch (s) {
    case 'compact': return '0.94';
    case 'normal': return '1';
    case 'large': return '1.06';
    default: return '1';
  }
}

function applyDomStyling(cfg: ConfiguracionVisual) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty('--color-primary', cfg.primaryColor);
  root.style.setProperty('--color-secondary', cfg.secondaryColor);
  root.style.setProperty('--color-bg', cfg.backgroundColor);
  root.style.setProperty('--color-surface', cfg.surfaceColor);
  root.style.setProperty('--color-text', cfg.textColor);
  root.style.setProperty('--color-text-muted', cfg.mutedTextColor);
  root.style.setProperty('--color-button', cfg.buttonColor);
  root.style.setProperty('--color-button-hover', cfg.buttonHoverColor);
  root.style.setProperty('--color-header', cfg.headerColor);
  root.style.setProperty('--color-border', cfg.borderColor);
  root.style.setProperty('--color-success', cfg.successColor);
  root.style.setProperty('--color-warning', cfg.warningColor);
  root.style.setProperty('--color-error', cfg.errorColor);

  const fontString = `'${cfg.fontFamily}', system-ui, -apple-system, sans-serif`;
  root.style.setProperty('--app-font-family', fontString);
  root.style.setProperty('--app-radius', mapRadiusValue(cfg.borderRadius));
  root.style.setProperty('--app-scale', mapScaleValue(cfg.interfaceSize));

  // Título de la pestaña
  if (cfg.tituloNavegador) {
    document.title = cfg.tituloNavegador;
  } else if (cfg.nombreSistema) {
    document.title = `${cfg.nombreSistema} | ${cfg.nombreInstitucion}`;
  }

  // Favicon dinámico
  if (cfg.faviconUrl) {
    let faviconEl = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
    if (!faviconEl) {
      faviconEl = document.createElement('link');
      faviconEl.id = 'dynamic-favicon';
      faviconEl.rel = 'icon';
      document.head.appendChild(faviconEl);
    }
    faviconEl.href = cfg.faviconUrl;
  }
}

export const CustomizationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [configuracion, setConfiguracion] = useState<ConfiguracionVisual>(DEFAULT_CONFIGURACION_VISUAL);
  const [previewConfig, setPreviewConfig] = useState<ConfiguracionVisual>(DEFAULT_CONFIGURACION_VISUAL);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Cargar configuración inicial desde el servidor
  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/configuracion');
      if (res.ok) {
        const data: ConfiguracionVisual = await res.json();
        const merged = { ...DEFAULT_CONFIGURACION_VISUAL, ...data };
        setConfiguracion(merged);
        setPreviewConfig(merged);
        setIsDirty(false);
        applyDomStyling(merged);
      }
    } catch (err) {
      console.error('Error cargando configuración visual:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  // Escuchar actualizaciones en tiempo real via WebSocket
  useEffect(() => {
    const unsubscribe = wsClient.subscribe((evento) => {
      if (evento.type === 'CONFIGURACION_ACTUALIZADA' && evento.payload) {
        const nuevaConfig = { ...DEFAULT_CONFIGURACION_VISUAL, ...evento.payload };
        setConfiguracion(nuevaConfig);
        // Si no se está editando activamente, sincronizar la vista previa
        if (!isDirty) {
          setPreviewConfig(nuevaConfig);
          applyDomStyling(nuevaConfig);
        }
      }
    });

    return () => unsubscribe();
  }, [isDirty]);

  // Actualizar vista previa local
  const updatePreview = useCallback((patch: Partial<ConfiguracionVisual>) => {
    setPreviewConfig((prev) => {
      const next = { ...prev, ...patch };
      setIsDirty(true);
      applyDomStyling(next);
      return next;
    });
  }, []);

  // Guardar configuración en la base de datos
  const saveConfiguration = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(previewConfig)
      });
      if (res.ok) {
        const saved: ConfiguracionVisual = await res.json();
        const merged = { ...DEFAULT_CONFIGURACION_VISUAL, ...saved };
        setConfiguracion(merged);
        setPreviewConfig(merged);
        setIsDirty(false);
        applyDomStyling(merged);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error guardando configuración visual:', err);
      return false;
    } finally {
      setSaving(false);
    }
  }, [previewConfig]);

  // Cancelar cambios no guardados
  const cancelPreview = useCallback(() => {
    setPreviewConfig(configuracion);
    setIsDirty(false);
    applyDomStyling(configuracion);
  }, [configuracion]);

  // Restaurar a valores predeterminados
  const resetToDefaults = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion/reset', { method: 'POST' });
      if (res.ok) {
        const def: ConfiguracionVisual = await res.json();
        const merged = { ...DEFAULT_CONFIGURACION_VISUAL, ...def };
        setConfiguracion(merged);
        setPreviewConfig(merged);
        setIsDirty(false);
        applyDomStyling(merged);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error restableciendo configuración:', err);
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  return (
    <CustomizationContext.Provider
      value={{
        configuracion,
        previewConfig,
        isDirty,
        loading,
        saving,
        updatePreview,
        saveConfiguration,
        cancelPreview,
        resetToDefaults
      }}
    >
      {children}
    </CustomizationContext.Provider>
  );
};

export const useCustomization = () => {
  const context = useContext(CustomizationContext);
  if (!context) {
    throw new Error('useCustomization debe usarse dentro de un CustomizationProvider');
  }
  return context;
};
