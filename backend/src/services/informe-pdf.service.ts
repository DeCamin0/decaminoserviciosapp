import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

const MARGIN = 50;
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const FOOTER_Y = 808;
/** Y para numeración "Pag. x de y" – por encima de la línea De Camino (FOOTER_Y 808) para que quede en la página. */
const PAGE_NUM_Y = 778;
/** Límite inferior del contenido en página 2 (tabla): el chenar SUB TOTAL + numeración no deben solaparse. */
const TABLE_SAFE_BOTTOM = PAGE_NUM_Y - 30;

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Formatează sumă în stil spaniol: 1.119,00 € */
function fmtEuro(value: number): string {
  const n = Math.round(value * 100) / 100;
  const [intPart, decPart] = n.toFixed(2).split('.');
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${withDots},${decPart} €`;
}

/** Generează paragraful intro din ítemuri: nombre (sau descripcion) pentru listă. */
function generarTextoIntroDesdeLineas(
  lineas: Array<{ nombre?: string; descripcion?: string }>,
): string {
  if (!lineas.length) return '';
  const titulos = lineas
    .map(
      (lin) =>
        (lin.nombre && String(lin.nombre).trim()) ||
        (lin.descripcion && String(lin.descripcion).trim()) ||
        '',
    )
    .filter(Boolean);
  if (!titulos.length) return '';
  const lista = titulos.map((t) => (t.endsWith('.') ? t : t + '.'));
  return (
    'Tras visita técnica en la instalación, se comprueba la necesidad de adaptación de accesos al vaso y revisión del sistema de desbordamiento. ' +
    'Se propone sustitución/instalación según detalle: ' +
    lista.join(' ') +
    ' Todo ello para correcto funcionamiento y seguridad de usuarios.'
  );
}

/** Logo path: optional company logo from env (COMPANY_LOGO_PATH), then fallback to logo.png in assets. Multi-client: set COMPANY_LOGO_PATH in .env. */
function getLogoPath(companyLogoPath?: string | null): string | null {
  const name = companyLogoPath && String(companyLogoPath).trim();
  if (name) {
    const dirs = [
      path.join(process.cwd(), 'assets'),
      path.join(process.cwd(), '..', 'frontend', 'public'),
      path.join(__dirname, '..', '..', 'assets'),
    ];
    for (const dir of dirs) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  const candidates = [
    path.join(process.cwd(), 'assets', 'logo.png'),
    path.join(process.cwd(), '..', 'frontend', 'public', 'logo.png'),
    path.join(__dirname, '..', '..', 'assets', 'logo.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Pentru informes: toate 3 imaginile PISCINA una lângă alta. Căutare în assets (dev + producție). */
function getInformeStripPaths(): [string | null, string | null, string | null] {
  const bases = [
    path.join(process.cwd(), 'assets'),
    path.join(__dirname, '..', '..', 'assets'),
  ];
  const find = (name: string): string | null => {
    for (const base of bases) {
      const p = path.join(base, name);
      if (fs.existsSync(p)) return p;
    }
    return null;
  };
  return [find('PISCINA1.png'), find('PISCINA2.png'), find('PISCINA3.png')];
}

function getServiciosStripPath(): string | null {
  const candidates = [
    path.join(process.cwd(), 'assets', 'servicios.png'),
    path.join(__dirname, '..', '..', 'assets', 'servicios.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const STAMP_CANDIDATES = [
  path.join(process.cwd(), 'assets'),
  path.join(__dirname, '..', '..', 'assets'),
  path.join(process.cwd(), '..', 'frontend', 'public'),
  process.cwd(),
  path.join(process.cwd(), '..'),
  path.join(__dirname, '..', '..', '..'),
];

/** Ruta ștampilă EMPRESA (fallback Decamino). */
function getStampPathDefault(): string | null {
  const envStamp = (process.env.COMPANY_STAMP_PATH || '').trim();
  if (envStamp) {
    for (const dir of STAMP_CANDIDATES) {
      const p = path.join(dir, envStamp);
      if (fs.existsSync(p)) return p;
    }
  }
  const names = [
    'stampila-2-image2.jpeg',
    'stampila-2-image2.jpg',
    'stampila.jpeg',
    'stampila.jpg',
  ];
  for (const dir of STAMP_CANDIDATES) {
    for (const name of names) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

/** Ruta stamp per company: HERA folosește COMPANY_STAMP_PATH_HERA, Decamino COMPANY_STAMP_PATH / fallback. */
function getStampPathForCompany(company: {
  presupuestoPresentacionKey?: string;
  stampPath?: string;
  stampPathHera?: string;
} | null): string | null {
  const key = (company as any)?.presupuestoPresentacionKey;
  const name =
    key === 'hera'
      ? ((company as any)?.stampPathHera || (company as any)?.stampPath || 'stampila_hera-removebg-preview.png')
      : (company as any)?.stampPath;
  if (name && String(name).trim()) {
    for (const dir of STAMP_CANDIDATES) {
      const p = path.join(dir, String(name).trim());
      if (fs.existsSync(p)) return p;
    }
  }
  if (key === 'hera') return null;
  return getStampPathDefault();
}

@Injectable()
export class InformePdfService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private getCompany() {
    return this.configService.get('company') ?? {};
  }

  /** opts.datosFirma: cuando viene de firma electrónica, se dibuja la imagen y datos del formulario en página 3 (FIRMA CLIENTE). opts.evidencias: hashes SHA-256 para bloque Evidencias (integridad). */
  async generatePdf(
    informeId: number,
    opts?: {
      datosFirma?: {
        firma_base64: string;
        fecha_hora?: string;
        nombre_representante?: string;
        nombre_comunidad?: string;
        cif?: string;
        direccion?: string;
        cargo?: string;
        email?: string;
        telefono?: string;
      };
      evidencias?: {
        original_pdf_sha256: string;
        signed_pdf_sha256?: string;
      };
    },
  ): Promise<{ buffer: Buffer; filename: string }> {
    const informe = await this.prisma.informes_factura_config.findUnique({
      where: { id: informeId },
    });
    if (!informe) throw new NotFoundException('Informe no encontrado');
    const datosFirma = opts?.datosFirma;
    const evidencias = opts?.evidencias;

    let clienteNombre = 'Cliente';
    const direccionPortadaLineas: string[] = [];

    if (informe.cliente_id != null) {
      const cliente = await this.prisma.clientes.findUnique({
        where: { id: informe.cliente_id },
        select: {
          NOMBRE_O_RAZON_SOCIAL: true,
          DIRECCION: true,
          CODIGO_POSTAL: true,
          POBLACION: true,
          PROVINCIA: true,
          PAIS: true,
        },
      });
      if (cliente) {
        const nom = cliente.NOMBRE_O_RAZON_SOCIAL;
        clienteNombre =
          nom && String(nom).trim() ? String(nom).trim() : 'Cliente';
        const dir =
          cliente.DIRECCION != null ? String(cliente.DIRECCION).trim() : '';
        if (dir) direccionPortadaLineas.push(dir);
        const cp =
          cliente.CODIGO_POSTAL != null
            ? String(cliente.CODIGO_POSTAL).trim()
            : '';
        const pob =
          cliente.POBLACION != null ? String(cliente.POBLACION).trim() : '';
        if (cp || pob)
          direccionPortadaLineas.push([cp, pob].filter(Boolean).join(' '));
        const prov =
          cliente.PROVINCIA != null ? String(cliente.PROVINCIA).trim() : '';
        if (prov) direccionPortadaLineas.push(prov);
      }
    }

    const anio = new Date().getFullYear();
    const tituloPortada = `PRESUPUESTO ${anio}`;
    const subtituloPortada = informe.informe_final_temporada
      ? 'INFORME FINAL TEMPORADA'
      : 'REPARACIONES VARIAS';
    const numeroPresupuesto = `INF-${anio}-${String(informeId).padStart(4, '0')}`;
    const fechaEmision = informe.created_at
      ? new Date(informe.created_at)
      : new Date();
    const fechaEmisionStr = `${fechaEmision.getDate()} de ${MESES_ES[fechaEmision.getMonth()]} de ${fechaEmision.getFullYear()}`;

    const filename = `presupuesto-reparaciones-${numeroPresupuesto}.pdf`;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: MARGIN,
        bufferPages: true,
      });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Página 1: igual que presupuesto — fondo (brandRed o COMPANY_PORTADA_BG – ex. albastru deschis HERA), título, logo, cliente, banda, contact, footer
      const company = this.getCompany();
      const portadaBg = company.portadaBg ?? company.brandRed;
      const portadaTextColor = company.portadaTextColor ?? '#FFFFFF';
      doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(portadaBg);

      const logoPath = getLogoPath(
        this.configService.get<string>('company.logoPath'),
      );

      const titleY = 40;
      doc.fillColor(portadaTextColor).font('Helvetica-Bold').fontSize(34);
      doc.text(tituloPortada, 0, titleY, {
        width: PAGE_WIDTH,
        align: 'center',
      });

      const titleH = doc.heightOfString(tituloPortada, { width: PAGE_WIDTH });
      const lineY = titleY + titleH + 10;
      const lineW = Math.min(280, PAGE_WIDTH - 80);
      doc.strokeColor(portadaTextColor).lineWidth(2);
      doc
        .moveTo((PAGE_WIDTH - lineW) / 2, lineY)
        .lineTo((PAGE_WIDTH + lineW) / 2, lineY)
        .stroke();
      doc.font('Helvetica').fontSize(16);
      doc.text(subtituloPortada, 0, lineY + 14, {
        width: PAGE_WIDTH,
        align: 'center',
      });
      const logoY = lineY + 14 + 22 + 28;

      const logoSize = 260;
      const logoW = logoSize;
      const logoH = logoSize;
      if (logoPath) {
        try {
          doc.image(logoPath, (PAGE_WIDTH - logoW) / 2, logoY, {
            width: logoW,
            height: logoH,
          });
        } catch {
          // skip
        }
      }

      const blockCenterW = PAGE_WIDTH - 80;
      const blockCenterX = 40;
      let belowLogoY = logoY + logoH + 38;

      const clientLines = clienteNombre
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      doc.fillColor(portadaTextColor).font('Helvetica').fontSize(20);
      let clientBlockHeight = 0;
      if (clientLines.length >= 2) {
        doc.text(clientLines[0], blockCenterX, belowLogoY, {
          align: 'center',
          width: blockCenterW,
        });
        const h1 = doc.heightOfString(clientLines[0], { width: blockCenterW });
        const line2 = clientLines.slice(1).join(', ');
        doc.text(line2, blockCenterX, belowLogoY + h1 + 6, {
          align: 'center',
          width: blockCenterW,
        });
        const h2 = doc.heightOfString(line2, { width: blockCenterW });
        clientBlockHeight = h1 + 6 + h2;
      } else {
        doc.text(clienteNombre, blockCenterX, belowLogoY, {
          align: 'center',
          width: blockCenterW,
        });
        clientBlockHeight = doc.heightOfString(clienteNombre, {
          width: blockCenterW,
        });
      }
      belowLogoY += clientBlockHeight + 12;
      if (direccionPortadaLineas.length > 0) {
        doc.fontSize(11);
        for (const linea of direccionPortadaLineas) {
          doc.text(linea, blockCenterX, belowLogoY, {
            align: 'center',
            width: blockCenterW,
          });
          belowLogoY += 14;
        }
      }
      belowLogoY += 2;
      doc.font('Helvetica-Bold').fontSize(20);
      doc.text(
        `PRESUPUESTO Nº ${numeroPresupuesto}`,
        blockCenterX,
        belowLogoY,
        {
          align: 'center',
          width: blockCenterW,
          underline: true,
        },
      );
      belowLogoY += 28;
      doc.font('Helvetica').fontSize(11);
      doc.text(`Fecha emisión: ${fechaEmisionStr}`, blockCenterX, belowLogoY, {
        align: 'center',
        width: blockCenterW,
      });
      belowLogoY += 22;

      // Informes: toate 3 PISCINA una lângă alta; dacă lipsesc, fallback la servicios.png
      const piscinaPaths = getInformeStripPaths();
      const haveAllThree =
        piscinaPaths[0] && piscinaPaths[1] && piscinaPaths[2];
      const stripTotalW = Math.min(520, blockCenterW);
      const stripH = 72;
      if (haveAllThree) {
        const imgW = stripTotalW / 3;
        const stripX = (PAGE_WIDTH - stripTotalW) / 2;
        try {
          for (let i = 0; i < 3; i++) {
            const p = piscinaPaths[i];
            if (p)
              doc.image(p, stripX + i * imgW, belowLogoY, {
                width: imgW,
                height: stripH,
              });
          }
          belowLogoY += stripH + 14;
        } catch {
          belowLogoY += 8;
        }
      } else {
        const serviciosStripPath = getServiciosStripPath();
        if (serviciosStripPath) {
          try {
            doc.image(
              serviciosStripPath,
              (PAGE_WIDTH - stripTotalW) / 2,
              belowLogoY,
              { width: stripTotalW, height: stripH },
            );
            belowLogoY += stripH + 14;
          } catch {
            belowLogoY += 8;
          }
        } else {
          belowLogoY += 8;
        }
      }

      doc.font('Helvetica').fontSize(14);
      doc.text(this.getCompany().website ?? '', blockCenterX, belowLogoY, {
        align: 'center',
        width: blockCenterW,
      });
      doc.text(
        `Tfno: ${this.getCompany().phone ?? ''}`,
        blockCenterX,
        belowLogoY + 20,
        {
          align: 'center',
          width: blockCenterW,
        },
      );
      doc.text(this.getCompany().email ?? '', blockCenterX, belowLogoY + 40, {
        align: 'center',
        width: blockCenterW,
      });

      doc.fontSize(7).fillColor(portadaTextColor).font('Helvetica');
      const footerHeight = PAGE_HEIGHT - FOOTER_Y - 12;
      doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
        width: PAGE_WIDTH - MARGIN * 2,
        align: 'center',
        height: footerHeight,
        ellipsis: true,
      });

      // ——— Página 2: la fel ca la presupuesto — logo filigrană, logo stânga sus, date firma lângă logo, footer
      doc.addPage({ size: 'A4', margin: MARGIN });
      const smallLogoSize = 56;
      if (logoPath) {
        try {
          doc.opacity(0.1);
          const wmW = 400;
          const wmH = 400;
          doc.image(logoPath, (PAGE_WIDTH - wmW) / 2, (PAGE_HEIGHT - wmH) / 2, {
            width: wmW,
            height: wmH,
          });
          doc.opacity(1);
          doc.image(logoPath, MARGIN, 40, {
            width: smallLogoSize,
            height: smallLogoSize,
          });
        } catch {
          // skip
        }
      }
      // Date firma lângă logo (din informe sau default company config)
      const tituloEmpresa =
        (informe.titulo_empresa && String(informe.titulo_empresa).trim()) ||
        (company.legalName ?? '');
      const direccionEmpresa =
        (informe.direccion_empresa &&
          String(informe.direccion_empresa).trim()) ||
        (company.addressLine1 ?? '');
      const cpPoblacionEmpresa =
        (informe.cp_poblacion_empresa &&
          String(informe.cp_poblacion_empresa).trim()) ||
        (company.cpPoblacion ?? '');
      const emailEmpresa =
        (informe.email_empresa && String(informe.email_empresa).trim()) ||
        (company.email ?? '');
      const telefonoEmpresa =
        (informe.telefono_empresa && String(informe.telefono_empresa).trim()) ||
        (company.phone ?? '');
      const headerRightX = MARGIN + smallLogoSize + 16;
      const headerRightW = PAGE_WIDTH - headerRightX - MARGIN;
      doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(10);
      doc.text(tituloEmpresa, headerRightX, 40, { width: headerRightW });
      let headerY =
        40 + doc.heightOfString(tituloEmpresa, { width: headerRightW }) + 4;
      doc.font('Helvetica').fontSize(9);
      doc.text(direccionEmpresa, headerRightX, headerY, {
        width: headerRightW,
      });
      headerY += 12;
      doc.text(cpPoblacionEmpresa, headerRightX, headerY, {
        width: headerRightW,
      });
      headerY += 12;
      doc.text(`Tfno: ${telefonoEmpresa}`, headerRightX, headerY, {
        width: headerRightW,
      });
      headerY += 12;
      doc.text(emailEmpresa, headerRightX, headerY, { width: headerRightW });

      // Text intro generat automat din descrierile ítemurilor (înainte de detalle economice)
      const lineas =
        (informe.lineas_json as Array<{
          nombre?: string;
          descripcion?: string;
          precioUnitario?: number | string;
          cantidad?: number;
        }>) || [];
      let tableY = 140;
      const contentWidth = PAGE_WIDTH - MARGIN * 2;
      const textoIntro = generarTextoIntroDesdeLineas(lineas);
      if (textoIntro) {
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
        const introHeight = doc.heightOfString(textoIntro, {
          width: contentWidth,
        });
        doc.text(textoIntro, MARGIN, tableY, {
          width: contentWidth,
          align: 'justify',
        });
        tableY += introHeight + 20;
      }

      // Tabel „Detalle del informe” — coloane fixe, aliniere corectă, header cu fundal, grid
      if (lineas.length > 0) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a');
        doc.text('Detalle del informe', MARGIN, tableY, {
          width: contentWidth,
        });
        tableY += 24;

        const tableLeft = MARGIN;
        const tableRight = PAGE_WIDTH - MARGIN;
        const tableW = tableRight - tableLeft;
        const wCant = 38;
        const wPrecio = 62;
        const wTotal = 58;
        const gap = 10;
        const wDesc = tableW - wCant - wPrecio - wTotal - gap * 3;
        const xDesc = tableLeft;
        const xCant = xDesc + wDesc + gap;
        const xPrecio = xCant + wCant + gap;
        const xTotal = xPrecio + wPrecio + gap;
        const mainRowHeight = 20;
        const headerHeight = 28;
        const boxPadding = 16;
        const lineHBox = 24;
        const boxH = lineHBox * 3 + boxPadding * 2;

        // Header cu fundal (gri) și contur roșu
        doc
          .fillColor('#E8E8E8')
          .rect(tableLeft, tableY, tableW, headerHeight)
          .fill();
        doc
          .strokeColor(this.getCompany().brandRed)
          .lineWidth(0.8)
          .rect(tableLeft, tableY, tableW, headerHeight)
          .stroke();
        doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9);
        doc.text('Descripción', xDesc + 8, tableY + (headerHeight - 10) / 2, {
          width: wDesc - 16,
          ellipsis: true,
        });
        doc.text('Cant.', xCant, tableY + (headerHeight - 10) / 2, {
          width: wCant,
          align: 'right',
        });
        doc.text('P. unit. (€)', xPrecio, tableY + (headerHeight - 10) / 2, {
          width: wPrecio,
          align: 'right',
        });
        doc.text('Total (€)', xTotal, tableY + (headerHeight - 10) / 2, {
          width: wTotal,
          align: 'right',
        });
        tableY += headerHeight;

        const addTableContinuationPage = () => {
          doc.addPage({ size: 'A4', margin: MARGIN });
          if (logoPath) {
            try {
              doc.opacity(0.1);
              doc.image(
                logoPath,
                (PAGE_WIDTH - 400) / 2,
                (PAGE_HEIGHT - 400) / 2,
                {
                  width: 400,
                  height: 400,
                },
              );
              doc.opacity(1);
              doc.image(logoPath, MARGIN, 40, {
                width: smallLogoSize,
                height: smallLogoSize,
              });
            } catch {
              // skip
            }
          }
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(10);
          doc.text(tituloEmpresa, headerRightX, 40, { width: headerRightW });
          let hy =
            40 + doc.heightOfString(tituloEmpresa, { width: headerRightW }) + 4;
          doc.font('Helvetica').fontSize(9);
          doc.text(direccionEmpresa, headerRightX, hy, { width: headerRightW });
          hy += 12;
          doc.text(cpPoblacionEmpresa, headerRightX, hy, {
            width: headerRightW,
          });
          hy += 12;
          doc.text(`Tfno: ${telefonoEmpresa}`, headerRightX, hy, {
            width: headerRightW,
          });
          hy += 12;
          doc.text(emailEmpresa, headerRightX, hy, { width: headerRightW });
          tableY = 150;
          doc
            .fillColor('#E8E8E8')
            .rect(tableLeft, tableY, tableW, headerHeight)
            .fill();
          doc
            .strokeColor(this.getCompany().brandRed)
            .lineWidth(0.8)
            .rect(tableLeft, tableY, tableW, headerHeight)
            .stroke();
          doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(9);
          doc.text('Descripción', xDesc + 8, tableY + (headerHeight - 10) / 2, {
            width: wDesc - 16,
            ellipsis: true,
          });
          doc.text('Cant.', xCant, tableY + (headerHeight - 10) / 2, {
            width: wCant,
            align: 'right',
          });
          doc.text('P. unit. (€)', xPrecio, tableY + (headerHeight - 10) / 2, {
            width: wPrecio,
            align: 'right',
          });
          doc.text('Total (€)', xTotal, tableY + (headerHeight - 10) / 2, {
            width: wTotal,
            align: 'right',
          });
          tableY += headerHeight;
        };

        doc.font('Helvetica').fontSize(9).fillColor('#333333');
        for (let i = 0; i < lineas.length; i++) {
          const lin = lineas[i];
          const nombre = (lin.nombre && String(lin.nombre).trim()) || '';
          const descripcionLarga =
            (lin.descripcion && String(lin.descripcion).trim()) || '';
          const tituloRow = nombre || descripcionLarga || '—';
          const tituloShort =
            tituloRow.length > 55
              ? tituloRow.substring(0, 55) + '…'
              : tituloRow;
          const cant = Number(lin.cantidad) || 0;
          const precio = Number(lin.precioUnitario) || 0;
          const total = cant * precio;

          const subDescW = wDesc - 20;
          const estRowH =
            mainRowHeight +
            (descripcionLarga
              ? doc.heightOfString(descripcionLarga, { width: subDescW }) + 8
              : 0);
          if (tableY + estRowH + boxH + 25 > TABLE_SAFE_BOTTOM) {
            addTableContinuationPage();
          }

          if (i > 0) {
            doc.strokeColor('#e0e0e0').lineWidth(0.3);
            doc.moveTo(tableLeft, tableY).lineTo(tableRight, tableY).stroke();
          }
          doc.fillColor('#1a1a1a');
          doc.text(tituloShort, xDesc + 8, tableY + 5, {
            width: wDesc - 16,
            ellipsis: true,
          });
          doc.text(String(cant), xCant, tableY + 5, {
            width: wCant,
            align: 'right',
          });
          doc.text(precio.toFixed(2), xPrecio, tableY + 5, {
            width: wPrecio,
            align: 'right',
          });
          doc.text(total.toFixed(2), xTotal, tableY + 5, {
            width: wTotal,
            align: 'right',
          });
          tableY += mainRowHeight;

          // Sub ítem: descripcion (text lung din ítem), font mai mic, gri — doar dacă există și e diferit de nombre
          if (descripcionLarga) {
            doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#666666');
            const subDescH = doc.heightOfString(descripcionLarga, {
              width: subDescW,
            });
            doc.text(descripcionLarga, xDesc + 14, tableY, { width: subDescW });
            tableY += subDescH + 8;
          }
        }
        doc
          .strokeColor((this.getCompany().brandRed as string) || '#CC0000')
          .lineWidth(0.8);
        doc.moveTo(tableLeft, tableY).lineTo(tableRight, tableY).stroke();
        tableY += 20;

        // SUB TOTAL, I.V.A., TOTAL — bloc aliniat la dreapta, format frumos
        const subtotal = lineas.reduce(
          (sum, lin) =>
            sum +
            (Number(lin.cantidad) || 0) * (Number(lin.precioUnitario) || 0),
          0,
        );
        const tasaIva = Number.isFinite(Number(informe.tasa_iva))
          ? Number(informe.tasa_iva)
          : 21;
        const iva = Math.round(subtotal * (tasaIva / 100) * 100) / 100;
        const total = Math.round((subtotal + iva) * 100) / 100;
        const boxW = 240;
        const boxX = tableRight - boxW;
        const labelW = 100;
        const valueW = 90;
        doc.fillColor('#f8f8f8').rect(boxX, tableY, boxW, boxH).fill();
        doc
          .strokeColor(this.getCompany().brandRed)
          .lineWidth(0.8)
          .rect(boxX, tableY, boxW, boxH)
          .stroke();
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
        doc.text('SUB TOTAL:', boxX + boxPadding, tableY + boxPadding, {
          width: labelW,
        });
        doc.text(
          fmtEuro(subtotal),
          boxX + boxW - boxPadding - valueW,
          tableY + boxPadding,
          { width: valueW, align: 'right' },
        );
        doc.text(
          `${tasaIva}% I.V.A.`,
          boxX + boxPadding,
          tableY + boxPadding + lineHBox,
          { width: labelW },
        );
        doc.text(
          fmtEuro(iva),
          boxX + boxW - boxPadding - valueW,
          tableY + boxPadding + lineHBox,
          { width: valueW, align: 'right' },
        );
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a1a');
        doc.text(
          'TOTAL:',
          boxX + boxPadding,
          tableY + boxPadding + lineHBox * 2,
          {
            width: labelW,
          },
        );
        doc.text(
          fmtEuro(total),
          boxX + boxW - boxPadding - valueW,
          tableY + boxPadding + lineHBox * 2,
          { width: valueW, align: 'right' },
        );
        tableY += boxH + 18;
      } else {
        tableY += 10;
      }

      // Doar Forma de pago sub totaluri
      doc.font('Helvetica').fontSize(9).fillColor('#1a1a1a');
      doc.text(
        'Forma de pago: 50% al firmar el presupuesto y 50% al finalizar los trabajos.',
        MARGIN,
        tableY,
        { width: PAGE_WIDTH - MARGIN * 2 },
      );

      // Footer pagina 2
      doc.fontSize(7).fillColor('#333333').font('Helvetica');
      doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
        width: PAGE_WIDTH - MARGIN * 2,
        align: 'center',
        height: PAGE_HEIGHT - FOOTER_Y - 12,
        ellipsis: true,
      });

      // ——— Página 3: condiții, FIRMA EMPRESA + FIRMA CLIENTE (Forma de pago está en pág. 2)
      doc.addPage({ size: 'A4', margin: MARGIN });
      if (logoPath) {
        try {
          doc.opacity(0.1);
          doc.image(logoPath, (PAGE_WIDTH - 400) / 2, (PAGE_HEIGHT - 400) / 2, {
            width: 400,
            height: 400,
          });
          doc.opacity(1);
          doc.image(logoPath, MARGIN, 40, {
            width: smallLogoSize,
            height: smallLogoSize,
          });
        } catch {
          // skip
        }
      }
      doc.fillColor('#1a1a1a').font('Helvetica-Bold').fontSize(10);
      doc.text(tituloEmpresa, headerRightX, 40, { width: headerRightW });
      let page3Y =
        40 + doc.heightOfString(tituloEmpresa, { width: headerRightW }) + 4;
      doc.font('Helvetica').fontSize(9);
      doc.text(direccionEmpresa, headerRightX, page3Y, { width: headerRightW });
      page3Y += 12;
      doc.text(cpPoblacionEmpresa, headerRightX, page3Y, {
        width: headerRightW,
      });
      page3Y += 12;
      doc.text(`Tfno: ${telefonoEmpresa}`, headerRightX, page3Y, {
        width: headerRightW,
      });
      page3Y += 12;
      doc.text(emailEmpresa, headerRightX, page3Y, { width: headerRightW });
      page3Y += 28;

      const condicionesTexto =
        'El presente presupuesto contempla únicamente los trabajos y materiales descritos en el detalle anterior. ' +
        'Cualquier intervención adicional derivada de incidencias no visibles durante la inspección inicial será comunicada previamente para su valoración y aprobación, no estando incluida en el importe indicado.\n\n' +
        'La validez del presente presupuesto es de 90 días desde la fecha de emisión.\n\n' +
        'La aceptación podrá realizarse mediante firma manuscrita o firma electrónica, teniendo ambas plena validez legal conforme a la normativa vigente. ' +
        'La confirmación electrónica (firma digital, aceptación por plataforma o correo de aprobación) tendrá la consideración de autorización expresa para el inicio de los trabajos.\n\n' +
        'No se iniciarán los trabajos sin dicha autorización.';
      doc.font('Helvetica').fontSize(8).fillColor('#444444');
      doc.text(condicionesTexto, MARGIN, page3Y, {
        width: contentWidth,
        align: 'justify',
      });
      page3Y +=
        doc.heightOfString(condicionesTexto, { width: contentWidth }) + 18;

      const firmaLineW = 180;
      const firmaLabelH = 10;
      const firmaClienteX = PAGE_WIDTH - MARGIN - firmaLineW;
      doc.font('Helvetica').fontSize(8).fillColor('#333333');
      doc.strokeColor('#888888').lineWidth(0.5);
      doc.text('FIRMA EMPRESA:', MARGIN, page3Y);
      const stampPath = getStampPathForCompany(this.getCompany());
      const stampW = 56;
      const stampH = 42;
      const firmaEmpresaContentX = MARGIN + stampW + 14;
      const firmaEmpresaContentW = firmaClienteX - firmaEmpresaContentX - 16;
      let firmaBlockH = firmaLabelH + 4 + 2;
      if (stampPath) {
        try {
          doc.image(stampPath, MARGIN, page3Y + firmaLabelH + 2, {
            width: stampW,
            height: stampH,
          });
          firmaBlockH = firmaLabelH + 2 + stampH;
        } catch {
          doc
            .moveTo(MARGIN, page3Y + firmaLabelH + 4)
            .lineTo(MARGIN + firmaLineW, page3Y + firmaLabelH + 4)
            .stroke();
        }
      } else {
        doc
          .moveTo(MARGIN, page3Y + firmaLabelH + 4)
          .lineTo(MARGIN + firmaLineW, page3Y + firmaLabelH + 4)
          .stroke();
      }
      doc.font('Helvetica').fontSize(7).fillColor('#333333');
      let empY = page3Y + firmaLabelH + 2;
      doc.text(tituloEmpresa, firmaEmpresaContentX, empY, {
        width: firmaEmpresaContentW,
      });
      empY += 10;
      doc.text(direccionEmpresa, firmaEmpresaContentX, empY, {
        width: firmaEmpresaContentW,
      });
      empY += 9;
      doc.text(cpPoblacionEmpresa, firmaEmpresaContentX, empY, {
        width: firmaEmpresaContentW,
      });
      empY += 9;
      doc.text(`Tfno: ${telefonoEmpresa}`, firmaEmpresaContentX, empY, {
        width: firmaEmpresaContentW,
      });
      empY += 9;
      doc.text(emailEmpresa, firmaEmpresaContentX, empY, {
        width: firmaEmpresaContentW,
      });
      const empBlockH = empY - (page3Y + firmaLabelH + 2) + 4;
      firmaBlockH = Math.max(firmaBlockH, empBlockH);

      doc.font('Helvetica').fontSize(8).fillColor('#333333');
      doc.text('FIRMA CLIENTE:', firmaClienteX, page3Y);
      if (datosFirma?.firma_base64) {
        try {
          const base64Data = datosFirma.firma_base64.replace(
            /^data:image\/\w+;base64,/,
            '',
          );
          const imgBuf = Buffer.from(base64Data, 'base64');
          const sigW = 100;
          const sigH = 40;
          doc.image(imgBuf, firmaClienteX, page3Y + firmaLabelH + 2, {
            width: sigW,
            height: sigH,
          });
          let clientY = page3Y + firmaLabelH + 2 + sigH + 10;
          doc.font('Helvetica').fontSize(7).fillColor('#333333');
          const trim = (s: string | undefined) => (s && String(s).trim()) || '';
          const lineGap = 6;
          const drawClientLine = (text: string) => {
            if (!text) return;
            const h = doc.heightOfString(text, { width: firmaLineW });
            doc.text(text, firmaClienteX, clientY, { width: firmaLineW });
            clientY += h + lineGap;
          };
          if (datosFirma.nombre_representante) {
            drawClientLine(datosFirma.nombre_representante.trim());
          }
          if (trim(datosFirma.nombre_comunidad)) {
            drawClientLine(trim(datosFirma.nombre_comunidad));
          }
          if (trim(datosFirma.cif)) {
            drawClientLine('CIF: ' + trim(datosFirma.cif));
          }
          if (trim(datosFirma.direccion)) {
            drawClientLine(trim(datosFirma.direccion));
          }
          if (trim(datosFirma.cargo)) {
            drawClientLine('Cargo: ' + trim(datosFirma.cargo));
          }
          if (trim(datosFirma.email)) {
            drawClientLine(trim(datosFirma.email));
          }
          if (trim(datosFirma.telefono)) {
            drawClientLine('Tfno: ' + trim(datosFirma.telefono));
          }
          clientY += 4;
          const clienteBlockH = clientY - (page3Y + firmaLabelH + 2);
          page3Y +=
            Math.max(firmaBlockH, firmaLabelH + 2 + sigH + clienteBlockH) + 8;
        } catch {
          doc
            .moveTo(firmaClienteX, page3Y + firmaLabelH + 4)
            .lineTo(firmaClienteX + firmaLineW, page3Y + firmaLabelH + 4)
            .stroke();
          page3Y += Math.max(firmaBlockH, firmaLabelH + 6) + 8;
        }
      } else {
        // Botón "ACEPTAR INFORME" en el PDF (enlace a firmar-informe.html), como en presupuesto
        const firmarBaseUrl =
          process.env.FIRMAR_BASE_URL || this.getCompany().frontendAppUrl || '';
        const firmarUrl = `${firmarBaseUrl}/firmar-informe.html?id=${informeId}`;
        const btnW = 160;
        const btnH = 28;
        const btnX = firmaClienteX + (firmaLineW - btnW) / 2;
        const btnY = page3Y + firmaLabelH + 4;
        doc.fillColor('#2563eb').strokeColor('#1d4ed8').lineWidth(1);
        doc.roundedRect(btnX, btnY, btnW, btnH, 4).fillAndStroke();
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
        doc.text('ACEPTAR INFORME', btnX, btnY + 8, {
          width: btnW,
          align: 'center',
        });
        doc.link(btnX, btnY, btnW, btnH, firmarUrl);
        page3Y += Math.max(firmaBlockH, firmaLabelH + 4 + btnH + 6) + 8;
      }

      // ——— Aceptado electrónicamente + texto legal eIDAS + Evidencias (como en presupuesto)
      const formatFechaFirma = (iso: string) => {
        try {
          const d = new Date(iso);
          return isNaN(d.getTime())
            ? iso
            : d.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
        } catch {
          return iso;
        }
      };
      if (datosFirma) {
        doc.font('Helvetica').fontSize(9).fillColor('#15803d');
        doc.text(
          `Aceptado electrónicamente el ${datosFirma.fecha_hora ? formatFechaFirma(datosFirma.fecha_hora) : new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
          MARGIN,
          page3Y,
          { width: PAGE_WIDTH - MARGIN * 2, align: 'center' },
        );
        page3Y += 18;
      }
      const legalFirma = datosFirma
        ? 'Documento aceptado mediante firma electrónica conforme al Reglamento (UE) 910/2014 (eIDAS).'
        : 'Este informe puede aceptarse mediante firma electrónica a través del enlace superior, teniendo la misma validez legal que la firma manuscrita conforme al Reglamento (UE) 910/2014 (eIDAS).';
      doc.font('Helvetica').fontSize(6).fillColor('#555555');
      doc.text(legalFirma, MARGIN, page3Y, {
        width: PAGE_WIDTH - MARGIN * 2,
        align: 'center',
      });
      page3Y += 20;
      if (datosFirma && evidencias) {
        const ahoraMadrid = new Date().toLocaleString('es-ES', {
          timeZone: 'Europe/Madrid',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        doc.font('Helvetica-Bold').fontSize(6).fillColor('#333333');
        doc.text('Evidencias (integridad del documento)', MARGIN, page3Y, {
          width: PAGE_WIDTH - MARGIN * 2,
        });
        page3Y += 10;
        doc.font('Helvetica').fontSize(5).fillColor('#555555');
        doc.text(
          `Huella digital (SHA-256) del informe original: ${evidencias.original_pdf_sha256}`,
          MARGIN,
          page3Y,
          { width: PAGE_WIDTH - MARGIN * 2 },
        );
        page3Y += 8;
        doc.text(
          `Huella digital (SHA-256) del documento firmado: ${evidencias.signed_pdf_sha256 ?? '(registrada en base de datos)'}`,
          MARGIN,
          page3Y,
          { width: PAGE_WIDTH - MARGIN * 2 },
        );
        page3Y += 8;
        doc.text(
          `Fecha y hora (Europe/Madrid): ${ahoraMadrid}`,
          MARGIN,
          page3Y,
          { width: PAGE_WIDTH - MARGIN * 2 },
        );
        page3Y += 8;
        doc.text(`ID Informe: ${informeId}`, MARGIN, page3Y, {
          width: PAGE_WIDTH - MARGIN * 2,
        });
        page3Y += 12;
      }

      doc.fontSize(7).fillColor('#333333').font('Helvetica');
      doc.text(this.getCompany().legalRegistryText, MARGIN, FOOTER_Y, {
        width: PAGE_WIDTH - MARGIN * 2,
        align: 'center',
        height: PAGE_HEIGHT - FOOTER_Y - 12,
        ellipsis: true,
      });

      // Numerotare "Pag. x de y" în dreapta jos, pe toate paginile exceptând coperta (pagina 0)
      const pageRange = doc.bufferedPageRange();
      const totalPages = pageRange.count;
      for (let i = 1; i < totalPages; i++) {
        doc.switchToPage(i);
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor(this.getCompany().brandRed);
        doc.text(`Pag. ${i + 1} de ${totalPages}`, MARGIN, PAGE_NUM_Y, {
          width: PAGE_WIDTH - MARGIN * 2,
          align: 'right',
        });
      }

      doc.end();
    });

    return { buffer, filename };
  }
}
