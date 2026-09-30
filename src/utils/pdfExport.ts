import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Ticket, Usuario, Caja } from '../types';

export interface HistorialPdfParams {
  caja: Caja;
  usuario: Usuario | null;
  tickets: any[];
  tipoEstacion?: 'CAJA' | 'TRIADA';
}

export function generarPdfHistorial({
  caja,
  usuario,
  tickets,
  tipoEstacion = 'CAJA'
}: HistorialPdfParams): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const fechaHoy = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const horaEmision = new Date().toLocaleTimeString('es-ES');

  const finalizados = tickets.filter(t => t.estado === 'FINALIZADO');
  const noPresentados = tickets.filter(t => t.estado === 'NO_PRESENTO');
  const totalDuracionSeg = finalizados.reduce((acc, t) => acc + (t.duracionSegundos || t.duracionAtencionSegundos || 0), 0);
  const promedioSegundos = finalizados.length > 0 ? Math.round(totalDuracionSeg / finalizados.length) : 0;
  const promMin = Math.floor(promedioSegundos / 60);
  const promSeg = promedioSegundos % 60;

  const esTriada = tipoEstacion === 'TRIADA' || caja.tipo === 'TRIADA';
  const nombreEstacion = esTriada
    ? `Triada / Fotografía ${caja.numero}`
    : (caja.numero === 0 ? 'Caja 0 (Preferencial)' : `Caja ${caja.numero}`);

  const nombreFuncionario = usuario?.nombre || caja.usuarioNombre || 'Funcionario en Turno';

  // 1. Franja Superior Institucional
  if (esTriada) {
    doc.setFillColor(67, 56, 202); // Indigo 700
  } else {
    doc.setFillColor(30, 58, 138); // Blue 900
  }
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SISTEMA INSTITUCIONAL DE GESTIÓN DE COLAS Y TURNOS', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('REPORTE OFICIAL DE TICKETS ATENDIDOS • JORNADA LABORAL', 14, 18);

  // 2. Título del Reporte y Datos de la Cajera / Estación
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(`Reporte de Atención: ${nombreEstacion}`, 14, 34);

  // Cuadro de Información de la Cajera
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.roundedRect(14, 38, 182, 26, 3, 3, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text('Cajera / Funcionario:', 18, 45);
  doc.text('Estación / Módulo:', 18, 52);
  doc.text('Fecha de la Jornada:', 18, 59);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(`${nombreFuncionario} (${usuario?.usuario || usuario?.email || 'cajera'})`, 60, 45);
  doc.text(`${nombreEstacion} - ${caja.nombre || 'Atención al Ciudadano'}`, 60, 52);
  doc.text(`${fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)} • ${horaEmision}`, 60, 59);

  // 3. Tarjetas Resumen de Métricas (KPIs)
  const cardY = 68;
  const cardWidth = 43;
  const cardHeight = 18;
  const cardGap = 3.3;

  // KPI 1: Total
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL TICKETS', 18, cardY + 6);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${tickets.length}`, 18, cardY + 14);

  // KPI 2: Finalizados
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14 + (cardWidth + cardGap), cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('FINALIZADOS', 14 + (cardWidth + cardGap) + 4, cardY + 6);
  doc.setFontSize(13);
  doc.setTextColor(4, 120, 87);
  doc.text(`${finalizados.length}`, 14 + (cardWidth + cardGap) + 4, cardY + 14);

  // KPI 3: No presentados
  doc.setFillColor(255, 241, 242);
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(14 + (cardWidth + cardGap) * 2, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72);
  doc.text('NO SE PRESENTÓ', 14 + (cardWidth + cardGap) * 2 + 4, cardY + 6);
  doc.setFontSize(13);
  doc.setTextColor(190, 18, 60);
  doc.text(`${noPresentados.length}`, 14 + (cardWidth + cardGap) * 2 + 4, cardY + 14);

  // KPI 4: Tiempo Promedio
  doc.setFillColor(238, 242, 255);
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(14 + (cardWidth + cardGap) * 3, cardY, cardWidth, cardHeight, 2, 2, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('TIEMPO PROMEDIO', 14 + (cardWidth + cardGap) * 3 + 4, cardY + 6);
  doc.setFontSize(11);
  doc.setTextColor(67, 56, 202);
  doc.text(`${promMin}m ${promSeg}s`, 14 + (cardWidth + cardGap) * 3 + 4, cardY + 14);

  // 4. Tabla de Tickets Atendidos
  const tableData = tickets.map((t, idx) => {
    const ciudadano = [t.ciudadanoNombre, t.ciudadanoApellido].filter(Boolean).join(' ') || 'Ciudadano';
    const hLlamado = t.fechaLlamado ? new Date(t.fechaLlamado).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
    const hFin = t.fechaFinalizacion ? new Date(t.fechaFinalizacion).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
    const duracion = t.duracionFormato || (t.duracionSegundos ? `${t.duracionSegundos}s` : (t.duracionAtencionSegundos ? `${t.duracionAtencionSegundos}s` : '-'));
    const estado = t.estado === 'FINALIZADO' ? 'Atendido' : (t.estado === 'NO_PRESENTO' ? 'No se presentó' : t.estado);

    return [
      (idx + 1).toString(),
      t.codigo || '-',
      ciudadano,
      t.tramite || 'Atención General',
      hLlamado,
      hFin,
      duracion,
      estado
    ];
  });

  autoTable(doc, {
    startY: cardY + cardHeight + 6,
    head: [['#', 'Código', 'Ciudadano', 'Trámite', 'Llamado', 'Fin', 'Duración', 'Estado']],
    body: tableData.length > 0 ? tableData : [['-', '-', 'No se registran tickets atendidos en este período', '-', '-', '-', '-', '-']],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15
    },
    headStyles: {
      fillColor: esTriada ? [67, 56, 202] : [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left'
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 18, fontStyle: 'bold', halign: 'center' },
      2: { cellWidth: 42 },
      3: { cellWidth: 40 },
      4: { cellWidth: 19, halign: 'center' },
      5: { cellWidth: 19, halign: 'center' },
      6: { cellWidth: 18, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' }
    },
    didDrawPage: (data) => {
      // Pie de página en cada hoja
      const pageCount = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Documento generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')} • Sistema de Turnos Institucional`,
        14,
        290
      );
      doc.text(`Página ${data.pageNumber} de ${pageCount}`, 196, 290, { align: 'right' });
    }
  });

  // 5. Sección de Firmas al final de la tabla
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 14 : 220;

  if (finalY < 260) {
    doc.setDrawColor(148, 163, 184);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(20, finalY + 16, 85, finalY + 16);
    doc.line(125, finalY + 16, 190, finalY + 16);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Firma de la Cajera / Funcionario', 30, finalY + 21);
    doc.text('Firma de Supervisión / Control', 137, finalY + 21);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(nombreFuncionario, 30, finalY + 25);
    doc.text('Visto Bueno de Cierre', 137, finalY + 25);
  }

  // Descargar el archivo PDF
  const codigoArchivo = caja.numero === 0 ? 'caja_0_pref' : `caja_${caja.numero}`;
  const fechaStr = new Date().toISOString().split('T')[0];
  doc.save(`reporte_tickets_${codigoArchivo}_${fechaStr}.pdf`);
}
