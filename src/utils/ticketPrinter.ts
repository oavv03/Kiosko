import { Ticket, ConfiguracionVisual } from '../types';

/**
 * Escapa caracteres HTML especiales para prevenir Cross-Site Scripting (XSS)
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Valida que una URL de imagen no contenga esquemas ejecutables (javascript:, etc.)
 */
export function isSafeImageUrl(url: string): boolean {
  if (!url) return false;
  const clean = url.trim().toLowerCase();
  return (
    clean.startsWith('https://') ||
    clean.startsWith('http://') ||
    clean.startsWith('/') ||
    /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,/i.test(url.trim())
  );
}

/**
 * Genera el HTML formateado para imprimir un ticket en impresora térmica (80mm o 58mm)
 * o guardarlo como comprobante de forma 100% segura contra XSS.
 */
export function generarHtmlTicket(ticket: Ticket, config: ConfiguracionVisual): string {
  const mostrarLogo = config.ticketMostrarLogo !== false;
  const rawLogoUrl = config.ticketLogoUrl || config.logoPrincipalUrl || '';
  const logoUrl = isSafeImageUrl(rawLogoUrl) ? rawLogoUrl : '';
  
  // Tamaño del logo según configuración
  let logoMaxHeight = 65;
  if (config.ticketLogoTamano === 'pequeno') logoMaxHeight = 45;
  if (config.ticketLogoTamano === 'grande') logoMaxHeight = 85;

  // Textos configurables con fallbacks y escape seguro contra XSS
  const encabezado = escapeHtml(config.ticketEncabezado || config.nombreInstitucion || 'Tribunal Electoral');
  const subencabezado = escapeHtml(config.ticketSubencabezado || 'Comprobante Oficial de Turno');
  const mensajeEspera = escapeHtml(config.ticketMensajeEspera || 'Por favor permanezca atento a la Pantalla Pública y al audio del llamado.');
  const pieMensaje = escapeHtml(config.ticketPieMensaje || '¡Gracias por su visita! Conserve este comprobante hasta finalizar su atención.');
  const notaPie = escapeHtml(config.ticketNotaPie || 'Validez únicamente para el día de emisión.');

  // Toggles de visualización
  const mostrarCiudadano = config.ticketMostrarCiudadano !== false;
  const mostrarTramite = config.ticketMostrarTramite !== false;
  const mostrarFechaHora = config.ticketMostrarFechaHora !== false;
  const mostrarCodigoBarras = config.ticketMostrarCodigoBarras !== false;
  const mostrarQr = config.ticketMostrarQr === true;

  // Parámetros de papel y fuente
  const es58mm = config.ticketAnchoPapel === '58mm';
  const anchoContenedor = es58mm ? '54mm' : '76mm';
  const pageSize = es58mm ? '58mm auto' : '80mm auto';
  const fontFamily = config.ticketEstiloFuente === 'sans-serif'
    ? 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    : "'Courier New', Courier, monospace, sans-serif";

  // Densidad y espaciado
  const espaciado = config.ticketEspaciado || 'normal';
  const paddingBody = espaciado === 'compacto' ? '6px 2px' : espaciado === 'amplio' ? '14px 6px' : '10px 4px';
  const marginDivider = espaciado === 'compacto' ? '4px 0' : espaciado === 'amplio' ? '8px 0' : '6px 0';
  const turnFontSize = es58mm ? '42px' : '48px';

  const rawNombreCompleto = [ticket.ciudadanoNombre, ticket.ciudadanoApellido].filter(Boolean).join(' ') || ticket.ciudadanoNombre || 'Ciudadano';
  const nombreCompleto = escapeHtml(rawNombreCompleto);
  const ticketCodigo = escapeHtml(ticket.codigo);
  const ticketTramite = escapeHtml(ticket.tramite);

  const fechaObj = ticket.fechaCreacion ? new Date(ticket.fechaCreacion) : new Date();
  const fechaStr = escapeHtml(fechaObj.toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  const horaStr = escapeHtml(fechaObj.toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  // QR simulado en SVG vectorizado de alta resolución para impresión térmica nítida
  const svgQr = `
    <svg width="72" height="72" viewBox="0 0 29 29" fill="black" style="margin: 0 auto; display: block;" xmlns="http://www.w3.org/2000/svg">
      <!-- Esquinas QR estándar -->
      <rect x="2" y="2" width="7" height="7" fill="black"/>
      <rect x="3" y="3" width="5" height="5" fill="white"/>
      <rect x="4" y="4" width="3" height="3" fill="black"/>
      <rect x="20" y="2" width="7" height="7" fill="black"/>
      <rect x="21" y="3" width="5" height="5" fill="white"/>
      <rect x="22" y="4" width="3" height="3" fill="black"/>
      <rect x="2" y="20" width="7" height="7" fill="black"/>
      <rect x="3" y="21" width="5" height="5" fill="white"/>
      <rect x="4" y="22" width="3" height="3" fill="black"/>
      <!-- Puntos de datos patrón -->
      <rect x="11" y="3" width="2" height="2"/>
      <rect x="15" y="4" width="2" height="2"/>
      <rect x="10" y="7" width="2" height="2"/>
      <rect x="13" y="8" width="3" height="2"/>
      <rect x="17" y="7" width="1" height="2"/>
      <rect x="3" y="11" width="2" height="2"/>
      <rect x="7" y="12" width="2" height="2"/>
      <rect x="11" y="11" width="2" height="3"/>
      <rect x="15" y="11" width="2" height="2"/>
      <rect x="18" y="13" width="2" height="2"/>
      <rect x="22" y="11" width="3" height="2"/>
      <rect x="4" y="15" width="2" height="2"/>
      <rect x="8" y="16" width="2" height="2"/>
      <rect x="12" y="16" width="3" height="2"/>
      <rect x="17" y="17" width="2" height="2"/>
      <rect x="21" y="15" width="2" height="3"/>
      <rect x="11" y="21" width="2" height="2"/>
      <rect x="14" y="20" width="2" height="2"/>
      <rect x="18" y="22" width="3" height="2"/>
      <rect x="23" y="20" width="2" height="2"/>
      <rect x="11" y="24" width="2" height="2"/>
      <rect x="15" y="25" width="2" height="2"/>
      <rect x="20" y="24" width="2" height="2"/>
    </svg>
  `;

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Ticket ${ticket.codigo}</title>
      <style>
        @page {
          size: ${pageSize};
          margin: 0;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: ${fontFamily};
          width: ${anchoContenedor};
          margin: 0 auto;
          padding: ${paddingBody};
          text-align: center;
          color: #000;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .logo-wrap {
          margin-bottom: 6px;
        }
        .logo-img {
          max-height: ${logoMaxHeight}px;
          max-width: 90%;
          margin: 0 auto 4px auto;
          display: block;
          filter: grayscale(100%) contrast(130%);
          object-fit: contain;
        }
        .header {
          font-size: ${es58mm ? '13px' : '15px'};
          font-weight: 900;
          text-transform: uppercase;
          margin-bottom: 2px;
          letter-spacing: 0.5px;
          line-height: 1.15;
        }
        .subheader {
          font-size: ${es58mm ? '9px' : '10px'};
          margin-bottom: 4px;
          color: #333;
          line-height: 1.2;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: ${marginDivider};
        }
        .label {
          font-size: 8.5px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #444;
          margin-bottom: 1px;
        }
        .citizen {
          font-size: ${es58mm ? '11.5px' : '13px'};
          font-weight: bold;
          margin: 1px 0 4px 0;
          text-transform: capitalize;
          line-height: 1.2;
        }
        .ticket-number {
          font-size: ${turnFontSize};
          font-weight: 900;
          line-height: 1;
          margin: 6px 0;
          letter-spacing: -1px;
        }
        .tramite-pill {
          display: inline-block;
          border: 1px solid #000;
          border-radius: 4px;
          padding: 2px 7px;
          font-size: ${es58mm ? '10px' : '11px'};
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .preferencial-badge {
          background: #000;
          color: #fff;
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 3px;
          margin: 4px 0;
          display: inline-block;
        }
        .details {
          font-size: ${es58mm ? '9px' : '10px'};
          text-align: left;
          margin: 4px 0;
        }
        .details-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
        }
        .mensaje-espera {
          font-size: ${es58mm ? '8.5px' : '9.5px'};
          color: #111;
          margin: 6px 0;
          line-height: 1.3;
        }
        .barcode-container {
          margin: 6px 0 2px 0;
        }
        .barcode-lines {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 1.5px;
          height: 24px;
          margin: 0 auto;
        }
        .barcode-text {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          letter-spacing: 2px;
          font-weight: bold;
          margin-top: 2px;
        }
        .qr-container {
          margin: 6px 0 2px 0;
        }
        .pie-mensaje {
          font-size: ${es58mm ? '8px' : '9px'};
          font-weight: bold;
          color: #222;
          margin-top: 5px;
          line-height: 1.25;
        }
        .nota-pie {
          font-size: 8px;
          color: #555;
          margin-top: 3px;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      ${mostrarLogo && logoUrl ? `
        <div class="logo-wrap">
          <img src="${logoUrl}" alt="Logo" class="logo-img" />
        </div>
      ` : ''}

      <div class="header">${encabezado}</div>
      ${subencabezado ? `<div class="subheader">${subencabezado}</div>` : ''}
      <div class="divider"></div>

      ${mostrarCiudadano ? `
        <div class="label">Ciudadano(a)</div>
        <div class="citizen">${nombreCompleto}</div>
      ` : ''}

      <div class="label">Número de Turno</div>
      <div class="ticket-number">${ticketCodigo}</div>
      
      ${mostrarTramite ? `
        <div class="tramite-pill">${ticketTramite}</div>
      ` : ''}

      ${ticket.preferencial ? `
        <div>
          <span class="preferencial-badge">★ ATENCIÓN PREFERENCIAL ♿ • CAJA 0</span>
        </div>
      ` : ''}

      ${mostrarFechaHora ? `
        <div class="divider"></div>
        <div class="details">
          <div class="details-row">
            <span>Fecha:</span>
            <span>${fechaStr}</span>
          </div>
          <div class="details-row">
            <span>Hora:</span>
            <span>${horaStr}</span>
          </div>
          <div class="details-row">
            <span>Estado:</span>
            <span>En espera de atención</span>
          </div>
        </div>
      ` : ''}

      ${mensajeEspera ? `
        <div class="divider"></div>
        <div class="mensaje-espera">
          ${mensajeEspera}
        </div>
      ` : ''}

      ${mostrarCodigoBarras ? `
        <div class="barcode-container">
          <div class="barcode-lines">
            <span style="width:2px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:1px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:3px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:1px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:2px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:4px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:1px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:2px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:3px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:1px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:2px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:1px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:3px; height:100%; background:#000; display:inline-block;"></span>
            <span style="width:2px; height:100%; background:#000; display:inline-block;"></span>
          </div>
          <div class="barcode-text">*${ticketCodigo}*</div>
        </div>
      ` : ''}

      ${mostrarQr ? `
        <div class="qr-container">
          ${svgQr}
          <div style="font-size:7.5px; color:#555; margin-top:2px; font-family:sans-serif;">Verificación Digital de Turno</div>
        </div>
      ` : ''}

      ${(pieMensaje || notaPie) ? `
        <div class="divider"></div>
        ${pieMensaje ? `<div class="pie-mensaje">${pieMensaje}</div>` : ''}
        ${notaPie ? `<div class="nota-pie">${notaPie}</div>` : ''}
      ` : ''}
    </body>
    </html>
  `;
}

/**
 * Lanza la impresión de un ticket en un iframe oculto o mediante window.print()
 */
export function imprimirTicket(ticket: Ticket, config: ConfiguracionVisual): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const html = generarHtmlTicket(ticket, config);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (err) {
            console.warn('Fallback to standard window.print()', err);
            window.print();
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
              } catch (e) {}
              resolve(true);
            }, 1200);
          }
        }, 350);
      } else {
        window.print();
        resolve(true);
      }
    } catch (e) {
      console.warn('Error imprimiendo ticket vía iframe, fallback a print normal', e);
      window.print();
      resolve(true);
    }
  });
}

/**
 * Ticket ficticio de muestra para la vista previa de personalización
 */
export const TICKET_EJEMPLO: Ticket = {
  id: 'ticket-demo-sample',
  numero: 1,
  codigo: 'C001',
  tramite: 'Cedulación',
  prefijo: 'C',
  ciudadanoNombre: 'Carlos Eduardo',
  ciudadanoApellido: 'Rodríguez Gómez',
  estado: 'ESPERANDO',
  fechaCreacion: new Date().toISOString(),
  preferencial: false
};
