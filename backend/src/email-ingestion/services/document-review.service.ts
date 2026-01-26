import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentReviewService {
  private readonly logger = new Logger(DocumentReviewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get pending documents for review
   */
  async getPendingDocuments(): Promise<any[]> {
    const query = `
      SELECT 
        doc_id,
        id,
        correo_electronico,
        tipo_documento,
        nombre_archivo,
        nombre_empleado,
        fecha_creacion,
        status,
        detected_empleado_id,
        detected_tipo_documento,
        confirmed_empleado_id,
        confirmed_tipo_documento,
        ingestion_metadata
      FROM \`DocumentosOficiales\`
      WHERE status = 'PENDING_REVIEW'
      ORDER BY fecha_creacion DESC
    `;

    const documents = await this.prisma.$queryRawUnsafe<any[]>(query);

    return documents.map((doc) => ({
      doc_id: doc.doc_id,
      id: doc.id,
      correo_electronico: doc.correo_electronico,
      tipo_documento: doc.tipo_documento,
      nombre_archivo: doc.nombre_archivo,
      nombre_empleado: doc.nombre_empleado,
      fecha_creacion: doc.fecha_creacion,
      status: doc.status,
      detected_empleado_id: doc.detected_empleado_id,
      detected_tipo_documento: doc.detected_tipo_documento,
      confirmed_empleado_id: doc.confirmed_empleado_id,
      confirmed_tipo_documento: doc.confirmed_tipo_documento,
      ingestion_metadata: doc.ingestion_metadata
        ? JSON.parse(doc.ingestion_metadata)
        : null,
    }));
  }

  /**
   * Approve document and assign to employee
   */
  async approveDocument(
    docId: number,
    employeeId: string,
    documentType: string,
    action: 'send' | 'archive',
    approvedBy: string,
  ): Promise<{ success: true }> {
    // Verify document exists and is PENDING_REVIEW
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT doc_id, status FROM DocumentosOficiales WHERE doc_id = ${docId} LIMIT 1`,
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Document with doc_id ${docId} not found`);
    }

    if (existing[0].status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Document is not in PENDING_REVIEW status (current: ${existing[0].status})`,
      );
    }

    // Update document
    const query = `
      UPDATE \`DocumentosOficiales\`
      SET 
        \`status\` = 'APPROVED',
        \`id\` = ${this.escapeSql(employeeId)},
        \`confirmed_empleado_id\` = ${this.escapeSql(employeeId)},
        \`confirmed_tipo_documento\` = ${this.escapeSql(documentType)},
        \`tipo_documento\` = ${this.escapeSql(documentType)},
        \`action\` = ${this.escapeSql(action)},
        \`approved_by\` = ${this.escapeSql(approvedBy)},
        \`approved_at\` = NOW()
      WHERE doc_id = ${docId}
    `;

    await this.prisma.$executeRawUnsafe(query);

    this.logger.log(
      `✅ Document ${docId} approved: employee=${employeeId}, type=${documentType}, action=${action}`,
    );

    return { success: true };
  }

  /**
   * Reject document
   */
  async rejectDocument(
    docId: number,
    reason: string | null,
    rejectedBy: string,
  ): Promise<{ success: true }> {
    // Verify document exists and is PENDING_REVIEW
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT doc_id, status FROM DocumentosOficiales WHERE doc_id = ${docId} LIMIT 1`,
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Document with doc_id ${docId} not found`);
    }

    if (existing[0].status !== 'PENDING_REVIEW') {
      throw new BadRequestException(
        `Document is not in PENDING_REVIEW status (current: ${existing[0].status})`,
      );
    }

    // Update document
    const query = `
      UPDATE \`DocumentosOficiales\`
      SET 
        \`status\` = 'REJECTED',
        \`action\` = 'reject',
        \`rejection_reason\` = ${this.escapeSql(reason || null)},
        \`approved_by\` = ${this.escapeSql(rejectedBy)},
        \`approved_at\` = NOW()
      WHERE doc_id = ${docId}
    `;

    await this.prisma.$executeRawUnsafe(query);

    this.logger.log(`✅ Document ${docId} rejected by ${rejectedBy}`);

    return { success: true };
  }

  /**
   * Reassign document to different employee
   */
  async reassignDocument(
    docId: number,
    employeeId: string,
    reassignedBy: string,
  ): Promise<{ success: true }> {
    // Verify document exists
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT doc_id, status FROM DocumentosOficiales WHERE doc_id = ${docId} LIMIT 1`,
    );

    if (!existing || existing.length === 0) {
      throw new NotFoundException(`Document with doc_id ${docId} not found`);
    }

    // Update document
    const query = `
      UPDATE \`DocumentosOficiales\`
      SET 
        \`id\` = ${this.escapeSql(employeeId)},
        \`confirmed_empleado_id\` = ${this.escapeSql(employeeId)},
        \`approved_by\` = ${this.escapeSql(reassignedBy)},
        \`approved_at\` = NOW()
      WHERE doc_id = ${docId}
    `;

    await this.prisma.$executeRawUnsafe(query);

    this.logger.log(
      `✅ Document ${docId} reassigned to employee ${employeeId} by ${reassignedBy}`,
    );

    return { success: true };
  }

  /**
   * Escape SQL values
   */
  private escapeSql(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'NULL';
    }
    const escaped = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
}
