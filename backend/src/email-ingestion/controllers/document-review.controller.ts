import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Logger,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { DocumentIngestionService } from '../services/document-ingestion.service';
import { DocumentReviewService } from '../services/document-review.service';
import { DocumentDistributionService } from '../services/document-distribution.service';

@Controller('admin/documents')
@UseGuards(JwtAuthGuard)
export class DocumentReviewController {
  private readonly logger = new Logger(DocumentReviewController.name);

  constructor(
    private readonly ingestionService: DocumentIngestionService,
    private readonly reviewService: DocumentReviewService,
    private readonly distributionService: DocumentDistributionService,
  ) {}

  /**
   * POST /admin/documents/preview-emails
   * Preview emails and extract documents without saving them
   */
  @Post('preview-emails')
  async previewEmails(
    @CurrentUser() user: any,
    @Body()
    body: {
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number;
      subjectFilter?: string | null;
    },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const readStatus = body.readStatus || 'all';
    // If limit is 0 or not provided, use null (no limit)
    const limit =
      body.limit === 0 || body.limit === null || body.limit === undefined
        ? null
        : body.limit || 50;
    const subjectFilter = body.subjectFilter || null;

    this.logger.log(
      `👁️ Email preview triggered by ${user.CODIGO || user.email} (readStatus: ${readStatus}, limit: ${limit}, subjectFilter: ${subjectFilter || 'none'})`,
    );

    const result = await this.ingestionService.previewEmails(
      readStatus,
      limit,
      subjectFilter,
    );

    return result;
  }

  /**
   * POST /admin/documents/save-selected
   * Save selected documents from preview
   */
  @Post('save-selected')
  async saveSelectedDocuments(
    @CurrentUser() user: any,
    @Body()
    body: {
      selectedDocuments?: Array<{
        id: string;
        filename: string;
        normalizedFilename: string;
        contentType: string;
        size: number;
        classification: {
          tipoDocumento: string | null;
          empleadoId: string | null;
          empleadoNombre: string | null;
          confidence: number;
        };
        emailMetadata: {
          subject: string;
          from: string;
          date: string;
          messageId: string;
          attachmentId: string;
        };
        idempotencyKey: string;
      }>;
      selectedIds?: string[]; // Fallback for old API
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number | null;
    },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const limit =
      body.limit === 0 || body.limit === null || body.limit === undefined
        ? null
        : body.limit || 50;

    if (body.selectedDocuments && body.selectedDocuments.length > 0) {
      this.logger.log(
        `💾 Saving ${body.selectedDocuments.length} pre-processed documents by ${user.CODIGO || user.email} (no re-fetch needed)`,
      );
    } else if (body.selectedIds && body.selectedIds.length > 0) {
      this.logger.log(
        `💾 Saving ${body.selectedIds.length} selected documents by ${user.CODIGO || user.email} (will re-fetch from email)`,
      );
    }

    const result = await this.ingestionService.saveSelectedDocuments(
      body.selectedDocuments,
      body.selectedIds,
      body.readStatus || 'all',
      limit,
    );

    return result;
  }

  /**
   * POST /admin/documents/ingest-emails
   * Trigger manual email ingestion (legacy - saves directly without preview)
   */
  @Post('ingest-emails')
  async ingestEmails(
    @CurrentUser() user: any,
    @Body()
    body: {
      readStatus?: 'read' | 'unread' | 'all';
      limit?: number;
      subjectFilter?: string | null;
    },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const readStatus = body.readStatus || 'all';
    // If limit is 0 or not provided, use null (no limit)
    const limit =
      body.limit === 0 || body.limit === null || body.limit === undefined
        ? null
        : body.limit || 50;
    const subjectFilter = body.subjectFilter || null;

    this.logger.log(
      `📧 Email ingestion triggered by ${user.CODIGO || user.email} (readStatus: ${readStatus}, limit: ${limit}, subjectFilter: ${subjectFilter || 'none'})`,
    );

    const result = await this.ingestionService.ingestEmails(
      readStatus,
      limit,
      subjectFilter,
    );

    return {
      success: result.success,
      processed: result.processed,
      inserted: result.inserted,
      skipped: result.skipped,
      details: result.details,
    };
  }

