import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Usuario } from '../src/types.js';

// Clave secreta para firma de tokens de sesión (rotada o tomada de env)
const JWT_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'turnos-te-secure-key-2026-v1';

// -------------------------------------------------------------
// 1. Sanitización de Usuarios (Prevención de fuga de contraseñas)
// -------------------------------------------------------------
export type SafeUsuario = Omit<Usuario, 'password'>;

export function toSafeUser(user: Usuario | null | undefined): SafeUsuario | null {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

export function toSafeUsers(users: Usuario[]): SafeUsuario[] {
  return users.map(u => {
    const { password, ...safe } = u;
    return safe;
  });
}

// -------------------------------------------------------------
// 2. Tokens Criptográficos de Sesión Administrativa (HMAC-SHA256)
// -------------------------------------------------------------
export function createSessionToken(user: SafeUsuario, expiresInHours = 12): string {
  const payload = {
    sub: user.id,
    rol: user.rol,
    usuario: user.usuario,
    exp: Date.now() + expiresInHours * 60 * 60 * 1000
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token: string): { valid: boolean; payload?: any } {
  if (!token || typeof token !== 'string') return { valid: false };
  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false };

  const [encodedPayload, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(encodedPayload).digest('base64url');

  try {
    const isValidSig = crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
    if (!isValidSig) return { valid: false };

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) {
      return { valid: false }; // Token expirado
    }
    return { valid: true, payload };
  } catch (err) {
    return { valid: false };
  }
}

// -------------------------------------------------------------
// 3. Rate Limiter en Memoria (Prevención de Fuerza Bruta y DoS)
// -------------------------------------------------------------
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const hits = new Map<string, RateLimitRecord>();

  // Limpieza periódica cada 2 minutos
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) {
        hits.delete(key);
      }
    }
  }, 120000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Si estamos corriendo tests automatizados internos con header específico, permitir auditoría
    if (req.headers['x-bypass-rate-limit'] === 'test-internal-audit') {
      return next();
    }

    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown-ip';

    const now = Date.now();
    let record = hits.get(clientIp);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + options.windowMs };
      hits.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, options.maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > options.maxRequests) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: options.message || 'Demasiadas solicitudes. Por favor intente más tarde.',
        retryAfterSeconds: retryAfter
      });
    }

    next();
  };
}

// -------------------------------------------------------------
// 4. Sanitización contra XSS, Inyección y CSV Formula Injection
// -------------------------------------------------------------
export function sanitizeString(val: any, maxLength = 100): string {
  if (val === undefined || val === null) return '';
  let str = String(val).trim();
  // Truncar longitud máxima para prevenir desbordes de memoria
  if (str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  // Eliminar caracteres de control y caracteres nulos
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Escapar corchetes y etiquetas HTML comunes
  str = str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return str;
}

/**
 * Neutraliza vulnerabilidades de CSV Formula Injection (Excel / LibreOffice)
 * Caracteres peligrosos al inicio: =, +, -, @, tab, retorno de carro
 */
export function sanitizeCsvCell(val: any): string {
  if (val === undefined || val === null) return '""';
  let str = String(val).trim();
  
  // Si comienza con =, +, -, @, \t, \r, anteponer una comilla simple para desarmar la fórmula
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  
  // Escapar comillas dobles internas duplicándolas
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Valida URLs de logos y avatares para evitar esquemas javascript: o data: maliciosos
 */
export function validateImageUrl(url: any): boolean {
  if (!url || typeof url !== 'string') return true; // vacío es aceptable
  const clean = url.trim().toLowerCase();
  
  // Rechazar esquemas ejecutables
  if (clean.startsWith('javascript:') || clean.startsWith('vbscript:') || clean.startsWith('data:text/html')) {
    return false;
  }
  
  // Permitir data URLs válidas de imágenes (png, jpeg, webp, svg+xml) de hasta 5MB
  if (clean.startsWith('data:image/')) {
    const isAllowedMime = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(url.trim());
    if (!isAllowedMime) return false;
    // Comprobar tamaño (max 5MB)
    if (url.length > 5 * 1024 * 1024 * 1.37) return false;
    return true;
  }

  // Permitir URLs HTTP y HTTPS bien formadas o rutas relativas seguras
  if (clean.startsWith('https://') || clean.startsWith('http://') || clean.startsWith('/')) {
    return true;
  }

  return false;
}

// -------------------------------------------------------------
// 5. Middleware de Cabeceras HTTP de Seguridad
// -------------------------------------------------------------
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  // Prevenir que el navegador adivine el tipo MIME
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Mitigar Clickjacking mientras se permite el iframe en el mismo origen / AI Studio
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  
  // Filtro XSS en navegadores legados
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Política de referenciador estricta
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Deshabilitar características de hardware no requeridas
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Content-Security-Policy robusto
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: blob: https:; " +
    "connect-src 'self' ws: wss: https: http:; " +
    "frame-src 'self' blob: data:;"
  );

  next();
}
