import React, { useState } from 'react';
import { useCustomization } from '../context/CustomizationContext';
import { ConfiguracionVisual } from '../types';

export interface LogoInstitucionalProps {
  className?: string;
  variant?: 'navbar' | 'kiosk' | 'tv' | 'login' | 'preview' | 'small' | 'portal-hero';
  overrideConfig?: ConfiguracionVisual;
  showText?: boolean;
}

export const LogoInstitucional: React.FC<LogoInstitucionalProps> = ({
  className = '',
  variant = 'navbar',
  overrideConfig,
  showText = true
}) => {
  const { configuracion: contextConfig } = useCustomization();
  const config = overrideConfig || contextConfig;
  const [imageError, setImageError] = useState(false);

  const logoSrc = (variant === 'small' && config.logoMovilUrl) 
    ? config.logoMovilUrl 
    : (config.logoPrincipalUrl || config.logoMovilUrl);

  const isHero = variant === 'portal-hero';
  const shouldShowText = showText && !isHero;

  // Renderizado del ícono/escudo predeterminado cuando no hay imagen cargada o si falla la carga
  const renderFallbackEmblem = () => {
    const letraInicial = config.nombreCorto ? config.nombreCorto.slice(0, 2) : (config.nombreInstitucion ? config.nombreInstitucion.charAt(0) : 'Q');

    const sizeClasses = 
      variant === 'portal-hero' ? 'w-20 h-20 sm:w-24 sm:h-24 text-3xl sm:text-4xl' :
      variant === 'kiosk' ? 'w-16 h-16 sm:w-20 sm:h-20 text-2xl sm:text-3xl' :
      variant === 'tv' ? 'w-12 h-12 text-xl' :
      variant === 'login' ? 'w-16 h-16 text-3xl' :
      variant === 'small' ? 'w-7 h-7 text-xs' :
      'w-8 h-8 text-sm';

    const radiusClasses =
      variant === 'portal-hero' ? 'rounded-3xl' :
      variant === 'kiosk' ? 'rounded-2xl' :
      'rounded-xl';

    return (
      <div 
        className={`${sizeClasses} ${radiusClasses} font-black flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105 shrink-0`}
        style={{
          backgroundColor: config.primaryColor || '#1D4ED8',
          boxShadow: `0 8px 24px -4px ${config.primaryColor || '#1D4ED8'}55`
        }}
      >
        <span className="tracking-tight">{letraInicial}</span>
      </div>
    );
  };

  return (
    <div className={`flex items-center gap-2.5 ${isHero ? 'flex-col justify-center text-center' : ''} ${className}`}>
      {logoSrc && !imageError ? (
        <img
          src={logoSrc}
          alt={`Logo de ${config.nombreInstitucion || 'la institución'}`}
          onError={() => setImageError(true)}
          referrerPolicy="no-referrer"
          className={`object-contain shrink-0 transition-transform ${
            variant === 'portal-hero' ? 'max-h-20 sm:max-h-24 max-w-[240px] sm:max-w-[280px] drop-shadow-sm hover:scale-105' :
            variant === 'kiosk' ? 'max-h-16 max-w-[180px]' :
            variant === 'tv' ? 'max-h-14 max-w-[160px]' :
            variant === 'login' ? 'max-h-16 max-w-[200px]' :
            variant === 'small' ? 'max-h-7 max-w-[80px]' :
            'max-h-8 max-w-[110px]'
          }`}
        />
      ) : (
        renderFallbackEmblem()
      )}

      {shouldShowText && (
        <div className="flex flex-col justify-center text-left leading-tight truncate">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span 
              className={`font-black tracking-tight truncate ${
                variant === 'kiosk' ? 'text-lg sm:text-xl' :
                variant === 'tv' ? 'text-base sm:text-lg' :
                variant === 'login' ? 'text-lg' :
                'text-sm'
              }`}
              style={{ color: config.headerColor || config.textColor || '#0F172A' }}
            >
              {config.nombreSistema || 'Sistema de Turnos'}
            </span>
            {config.nombreCorto && (
              <span 
                className="text-[10px] font-extrabold px-1.5 py-0.2 rounded uppercase border shrink-0"
                style={{
                  backgroundColor: `${config.primaryColor}20`,
                  color: config.primaryColor,
                  borderColor: `${config.primaryColor}40`
                }}
              >
                {config.nombreCorto}
              </span>
            )}
          </div>
          <span 
            className={`truncate ${
              variant === 'kiosk' ? 'text-xs' : 'text-[11px]'
            }`}
            style={{ color: config.mutedTextColor || '#64748B' }}
          >
            {config.nombreInstitucion || 'Atención al Público'}
          </span>
        </div>
      )}
    </div>
  );
};