  /**
   * POST /admin/documents/preview-folder
   * Preview folder and extract documents without saving them
   */
  @Post('preview-folder')
  @UseInterceptors(FilesInterceptor('files', 1000)) // Max 1000 files
  async previewFolder(
    @CurrentUser() user: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: any, // Use any to handle FormData properly
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    if (!files || files.length === 0) {
      throw new Error('No files provided');
    }

    // Extract paths from body (sent as form data)
    // FormData sends arrays as multiple fields with same name or as comma-separated string
    const paths: string[] = [];
    const bodyPaths = body.paths;
    if (bodyPaths) {
      if (Array.isArray(bodyPaths)) {
        paths.push(...bodyPaths);
      } else if (typeof bodyPaths === 'string') {
        // Try to parse as JSON array or split by comma
        try {
          const parsed = JSON.parse(bodyPaths);
          if (Array.isArray(parsed)) {
            paths.push(...parsed);
          } else {
            paths.push(bodyPaths);
          }
        } catch {
          // Not JSON, treat as single string or comma-separated
          const pathString: string = bodyPaths;
          paths.push(...pathString.split(',').map((p) => p.trim()));
        }
      }
    }

    // Fallback: try to get from files (webkitRelativePath from directory input)
    if (paths.length === 0 || paths.length !== files.length) {
      paths.length = 0; // Reset if mismatch
      files.forEach((file: any) => {
        const path =
          (file as any).webkitRelativePath ||
          file.originalname ||
          file.name ||
          '';
        paths.push(path);
      });
    }

    this.logger.log(
      `📁 Folder preview triggered by ${user.CODIGO || user.email} (${files.length} files)`,
    );

    const result = await this.ingestionService.previewFolder(files, paths);

    return result;
  }

  /**
   * POST /admin/documents/save-folder-documents
   * Save selected documents from folder preview
   */
  @Post('save-folder-documents')
  async saveFolderDocuments(
    @CurrentUser() user: any,
    @Body()
    body: {
      selectedDocuments: Array<{
        id: string;
        filename: string;
        normalizedFilename: string;
        contentType: string;
        size: number;
        classification: {
          tipoDocumento: string | null;
          empleadoId: string | null;
          empleadoNombre: string | null;
          confidence: number;
        };
        folderMetadata: {
          folderPath: string;
          folderName: string;
          subfolderName?: string;
          employeeFolderName?: string | null;
        };
        idempotencyKey: string;
        contentBase64?: string; // Base64 encoded content from frontend
        content?: string; // Alternative field name for content
      }>;
    },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    if (!body.selectedDocuments || body.selectedDocuments.length === 0) {
      return { success: true, saved: 0, skipped: 0, errors: 0 };
    }

    this.logger.log(
      `💾 Saving ${body.selectedDocuments.length} folder documents by ${user.CODIGO || user.email}`,
    );

    // Note: Content should be re-fetched from preview cache or sent separately
    // For now, we'll need to modify the service to accept content from preview
    // Since preview already has content, we'll need to store it temporarily or send it back
    // For simplicity, we'll require content to be sent in the request
    // In a production system, you might want to use Redis or similar for temporary storage

    const result = await this.ingestionService.saveFolderDocuments(
      body.selectedDocuments as any, // Type assertion - content should be included
    );

    return result;
  }

  /**
   * GET /admin/documents/pending
   * Get pending documents for review
   * IMPORTANT: Must be before routes with :id parameter
   */
  @Get('pending')
  async getPendingDocuments(@CurrentUser() user: any) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const documents = await this.reviewService.getPendingDocuments();

    return {
      success: true,
      count: documents.length,
      documents,
    };
  }

  /**
   * POST /admin/documents/:id/approve
   * Approve document and assign to employee
   * IMPORTANT: Routes with :id parameter must be AFTER static routes
   */
  @Post(':id/approve')
  async approveDocument(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) docId: number,
    @Body()
    body: {
      employeeId: string;
      documentType: string;
      action: 'send' | 'archive';
    },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const approvedBy = user.CODIGO || user.email || 'unknown';

    await this.reviewService.approveDocument(
      docId,
      body.employeeId,
      body.documentType,
      body.action,
      approvedBy,
    );

    // If action is 'send', distribute the document
    if (body.action === 'send') {
      await this.distributionService.distributeDocument(docId);
    }

    return { success: true, message: 'Document approved and distributed' };
  }

  /**
   * POST /admin/documents/:id/reject
   * Reject document
   */
  @Post(':id/reject')
  async rejectDocument(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) docId: number,
    @Body() body: { reason?: string },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const rejectedBy = user.CODIGO || user.email || 'unknown';

    await this.reviewService.rejectDocument(
      docId,
      body.reason || null,
      rejectedBy,
    );

    return { success: true, message: 'Document rejected' };
  }

  /**
   * POST /admin/documents/:id/reassign
   * Reassign document to different employee
   */
  @Post(':id/reassign')
  async reassignDocument(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) docId: number,
    @Body() body: { employeeId: string },
  ) {
    // Check if user is admin
    const grupo = user.GRUPO || user.grupo || '';
    const isAdmin =
      grupo === 'Admin' ||
      grupo === 'Developer' ||
      grupo === 'Manager' ||
      grupo === 'Supervisor';

    if (!isAdmin) {
      throw new Error('Unauthorized: Admin access required');
    }

    const reassignedBy = user.CODIGO || user.email || 'unknown';

    await this.reviewService.reassignDocument(
      docId,
      body.employeeId,
      reassignedBy,
    );

    return { success: true, message: 'Document reassigned' };
  }
}
