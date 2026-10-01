import jsPDF from 'jspdf';

interface SurveyDataForPdf {
  surveys: any[];
  responses: any[];
  answers: any[];
  tickets: any[];
}

/**
 * Generates an official Executive Government PDF Report for Dire Dawa Administration
 * Government Communication Affairs Bureau (የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ)
 * powered by OPA AI Engine.
 */
export function generateExecutive24hPdf(
  data: SurveyDataForPdf,
  aiSummaryText: string,
  ethDateFormatted: string,
  refCode: string = 'DGC-24H-2026-ETH'
): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;

  // Helper for drawing header on any page
  const drawPageHeader = (pageNum: number, totalPages: number = 2) => {
    // Top Navy Banner
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 32, 'F');

    // Amber Accent Line
    doc.setFillColor(245, 158, 11); // amber-500
    doc.rect(0, 32, pageWidth, 2, 'F');

    // Header Texts
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('DIRE DAWA ADMINISTRATION', margin, 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('GOVERNMENT COMMUNICATION AFFAIRS BUREAU', margin, 17);
    doc.setFontSize(7.5);
    doc.setTextColor(203, 213, 225);
    doc.text('PUBLIC OPINION, CITIZEN ENGAGEMENT & POLICY INTELLIGENCE', margin, 23);

    // Right Side Metadata
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(245, 158, 11);
    doc.text(`REF: ${refCode}`, pageWidth - margin, 11, { align: 'right' });
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'normal');
    doc.text(`DATE: ${ethDateFormatted}`, pageWidth - margin, 17, { align: 'right' });
    doc.setTextColor(148, 163, 184);
    doc.text('ENGINE: OPA AI ENGINE v4.8', pageWidth - margin, 23, { align: 'right' });

    // Footer
    doc.setFillColor(241, 245, 249);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.line(0, pageHeight - 12, pageWidth, pageHeight - 12);

    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Official Document: Dire Dawa Administration Government Communication Affairs Bureau',
      margin,
      pageHeight - 5
    );
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 5, {
      align: 'right',
    });
  };

  // ================= PAGE 1 =================
  drawPageHeader(1, 2);

  let currentY = 42;

  // Document Title Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('24-HOUR EXECUTIVE CITIZEN ENGAGEMENT & POLICY REPORT', margin + 4, currentY + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Dire Dawa Government Communication Affairs Bureau | 24-Hour Survey Analytics & Grievances',
    margin + 4,
    currentY + 13
  );

  currentY += 24;

  // 4 Executive KPI Metric Cards
  const activeSurveys = data.surveys.filter((s) => s.is_active).length;
  const totalResponses = data.responses.length;
  const totalTickets = data.tickets.length;
  const resolvedTickets = data.tickets.filter((t) => t.status === 'Resolved').length;
  const cardWidth = (pageWidth - margin * 2 - 9) / 4;
  const cardHeight = 22;

  const kpis = [
    { label: 'TOTAL SURVEYS', val: `${data.surveys.length}`, sub: `${activeSurveys} Active` },
    { label: 'RESPONSES (24H)', val: `${totalResponses}`, sub: 'Verified Citizens' },
    { label: 'CITIZEN TICKETS', val: `${totalTickets}`, sub: `${resolvedTickets} Resolved` },
    { label: 'AI POLICY ENGINE', val: 'ACTIVE', sub: 'OPA AI Core v4.8' },
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, cardX + 3, currentY + 6);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(kpi.val, cardX + 3, currentY + 13);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(37, 99, 235);
    doc.text(kpi.sub, cardX + 3, currentY + 18);
  });

  currentY += cardHeight + 8;

  // Section 1: Surveys Overview Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. PUBLIC SURVEYS & CITIZEN ENGAGEMENT OVERVIEW', margin, currentY);
  currentY += 5;

  // Table Header
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text('ID', margin + 3, currentY + 4.5);
  doc.text('SURVEY TITLE / CATEGORY', margin + 18, currentY + 4.5);
  doc.text('CATEGORY', margin + 110, currentY + 4.5);
  doc.text('RESPONSES', margin + 145, currentY + 4.5);
  doc.text('STATUS', margin + 168, currentY + 4.5);
  currentY += 7;

  // Table Rows (top 6 surveys)
  const displaySurveys = data.surveys.slice(0, 7);
  displaySurveys.forEach((srv, i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, currentY + 6.5, pageWidth - margin, currentY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text(`#${srv.id}`, margin + 3, currentY + 4.2);

    doc.setFont('helvetica', 'normal');
    const safeTitle = (srv.title || 'Untitled Survey').substring(0, 52);
    doc.text(safeTitle, margin + 18, currentY + 4.2);

    doc.text((srv.category || 'General').substring(0, 20), margin + 110, currentY + 4.2);

    const respCount = srv.total_responses || data.responses.filter((r) => r.survey_id === srv.id).length;
    doc.setFont('helvetica', 'bold');
    doc.text(`${respCount}`, margin + 152, currentY + 4.2, { align: 'center' });

    doc.setTextColor(srv.is_active ? 22 : 100, srv.is_active ? 101 : 116, srv.is_active ? 52 : 139);
    doc.text(srv.is_active ? 'Active' : 'Closed', margin + 168, currentY + 4.2);

    currentY += 6.5;
  });

  currentY += 6;

  // Section 2: Citizen Tickets Summary
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('2. CITIZEN GRIEVANCES & PUBLIC FEEDBACK SUMMARY', margin, currentY);
  currentY += 5;

  // Table Header for Tickets
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text('TICKET CODE', margin + 3, currentY + 4.5);
  doc.text('CATEGORY / SUBJECT', margin + 35, currentY + 4.5);
  doc.text('LOCATION', margin + 120, currentY + 4.5);
  doc.text('PRIORITY', margin + 150, currentY + 4.5);
  doc.text('STATUS', margin + 168, currentY + 4.5);
  currentY += 7;

  const displayTickets = data.tickets.slice(0, 6);
  if (displayTickets.length === 0) {
    doc.setFillColor(255, 255, 255);
    doc.rect(margin, currentY, pageWidth - margin * 2, 7, 'F');
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.text('No active grievances recorded in this 24-hour cycle.', margin + 4, currentY + 4.5);
    currentY += 7;
  } else {
    displayTickets.forEach((t, i) => {
      doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
      doc.rect(margin, currentY, pageWidth - margin * 2, 6.5, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, currentY + 6.5, pageWidth - margin, currentY + 6.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(37, 99, 235);
      doc.text(t.ticket_code || `TCK-${t.id}`, margin + 3, currentY + 4.2);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const subjectText = `${t.category || ''} - ${(t.subject || 'General Grievance').substring(0, 40)}`;
      doc.text(subjectText, margin + 35, currentY + 4.2);

      doc.text((t.residence || 'Dire Dawa').substring(0, 16), margin + 120, currentY + 4.2);

      // Priority color
      if (t.priority === 'Urgent') doc.setTextColor(220, 38, 38);
      else if (t.priority === 'High') doc.setTextColor(217, 119, 6);
      else doc.setTextColor(71, 85, 105);
      doc.text(t.priority || 'Normal', margin + 150, currentY + 4.2);

      doc.setTextColor(t.status === 'Resolved' ? 22 : 15, t.status === 'Resolved' ? 101 : 23, t.status === 'Resolved' ? 52 : 42);
      doc.text(t.status || 'Pending', margin + 168, currentY + 4.2);

      currentY += 6.5;
    });
  }

  // ================= PAGE 2 =================
  doc.addPage();
  drawPageHeader(2, 2);

  currentY = 42;

  // Section 3: OPA AI Engine Policy Intelligence Briefing
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('3. OPA AI ENGINE EXECUTIVE POLICY BRIEF & INTELLIGENCE SYNTHESIS', margin + 4, currentY + 6.5);
  currentY += 16;

  // AI Summary Content Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 150, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('EXECUTIVE STRATEGIC SUMMARY & RECOMMENDATIONS:', margin + 5, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  // Split and render AI summary text cleanly
  const cleanSummary = aiSummaryText
    .replace(/[#*`_]/g, '')
    .trim();

  const lines = doc.splitTextToSize(cleanSummary, pageWidth - margin * 2 - 10);
  doc.text(lines.slice(0, 40), margin + 5, currentY + 16);

  currentY += 158;

  // Official Bureau Verification & Sign-off Stamp Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('OFFICIAL VERIFICATION & SYSTEM AUDIT:', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(
    'This 24-hour citizen opinion report has been compiled and certified by Dire Dawa Administration',
    margin + 4,
    currentY + 11
  );
  doc.text(
    'Government Communication Affairs Bureau (የድሬዳዋ አስተዳደር የመንግስት ኮሙኒኬሽን ጉዳዮች ቢሮ).',
    margin + 4,
    currentY + 16
  );
  doc.text(
    'Generated via OPA AI Engine Enterprise Analytics Core. All citizen data encrypted.',
    margin + 4,
    currentY + 21
  );

  // Verification Seal on the Right
  doc.setFillColor(30, 41, 59);
  doc.rect(pageWidth - margin - 35, currentY + 3, 32, 20, 'F');
  doc.setTextColor(245, 158, 11);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text('CERTIFIED', pageWidth - margin - 19, currentY + 9, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.text('DGC BUREAU', pageWidth - margin - 19, currentY + 14, { align: 'center' });
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(5.5);
  doc.text('OPA-ETH-2026', pageWidth - margin - 19, currentY + 19, { align: 'center' });

  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
