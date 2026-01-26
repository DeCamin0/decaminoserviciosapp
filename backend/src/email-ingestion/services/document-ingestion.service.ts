import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ImapConnector } from '../connectors/imap.connector';
import { EmailMessage } from '../interfaces/email-connector.interface';
import { classifyDocument } from '../utils/document-classifier.util';
import { EmpleadosService } from '../../services/empleados.service';
import * as pdfParseModule from 'pdf-parse';
import * as crypto from 'crypto';

@Injectable()
export class DocumentIngestionService {
  private readonly logger = new Logger(DocumentIngestionService.name);

  // List of email addresses to exclude from ingestion
  private readonly excludedSenders = [
    'ruben@aurahogar.es',
    // Add more excluded senders here if needed
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly imapConnector: ImapConnector,
    private readonly empleadosService: EmpleadosService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Preview emails and extract documents without saving them
   * Returns list of documents for user to review before saving
   * @param readStatus - 'read', 'unread', or 'all'
   * @param limit - Maximum number of messages to process (null or 0 = no limit)
   */
  async previewEmails(
    readStatus: 'read' | 'unread' | 'all',
    limit: number | null = 50,
    subjectFilter?: string | null,
  ): Promise<{
    success: boolean;
    messagesFetched: number;
    documents: Array<{
      id: string; // Temporary ID for selection
      filename: string;
      normalizedFilename: string;
      contentType: string;
      size: number;
      preview?: string; // Base64 thumbnail for images or text preview for PDFs
      classification: {
        tipoDocumento: string | null;
        empleadoId: string | null;
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
      isDuplicate: boolean; // Whether this document already exists in DB
    }>;
  }> {
    if (!this.imapConnector.isConfigured()) {
      throw new BadRequestException(
        'IMAP not configured. Set SMTP_USER, SMTP_PASSWORD, and optionally IMAP_HOST, IMAP_PORT.',
      );
    }

    const documents: any[] = [];
    let messages: EmailMessage[] = [];

    try {
      // Connect to IMAP
      await this.imapConnector.connect();

      // Fetch messages
      messages = await this.imapConnector.fetchMessages(
        readStatus,
        limit,
        true,
        subjectFilter,
      );

      this.logger.log(
        `📧 Previewing ${messages.length} messages (readStatus: ${readStatus}, subjectFilter: ${subjectFilter || 'none'})`,
      );

      // Process each message
      for (const message of messages) {
        try {
          // Skip messages from excluded senders
          if (this.isExcludedSender(message.from)) {
            this.logger.log(
              `⏭️ Skipping message from excluded sender: ${message.from}`,
            );
            continue;
          }

          // Process each attachment
          for (const attachment of message.attachments) {
            // Generate idempotency key
            const idempotencyKey = this.generateIdempotencyKey(
              message.messageId,
              attachment.attachmentId,
            );

            // Check if document already exists (idempotency)
            const existing = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT doc_id FROM DocumentosOficiales WHERE idempotency_key = ${this.escapeSql(idempotencyKey)} LIMIT 1`,
            );

            let isDuplicate = existing && existing.length > 0;

            // Also check by filename + size (catches same file sent in different emails)
            if (!isDuplicate) {
              isDuplicate = await this.checkDuplicateByFilenameAndSize(
                attachment.filename,
                attachment.size,
              );
              if (isDuplicate) {
                this.logger.log(
                  `🔍 Duplicate detected by filename + size: ${attachment.filename} (${attachment.size} bytes)`,
                );
              }
            }

            // Classify document
            const classification = await classifyDocument(
              attachment.filename,
              message.subject,
              attachment.contentType.startsWith('application/pdf')
                ? attachment.content
                : undefined,
            );

            // PRIORITY 1: Try to find employee by DNI/NIE or Social Security Number (more reliable than name)
            if (!classification.empleadoId) {
              // Try DNI/NIE first
              if (classification.dniNie) {
                try {
                  const empleadoCodigo = await this.findEmpleadoByDNINIE(
                    classification.dniNie,
                  );
                  if (empleadoCodigo) {
                    classification.empleadoId = empleadoCodigo;
                    classification.confidence = Math.min(
                      classification.confidence + 0.4,
                      1.0,
                    ); // Very high confidence
                    this.logger.log(
                      `✅ Found empleado code ${empleadoCodigo} by DNI/NIE "${classification.dniNie}" (preview)`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error finding empleado by DNI/NIE "${classification.dniNie}" (preview): ${error.message}`,
                  );
                }
              }

              // Try Social Security Number if DNI/NIE didn't work
              if (!classification.empleadoId && classification.segSocial) {
                try {
                  const empleadoCodigo = await this.findEmpleadoBySegSocial(
                    classification.segSocial,
                  );
                  if (empleadoCodigo) {
                    classification.empleadoId = empleadoCodigo;
                    classification.confidence = Math.min(
                      classification.confidence + 0.4,
                      1.0,
                    ); // Very high confidence
                    this.logger.log(
                      `✅ Found empleado code ${empleadoCodigo} by Seg. Social "${classification.segSocial}" (preview)`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error finding empleado by Seg. Social "${classification.segSocial}" (preview): ${error.message}`,
                  );
                }
              }
            }

            // PRIORITY 2: If we extracted employee name, find code by name in database (for preview)
            // NOTE: We NEVER extract empleadoId from documents - codes only exist in database
            // We extract names from documents, then look up codes in database
            if (classification.empleadoNombre && !classification.empleadoId) {
              this.logger.log(
                `🔍 PRIORITY 2: Looking up empleado by name "${classification.empleadoNombre}" (tipo: ${classification.tipoDocumento}, empleadoId: ${classification.empleadoId || 'null'})`,
              );

              try {
                const empleadoCodigo = await this.findEmpleadoByNombre(
                  classification.empleadoNombre,
                );
                if (empleadoCodigo) {
                  // Validate: check if the DB name matches the extracted name
                  const empleadoNombreFromDb =
                    await this.getEmpleadoNombreByCodigo(empleadoCodigo);
                  if (empleadoNombreFromDb) {
                    const extractedNameNormalized =
                      classification.empleadoNombre.trim().toUpperCase();
                    const dbNameNormalized = empleadoNombreFromDb
                      .trim()
                      .toUpperCase();

                    // Check if names match (exact or contains all words, or majority of words match)
                    const extractedWords = extractedNameNormalized
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);
                    const dbWords = dbNameNormalized
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);

                    // Match if: exact match OR all extracted words are in DB name OR all DB words are in extracted name
                    const exactMatch =
                      extractedNameNormalized === dbNameNormalized;
                    const allExtractedWordsInDb =
                      extractedWords.length > 0 &&
                      extractedWords.every((word) =>
                        dbNameNormalized.includes(word),
                      );
                    const allDbWordsInExtracted =
                      dbWords.length > 0 &&
                      dbWords.every((word) =>
                        extractedNameNormalized.includes(word),
                      );

                    // Helper function to normalize accents (Á -> A, É -> E, etc.)
                    const normalizeAccents = (str: string): string => {
                      return str
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                        .toUpperCase();
                    };

                    // Normalize both names for comparison (to handle accents)
                    const extractedNameNormalizedForCompare = normalizeAccents(
                      extractedNameNormalized,
                    );
                    const dbNameNormalizedForCompare =
                      normalizeAccents(dbNameNormalized);

                    // Flexible matching: if majority of words match (at least 50% or minimum 2 words), accept it
                    // This handles cases like "AMILCAR ESTEBAN VENTURA MORENO" matching "VENTURA AMILCAR ESTEBAN"
                    // where one name has an extra word (like "MORENO")
                    // Also handles cases like "JORGE EDUARDO HERAS MATOCHE" matching "ERAS MOTOCHE JORGE EDUARDO"
                    // where 2/4 words match (50%) and word count is similar
                    // IMPORTANT: Use normalized versions for comparison to handle accents (HERNÁNDEZ = HERNANDEZ)
                    let majorityMatch = false;
                    if (extractedWords.length >= 2 && dbWords.length >= 2) {
                      // Count exact matches using normalized versions
                      const extractedWordsInDb = extractedWords.filter(
                        (word) => {
                          const wordNormalized = normalizeAccents(word);
                          return dbNameNormalizedForCompare.includes(
                            wordNormalized,
                          );
                        },
                      ).length;
                      const dbWordsInExtracted = dbWords.filter((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return extractedNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      }).length;

                      // Also check for similar words (e.g., "YURLEDINSON" ≈ "YURLENDINSON")
                      let similarWordsCount = 0;
                      for (const extractedWord of extractedWords) {
                        const extractedWordNormalized =
                          normalizeAccents(extractedWord);
                        // Skip if already matched exactly
                        if (
                          dbNameNormalizedForCompare.includes(
                            extractedWordNormalized,
                          )
                        )
                          continue;

                        for (const dbWord of dbWords) {
                          const dbWordNormalized = normalizeAccents(dbWord);
                          // Skip if already matched exactly
                          if (
                            extractedNameNormalizedForCompare.includes(
                              dbWordNormalized,
                            )
                          )
                            continue;

                          // Check if normalized versions are identical (handles accents)
                          if (extractedWordNormalized === dbWordNormalized) {
                            similarWordsCount++;
                            break;
                          }

                          // Check if words are similar (typos, etc.)
                          if (
                            Math.abs(extractedWord.length - dbWord.length) <= 2
                          ) {
                            const shorter = Math.min(
                              extractedWord.length,
                              dbWord.length,
                            );
                            let commonChars = 0;
                            for (let i = 0; i < shorter; i++) {
                              if (
                                normalizeAccents(extractedWord[i]) ===
                                normalizeAccents(dbWord[i])
                              )
                                commonChars++;
                              else break;
                            }
                            const oneContainsOther =
                              extractedWordNormalized.includes(
                                dbWordNormalized,
                              ) ||
                              dbWordNormalized.includes(
                                extractedWordNormalized,
                              );
                            if (commonChars >= 4 || oneContainsOther) {
                              similarWordsCount++;
                              break;
                            }
                          }
                        }
                      }

                      // Calculate minimum words needed: at least 2 words, or 50% of words (whichever is higher)
                      const minWordsToMatch = Math.max(
                        2,
                        Math.min(extractedWords.length, dbWords.length) * 0.5,
                      );

                      // Accept if exact matches + similar words >= minWordsToMatch
                      const effectiveMatchCount =
                        extractedWordsInDb + similarWordsCount;
                      const effectiveDbMatchCount =
                        dbWordsInExtracted + similarWordsCount;

                      // Accept if at least 50% of words match in both directions
                      // OR if at least 2 words match (exact + similar) and the total word count is similar
                      const wordCountSimilar =
                        Math.abs(extractedWords.length - dbWords.length) <= 1;
                      majorityMatch =
                        (extractedWordsInDb >= minWordsToMatch &&
                          dbWordsInExtracted >= minWordsToMatch) ||
                        (effectiveMatchCount >= 2 &&
                          effectiveDbMatchCount >= 1) ||
                        (effectiveMatchCount >= minWordsToMatch &&
                          effectiveDbMatchCount >= minWordsToMatch) ||
                        (effectiveMatchCount >= 2 &&
                          effectiveDbMatchCount >= 2 &&
                          wordCountSimilar) ||
                        (extractedWordsInDb >= 1 &&
                          similarWordsCount >= 1 &&
                          effectiveMatchCount >= 2) ||
                        (similarWordsCount >= 2 &&
                          extractedWords.length === dbWords.length) ||
                        (extractedWordsInDb >= 2 &&
                          dbWordsInExtracted >= 2 &&
                          wordCountSimilar);

                      this.logger.log(
                        `🔍 Name matching (preview): extracted="${extractedNameNormalized}" (${extractedWords.length} words), db="${dbNameNormalized}" (${dbWords.length} words), extractedWordsInDb=${extractedWordsInDb}, dbWordsInExtracted=${dbWordsInExtracted}, similarWords=${similarWordsCount}, effectiveMatchCount=${effectiveMatchCount}, minWordsToMatch=${minWordsToMatch}, wordCountSimilar=${wordCountSimilar}, majorityMatch=${majorityMatch}`,
                      );
                    }

                    if (
                      exactMatch ||
                      allExtractedWordsInDb ||
                      allDbWordsInExtracted ||
                      majorityMatch
                    ) {
                      // Good match - use this code
                      classification.empleadoId = empleadoCodigo;
                      (classification as any).empleadoNombreFromDb =
                        empleadoNombreFromDb;
                      // Increase confidence when we successfully find code by name and verify match
                      classification.confidence = Math.min(
                        classification.confidence + 0.3,
                        1.0,
                      );
                      this.logger.log(
                        `✅ Found and verified empleado code ${empleadoCodigo} for name "${classification.empleadoNombre}" -> DB: "${empleadoNombreFromDb}" (preview, match type: ${exactMatch ? 'exact' : allExtractedWordsInDb ? 'allExtractedInDb' : allDbWordsInExtracted ? 'allDbInExtracted' : 'majority'})`,
                      );
                    } else {
                      // Names don't match - don't use this code
                      this.logger.warn(
                        `⚠️ Found code ${empleadoCodigo} for "${classification.empleadoNombre}" but DB name "${empleadoNombreFromDb}" doesn't match - rejecting code (preview)`,
                      );
                      // Don't set empleadoId - keep it null
                    }
                  } else {
                    // Couldn't get DB name - use code but with lower confidence
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `🔍 Found empleado code ${empleadoCodigo} for name "${classification.empleadoNombre}" but couldn't verify DB name (preview)`,
                    );
                  }
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error finding empleado by name "${classification.empleadoNombre}" (preview): ${error.message}`,
                );
              }
            }

            // FALLBACK: If we still don't have empleadoId, try to extract name from email subject and find code by name
            // This handles cases where the PDF has a typo in the name (e.g., "HERAS" instead of "ERAS")
            // Pattern: "ALTA OPERARIA/O: 147 ERAS MOTOCHE JORGE EDUARDO" -> extract name "ERAS MOTOCHE JORGE EDUARDO" and find code by name
            // Check both null/undefined and empty string
            const hasNoEmpleadoId =
              !classification.empleadoId ||
              classification.empleadoId.trim() === '';
            if (hasNoEmpleadoId && message.subject) {
              this.logger.log(
                `🔍 Fallback (preview): Attempting to extract name from subject. Current empleadoId: ${classification.empleadoId || 'null'}, subject: "${message.subject}"`,
              );
              try {
                // Extract name from subject: multiple patterns
                // Pattern 1: "ALTA OPERARIA/O: 147 ERAS MOTOCHE JORGE EDUARDO"
                // Pattern 2: "ALTA OPERARIA SOFIA BITLAN - 09.06.2025" (without "OPERARIA/O:" and colon)
                // Pattern 3: "CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES"
                // Patterns work even with "Re: " prefix because regex searches anywhere in string
                let subjectNameMatch = message.subject.match(
                  /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
                );
                let nombreFromSubject = subjectNameMatch
                  ? subjectNameMatch[1].trim()
                  : null;

                // Pattern 2: "ALTA OPERARIA SOFIA BITLAN - 09.06.2025" (without "OPERARIA/O:" and colon)
                if (!nombreFromSubject) {
                  subjectNameMatch = message.subject.match(
                    /ALTA\s+OPERARIA\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s*-\s*\d{2}\.\d{2}\.\d{4}|\s*$)/i,
                  );
                  nombreFromSubject = subjectNameMatch
                    ? subjectNameMatch[1].trim()
                    : null;
                }

                // Pattern 3: "CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES" or "Re: CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES"
                if (!nombreFromSubject) {
                  subjectNameMatch = message.subject.match(
                    /CARTA\s+DESPIDO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s*$)/i,
                  );
                  if (subjectNameMatch) {
                    nombreFromSubject = subjectNameMatch[1].trim();
                    // Validate that it looks like a name (not an address or other false positive)
                    const nameWords = nombreFromSubject
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);
                    if (
                      !(
                        nameWords.length >= 2 &&
                        nameWords.length <= 5 &&
                        !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(
                          nombreFromSubject,
                        )
                      )
                    ) {
                      nombreFromSubject = null; // Reject if doesn't look like a name
                    }
                  }
                }

                this.logger.log(
                  `🔍 Fallback (preview): Regex match result: ${nombreFromSubject ? `found name: ${nombreFromSubject}` : 'no match'}`,
                );
                if (nombreFromSubject) {
                  this.logger.log(
                    `🔍 Fallback (preview): Extracted name from email subject: "${nombreFromSubject}" (subject: "${message.subject}")`,
                  );

                  // Find code by name (more reliable than trying to match short code from subject)
                  const empleadoCodigoFromSubject =
                    await this.findEmpleadoByNombre(nombreFromSubject);
                  if (empleadoCodigoFromSubject) {
                    // Verify that this code exists in database
                    const empleadoNombreFromSubjectCheck =
                      await this.getEmpleadoNombreByCodigo(
                        empleadoCodigoFromSubject,
                      );
                    if (empleadoNombreFromSubjectCheck) {
                      classification.empleadoId = empleadoCodigoFromSubject;
                      // Increase confidence when we successfully find code from subject
                      classification.confidence = Math.min(
                        classification.confidence + 0.2,
                        1.0,
                      );
                      this.logger.log(
                        `✅ Fallback (preview): Using code ${empleadoCodigoFromSubject} from email subject name lookup (DB name: "${empleadoNombreFromSubjectCheck}")`,
                      );

                      // Update empleadoNombre to use the name from subject (correct name)
                      classification.empleadoNombre = nombreFromSubject;
                      (classification as any).empleadoNombreFromDb =
                        empleadoNombreFromSubjectCheck;
                    } else {
                      this.logger.warn(
                        `⚠️ Fallback (preview): Code ${empleadoCodigoFromSubject} from subject name lookup not found in database`,
                      );
                    }
                  } else {
                    this.logger.warn(
                      `⚠️ Fallback (preview): Could not find code for name "${nombreFromSubject}" from subject`,
                    );
                  }
                } else {
                  this.logger.warn(
                    `⚠️ Fallback (preview): Could not extract name from subject. Subject: "${message.subject}"`,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error in fallback extraction from subject (preview): ${error.message}`,
                );
              }
            }

            // Reduce confidence if we still don't have empleadoId after all attempts
            if (
              !classification.empleadoId &&
              classification.confidence >= 0.9
            ) {
              // If confidence was high (90%+) but we couldn't find the employee code, reduce it
              classification.confidence = 0.7; // Still decent confidence for document type, but lower for employee association
              this.logger.log(
                `⚠️ Reduced confidence from ${classification.confidence + 0.3}% to 70% because empleadoId not found`,
              );
            }

            // If we have empleadoId but haven't set empleadoNombreFromDb yet, get it from database (for preview)
            if (
              classification.empleadoId &&
              !(classification as any).empleadoNombreFromDb
            ) {
              try {
                const empleadoNombreFromDb =
                  await this.getEmpleadoNombreByCodigo(
                    classification.empleadoId,
                  );
                if (empleadoNombreFromDb) {
                  // Store both: extracted name (for reference) and DB name (for display)
                  (classification as any).empleadoNombreFromDb =
                    empleadoNombreFromDb;
                  // Increase confidence when we successfully verify name in database (high confidence = verified match)
                  classification.confidence = Math.min(
                    classification.confidence + 0.2,
                    1.0,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error getting empleado name from DB for code "${classification.empleadoId}" (preview): ${error.message}`,
                );
              }
            }

            // Skip nomina documents (processed manually)
            // Finiquito documents are now accepted for automatic processing
            const isNomina = classification.tipoDocumento === 'nomina';

            if (isNomina) {
              this.logger.log(
                `⏭️ Skipping nomina document (processed manually): ${attachment.filename}`,
              );
              continue;
            }

            // Normalize filename
            const normalizedFilename = this.normalizeFilename(
              attachment.filename,
            );

            // Generate preview (thumbnail for images, text preview for PDFs)
            let preview: string | undefined;
            try {
              if (attachment.contentType.startsWith('image/')) {
                // For images, create base64 thumbnail (max 200x200)
                // For now, just use the full image as base64 (can optimize later with image resizing)
                preview = `data:${attachment.contentType};base64,${attachment.content.toString('base64')}`;
              } else if (attachment.contentType === 'application/pdf') {
                // For PDFs, extract first 500 characters of text
                try {
                  const PDFParse = pdfParseModule.PDFParse;
                  const pdfInstance = new PDFParse({
                    data: new Uint8Array(attachment.content),
                  });
                  const textResult = await pdfInstance.getText();
                  const pdfText =
                    textResult &&
                    typeof textResult === 'object' &&
                    'text' in textResult
                      ? textResult.text
                      : typeof textResult === 'string'
                        ? textResult
                        : '';
                  preview =
                    pdfText.substring(0, 500) +
                    (pdfText.length > 500 ? '...' : '');
                } catch {
                  preview = '[PDF - No text preview available]';
                }
              }
            } catch (e) {
              // Preview generation failed, continue without it
              this.logger.warn(
                `⚠️ Failed to generate preview for ${attachment.filename}: ${e.message}`,
              );
            }

            // Get employee name from database for preview (if we have empleadoId)
            let empleadoNombreFromDb: string | null = null;
            if (classification.empleadoId) {
              try {
                empleadoNombreFromDb = await this.getEmpleadoNombreByCodigo(
                  classification.empleadoId,
                );
              } catch {
                // Silently fail - we'll use extracted name as fallback
              }
            }

            documents.push({
              id: idempotencyKey, // Use idempotency key as temporary ID
              filename: attachment.filename,
              normalizedFilename,
              contentType: attachment.contentType,
              size: attachment.size,
              preview,
              classification: {
                tipoDocumento: classification.tipoDocumento,
                empleadoId: classification.empleadoId,
                empleadoNombre: classification.empleadoNombre,
                empleadoNombreFromDb: empleadoNombreFromDb, // Name from database
                confidence: classification.confidence,
              },
              emailMetadata: {
                subject: message.subject,
                from: message.from,
                date: message.date.toISOString(),
                messageId: message.messageId,
                attachmentId: attachment.attachmentId,
              },
              idempotencyKey,
              isDuplicate,
            });
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error processing message ${message.messageId}: ${error.message}`,
          );
          // Continue with next message
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Error during email preview: ${error.message}`);
      throw new BadRequestException(`Email preview failed: ${error.message}`);
    } finally {
      // Disconnect from IMAP
      try {
        await this.imapConnector.disconnect();
      } catch (error: any) {
        this.logger.warn(`⚠️ Error disconnecting from IMAP: ${error.message}`);
      }
    }

    return {
      success: true,
      messagesFetched: messages.length,
      documents,
    };
  }

  /**
   * Save selected documents from preview
   * @param selectedDocuments - Array of document objects from preview (with classification, metadata, etc.)
   *                            If provided, uses these instead of re-fetching from email
   * @param selectedIds - Array of document IDs (idempotency keys) to save (fallback if selectedDocuments not provided)
   * @param readStatus - Same readStatus used in preview (for re-fetching if selectedDocuments not provided)
   * @param limit - Same limit used in preview (for re-fetching if selectedDocuments not provided)
   */
  async saveSelectedDocuments(
    selectedDocuments?: Array<{
      id: string;
      filename: string;
      normalizedFilename: string;
      contentType: string;
      size: number;
      content?: Buffer; // Optional - will be re-fetched from email if not provided
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
    }>,
    selectedIds?: string[],
    readStatus?: 'read' | 'unread' | 'all',
    limit?: number | null,
  ): Promise<{
    success: boolean;
    saved: number;
    skipped: number;
    errors: number;
  }> {
    if (!selectedDocuments && (!selectedIds || selectedIds.length === 0)) {
      return { success: true, saved: 0, skipped: 0, errors: 0 };
    }

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    // If we have pre-processed documents from preview, re-fetch only selected attachments
    if (selectedDocuments && selectedDocuments.length > 0) {
      this.logger.log(
        `💾 Saving ${selectedDocuments.length} pre-processed documents (re-fetching only selected attachments)`,
      );

      // Debug: Log classification data from preview
      for (const doc of selectedDocuments) {
        this.logger.log(
          `📋 Preview data for ${doc.filename}: empleadoId=${doc.classification.empleadoId}, empleadoNombre=${doc.classification.empleadoNombre}, tipo=${doc.classification.tipoDocumento}`,
        );
      }

      if (!this.imapConnector.isConfigured()) {
        throw new BadRequestException(
          'IMAP not configured. Set SMTP_USER, SMTP_PASSWORD, and optionally IMAP_HOST, IMAP_PORT.',
        );
      }

      try {
        // Connect to IMAP
        await this.imapConnector.connect();

        // Group documents by messageId to optimize fetching
        const documentsByMessageId = new Map<
          string,
          typeof selectedDocuments
        >();
        for (const doc of selectedDocuments) {
          const messageId = doc.emailMetadata.messageId;
          if (!documentsByMessageId.has(messageId)) {
            documentsByMessageId.set(messageId, []);
          }
          documentsByMessageId.get(messageId)!.push(doc);
        }

        this.logger.log(
          `📧 Re-fetching ${documentsByMessageId.size} unique messages (instead of all messages)`,
        );

        // Fetch messages WITHOUT attachments first (faster)
        const allMessages = await this.imapConnector.fetchMessages(
          readStatus || 'all',
          limit || null,
          false,
          null,
        );

        // Filter only messages that contain selected documents
        const neededMessageIds = Array.from(documentsByMessageId.keys());
        const filteredMessages = allMessages.filter((msg) =>
          neededMessageIds.includes(msg.messageId),
        );

        this.logger.log(
          `📧 Filtered ${filteredMessages.length} messages from ${allMessages.length} total (needed: ${neededMessageIds.length})`,
        );

        // Extract attachments only for filtered messages
        for (const message of filteredMessages) {
          try {
            const attachments =
              await this.imapConnector.extractAttachmentsForMessage(
                message as any,
              );
            message.attachments = attachments;
            if (attachments.length > 0) {
              this.logger.log(
                `📎 Extracted ${attachments.length} attachment(s) from message: ${message.subject}`,
              );
            }
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Error extracting attachments for message ${message.messageId}: ${error.message}`,
            );
            message.attachments = [];
          }
        }

        // Create a map of messageId -> message for fast lookup
        const messageMap = new Map<string, (typeof filteredMessages)[0]>();
        for (const message of filteredMessages) {
          messageMap.set(message.messageId, message);
        }

        // Track which messages had documents saved successfully (for moving to "Extrase")
        const messagesWithSavedDocuments = new Set<string>();

        // Process each selected document
        for (const doc of selectedDocuments) {
          try {
            // Check if document already exists (idempotency)
            const existing = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT doc_id FROM DocumentosOficiales WHERE idempotency_key = ${this.escapeSql(doc.idempotencyKey)} LIMIT 1`,
            );

            let isDuplicate = existing && existing.length > 0;

            // Also check by filename + size (catches same file sent in different emails)
            if (!isDuplicate) {
              isDuplicate = await this.checkDuplicateByFilenameAndSize(
                doc.filename,
                doc.size,
              );
            }

            if (isDuplicate) {
              this.logger.log(
                `⏭️ Skipping duplicate document: ${doc.filename} (idempotency_key: ${doc.idempotencyKey})`,
              );
              skipped++;
              continue;
            }

            // Find the message and attachment
            const message = messageMap.get(doc.emailMetadata.messageId);
            if (!message) {
              this.logger.warn(
                `⚠️ Message not found for document ${doc.filename} (messageId: ${doc.emailMetadata.messageId})`,
              );
              errors++;
              continue;
            }

            // Find the attachment
            const attachment = message.attachments.find(
              (att) => att.attachmentId === doc.emailMetadata.attachmentId,
            );

            if (!attachment || !attachment.content) {
              this.logger.warn(
                `⚠️ Attachment not found or no content for document ${doc.filename}`,
              );
              errors++;
              continue;
            }

            // Use classification from preview (already processed)
            const classification = { ...doc.classification };

            // PRIORITY 1: Try to find employee by DNI/NIE or Social Security Number (more reliable than name)
            if (!classification.empleadoId) {
              // Try DNI/NIE first
              if ((classification as any).dniNie) {
                try {
                  const empleadoCodigo = await this.findEmpleadoByDNINIE(
                    (classification as any).dniNie,
                  );
                  if (empleadoCodigo) {
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `✅ Found empleado code ${empleadoCodigo} by DNI/NIE "${(classification as any).dniNie}"`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error finding empleado by DNI/NIE "${(classification as any).dniNie}": ${error.message}`,
                  );
                }
              }

              // Try Social Security Number if DNI/NIE didn't work
              if (
                !classification.empleadoId &&
                (classification as any).segSocial
              ) {
                try {
                  const empleadoCodigo = await this.findEmpleadoBySegSocial(
                    (classification as any).segSocial,
                  );
                  if (empleadoCodigo) {
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `✅ Found empleado code ${empleadoCodigo} by Seg. Social "${(classification as any).segSocial}"`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error finding empleado by Seg. Social "${(classification as any).segSocial}": ${error.message}`,
                  );
                }
              }
            }

            // PRIORITY 2: If we extracted employee name but not code, find code by name in database
            // NOTE: We NEVER extract empleadoId from documents - codes only exist in database
            // We extract names from documents, then look up codes in database
            if (classification.empleadoNombre && !classification.empleadoId) {
              try {
                const empleadoCodigo = await this.findEmpleadoByNombre(
                  classification.empleadoNombre,
                );
                if (empleadoCodigo) {
                  // Validate: check if the DB name matches the extracted name
                  const empleadoNombreFromDbCheck =
                    await this.getEmpleadoNombreByCodigo(empleadoCodigo);
                  if (empleadoNombreFromDbCheck) {
                    const extractedNameNormalized =
                      classification.empleadoNombre.trim().toUpperCase();
                    const dbNameNormalized = empleadoNombreFromDbCheck
                      .trim()
                      .toUpperCase();

                    // Helper function to normalize accents (Á -> A, É -> E, etc.)
                    const normalizeAccents = (str: string): string => {
                      return str
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                        .toUpperCase();
                    };

                    // Normalize both names for comparison (to handle accents)
                    const extractedNameNormalizedForCompare = normalizeAccents(
                      extractedNameNormalized,
                    );
                    const dbNameNormalizedForCompare =
                      normalizeAccents(dbNameNormalized);

                    // Check if names match (exact or contains all words, or majority of words match)
                    const extractedWords = extractedNameNormalized
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);
                    const dbWords = dbNameNormalized
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);

                    // Match if: exact match OR all extracted words are in DB name OR all DB words are in extracted name (normalized)
                    const exactMatch =
                      extractedNameNormalizedForCompare ===
                      dbNameNormalizedForCompare;
                    const allExtractedWordsInDb =
                      extractedWords.length > 0 &&
                      extractedWords.every((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return dbNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      });
                    const allDbWordsInExtracted =
                      dbWords.length > 0 &&
                      dbWords.every((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return extractedNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      });

                    // Flexible matching: if majority of words match (at least 2/3 or 3/4), accept it
                    // This handles cases like "AMILCAR ESTEBAN VENTURA MORENO" matching "VENTURA AMILCAR ESTEBAN"
                    // where one name has an extra word (like "MORENO")
                    // Also handles cases like "JORGE EDUARDO HERAS MATOCHE" matching "ERAS MOTOCHE JORGE EDUARDO"
                    // where words are similar but not exact (HERAS vs ERAS, MATOCHE vs MOTOCHE)
                    // IMPORTANT: Use normalized versions for comparison to handle accents (HERNÁNDEZ = HERNANDEZ)
                    let majorityMatch = false;
                    if (extractedWords.length >= 2 && dbWords.length >= 2) {
                      // Count exact matches using normalized versions
                      const extractedWordsInDb = extractedWords.filter(
                        (word) => {
                          const wordNormalized = normalizeAccents(word);
                          return dbNameNormalizedForCompare.includes(
                            wordNormalized,
                          );
                        },
                      ).length;
                      const dbWordsInExtracted = dbWords.filter((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return extractedNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      }).length;

                      // Also check for similar words (e.g., "YURLEDINSON" ≈ "YURLENDINSON")
                      let similarWordsCount = 0;
                      for (const extractedWord of extractedWords) {
                        const extractedWordNormalized =
                          normalizeAccents(extractedWord);
                        // Skip if already matched exactly
                        if (
                          dbNameNormalizedForCompare.includes(
                            extractedWordNormalized,
                          )
                        )
                          continue;

                        for (const dbWord of dbWords) {
                          const dbWordNormalized = normalizeAccents(dbWord);
                          // Skip if already matched exactly
                          if (
                            extractedNameNormalizedForCompare.includes(
                              dbWordNormalized,
                            )
                          )
                            continue;

                          // Check if normalized versions are identical (handles accents)
                          if (extractedWordNormalized === dbWordNormalized) {
                            similarWordsCount++;
                            break;
                          }

                          // Check if words are similar (typos, etc.)
                          if (
                            Math.abs(extractedWord.length - dbWord.length) <= 2
                          ) {
                            const shorter = Math.min(
                              extractedWord.length,
                              dbWord.length,
                            );
                            let commonChars = 0;
                            for (let i = 0; i < shorter; i++) {
                              if (
                                normalizeAccents(extractedWord[i]) ===
                                normalizeAccents(dbWord[i])
                              )
                                commonChars++;
                              else break;
                            }
                            const oneContainsOther =
                              extractedWordNormalized.includes(
                                dbWordNormalized,
                              ) ||
                              dbWordNormalized.includes(
                                extractedWordNormalized,
                              );
                            if (commonChars >= 4 || oneContainsOther) {
                              similarWordsCount++;
                              break;
                            }
                          }
                        }
                      }

                      // Calculate minimum words needed: at least 2 words, or 50% of words (whichever is higher)
                      const minWordsToMatch = Math.max(
                        2,
                        Math.min(extractedWords.length, dbWords.length) * 0.5,
                      );

                      // Accept if exact matches + similar words >= minWordsToMatch
                      const effectiveMatchCount =
                        extractedWordsInDb + similarWordsCount;
                      const effectiveDbMatchCount =
                        dbWordsInExtracted + similarWordsCount;

                      // Accept if at least 50% of words match in both directions
                      // OR if at least 2 words match (exact + similar) and the total word count is similar
                      const wordCountSimilar =
                        Math.abs(extractedWords.length - dbWords.length) <= 1;
                      majorityMatch =
                        (extractedWordsInDb >= minWordsToMatch &&
                          dbWordsInExtracted >= minWordsToMatch) ||
                        (effectiveMatchCount >= 2 &&
                          effectiveDbMatchCount >= 1) ||
                        (effectiveMatchCount >= minWordsToMatch &&
                          effectiveDbMatchCount >= minWordsToMatch) ||
                        (effectiveMatchCount >= 2 &&
                          effectiveDbMatchCount >= 2 &&
                          wordCountSimilar) ||
                        (extractedWordsInDb >= 1 &&
                          similarWordsCount >= 1 &&
                          effectiveMatchCount >= 2) ||
                        (similarWordsCount >= 2 &&
                          extractedWords.length === dbWords.length) ||
                        (extractedWordsInDb >= 2 &&
                          dbWordsInExtracted >= 2 &&
                          wordCountSimilar);

                      this.logger.log(
                        `🔍 Name matching: extracted="${extractedNameNormalized}" (${extractedWords.length} words), db="${dbNameNormalized}" (${dbWords.length} words), extractedWordsInDb=${extractedWordsInDb}, dbWordsInExtracted=${dbWordsInExtracted}, similarWords=${similarWordsCount}, effectiveMatchCount=${effectiveMatchCount}, minWordsToMatch=${minWordsToMatch}, wordCountSimilar=${wordCountSimilar}, majorityMatch=${majorityMatch}`,
                      );
                    }

                    if (
                      exactMatch ||
                      allExtractedWordsInDb ||
                      allDbWordsInExtracted ||
                      majorityMatch
                    ) {
                      // Good match - use this code
                      classification.empleadoId = empleadoCodigo;
                      this.logger.log(
                        `✅ Found and verified empleado code ${empleadoCodigo} for name "${classification.empleadoNombre}" -> DB: "${empleadoNombreFromDbCheck}" (match type: ${exactMatch ? 'exact' : allExtractedWordsInDb ? 'allExtractedInDb' : allDbWordsInExtracted ? 'allDbInExtracted' : 'majority'})`,
                      );
                    } else {
                      // Names don't match - don't use this code
                      this.logger.warn(
                        `⚠️ Found code ${empleadoCodigo} for "${classification.empleadoNombre}" but DB name "${empleadoNombreFromDbCheck}" doesn't match - rejecting code`,
                      );
                      // Don't set empleadoId - keep it null
                    }
                  } else {
                    // Couldn't get DB name - use code but log warning
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `🔍 Found empleado code ${empleadoCodigo} for name "${classification.empleadoNombre}" but couldn't verify DB name`,
                    );
                  }
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error finding empleado by name "${classification.empleadoNombre}": ${error.message}`,
                );
              }
            }

            // FALLBACK: If we still don't have empleadoId, try to extract name from email subject and find code by name
            // This handles cases where the PDF has a typo in the name (e.g., "HERAS" instead of "ERAS")
            // Pattern: "ALTA OPERARIA/O: 147 ERAS MOTOCHE JORGE EDUARDO" -> extract name "ERAS MOTOCHE JORGE EDUARDO" and find code by name
            if (!classification.empleadoId && message.subject) {
              try {
                // Extract name from subject: multiple patterns
                // Pattern 1: "ALTA OPERARIA/O: 147 ERAS MOTOCHE JORGE EDUARDO"
                // Pattern 2: "ALTA OPERARIA SOFIA BITLAN - 09.06.2025" (without "OPERARIA/O:" and colon)
                let subjectNameMatch = message.subject.match(
                  /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
                );
                let nombreFromSubject = subjectNameMatch
                  ? subjectNameMatch[1].trim()
                  : null;

                // Pattern 2: "ALTA OPERARIA SOFIA BITLAN - 09.06.2025"
                if (!nombreFromSubject) {
                  subjectNameMatch = message.subject.match(
                    /ALTA\s+OPERARIA\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s*-\s*\d{2}\.\d{2}\.\d{4}|\s*$)/i,
                  );
                  nombreFromSubject = subjectNameMatch
                    ? subjectNameMatch[1].trim()
                    : null;
                }

                if (nombreFromSubject) {
                  this.logger.log(
                    `🔍 Fallback: Extracted name from email subject: "${nombreFromSubject}" (subject: "${message.subject}")`,
                  );

                  // Find code by name (more reliable than trying to match short code from subject)
                  const empleadoCodigoFromSubject =
                    await this.findEmpleadoByNombre(nombreFromSubject);
                  if (empleadoCodigoFromSubject) {
                    // Verify that this code exists in database
                    const empleadoNombreFromSubjectCheck =
                      await this.getEmpleadoNombreByCodigo(
                        empleadoCodigoFromSubject,
                      );
                    if (empleadoNombreFromSubjectCheck) {
                      classification.empleadoId = empleadoCodigoFromSubject;
                      this.logger.log(
                        `✅ Fallback: Using code ${empleadoCodigoFromSubject} from email subject name lookup (DB name: "${empleadoNombreFromSubjectCheck}")`,
                      );

                      // Update empleadoNombre to use the name from subject (correct name)
                      classification.empleadoNombre = nombreFromSubject;
                    } else {
                      this.logger.warn(
                        `⚠️ Fallback: Code ${empleadoCodigoFromSubject} from subject name lookup not found in database`,
                      );
                    }
                  } else {
                    this.logger.warn(
                      `⚠️ Fallback: Could not find code for name "${nombreFromSubject}" from subject`,
                    );
                  }
                } else {
                  this.logger.warn(
                    `⚠️ Fallback: Could not extract name from subject. Subject: "${message.subject}"`,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error in fallback extraction from subject: ${error.message}`,
                );
              }
            }

            // Get employee name and email from database (use DB values instead of extracted values)
            let empleadoNombreFromDb: string | null = null;
            let empleadoEmailFromDb: string | null = null;
            if (classification.empleadoId) {
              try {
                empleadoNombreFromDb = await this.getEmpleadoNombreByCodigo(
                  classification.empleadoId,
                );
                if (empleadoNombreFromDb) {
                  this.logger.log(
                    `📋 Using DB name for empleado ${classification.empleadoId}: ${empleadoNombreFromDb}`,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error getting empleado name from DB for code "${classification.empleadoId}": ${error.message}`,
                );
              }

              try {
                empleadoEmailFromDb = await this.getEmpleadoEmailByCodigo(
                  classification.empleadoId,
                );
                if (empleadoEmailFromDb) {
                  this.logger.log(
                    `📧 Using DB email for empleado ${classification.empleadoId}: ${empleadoEmailFromDb}`,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error getting empleado email from DB for code "${classification.empleadoId}": ${error.message}`,
                );
              }
            }

            // Prepare metadata
            const ingestionMetadata = {
              subject: message.subject,
              from: message.from,
              date: message.date.toISOString(),
              messageId: message.messageId,
              attachmentId: attachment.attachmentId,
            };

            // Save to database
            const normalizedFilename = doc.normalizedFilename;

            // Log before saving to debug
            this.logger.log(
              `💾 Saving document ${doc.filename}: empleadoId=${classification.empleadoId}, empleadoNombreFromDb=${empleadoNombreFromDb || classification.empleadoNombre}, empleadoEmailFromDb=${empleadoEmailFromDb || 'NULL'}, tipo=${classification.tipoDocumento}`,
            );

            // Use DB name if available, otherwise fallback to extracted name
            const nombreToSave =
              empleadoNombreFromDb || classification.empleadoNombre || null;

            const query = `
              INSERT INTO \`DocumentosOficiales\` (
                \`id\`,
                \`correo_electronico\`,
                \`tipo_documento\`,
                \`nombre_archivo\`,
                \`nombre_empleado\`,
                \`fecha_creacion\`,
                \`archivo\`,
                \`status\`,
                \`source_message_id\`,
                \`source_attachment_id\`,
                \`source_mailbox\`,
                \`idempotency_key\`,
                \`detected_empleado_id\`,
                \`detected_tipo_documento\`,
                \`ingestion_metadata\`
              ) VALUES (
                ${this.escapeSql(classification.empleadoId || 'PENDING')},
                ${this.escapeSql(empleadoEmailFromDb)},
                ${this.escapeSql(classification.tipoDocumento || null)},
                ${this.escapeSql(normalizedFilename)},
                ${this.escapeSql(nombreToSave)},
                NOW(),
                ${attachment.content.length > 0 ? `0x${attachment.content.toString('hex')}` : 'NULL'},
                'PENDING_REVIEW',
                ${this.escapeSql(message.messageId)},
                ${this.escapeSql(attachment.attachmentId)},
                ${this.escapeSql('INBOX')},
                ${this.escapeSql(doc.idempotencyKey)},
                ${this.escapeSql(classification.empleadoId || null)},
                ${this.escapeSql(classification.tipoDocumento || null)},
                ${this.escapeSql(JSON.stringify(ingestionMetadata))}
              )
            `;

            await this.prisma.$executeRawUnsafe(query);

            this.logger.log(
              `✅ Saved document: ${doc.filename} (detected: ${classification.tipoDocumento || 'unknown'}, empleado: ${classification.empleadoId || 'unknown'}, nombre: ${nombreToSave || 'unknown'})`,
            );

            // SPECIAL HANDLING FOR FINIQUITO: Save to Nominas table and set employee as INACTIVO
            if (
              classification.tipoDocumento === 'finiquito' &&
              classification.empleadoId &&
              attachment.content.length > 0
            ) {
              try {
                await this.handleFiniquitoDocument(
                  attachment.content,
                  classification.empleadoId,
                  nombreToSave || classification.empleadoNombre || 'UNKNOWN',
                );
              } catch (finiquitoError: any) {
                this.logger.error(
                  `❌ Error processing finiquito for ${doc.filename}: ${finiquitoError.message}`,
                );
                // Don't fail the whole save - document is already saved in DocumentosOficiales
              }
            }

            saved++;
            // Track this message as having a saved document
            messagesWithSavedDocuments.add(message.messageId);
          } catch (error: any) {
            this.logger.error(
              `❌ Error saving document ${doc.filename}: ${error.message}`,
            );
            errors++;
          }
        }

        // Move messages with saved documents to "Extrase" folder (if configured)
        const processedMailbox = this.configService.get<string>(
          'IMAP_PROCESSED_MAILBOX',
        );
        this.logger.log(
          `📦 Move messages check: processedMailbox=${processedMailbox || 'NOT SET'}, messagesWithSavedDocuments.size=${messagesWithSavedDocuments.size}`,
        );

        // Try to move messages to processed mailbox, but if that fails, mark them as processed with flags
        if (processedMailbox && messagesWithSavedDocuments.size > 0) {
          this.logger.log(
            `📦 Processing ${messagesWithSavedDocuments.size} message(s) with saved documents (attempting move to ${processedMailbox}, will mark as processed if move fails)...`,
          );

          let movedCount = 0;
          let markedCount = 0;
          for (const messageId of messagesWithSavedDocuments) {
            try {
              this.logger.log(
                `🔄 Attempting to move message ${messageId} to ${processedMailbox}...`,
              );
              const moved = await this.imapConnector.moveMessage(
                messageId,
                processedMailbox,
              );
              if (moved) {
                movedCount++;
                this.logger.log(
                  `✅ Successfully moved message ${messageId} to ${processedMailbox}`,
                );
              } else {
                // Move failed - mark as processed with flags instead
                this.logger.warn(
                  `⚠️ Failed to move message ${messageId} to ${processedMailbox}. Marking as processed with flags instead...`,
                );
                const marked =
                  await this.imapConnector.markMessageAsProcessed(messageId);
                if (marked) {
                  markedCount++;
                  this.logger.log(
                    `✅ Marked message ${messageId} as processed (read flag)`,
                  );
                } else {
                  this.logger.warn(
                    `⚠️ Failed to mark message ${messageId} as processed`,
                  );
                }
              }
            } catch (error: any) {
              this.logger.error(
                `❌ Error processing message ${messageId}: ${error.message}. Attempting to mark as processed...`,
                error.stack,
              );
              // Try to mark as processed even if move failed
              try {
                const marked =
                  await this.imapConnector.markMessageAsProcessed(messageId);
                if (marked) {
                  markedCount++;
                  this.logger.log(
                    `✅ Marked message ${messageId} as processed (fallback)`,
                  );
                }
              } catch (markError: any) {
                this.logger.error(
                  `❌ Failed to mark message ${messageId} as processed: ${markError.message}`,
                );
              }
            }
          }

          this.logger.log(
            `✅ Processed ${messagesWithSavedDocuments.size} message(s): ${movedCount} moved to ${processedMailbox}, ${markedCount} marked as processed with flags`,
          );
        } else if (!processedMailbox) {
          // No processed mailbox configured - just mark as processed
          if (messagesWithSavedDocuments.size > 0) {
            this.logger.log(
              `🏷️ IMAP_PROCESSED_MAILBOX is not configured. Marking ${messagesWithSavedDocuments.size} message(s) as processed with flags...`,
            );

            let markedCount = 0;
            for (const messageId of messagesWithSavedDocuments) {
              try {
                const marked =
                  await this.imapConnector.markMessageAsProcessed(messageId);
                if (marked) {
                  markedCount++;
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Failed to mark message ${messageId} as processed: ${error.message}`,
                );
              }
            }

            this.logger.log(
              `✅ Marked ${markedCount} out of ${messagesWithSavedDocuments.size} message(s) as processed`,
            );
          }
        } else if (messagesWithSavedDocuments.size === 0) {
          this.logger.warn(`⚠️ No messages with saved documents to process.`);
        }

        // Disconnect from IMAP
        try {
          await this.imapConnector.disconnect();
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error disconnecting from IMAP: ${error.message}`,
          );
        }

        return { success: true, saved, skipped, errors };
      } catch (error: any) {
        // Disconnect on error
        try {
          await this.imapConnector.disconnect();
        } catch (disconnectError: any) {
          this.logger.warn(
            `⚠️ Error disconnecting from IMAP: ${disconnectError.message}`,
          );
        }
        throw error;
      }
    }

    // Fallback: Re-fetch from email (old behavior)
    if (!this.imapConnector.isConfigured()) {
      throw new BadRequestException(
        'IMAP not configured. Set SMTP_USER, SMTP_PASSWORD, and optionally IMAP_HOST, IMAP_PORT.',
      );
    }

    try {
      // Connect to IMAP
      await this.imapConnector.connect();

      // Fetch messages again (same as preview)
      const messages = await this.imapConnector.fetchMessages(
        readStatus || 'all',
        limit || 50,
        true,
        null,
      );

      // Create a set for fast lookup
      const selectedIdsSet = new Set(selectedIds);

      // Process each message
      for (const message of messages) {
        try {
          // Skip messages from excluded senders
          if (this.isExcludedSender(message.from)) {
            this.logger.log(
              `⏭️ Skipping message from excluded sender: ${message.from}`,
            );
            continue;
          }

          // Process each attachment
          for (const attachment of message.attachments) {
            // Generate idempotency key
            const idempotencyKey = this.generateIdempotencyKey(
              message.messageId,
              attachment.attachmentId,
            );

            // Check if this document was selected
            if (!selectedIdsSet.has(idempotencyKey)) {
              continue; // Skip if not selected
            }

            // Check if document already exists (idempotency)
            const existing = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT doc_id FROM DocumentosOficiales WHERE idempotency_key = ${this.escapeSql(idempotencyKey)} LIMIT 1`,
            );

            let isDuplicate = existing && existing.length > 0;

            // Classify document first (needed for duplicate check with empleadoId)
            const classification = await classifyDocument(
              attachment.filename,
              message.subject,
              attachment.contentType.startsWith('application/pdf')
                ? attachment.content
                : undefined,
            );

            // Also check by filename + size + empleadoId (catches same file sent in different emails)
            if (!isDuplicate) {
              isDuplicate = await this.checkDuplicateByFilenameAndSize(
                attachment.filename,
                attachment.size,
                classification.empleadoId || null,
              );
              if (isDuplicate) {
                this.logger.log(
                  `🔍 Duplicate detected by filename + size + empleado: ${attachment.filename} (${attachment.size} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
                );
              }
            }

            // For images, also check by content hash (most reliable for detecting exact duplicates)
            if (
              !isDuplicate &&
              attachment.content &&
              attachment.content.length > 0
            ) {
              // Only check hash for smaller files (< 5MB) to avoid performance issues
              if (attachment.size < 5 * 1024 * 1024) {
                isDuplicate = await this.checkDuplicateByContentHash(
                  attachment.content,
                  classification.empleadoId || null,
                );
                if (isDuplicate) {
                  this.logger.log(
                    `🔍 Duplicate detected by content hash: ${attachment.filename} (${attachment.size} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
                  );
                }
              }
            }

            if (isDuplicate) {
              this.logger.log(
                `⏭️ Skipping duplicate document: ${attachment.filename} (idempotency_key: ${idempotencyKey})`,
              );
              skipped++;
              continue;
            }

            // Skip nomina documents (processed manually)
            // Finiquito documents are now accepted for automatic processing
            const isNomina = classification.tipoDocumento === 'nomina';

            if (isNomina) {
              this.logger.log(
                `⏭️ Skipping nomina document (processed manually): ${attachment.filename}`,
              );
              continue;
            }

            // Prepare metadata
            const ingestionMetadata = {
              subject: message.subject,
              from: message.from,
              date: message.date.toISOString(),
              read: message.read,
              messageId: message.messageId,
              attachmentId: attachment.attachmentId,
            };

            // Normalize filename
            const normalizedFilename = this.normalizeFilename(
              attachment.filename,
            );

            // Insert document as PENDING_REVIEW
            const query = `
              INSERT INTO \`DocumentosOficiales\` (
                \`id\`,
                \`correo_electronico\`,
                \`tipo_documento\`,
                \`nombre_archivo\`,
                \`nombre_empleado\`,
                \`fecha_creacion\`,
                \`archivo\`,
                \`status\`,
                \`source_message_id\`,
                \`source_attachment_id\`,
                \`source_mailbox\`,
                \`idempotency_key\`,
                \`detected_empleado_id\`,
                \`detected_tipo_documento\`,
                \`ingestion_metadata\`
              ) VALUES (
                ${this.escapeSql(classification.empleadoId || 'PENDING')},
                NULL,
                ${this.escapeSql(classification.tipoDocumento || null)},
                ${this.escapeSql(normalizedFilename)},
                NULL,
                NOW(),
                ${attachment.content.length > 0 ? `0x${attachment.content.toString('hex')}` : 'NULL'},
                'PENDING_REVIEW',
                ${this.escapeSql(message.messageId)},
                ${this.escapeSql(attachment.attachmentId)},
                ${this.escapeSql('INBOX')},
                ${this.escapeSql(idempotencyKey)},
                ${this.escapeSql(classification.empleadoId || null)},
                ${this.escapeSql(classification.tipoDocumento || null)},
                ${this.escapeSql(JSON.stringify(ingestionMetadata))}
              )
            `;

            await this.prisma.$executeRawUnsafe(query);
            saved++;

            this.logger.log(
              `✅ Saved document: ${attachment.filename} (detected: ${classification.tipoDocumento || 'unknown'}, empleado: ${classification.empleadoId || 'unknown'}, confidence: ${(classification.confidence * 100).toFixed(1)}%)`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error processing message ${message.messageId}: ${error.message}`,
          );
          errors++;
          // Continue with next message
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Error during document save: ${error.message}`);
      throw new BadRequestException(`Document save failed: ${error.message}`);
    } finally {
      // Disconnect from IMAP
      try {
        await this.imapConnector.disconnect();
      } catch (error: any) {
        this.logger.warn(`⚠️ Error disconnecting from IMAP: ${error.message}`);
      }
    }

    return {
      success: true,
      saved,
      skipped,
      errors,
    };
  }

  /**
   * Ingest emails and extract documents
   * @param readStatus - 'read', 'unread', or 'all'
   * @param limit - Maximum number of messages to process (null or 0 = no limit)
   * @param subjectFilter - Optional filter to search emails by subject (case-insensitive partial match)
   */
  async ingestEmails(
    readStatus: 'read' | 'unread' | 'all',
    limit: number | null = 50,
    subjectFilter: string | null = null,
  ): Promise<{
    success: boolean;
    processed: number;
    inserted: number;
    skipped: number;
    details: {
      messagesFetched: number;
      attachmentsExtracted: number;
      documentsCreated: number;
    };
  }> {
    if (!this.imapConnector.isConfigured()) {
      throw new BadRequestException(
        'IMAP not configured. Set SMTP_USER, SMTP_PASSWORD, and optionally IMAP_HOST, IMAP_PORT.',
      );
    }

    let processed = 0;
    let inserted = 0;
    let skipped = 0;
    let messagesFetched = 0;
    let attachmentsExtracted = 0;
    let documentsCreated = 0;

    try {
      // Connect to IMAP
      await this.imapConnector.connect();

      // Fetch messages
      const messages = await this.imapConnector.fetchMessages(
        readStatus,
        limit,
        true,
        subjectFilter,
      );
      messagesFetched = messages.length;

      this.logger.log(
        `📧 Processing ${messages.length} messages (readStatus: ${readStatus})`,
      );

      // Process each message
      for (const message of messages) {
        try {
          // Skip messages from excluded senders
          if (this.isExcludedSender(message.from)) {
            this.logger.log(
              `⏭️ Skipping message from excluded sender: ${message.from}`,
            );
            continue;
          }

          processed++;

          // Process each attachment
          for (const attachment of message.attachments) {
            attachmentsExtracted++;

            // Generate idempotency key
            const idempotencyKey = this.generateIdempotencyKey(
              message.messageId,
              attachment.attachmentId,
            );

            // Check if document already exists (idempotency)
            const existing = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT doc_id FROM DocumentosOficiales WHERE idempotency_key = ${this.escapeSql(idempotencyKey)} LIMIT 1`,
            );

            let isDuplicate = existing && existing.length > 0;

            // Classify document first (needed for duplicate check with empleadoId)
            const classification = await classifyDocument(
              attachment.filename,
              message.subject,
              attachment.contentType.startsWith('application/pdf')
                ? attachment.content
                : undefined,
            );

            // Also check by filename + size + empleadoId (catches same file sent in different emails)
            if (!isDuplicate) {
              isDuplicate = await this.checkDuplicateByFilenameAndSize(
                attachment.filename,
                attachment.size,
                classification.empleadoId || null,
              );
              if (isDuplicate) {
                this.logger.log(
                  `🔍 Duplicate detected by filename + size + empleado: ${attachment.filename} (${attachment.size} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
                );
              }
            }

            // For images, also check by content hash (most reliable for detecting exact duplicates)
            if (
              !isDuplicate &&
              attachment.content &&
              attachment.content.length > 0
            ) {
              // Only check hash for smaller files (< 5MB) to avoid performance issues
              if (attachment.size < 5 * 1024 * 1024) {
                isDuplicate = await this.checkDuplicateByContentHash(
                  attachment.content,
                  classification.empleadoId || null,
                );
                if (isDuplicate) {
                  this.logger.log(
                    `🔍 Duplicate detected by content hash: ${attachment.filename} (${attachment.size} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
                  );
                }
              }
            }

            if (isDuplicate) {
              this.logger.log(
                `⏭️ Skipping duplicate document: ${attachment.filename} (idempotency_key: ${idempotencyKey})`,
              );
              skipped++;
              continue;
            }

            // PRIORITY 1: Try to find employee by DNI/NIE or Social Security Number (more reliable than name)
            if (!classification.empleadoId) {
              // Try DNI/NIE first
              if (classification.dniNie) {
                try {
                  const empleadoCodigo = await this.findEmpleadoByDNINIE(
                    classification.dniNie,
                  );
                  if (empleadoCodigo) {
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `✅ Found empleado code ${empleadoCodigo} by DNI/NIE "${classification.dniNie}"`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error finding empleado by DNI/NIE "${classification.dniNie}": ${error.message}`,
                  );
                }
              }

              // Try Social Security Number if DNI/NIE didn't work
              if (!classification.empleadoId && classification.segSocial) {
                try {
                  const empleadoCodigo = await this.findEmpleadoBySegSocial(
                    classification.segSocial,
                  );
                  if (empleadoCodigo) {
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `✅ Found empleado code ${empleadoCodigo} by Seg. Social "${classification.segSocial}"`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Error finding empleado by Seg. Social "${classification.segSocial}": ${error.message}`,
                  );
                }
              }
            }

            // PRIORITY 2: If we extracted employee name but not code, find code by name in database
            // NOTE: We NEVER extract empleadoId from documents - codes only exist in database
            // We extract names from documents, then look up codes in database
            if (classification.empleadoNombre && !classification.empleadoId) {
              try {
                const empleadoCodigo = await this.findEmpleadoByNombre(
                  classification.empleadoNombre,
                );
                if (empleadoCodigo) {
                  // Validate: check if the DB name matches the extracted name
                  const empleadoNombreFromDbCheck =
                    await this.getEmpleadoNombreByCodigo(empleadoCodigo);
                  if (empleadoNombreFromDbCheck) {
                    const extractedNameNormalized =
                      classification.empleadoNombre.trim().toUpperCase();
                    const dbNameNormalized = empleadoNombreFromDbCheck
                      .trim()
                      .toUpperCase();

                    // Helper function to normalize accents (Á -> A, É -> E, etc.)
                    const normalizeAccents = (str: string): string => {
                      return str
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                        .toUpperCase();
                    };

                    // Normalize both names for comparison (to handle accents)
                    const extractedNameNormalizedForCompare = normalizeAccents(
                      extractedNameNormalized,
                    );
                    const dbNameNormalizedForCompare =
                      normalizeAccents(dbNameNormalized);

                    // Check if names match (exact or contains all words, or majority of words match)
                    const extractedWords = extractedNameNormalized
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);
                    const dbWords = dbNameNormalized
                      .split(/\s+/)
                      .filter((w) => w.length >= 2);

                    // Match if: exact match OR all extracted words are in DB name OR all DB words are in extracted name (normalized)
                    const exactMatch =
                      extractedNameNormalizedForCompare ===
                      dbNameNormalizedForCompare;
                    const allExtractedWordsInDb =
                      extractedWords.length > 0 &&
                      extractedWords.every((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return dbNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      });
                    const allDbWordsInExtracted =
                      dbWords.length > 0 &&
                      dbWords.every((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return extractedNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      });

                    // Flexible matching: if majority of words match (at least 2/3 or 3/4), accept it
                    // This handles cases like "AMILCAR ESTEBAN VENTURA MORENO" matching "VENTURA AMILCAR ESTEBAN"
                    // where one name has an extra word (like "MORENO")
                    // Also handles cases like "JORGE EDUARDO HERAS MATOCHE" matching "ERAS MOTOCHE JORGE EDUARDO"
                    // where words are similar but not exact (HERAS vs ERAS, MATOCHE vs MOTOCHE)
                    // IMPORTANT: Use normalized versions for comparison to handle accents (HERNÁNDEZ = HERNANDEZ)
                    let majorityMatch = false;
                    if (extractedWords.length >= 2 && dbWords.length >= 2) {
                      // Count exact matches using normalized versions
                      const extractedWordsInDb = extractedWords.filter(
                        (word) => {
                          const wordNormalized = normalizeAccents(word);
                          return dbNameNormalizedForCompare.includes(
                            wordNormalized,
                          );
                        },
                      ).length;
                      const dbWordsInExtracted = dbWords.filter((word) => {
                        const wordNormalized = normalizeAccents(word);
                        return extractedNameNormalizedForCompare.includes(
                          wordNormalized,
                        );
                      }).length;

                      // Also check for similar words (e.g., "YURLEDINSON" ≈ "YURLENDINSON")
                      let similarWordsCount = 0;
                      for (const extractedWord of extractedWords) {
                        const extractedWordNormalized =
                          normalizeAccents(extractedWord);
                        // Skip if already matched exactly
                        if (
                          dbNameNormalizedForCompare.includes(
                            extractedWordNormalized,
                          )
                        )
                          continue;

                        for (const dbWord of dbWords) {
                          const dbWordNormalized = normalizeAccents(dbWord);
                          // Skip if already matched exactly
                          if (
                            extractedNameNormalizedForCompare.includes(
                              dbWordNormalized,
                            )
                          )
                            continue;

                          // Check if normalized versions are identical (handles accents)
                          if (extractedWordNormalized === dbWordNormalized) {
                            similarWordsCount++;
                            break;
                          }

                          // Check if words are similar (typos, etc.)
                          if (
                            Math.abs(extractedWord.length - dbWord.length) <= 2
                          ) {
                            const shorter = Math.min(
                              extractedWord.length,
                              dbWord.length,
                            );
                            let commonChars = 0;
                            for (let i = 0; i < shorter; i++) {
                              if (
                                normalizeAccents(extractedWord[i]) ===
                                normalizeAccents(dbWord[i])
                              )
                                commonChars++;
                              else break;
                            }
                            const oneContainsOther =
                              extractedWordNormalized.includes(
                                dbWordNormalized,
                              ) ||
                              dbWordNormalized.includes(
                                extractedWordNormalized,
                              );
                            if (commonChars >= 4 || oneContainsOther) {
                              similarWordsCount++;
                              break;
                            }
                          }
                        }
                      }

                      // Calculate minimum words needed: at least 2 words, or 50% of words (whichever is higher)
                      const minWordsToMatch = Math.max(
                        2,
                        Math.min(extractedWords.length, dbWords.length) * 0.5,
                      );

                      // Accept if exact matches + similar words >= minWordsToMatch
                      const effectiveMatchCount =
                        extractedWordsInDb + similarWordsCount;
                      const effectiveDbMatchCount =
                        dbWordsInExtracted + similarWordsCount;

                      // Accept if at least 50% of words match in both directions
                      // OR if at least 2 words match (exact + similar) and the total word count is similar
                      const wordCountSimilar =
                        Math.abs(extractedWords.length - dbWords.length) <= 1;
                      majorityMatch =
                        (extractedWordsInDb >= minWordsToMatch &&
                          dbWordsInExtracted >= minWordsToMatch) ||
                        (effectiveMatchCount >= 2 &&
                          effectiveDbMatchCount >= 1) ||
                        (effectiveMatchCount >= minWordsToMatch &&
                          effectiveDbMatchCount >= minWordsToMatch) ||
                        (effectiveMatchCount >= 2 &&
                          effectiveDbMatchCount >= 2 &&
                          wordCountSimilar) ||
                        (extractedWordsInDb >= 1 &&
                          similarWordsCount >= 1 &&
                          effectiveMatchCount >= 2) ||
                        (similarWordsCount >= 2 &&
                          extractedWords.length === dbWords.length) ||
                        (extractedWordsInDb >= 2 &&
                          dbWordsInExtracted >= 2 &&
                          wordCountSimilar);

                      this.logger.log(
                        `🔍 Name matching: extracted="${extractedNameNormalized}" (${extractedWords.length} words), db="${dbNameNormalized}" (${dbWords.length} words), extractedWordsInDb=${extractedWordsInDb}, dbWordsInExtracted=${dbWordsInExtracted}, similarWords=${similarWordsCount}, effectiveMatchCount=${effectiveMatchCount}, minWordsToMatch=${minWordsToMatch}, wordCountSimilar=${wordCountSimilar}, majorityMatch=${majorityMatch}`,
                      );
                    }

                    if (
                      exactMatch ||
                      allExtractedWordsInDb ||
                      allDbWordsInExtracted ||
                      majorityMatch
                    ) {
                      // Good match - use this code
                      classification.empleadoId = empleadoCodigo;
                      this.logger.log(
                        `✅ Found and verified empleado code ${empleadoCodigo} for name "${classification.empleadoNombre}" -> DB: "${empleadoNombreFromDbCheck}" (match type: ${exactMatch ? 'exact' : allExtractedWordsInDb ? 'allExtractedInDb' : allDbWordsInExtracted ? 'allDbInExtracted' : 'majority'})`,
                      );
                    } else {
                      // Names don't match - don't use this code
                      this.logger.warn(
                        `⚠️ Found code ${empleadoCodigo} for "${classification.empleadoNombre}" but DB name "${empleadoNombreFromDbCheck}" doesn't match - rejecting code`,
                      );
                      // Don't set empleadoId - keep it null
                    }
                  } else {
                    // Couldn't get DB name - use code but log warning
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `🔍 Found empleado code ${empleadoCodigo} for name "${classification.empleadoNombre}" but couldn't verify DB name`,
                    );
                  }
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error finding empleado by name "${classification.empleadoNombre}": ${error.message}`,
                );
              }
            }

            // Prepare metadata
            const ingestionMetadata = {
              subject: message.subject,
              from: message.from,
              date: message.date.toISOString(),
              read: message.read,
              messageId: message.messageId,
              attachmentId: attachment.attachmentId,
            };

            // Get employee name and email from database (if we have empleadoId)
            let empleadoNombreFromDb: string | null = null;
            let empleadoEmailFromDb: string | null = null;
            if (classification.empleadoId) {
              try {
                empleadoNombreFromDb = await this.getEmpleadoNombreByCodigo(
                  classification.empleadoId,
                );
                empleadoEmailFromDb = await this.getEmpleadoEmailByCodigo(
                  classification.empleadoId,
                );
              } catch {
                // Silently fail - we'll use extracted values as fallback
              }
            }

            // Normalize filename to avoid encoding issues (remove emojis and problematic characters)
            const normalizedFilename = this.normalizeFilename(
              attachment.filename,
            );

            // Use DB name if available, otherwise fallback to extracted name
            const nombreToSave =
              empleadoNombreFromDb || classification.empleadoNombre || null;

            // Insert document as PENDING_REVIEW
            const query = `
              INSERT INTO \`DocumentosOficiales\` (
                \`id\`,
                \`correo_electronico\`,
                \`tipo_documento\`,
                \`nombre_archivo\`,
                \`nombre_empleado\`,
                \`fecha_creacion\`,
                \`archivo\`,
                \`status\`,
                \`source_message_id\`,
                \`source_attachment_id\`,
                \`source_mailbox\`,
                \`idempotency_key\`,
                \`detected_empleado_id\`,
                \`detected_tipo_documento\`,
                \`ingestion_metadata\`
              ) VALUES (
                ${this.escapeSql(classification.empleadoId || 'PENDING')},
                ${this.escapeSql(empleadoEmailFromDb)},
                ${this.escapeSql(classification.tipoDocumento || null)},
                ${this.escapeSql(normalizedFilename)},
                ${this.escapeSql(nombreToSave)},
                NOW(),
                ${attachment.content.length > 0 ? `0x${attachment.content.toString('hex')}` : 'NULL'},
                'PENDING_REVIEW',
                ${this.escapeSql(message.messageId)},
                ${this.escapeSql(attachment.attachmentId)},
                ${this.escapeSql('INBOX')},
                ${this.escapeSql(idempotencyKey)},
                ${this.escapeSql(classification.empleadoId || null)},
                ${this.escapeSql(classification.tipoDocumento || null)},
                ${this.escapeSql(JSON.stringify(ingestionMetadata))}
              )
            `;

            await this.prisma.$executeRawUnsafe(query);
            inserted++;
            documentsCreated++;

            this.logger.log(
              `✅ Created document: ${attachment.filename} (detected: ${classification.tipoDocumento || 'unknown'}, empleado: ${classification.empleadoId || 'unknown'}, confidence: ${(classification.confidence * 100).toFixed(1)}%)`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error processing message ${message.messageId}: ${error.message}`,
          );
          // Continue with next message
        }
      }
    } catch (error: any) {
      this.logger.error(`❌ Error during email ingestion: ${error.message}`);
      throw new BadRequestException(`Email ingestion failed: ${error.message}`);
    } finally {
      // Disconnect from IMAP
      try {
        await this.imapConnector.disconnect();
      } catch (error: any) {
        this.logger.warn(`⚠️ Error disconnecting from IMAP: ${error.message}`);
      }
    }

    return {
      success: true,
      processed,
      inserted,
      skipped,
      details: {
        messagesFetched,
        attachmentsExtracted,
        documentsCreated,
      },
    };
  }

  /**
   * Generate idempotency key from message ID and attachment ID
   */
  private generateIdempotencyKey(
    messageId: string,
    attachmentId: string,
  ): string {
    const combined = `${messageId}:${attachmentId}`;
    return crypto.createHash('sha256').update(combined).digest('hex');
  }

  /**
   * Check if document is duplicate by filename and size
   * This catches cases where the same file is sent in different emails or uploaded from folder
   */
  private async checkDuplicateByFilenameAndSize(
    filename: string,
    size: number,
    empleadoId?: string | null,
  ): Promise<boolean> {
    const maxRetries = 3;
    let retries = maxRetries;

    while (retries > 0) {
      try {
        const normalizedFilename = this.normalizeFilename(filename);

        // Check if document with same filename and size exists
        // If empleadoId is provided, also check that it matches (more accurate)
        let query = `
          SELECT doc_id 
          FROM DocumentosOficiales 
          WHERE nombre_archivo = ${this.escapeSql(normalizedFilename)}
            AND LENGTH(archivo) = ${size}
        `;

        // If we have empleadoId, also check that it matches (more accurate detection)
        if (empleadoId) {
          query += ` AND id = ${this.escapeSql(empleadoId)}`;
        }

        query += ` LIMIT 1`;

        const result = await this.prisma.$queryRawUnsafe<any[]>(query);
        return result && result.length > 0;
      } catch (error: any) {
        retries--;
        const errorMessage = error.message || 'Unknown error';
        const errorCode = error.code || '';

        // Detect connection errors
        const isConnectionError =
          errorMessage.includes('Server has closed the connection') ||
          errorMessage.includes('Connection lost') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage === 'N/A' ||
          errorCode === 'PROTOCOL_CONNECTION_LOST' ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'ETIMEDOUT' ||
          errorCode === 'P2010' ||
          (errorMessage.includes('Raw query failed') &&
            (errorCode === 'N/A' || errorCode === 'P2010'));

        if (isConnectionError && retries > 0) {
          this.logger.warn(
            `⚠️ Connection error checking duplicate for ${filename}, retrying... (${retries} retries left)`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (maxRetries - retries + 1)),
          );
        } else {
          this.logger.warn(
            `⚠️ Error checking duplicate by filename and size: ${errorMessage} (code: ${errorCode || 'N/A'})`,
          );
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Check if document is duplicate by content hash (MD5)
   * This is the most reliable way to detect duplicates regardless of source
   * Optimized: only checks documents from the same employee or recent documents
   */
  private async checkDuplicateByContentHash(
    content: Buffer,
    empleadoId?: string | null,
  ): Promise<boolean> {
    const maxRetries = 3;
    let retries = maxRetries;

    while (retries > 0) {
      try {
        // Calculate MD5 hash of content
        const hash = crypto.createHash('md5').update(content).digest('hex');

        // Optimized query: check only documents from same employee (if available) or recent documents
        // This is much faster than checking all documents
        let query = `
          SELECT doc_id, archivo
          FROM DocumentosOficiales 
          WHERE archivo IS NOT NULL
        `;

        // If we have empleadoId, filter by it (much faster)
        if (empleadoId) {
          query += ` AND id = ${this.escapeSql(empleadoId)}`;
        } else {
          // If no empleadoId, check only recent documents (last 30 days) to limit scope
          query += ` AND fecha_creacion >= DATE_SUB(NOW(), INTERVAL 30 DAY)`;
        }

        // Limit to reasonable number
        query += ` LIMIT 500`;

        const results =
          await this.prisma.$queryRawUnsafe<
            Array<{ doc_id: number; archivo: Buffer }>
          >(query);

        for (const doc of results) {
          if (doc.archivo) {
            const docHash = crypto
              .createHash('md5')
              .update(doc.archivo)
              .digest('hex');
            if (docHash === hash) {
              this.logger.log(
                `🔍 Duplicate detected by content hash: ${hash.substring(0, 8)}... (empleado: ${empleadoId || 'unknown'})`,
              );
              return true;
            }
          }
        }

        return false;
      } catch (error: any) {
        retries--;
        const errorMessage = error.message || 'Unknown error';
        const errorCode = error.code || '';

        // Detect connection errors
        const isConnectionError =
          errorMessage.includes('Server has closed the connection') ||
          errorMessage.includes('Connection lost') ||
          errorMessage.includes('ECONNRESET') ||
          errorMessage === 'N/A' ||
          errorCode === 'PROTOCOL_CONNECTION_LOST' ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'ETIMEDOUT' ||
          errorCode === 'P2010' ||
          (errorMessage.includes('Raw query failed') &&
            (errorCode === 'N/A' || errorCode === 'P2010'));

        if (isConnectionError && retries > 0) {
          this.logger.warn(
            `⚠️ Connection error checking duplicate by hash, retrying... (${retries} retries left)`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * (maxRetries - retries + 1)),
          );
        } else {
          this.logger.warn(
            `⚠️ Error checking duplicate by content hash: ${errorMessage} (code: ${errorCode || 'N/A'})`,
          );
          return false;
        }
      }
    }
    return false;
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

  /**
   * Check if sender email should be excluded from ingestion
   */
  private isExcludedSender(fromEmail: string): boolean {
    const fromLower = fromEmail.toLowerCase();
    return this.excludedSenders.some((excluded) =>
      fromLower.includes(excluded.toLowerCase()),
    );
  }

  /**
   * Get employee name from database by code
   */
  private async getEmpleadoNombreByCodigo(
    codigo: string,
  ): Promise<string | null> {
    if (!codigo || codigo.trim().length === 0) {
      return null;
    }

    try {
      const codigoNormalized = codigo.trim();

      // First, try exact match
      let query = `
        SELECT \`NOMBRE / APELLIDOS\` as nombre
        FROM DatosEmpleados
        WHERE CODIGO = ${this.escapeSql(codigoNormalized)}
        LIMIT 1
      `;

      let result =
        await this.prisma.$queryRawUnsafe<Array<{ nombre: string }>>(query);

      if (result && result.length > 0) {
        return result[0].nombre;
      }

      // If exact match fails and codigo is short (3 digits or less), try suffix match
      // This handles cases where subject has "147" but DB has "10000146"
      // Pattern: codigo ends with the short code (e.g., "10000146" ends with "146" or "147")
      if (codigoNormalized.length <= 3 && /^\d+$/.test(codigoNormalized)) {
        this.logger.log(
          `🔍 Exact match failed for codigo "${codigoNormalized}", trying suffix match...`,
        );
        query = `
          SELECT \`NOMBRE / APELLIDOS\` as nombre
          FROM DatosEmpleados
          WHERE CODIGO LIKE ${this.escapeSql(`%${codigoNormalized}`)}
          LIMIT 1
        `;

        result =
          await this.prisma.$queryRawUnsafe<Array<{ nombre: string }>>(query);

        if (result && result.length > 0) {
          this.logger.log(
            `✅ Suffix match found for codigo "${codigoNormalized}": ${result[0].nombre}`,
          );
          return result[0].nombre;
        }
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error getting empleado name by codigo "${codigo}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Get employee email from database by code
   */
  private async getEmpleadoEmailByCodigo(
    codigo: string,
  ): Promise<string | null> {
    if (!codigo || codigo.trim().length === 0) {
      return null;
    }

    try {
      const query = `
        SELECT \`CORREO ELECTRONICO\` as email
        FROM DatosEmpleados
        WHERE CODIGO = ${this.escapeSql(codigo)}
        LIMIT 1
      `;

      const result =
        await this.prisma.$queryRawUnsafe<Array<{ email: string | null }>>(
          query,
        );

      if (result && result.length > 0 && result[0].email) {
        const email = result[0].email.trim();
        return email.length > 0 ? email : null;
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error getting empleado email by codigo "${codigo}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Find employee code by DNI/NIE
   * Searches in D.N.I. / NIE field
   */
  private async findEmpleadoByDNINIE(dniNie: string): Promise<string | null> {
    if (!dniNie || dniNie.trim().length === 0) {
      return null;
    }

    try {
      // Normalize DNI/NIE: remove spaces, hyphens, convert to uppercase
      const dniNieNormalized = dniNie
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');

      if (dniNieNormalized.length < 7) {
        return null; // Too short to be a valid DNI/NIE
      }

      const query = `
        SELECT CODIGO
        FROM DatosEmpleados
        WHERE TRIM(UPPER(REPLACE(REPLACE(\`D.N.I. / NIE\`, '-', ''), ' ', ''))) = ${this.escapeSql(dniNieNormalized)}
        LIMIT 1
      `;

      const result =
        await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);

      if (result && result.length > 0) {
        this.logger.log(
          `✅ Found empleado by DNI/NIE "${dniNieNormalized}": ${result[0].CODIGO}`,
        );
        return result[0].CODIGO;
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error searching empleado by DNI/NIE "${dniNie}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Find employee code by Social Security Number (número de afiliación)
   * Searches in SEG. SOCIAL field
   */
  private async findEmpleadoBySegSocial(
    segSocial: string,
  ): Promise<string | null> {
    if (!segSocial || segSocial.trim().length === 0) {
      return null;
    }

    try {
      // Normalize: remove spaces
      const segSocialNormalized = segSocial.trim().replace(/\s+/g, '');

      if (segSocialNormalized.length !== 10) {
        return null; // Social security number should be 10 digits
      }

      const query = `
        SELECT CODIGO
        FROM DatosEmpleados
        WHERE TRIM(REPLACE(\`SEG. SOCIAL\`, ' ', '')) = ${this.escapeSql(segSocialNormalized)}
        LIMIT 1
      `;

      const result =
        await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);

      if (result && result.length > 0) {
        this.logger.log(
          `✅ Found empleado by Seg. Social "${segSocialNormalized}": ${result[0].CODIGO}`,
        );
        return result[0].CODIGO;
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error searching empleado by Seg. Social "${segSocial}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Find employee code by name (flexible search)
   * Searches in NOMBRE / APELLIDOS field
   * Tries multiple strategies: exact match, starts with, contains, word match
   */
  private async findEmpleadoByNombre(nombre: string): Promise<string | null> {
    if (!nombre || nombre.trim().length < 3) {
      this.logger.log(`⚠️ findEmpleadoByNombre: nombre is too short or empty`);
      return null;
    }

    try {
      // Helper function to normalize accents (Á -> A, É -> E, etc.)
      const normalizeAccents = (str: string): string => {
        return str
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
          .toUpperCase();
      };

      const nombreNormalized = nombre.trim().toUpperCase();
      const nombreWords = nombreNormalized
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      // Also create normalized versions of words (without accents) for SQL queries
      const nombreWordsNormalized = nombreWords.map((w) => normalizeAccents(w));

      // Strategy 1: Exact match (try both with and without accents)
      let query = `
        SELECT CODIGO
        FROM DatosEmpleados
        WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) = ${this.escapeSql(nombreNormalized)}
        LIMIT 1
      `;

      let result =
        await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);

      if (result && result.length > 0) {
        this.logger.log(
          `✅ Exact match found for "${nombreNormalized}": ${result[0].CODIGO}`,
        );
        return result[0].CODIGO;
      }

      // Strategy 2: Majority of words match (order-independent) - for cases like "AMILCAR ESTEBAN VENTURA MORENO" matching "VENTURA AMILCAR ESTEBAN"
      // Use flexible matching: search for at least 2/3 of words (or minimum 2 words)
      if (nombreWords.length >= 2) {
        // Calculate minimum words needed (at least 2/3, but minimum 2)
        // const minWordsNeeded = Math.max(2, Math.ceil((nombreWords.length * 2) / 3));

        // Try searching with all words first (most specific)
        // BUT: Use OR instead of AND for better matching when there are typos
        // IMPORTANT: Use normalized words (without accents) in SQL LIKE queries
        // This way, "HERNÁNDEZ" will match "HERNANDEZ" in the database
        let likeConditions = nombreWordsNormalized
          .map(
            (word) =>
              `TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '  ', ' '), '  ', ' '))) LIKE ${this.escapeSql(`%${word}%`)}`,
          )
          .join(' OR ');

        // Also require at least 2 words to match (to avoid too many false positives)
        // Use a subquery or count matches
        query = `
            SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
            FROM DatosEmpleados
            WHERE (${likeConditions})
            LIMIT 20
          `;

        this.logger.log(
          `🔍 Strategy 2: Searching for "${nombreNormalized}" with all words (OR): [${nombreWords.join(', ')}]`,
        );
        this.logger.log(`🔍 Query: ${query.substring(0, 300)}...`);

        try {
          let resultWithNombre =
            await this.prisma.$queryRawUnsafe<
              Array<{ CODIGO: string; nombre: string }>
            >(query);

          this.logger.log(
            `🔍 Strategy 2 (all words OR) found ${resultWithNombre?.length || 0} result(s)`,
          );

          // If no results with OR, try with AND (exact match requirement)
          if (!resultWithNombre || resultWithNombre.length === 0) {
            likeConditions = nombreWordsNormalized
              .map(
                (word) =>
                  `TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '  ', ' '), '  ', ' '))) LIKE ${this.escapeSql(`%${word}%`)}`,
              )
              .join(' AND ');

            query = `
                SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
                FROM DatosEmpleados
                WHERE ${likeConditions}
                LIMIT 10
              `;

            this.logger.log(
              `🔍 Strategy 2 (all words AND): Searching with all words (normalized): [${nombreWordsNormalized.join(', ')}]`,
            );
            resultWithNombre =
              await this.prisma.$queryRawUnsafe<
                Array<{ CODIGO: string; nombre: string }>
              >(query);
            this.logger.log(
              `🔍 Strategy 2 (all words AND) found ${resultWithNombre?.length || 0} result(s)`,
            );
          }

          // If still no results, try with majority of words
          // Strategy 2a: Try with first 2 words (most common pattern: first name + last name)
          // This avoids issues with typos in later words (like "HERAS" vs "ERAS")
          if (!resultWithNombre || resultWithNombre.length === 0) {
            // Use first 2 words (most reliable - first name and first last name)
            // This works for "JORGE EDUARDO HERAS MATOCHE" -> search with "JORGE EDUARDO"
            // which will match "ERAS MOTOCHE JORGE EDUARDO" because both contain JORGE and EDUARDO
            const importantWords = nombreWordsNormalized.slice(0, 2);
            likeConditions = importantWords
              .map(
                (word) =>
                  `TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '  ', ' '), '  ', ' '))) LIKE ${this.escapeSql(`%${word}%`)}`,
              )
              .join(' AND ');

            query = `
                SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
                FROM DatosEmpleados
                WHERE ${likeConditions}
                LIMIT 20
              `;

            this.logger.log(
              `🔍 Strategy 2a (first 2 words): Searching with ${importantWords.length} words (normalized): [${importantWords.join(', ')}]`,
            );
            resultWithNombre =
              await this.prisma.$queryRawUnsafe<
                Array<{ CODIGO: string; nombre: string }>
              >(query);
            this.logger.log(
              `🔍 Strategy 2a (first 2 words) found ${resultWithNombre?.length || 0} result(s)`,
            );
          }

          // Strategy 2b: If still no results, try with last 2 words (for cases like "NATALIA JOHANNA CUEVA GARCIA")
          // where first name might have typo but last names are correct
          if (!resultWithNombre || resultWithNombre.length === 0) {
            if (nombreWords.length >= 3) {
              // Use last 2 words (last names - usually more stable)
              const importantWords = nombreWordsNormalized.slice(-2);
              likeConditions = importantWords
                .map(
                  (word) =>
                    `TRIM(UPPER(REPLACE(REPLACE(\`NOMBRE / APELLIDOS\`, '  ', ' '), '  ', ' '))) LIKE ${this.escapeSql(`%${word}%`)}`,
                )
                .join(' AND ');

              query = `
                  SELECT CODIGO, \`NOMBRE / APELLIDOS\` as nombre
                  FROM DatosEmpleados
                  WHERE ${likeConditions}
                  LIMIT 20
                `;

              this.logger.log(
                `🔍 Strategy 2b (last 2 words): Searching with ${importantWords.length} words (normalized): [${importantWords.join(', ')}]`,
              );
              resultWithNombre =
                await this.prisma.$queryRawUnsafe<
                  Array<{ CODIGO: string; nombre: string }>
                >(query);
              this.logger.log(
                `🔍 Strategy 2b (last 2 words) found ${resultWithNombre?.length || 0} result(s)`,
              );
            }
          }

          if (resultWithNombre && resultWithNombre.length > 0) {
            // Helper function to normalize accents (Á -> A, É -> E, etc.)
            // IMPORTANT: Declare before use
            const normalizeAccents = (str: string): string => {
              return str
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                .toUpperCase();
            };

            // Verify that words match - use flexible matching (majority of words)
            for (const row of resultWithNombre) {
              const empleadoNombre = (row.nombre || '').trim().toUpperCase();
              const empleadoWords = empleadoNombre
                .split(/\s+/)
                .filter((w) => w.length >= 2);

              // Normalize both names for comparison (to handle accents)
              const empleadoNombreNormalized = normalizeAccents(empleadoNombre);
              const nombreNormalizedForCompare =
                normalizeAccents(nombreNormalized);

              // Count how many words from search name are in DB name (exact match or substring, normalized)
              const nombreWordsInDb = nombreWords.filter((word) => {
                const wordNormalized = normalizeAccents(word);
                return empleadoNombreNormalized.includes(wordNormalized);
              }).length;

              // Count how many words from DB name are in search name (exact match or substring, normalized)
              const dbWordsInNombre = empleadoWords.filter((word) => {
                const wordNormalized = normalizeAccents(word);
                return nombreNormalizedForCompare.includes(wordNormalized);
              }).length;

              // Also check for similar words (e.g., "JOHANNA" vs "JOHANA", "GLADIS" vs "GLADYS", "GONZALO" vs "GONZALEZ")
              // This handles typos or variations in spelling (like double letters, I vs Y, O vs EZ)
              let similarWordsCount = 0;

              // Helper function to calculate character similarity (Levenshtein-like but simpler)
              const calculateSimilarity = (
                word1: string,
                word2: string,
              ): number => {
                const longer = Math.max(word1.length, word2.length);
                const shorter = Math.min(word1.length, word2.length);
                if (longer === 0) return 1.0;

                // Count matching characters (position-independent for flexibility)
                let matches = 0;
                const word1Chars = word1.split('').sort();
                const word2Chars = word2.split('').sort();
                let i = 0,
                  j = 0;
                while (i < word1Chars.length && j < word2Chars.length) {
                  if (word1Chars[i] === word2Chars[j]) {
                    matches++;
                    i++;
                    j++;
                  } else if (word1Chars[i] < word2Chars[j]) {
                    i++;
                  } else {
                    j++;
                  }
                }

                // Also check prefix similarity (important for names)
                let prefixMatch = 0;
                for (let k = 0; k < shorter; k++) {
                  if (word1[k] === word2[k]) prefixMatch++;
                  else break;
                }

                // Return combined similarity (weighted: 60% character match, 40% prefix match)
                const charSimilarity = matches / longer;
                const prefixSimilarity = prefixMatch / shorter;
                return charSimilarity * 0.6 + prefixSimilarity * 0.4;
              };

              for (const extractedWord of nombreWords) {
                // Skip if already matched exactly (with or without accents)
                const extractedWordNormalized = normalizeAccents(extractedWord);
                if (
                  normalizeAccents(empleadoNombre).includes(
                    extractedWordNormalized,
                  )
                )
                  continue;

                for (const dbWord of empleadoWords) {
                  // Skip if already matched exactly (with or without accents)
                  const dbWordNormalized = normalizeAccents(dbWord);
                  if (nombreNormalizedForCompare.includes(dbWordNormalized))
                    continue;

                  // IMPORTANT: First check if normalized versions are identical (handles accents)
                  // "HERNÁNDEZ" normalized = "HERNANDEZ", "HERNANDEZ" normalized = "HERNANDEZ" → same
                  if (extractedWordNormalized === dbWordNormalized) {
                    similarWordsCount++;
                    this.logger.log(
                      `🔍 Similar words found (normalized identical): "${extractedWord}" ≈ "${dbWord}" (normalized: "${extractedWordNormalized}" = "${dbWordNormalized}")`,
                    );
                    break; // Count each extracted word only once
                  }

                  // Check if words are similar (normalize accents for comparison)
                  // Allow up to 2 characters difference in length (for "GONZALO" vs "GONZALEZ")
                  if (Math.abs(extractedWord.length - dbWord.length) <= 2) {
                    // Check prefix similarity with normalized accents (at least 4 chars or 80% of shorter word)
                    const shorter = Math.min(
                      extractedWord.length,
                      dbWord.length,
                    );
                    let commonChars = 0;
                    for (let i = 0; i < shorter; i++) {
                      // Compare normalized characters (ignore accents)
                      if (
                        normalizeAccents(extractedWord[i]) ===
                        normalizeAccents(dbWord[i])
                      )
                        commonChars++;
                      else break; // Stop at first difference for prefix matching
                    }

                    // Check if one word contains the other (normalized, for cases like "JOHANNA" containing "JOHANA")
                    const oneContainsOther =
                      extractedWordNormalized.includes(dbWordNormalized) ||
                      dbWordNormalized.includes(extractedWordNormalized);

                    // Calculate overall similarity (using normalized versions)
                    const similarity = calculateSimilarity(
                      extractedWordNormalized,
                      dbWordNormalized,
                    );

                    // Accept if: prefix match is good (>= 4 chars) OR one contains other OR overall similarity is high (>= 70%)
                    // This handles cases like:
                    // - "GLADIS" vs "GLADYS" (prefix "GLAD" = 4 chars, similarity ~77%)
                    // - "GONZALO" vs "GONZALEZ" (prefix "GONZAL" = 6 chars, similarity ~75%)
                    // - "JOHANNA" vs "JOHANA" (one contains other)
                    if (
                      commonChars >= 4 ||
                      oneContainsOther ||
                      similarity >= 0.7
                    ) {
                      similarWordsCount++;
                      this.logger.log(
                        `🔍 Similar words found: "${extractedWord}" ≈ "${dbWord}" (prefix: ${commonChars}, similarity: ${(similarity * 100).toFixed(1)}%, normalized: "${extractedWordNormalized}" ≈ "${dbWordNormalized}")`,
                      );
                      break; // Count each extracted word only once
                    }
                  }
                }
              }

              // Match if: all words match OR majority of words match (at least 50% or 2 words)
              // OR if we have similar words that compensate for differences
              // More flexible: accepts cases like "JORGE EDUARDO HERAS MATOCHE" vs "ERAS MOTOCHE JORGE EDUARDO"
              // where 2/4 words match (50%) and word count is similar
              // Also accepts "NATALIA JOHANNA CUEVA GARCIA" vs "CUEVA GARCIA NATALIA JOHANA"
              // where 3/4 words match exactly and 1 word is similar (JOHANNA vs JOHANA)
              // IMPORTANT: For cases like "GLADIS MARIA GONZALO CASTRO" vs "GLADYS MARIA GONZÁLEZ CASTRO"
              // where 2 words match exactly (MARIA, CASTRO) and 2 words are similar (GLADIS≈GLADYS, GONZALO≈GONZALEZ)
              // we need to accept if: exact matches (2) + similar words (2) >= total words (4) * 0.5 = 2
              // Also handles "YURLEDINSON HERNÁNDEZ" vs "YURLEDINSON HERNANDEZ" (accents normalized)
              const allWordsMatch = nombreWords.every((word) => {
                const wordNormalized = normalizeAccents(word);
                return empleadoNombreNormalized.includes(wordNormalized);
              });
              const minWordsToMatch = Math.max(
                2,
                Math.min(nombreWords.length, empleadoWords.length) * 0.5,
              );
              const wordCountSimilar =
                Math.abs(nombreWords.length - empleadoWords.length) <= 1;
              // Accept if exact matches + similar words >= minWordsToMatch
              // IMPORTANT: Count similar words as valid matches (they compensate for typos)
              const effectiveMatchCount = nombreWordsInDb + similarWordsCount;
              const effectiveDbMatchCount = dbWordsInNombre + similarWordsCount;
              // More lenient: accept if we have at least 2 matches total (exact + similar), OR if we have 1 exact + 1 similar
              // This handles cases like "YURLEDINSON HERNÁNDEZ" vs "HERNANDEZ YURLENDINSON":
              // - nombreWordsInDb=0 (HERNÁNDEZ doesn't match HERNANDEZ exactly, YURLEDINSON doesn't match YURLENDINSON exactly)
              // - similarWordsCount=2 (HERNÁNDEZ≈HERNANDEZ normalized identical + YURLEDINSON≈YURLENDINSON)
              // - effectiveMatchCount=0+2=2 >= 2 → accept
              const majorityMatch =
                (nombreWordsInDb >= 2 && dbWordsInNombre >= 2) ||
                (effectiveMatchCount >= 2 && effectiveDbMatchCount >= 1) ||
                (effectiveMatchCount >= minWordsToMatch &&
                  effectiveDbMatchCount >= minWordsToMatch) ||
                (effectiveMatchCount >= 2 &&
                  effectiveDbMatchCount >= 2 &&
                  wordCountSimilar) ||
                (nombreWordsInDb >= 1 &&
                  similarWordsCount >= 1 &&
                  effectiveMatchCount >= 2) ||
                (similarWordsCount >= 2 &&
                  nombreWords.length === empleadoWords.length) ||
                (nombreWordsInDb >= 2 &&
                  dbWordsInNombre >= 2 &&
                  wordCountSimilar);

              this.logger.log(
                `🔍 Checking "${empleadoNombre}": nombreWordsInDb=${nombreWordsInDb}/${nombreWords.length}, dbWordsInNombre=${dbWordsInNombre}/${empleadoWords.length}, similarWords=${similarWordsCount}, effectiveMatchCount=${effectiveMatchCount}, effectiveDbMatchCount=${effectiveDbMatchCount}, minWordsToMatch=${minWordsToMatch}, allWordsMatch=${allWordsMatch}, majorityMatch=${majorityMatch}`,
              );

              if (allWordsMatch || majorityMatch) {
                this.logger.log(
                  `✅ ${allWordsMatch ? 'All-words' : 'Majority'} match found for "${nombreNormalized}": ${row.CODIGO} (${row.nombre})`,
                );
                return row.CODIGO;
              }
            }
            // If no match found, log warning but don't return (try next strategy)
            this.logger.warn(
              `⚠️ Strategy 2 found ${resultWithNombre.length} results for "${nombreNormalized}", but none passed verification. Trying next strategy...`,
            );
          } else {
            this.logger.log(
              `⚠️ Strategy 2: No results found for "${nombreNormalized}"`,
            );
          }
        } catch (error: any) {
          this.logger.error(
            `❌ Error in Strategy 2 query for "${nombreNormalized}": ${error.message}`,
          );
          // Continue to next strategy
        }
      }

      // Strategy 3: Starts with (for partial names like "YUSBEL" matching "YUSBEL ESTRADA SMITH")
      if (nombreWords.length >= 1) {
        query = `
          SELECT CODIGO
          FROM DatosEmpleados
          WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`${nombreWords[0]}%`)}
          LIMIT 5
        `;

        result =
          await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);

        if (result && result.length > 0) {
          // If multiple matches, prefer the one that contains all words
          if (result.length === 1) {
            this.logger.log(
              `✅ Starts-with match found for "${nombreNormalized}": ${result[0].CODIGO}`,
            );
            return result[0].CODIGO;
          } else {
            // Multiple matches - try to find best match
            for (const row of result) {
              const empleadoQuery = `
                SELECT \`NOMBRE / APELLIDOS\` as nombre
                FROM DatosEmpleados
                WHERE CODIGO = ${this.escapeSql(row.CODIGO)}
                LIMIT 1
              `;
              const empleado =
                await this.prisma.$queryRawUnsafe<Array<{ nombre: string }>>(
                  empleadoQuery,
                );
              if (empleado && empleado.length > 0) {
                const empleadoNombre = empleado[0].nombre.toUpperCase();
                // Check if all words from search are in employee name
                const allWordsMatch = nombreWords.every((word) =>
                  empleadoNombre.includes(word),
                );
                if (allWordsMatch) {
                  this.logger.log(
                    `✅ Best match found for "${nombreNormalized}": ${row.CODIGO} (${empleado[0].nombre})`,
                  );
                  return row.CODIGO;
                }
              }
            }
            // If no perfect match, return first result
            this.logger.log(
              `⚠️ Multiple matches for "${nombreNormalized}", using first: ${result[0].CODIGO}`,
            );
            return result[0].CODIGO;
          }
        }
      }

      // Strategy 4: Contains (fallback)
      query = `
        SELECT CODIGO
        FROM DatosEmpleados
        WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`%${nombreNormalized}%`)}
        LIMIT 1
      `;

      result =
        await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);

      if (result && result.length > 0) {
        return result[0].CODIGO;
      }

      // Try matching first word (for cases like "YUSBEL" matching "YUSBEL ESTRADA SMITH")
      const firstWord = nombreNormalized.split(/\s+/)[0];
      if (firstWord && firstWord.length >= 3) {
        query = `
          SELECT CODIGO
          FROM DatosEmpleados
          WHERE TRIM(UPPER(\`NOMBRE / APELLIDOS\`)) LIKE ${this.escapeSql(`${firstWord}%`)}
          LIMIT 1
        `;

        result =
          await this.prisma.$queryRawUnsafe<Array<{ CODIGO: string }>>(query);

        if (result && result.length > 0) {
          return result[0].CODIGO;
        }
      }

      return null;
    } catch (error: any) {
      this.logger.warn(
        `⚠️ Error searching empleado by name "${nombre}": ${error.message}`,
      );
      return null;
    }
  }

  /**
   * Handle finiquito document: save to Nominas table and set employee as INACTIVO
   */
  private async handleFiniquitoDocument(
    pdfContent: Buffer,
    empleadoId: string,
    empleadoNombre: string,
  ): Promise<void> {
    try {
      // Extract text from PDF
      const PDFParse = pdfParseModule.PDFParse;
      const pdfInstance = new PDFParse({
        data: new Uint8Array(pdfContent),
      });
      const textResult = await pdfInstance.getText();
      const textContent =
        textResult && typeof textResult === 'object' && 'text' in textResult
          ? textResult.text
          : typeof textResult === 'string'
            ? textResult
            : '';

      if (!textContent) {
        this.logger.warn('⚠️ Could not extract text from finiquito PDF');
        return;
      }

      // Extract mes/ano from PDF (from Fecha Baja pattern: "del X de [mes] al Y de [mes] de [an]")
      const meses = [
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

      let mesNombre: string | null = null;
      let ano: number | null = null;

      // Try to extract from "del X de [mes] al Y de [mes] de [an]" pattern
      const fechaBajaPattern =
        /del\s+\d{1,2}\s+de\s+\w+\s+al\s+(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{1,4}[\.]?\d{0,4})/i;
      const fechaBajaMatch = textContent.match(fechaBajaPattern);
      if (fechaBajaMatch) {
        const mesNombreExtraido = fechaBajaMatch[2].toLowerCase();
        const anoStr = fechaBajaMatch[3].replace(/\./g, '');
        // Find matching month name (full or partial match)
        const mesEncontrado = meses.find(
          (m) => mesNombreExtraido.includes(m) || m.includes(mesNombreExtraido),
        );
        if (mesEncontrado) {
          mesNombre = mesEncontrado;
          ano = parseInt(anoStr, 10);
        }
      }

      // Fallback to current month/year if extraction failed
      if (!mesNombre || !ano) {
        const now = new Date();
        const mesIndex = now.getMonth();
        mesNombre = meses[mesIndex];
        ano = now.getFullYear();
        this.logger.log(
          `⚠️ Could not extract mes/ano from finiquito PDF, using current: ${mesNombre}/${ano}`,
        );
      } else {
        this.logger.log(
          `✅ Extracted mes/ano from finiquito PDF: ${mesNombre}/${ano}`,
        );
      }

      // Prepare nombre with "FINIQUITO - " prefix
      const nombreFinalConTipo = `FINIQUITO - ${empleadoNombre}`;

      // Check for duplicates
      const nombreNormalized = nombreFinalConTipo.trim().toUpperCase();
      const duplicateCheck = `
        SELECT \`id\`
        FROM \`Nominas\`
        WHERE \`Mes\` = ${this.escapeSql(mesNombre)}
          AND \`Ano\` = ${this.escapeSql(ano.toString())}
          AND TRIM(UPPER(\`nombre\`)) = ${this.escapeSql(nombreNormalized)}
        LIMIT 1
      `;
      const duplicate =
        await this.prisma.$queryRawUnsafe<Array<{ id: number }>>(
          duplicateCheck,
        );

      if (duplicate.length > 0) {
        this.logger.warn(
          `⚠️ Finiquito already exists in Nominas for ${nombreFinalConTipo} in ${mesNombre}/${ano}`,
        );
        return;
      }

      // Insert into Nominas table (save month name in Spanish, not number)
      const insertQuery = `
        INSERT INTO \`Nominas\` (
          \`nombre\`,
          \`archivo\`,
          \`tipo_mime\`,
          \`fecha_subida\`,
          \`Mes\`,
          \`Ano\`,
          \`codigo_empleado\`
        ) VALUES (
          ${this.escapeSql(nombreFinalConTipo)},
          ${pdfContent.length > 0 ? `0x${pdfContent.toString('hex')}` : 'NULL'},
          ${this.escapeSql('application/pdf')},
          NOW(),
          ${this.escapeSql(mesNombre)},
          ${this.escapeSql(ano.toString())},
          ${this.escapeSql(empleadoId)}
        )
      `;

      await this.prisma.$executeRawUnsafe(insertQuery);
      this.logger.log(
        `✅ Finiquito saved to Nominas: ${nombreFinalConTipo} - ${mesNombre}/${ano} (empleado: ${empleadoId})`,
      );

      // Set employee status to INACTIVO if currently ACTIVO
      await this.setEmpleadoInactivo(empleadoId);
    } catch (error: any) {
      this.logger.error(
        `❌ Error handling finiquito document: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Set employee status to INACTIVO if currently ACTIVO
   */
  private async setEmpleadoInactivo(codigo: string): Promise<boolean> {
    try {
      // Check if employee is ACTIVO
      const checkQuery = `
        SELECT \`ESTADO\`
        FROM \`DatosEmpleados\`
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
        LIMIT 1
      `;
      const empleado =
        await this.prisma.$queryRawUnsafe<Array<{ ESTADO: string }>>(
          checkQuery,
        );

      if (empleado.length === 0) {
        this.logger.warn(
          `⚠️ Employee with CODIGO ${codigo} not found for status update`,
        );
        return false;
      }

      const estadoActual = empleado[0]?.ESTADO?.trim().toUpperCase();

      // If already INACTIVO or other status, don't update
      if (estadoActual !== 'ACTIVO') {
        this.logger.log(
          `ℹ️ Employee ${codigo} already has status ${estadoActual}, not updating`,
        );
        return false;
      }

      // Update to INACTIVO
      const updateQuery = `
        UPDATE \`DatosEmpleados\`
        SET \`ESTADO\` = 'INACTIVO'
        WHERE \`CODIGO\` = ${this.escapeSql(codigo)}
          AND \`ESTADO\` = 'ACTIVO'
      `;
      await this.prisma.$executeRawUnsafe(updateQuery);

      this.logger.log(
        `✅ Status updated to INACTIVO for employee ${codigo} (finiquito detected)`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `❌ Error updating employee status for ${codigo}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Normalize filename to avoid encoding issues
   * Removes emojis and converts problematic characters to ASCII-safe equivalents
   */
  private normalizeFilename(filename: string): string {
    // Remove emojis and other non-ASCII characters that cause MySQL encoding issues
    // Keep basic Latin, numbers, common punctuation, and accented characters (á, é, í, ó, ú, ñ, etc.)
    let normalized = filename
      // Remove emojis (4-byte UTF-8 characters)
      .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
      // Remove other problematic Unicode ranges
      .replace(/[\u{10000}-\u{10FFFF}]/gu, '')
      // Replace common problematic characters with ASCII equivalents
      .replace(/[^\x20-\x7E\u00A0-\u024F\u1E00-\u1EFF]/g, '_')
      // Clean up multiple underscores
      .replace(/_+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_+|_+$/g, '');

    // Ensure filename is not empty
    if (!normalized || normalized.trim().length === 0) {
      normalized = `document_${Date.now()}`;
    }

    // Limit filename length (MySQL has limits)
    if (normalized.length > 255) {
      const ext = normalized.substring(normalized.lastIndexOf('.'));
      const name = normalized.substring(0, 255 - ext.length);
      normalized = name + ext;
    }

    return normalized;
  }

  /**
   * Preview folder and extract documents without saving them
   * Processes files organized in subfolders (each subfolder = potential employee)
   */
  async previewFolder(
    files: Express.Multer.File[],
    paths: string[],
  ): Promise<{
    success: boolean;
    documents: Array<{
      id: string;
      filename: string;
      normalizedFilename: string;
      contentType: string;
      size: number;
      preview?: string;
      classification: {
        tipoDocumento: string | null;
        empleadoId: string | null;
        empleadoNombre: string | null;
        confidence: number;
      };
      folderMetadata: {
        folderPath: string;
        folderName: string;
        subfolderName: string;
        employeeFolderName: string | null;
      };
      idempotencyKey: string;
      isDuplicate: boolean;
      content: string; // Base64 encoded content
    }>;
  }> {
    const documents: any[] = [];

    this.logger.log(`📁 Previewing folder with ${files.length} files`);

    // Organize files by folder structure
    const folderStructure: {
      [folderName: string]: Array<{
        file: Express.Multer.File;
        path: string;
        subfolderName: string;
        employeeFolderName: string | null;
      }>;
    } = {};

    files.forEach((file, index) => {
      const path = paths[index] || file.originalname;
      const parts = path.split('/');
      // Get the immediate parent folder (subfolder), not the root folder
      // Example: "Personal DeCamino 2025/ZUÑIGA AZCARATE CARLOS ADOLFO/file.pdf"
      // -> folderName = "Personal DeCamino 2025" (root)
      // -> subfolderName = "ZUÑIGA AZCARATE CARLOS ADOLFO" (employee folder)
      // Example: "Personal DeCamino 2025/NEACSU DECEBAL MARIUS/Vacaciones/file.pdf"
      // -> folderName = "Personal DeCamino 2025" (root)
      // -> subfolderName = "Vacaciones" (immediate parent)
      // -> employeeFolderName = "NEACSU DECEBAL MARIUS" (parent of subfolder)
      const folderName = parts.length > 1 ? parts[0] : 'root';
      const subfolderName =
        parts.length > 2
          ? parts[parts.length - 2]
          : parts.length > 1
            ? parts[0]
            : 'root';
      // Get employee folder name (parent of subfolder if subfolder is generic)
      const employeeFolderName =
        parts.length > 3
          ? parts[parts.length - 3]
          : parts.length > 2
            ? parts[parts.length - 2]
            : null;

      if (!folderStructure[folderName]) {
        folderStructure[folderName] = [];
      }
      folderStructure[folderName].push({
        file,
        path,
        subfolderName,
        employeeFolderName,
      });
    });

    // Process each folder (potential employee)
    for (const [folderName, folderFiles] of Object.entries(folderStructure)) {
      this.logger.log(
        `📂 Processing folder: ${folderName} (${folderFiles.length} files)`,
      );

      // Process each file in folder
      for (const {
        file,
        path,
        subfolderName,
        employeeFolderName,
      } of folderFiles) {
        // Try to identify employee from folder structure
        // Priority: employeeFolderName > subfolderName (if subfolder is generic)
        let folderEmpleadoId: string | null = null;
        let folderEmpleadoNombre: string | null = null;

        // List of generic folder names that are NOT employee names
        const genericFolderNames = [
          'vacaciones',
          'contratos',
          'documentos',
          'personal',
          'archivos',
          'fichas',
          'nominas',
          'bajas',
          'altas',
        ];
        const isGenericSubfolder =
          subfolderName &&
          genericFolderNames.includes(subfolderName.toLowerCase());

        // If subfolder is generic (like "Vacaciones"), try employeeFolderName instead
        if (
          isGenericSubfolder &&
          employeeFolderName &&
          employeeFolderName !== 'root' &&
          employeeFolderName !== folderName
        ) {
          try {
            folderEmpleadoId =
              await this.findEmpleadoByNombre(employeeFolderName);
            if (folderEmpleadoId) {
              folderEmpleadoNombre =
                await this.getEmpleadoNombreByCodigo(folderEmpleadoId);
              this.logger.log(
                `✅ Found empleado for employee folder "${employeeFolderName}" (subfolder "${subfolderName}" is generic): ${folderEmpleadoId} (${folderEmpleadoNombre})`,
              );
            }
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Error finding empleado for employee folder "${employeeFolderName}": ${error.message}`,
            );
          }
        }

        // IMPORTANT: Identify employee from folder name BEFORE checking for duplicates
        // This ensures we have empleadoId even if document is marked as duplicate
        // If we didn't find from employeeFolderName, try subfolderName (if not generic)
        // NOTE: subfolderName === folderName is OK when folder is directly the employee name (e.g., "MOHAMED AHRAOU/file.pdf")
        if (
          !folderEmpleadoId &&
          subfolderName &&
          subfolderName !== 'root' &&
          !isGenericSubfolder
        ) {
          try {
            folderEmpleadoId = await this.findEmpleadoByNombre(subfolderName);
            if (folderEmpleadoId) {
              folderEmpleadoNombre =
                await this.getEmpleadoNombreByCodigo(folderEmpleadoId);
              this.logger.log(
                `✅ Found empleado for subfolder "${subfolderName}": ${folderEmpleadoId} (${folderEmpleadoNombre})`,
              );
            } else {
              // If exact match failed, try with more flexible matching (for names like "MOHAMED AHRAOU")
              // Try to find by partial name match (split name into words)
              const nameWords = subfolderName
                .trim()
                .split(/\s+/)
                .filter((w) => w.length >= 2);
              if (nameWords.length >= 2) {
                // Try to find by first and last name
                const firstName = nameWords[0];
                const lastName = nameWords[nameWords.length - 1];
                try {
                  const empleadoCodigo = await this.findEmpleadoByNombre(
                    `${firstName} ${lastName}`,
                  );
                  if (empleadoCodigo) {
                    folderEmpleadoId = empleadoCodigo;
                    folderEmpleadoNombre =
                      await this.getEmpleadoNombreByCodigo(folderEmpleadoId);
                    this.logger.log(
                      `✅ Found empleado with flexible matching for subfolder "${subfolderName}": ${folderEmpleadoId} (${folderEmpleadoNombre})`,
                    );
                  }
                } catch (error: any) {
                  this.logger.warn(
                    `⚠️ Flexible matching failed for "${subfolderName}": ${error.message}`,
                  );
                }
              }
            }
          } catch (error: any) {
            this.logger.error(
              `❌ Error finding empleado for subfolder "${subfolderName}": ${error.message}`,
            );
          }
        }

        try {
          const buffer = file.buffer;
          const filename =
            file.originalname || path.split('/').pop() || 'unknown';
          const contentType = file.mimetype || 'application/octet-stream';

          // Generate idempotency key from folder path + filename
          const idempotencyKey = this.generateIdempotencyKey(
            `folder:${path}`,
            filename,
          );

          // Check if document already exists (idempotency)
          const existing = await this.prisma.$queryRawUnsafe<any[]>(
            `SELECT doc_id, id, detected_empleado_id, nombre_empleado FROM DocumentosOficiales WHERE idempotency_key = ${this.escapeSql(idempotencyKey)} LIMIT 1`,
          );

          let isDuplicate = existing && existing.length > 0;

          // If document exists but we don't have empleadoId yet, try to get it from existing document
          // OR if existing document has empleadoId but we found a better match from folder name, use folder name
          if (isDuplicate && existing[0]) {
            const existingDoc = existing[0];
            // Use detected_empleado_id if available, otherwise try id (if not 'PENDING')
            const existingEmpleadoId =
              existingDoc.detected_empleado_id ||
              (existingDoc.id && existingDoc.id !== 'PENDING'
                ? existingDoc.id
                : null);

            // If we don't have empleadoId from folder, use the one from existing document
            if (!folderEmpleadoId && existingEmpleadoId) {
              folderEmpleadoId = existingEmpleadoId;
              folderEmpleadoNombre = existingDoc.nombre_empleado || null;
              this.logger.log(
                `✅ Using empleado from existing duplicate document: ${folderEmpleadoId} (${folderEmpleadoNombre || 'N/A'})`,
              );
            }
            // If we have empleadoId from folder but existing document doesn't have one, keep folder empleadoId
            // (folder name is more reliable than a document that was saved without empleadoId)
          }

          // Classify document
          // Use employee folder name or subfolder name as "subject" if it's not generic, otherwise use filename
          const genericFolderNames = [
            'vacaciones',
            'contratos',
            'documentos',
            'personal',
            'archivos',
            'fichas',
            'nominas',
            'bajas',
            'altas',
          ];
          const isGenericSubfolder =
            subfolderName &&
            genericFolderNames.includes(subfolderName.toLowerCase());

          let subjectForClassification = filename; // Default to filename
          if (
            employeeFolderName &&
            employeeFolderName !== 'root' &&
            employeeFolderName !== folderName
          ) {
            // If we have employee folder name, use it (best option)
            subjectForClassification = employeeFolderName;
          } else if (
            subfolderName &&
            subfolderName !== 'root' &&
            subfolderName !== folderName &&
            !isGenericSubfolder
          ) {
            // If subfolder is not generic, use it
            subjectForClassification = subfolderName;
          }
          // Otherwise use filename (which may contain the name, e.g., "Vacaciones NEACSU, DECEBAL MARIUS(2).pdf")

          const classification = await classifyDocument(
            filename,
            subjectForClassification, // Use employee folder, subfolder, or filename as "subject" for classification
            contentType.startsWith('application/pdf') ? buffer : undefined,
          );

          // If subfolder name gave us an employee, use it (unless classification found a better match)
          // PRIORITY: folderEmpleadoId > classification.empleadoId (folder name is more reliable)
          if (folderEmpleadoId) {
            // Always use folder empleadoId if we found it (even if classification found one)
            // This ensures documents in employee folders are correctly associated
            classification.empleadoId = folderEmpleadoId;
            classification.empleadoNombre =
              folderEmpleadoNombre || subfolderName;
            classification.confidence = Math.max(classification.confidence, 60); // Boost confidence if found from folder
            this.logger.log(
              `✅ Using empleado from folder/subfolder: ${folderEmpleadoId} (${classification.empleadoNombre})`,
            );
          } else if (!classification.empleadoId) {
            // If we didn't find from folder and classification didn't find either, log warning
            this.logger.warn(
              `⚠️ No empleado found for document "${filename}" in folder "${subfolderName}"`,
            );
          }

          // If classification extracted a name from PDF but no code, try to find code
          // This is especially important for contracts where the PDF has the employee name
          if (classification.empleadoNombre && !classification.empleadoId) {
            // First try the extracted name from PDF
            try {
              const empleadoCodigo = await this.findEmpleadoByNombre(
                classification.empleadoNombre,
              );
              if (empleadoCodigo) {
                const empleadoNombreFromDbCheck =
                  await this.getEmpleadoNombreByCodigo(empleadoCodigo);
                if (empleadoNombreFromDbCheck) {
                  // Validate match
                  const extractedNameNormalized = classification.empleadoNombre
                    .trim()
                    .toUpperCase();
                  const dbNameNormalized = empleadoNombreFromDbCheck
                    .trim()
                    .toUpperCase();

                  const normalizeAccents = (str: string): string => {
                    return str
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .toUpperCase();
                  };

                  const extractedNameNormalizedForCompare = normalizeAccents(
                    extractedNameNormalized,
                  );
                  const dbNameNormalizedForCompare =
                    normalizeAccents(dbNameNormalized);

                  const extractedWords = extractedNameNormalized
                    .split(/\s+/)
                    .filter((w) => w.length >= 2);
                  const dbWords = dbNameNormalized
                    .split(/\s+/)
                    .filter((w) => w.length >= 2);

                  const exactMatch =
                    extractedNameNormalizedForCompare ===
                    dbNameNormalizedForCompare;
                  const allExtractedWordsInDb =
                    extractedWords.length > 0 &&
                    extractedWords.every((word) => {
                      const wordNormalized = normalizeAccents(word);
                      return dbNameNormalizedForCompare.includes(
                        wordNormalized,
                      );
                    });
                  const allDbWordsInExtracted =
                    dbWords.length > 0 &&
                    dbWords.every((word) => {
                      const wordNormalized = normalizeAccents(word);
                      return extractedNameNormalizedForCompare.includes(
                        wordNormalized,
                      );
                    });

                  if (
                    exactMatch ||
                    allExtractedWordsInDb ||
                    allDbWordsInExtracted
                  ) {
                    classification.empleadoId = empleadoCodigo;
                    this.logger.log(
                      `✅ Found empleado from PDF content: ${empleadoCodigo} (${classification.empleadoNombre} -> ${empleadoNombreFromDbCheck})`,
                    );
                  }
                }
              }
            } catch (error: any) {
              this.logger.warn(
                `⚠️ Error finding empleado by extracted name "${classification.empleadoNombre}": ${error.message}`,
              );
            }
          }

          // PRIORITY 1: Try to find employee by DNI/NIE or Social Security Number
          if (!classification.empleadoId) {
            if (classification.dniNie) {
              try {
                const empleadoCodigo = await this.findEmpleadoByDNINIE(
                  classification.dniNie,
                );
                if (empleadoCodigo) {
                  classification.empleadoId = empleadoCodigo;
                  this.logger.log(
                    `✅ Found empleado code ${empleadoCodigo} by DNI/NIE "${classification.dniNie}"`,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error finding empleado by DNI/NIE "${classification.dniNie}": ${error.message}`,
                );
              }
            }

            if (!classification.empleadoId && classification.segSocial) {
              try {
                const empleadoCodigo = await this.findEmpleadoBySegSocial(
                  classification.segSocial,
                );
                if (empleadoCodigo) {
                  classification.empleadoId = empleadoCodigo;
                  this.logger.log(
                    `✅ Found empleado code ${empleadoCodigo} by Seg. Social "${classification.segSocial}"`,
                  );
                }
              } catch (error: any) {
                this.logger.warn(
                  `⚠️ Error finding empleado by Seg. Social "${classification.segSocial}": ${error.message}`,
                );
              }
            }
          }

          // Note: The name matching from PDF content is already done above
          // This section is now redundant but kept for fallback

          // Also check by filename + size + empleadoId (catches same file sent in different emails or folders)
          if (!isDuplicate) {
            isDuplicate = await this.checkDuplicateByFilenameAndSize(
              filename,
              buffer.length,
              classification.empleadoId || null,
            );
            if (isDuplicate) {
              this.logger.log(
                `🔍 Duplicate detected by filename + size + empleado: ${filename} (${buffer.length} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
              );
            }
          }

          // For images, also check by content hash (most reliable for detecting exact duplicates)
          if (!isDuplicate && buffer.length > 0) {
            // Only check hash for smaller files (< 5MB) to avoid performance issues
            if (buffer.length < 5 * 1024 * 1024) {
              isDuplicate = await this.checkDuplicateByContentHash(
                buffer,
                classification.empleadoId || null,
              );
              if (isDuplicate) {
                this.logger.log(
                  `🔍 Duplicate detected by content hash: ${filename} (${buffer.length} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
                );
              }
            }
          }

          // Get employee name from DB if we have code
          let empleadoNombreFromDb: string | null = null;
          if (classification.empleadoId) {
            try {
              empleadoNombreFromDb = await this.getEmpleadoNombreByCodigo(
                classification.empleadoId,
              );
            } catch {
              // Silently fail
            }
          }

          // Generate preview
          let preview: string | undefined;
          try {
            if (contentType.startsWith('image/')) {
              preview = `data:${contentType};base64,${buffer.toString('base64')}`;
            } else if (contentType === 'application/pdf') {
              try {
                // Use PDFParse class (consistent with other places in codebase)
                const PDFParse = pdfParseModule.PDFParse;
                const pdfInstance = new PDFParse({
                  data: new Uint8Array(buffer),
                });
                const pdfData = await pdfInstance.getText();
                const pdfText =
                  pdfData && typeof pdfData === 'object' && 'text' in pdfData
                    ? pdfData.text
                    : typeof pdfData === 'string'
                      ? pdfData
                      : '';
                preview = pdfText.substring(0, 500); // First 500 chars
              } catch (e: any) {
                this.logger.warn(
                  `⚠️ Failed to parse PDF ${filename}: ${e.message}`,
                );
              }
            }
          } catch (e: any) {
            this.logger.warn(
              `⚠️ Failed to generate preview for ${filename}: ${e.message}`,
            );
          }

          // Also check by filename + size + empleadoId (catches same file sent in different emails or folders)
          if (!isDuplicate) {
            isDuplicate = await this.checkDuplicateByFilenameAndSize(
              filename,
              buffer.length,
              classification.empleadoId || null,
            );
            if (isDuplicate) {
              this.logger.log(
                `🔍 Duplicate detected by filename + size + empleado: ${filename} (${buffer.length} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
              );
            }
          }

          // For images, also check by content hash (most reliable for detecting exact duplicates)
          if (!isDuplicate && buffer.length > 0) {
            // Only check hash for smaller files (< 5MB) to avoid performance issues
            if (buffer.length < 5 * 1024 * 1024) {
              isDuplicate = await this.checkDuplicateByContentHash(
                buffer,
                classification.empleadoId || null,
              );
              if (isDuplicate) {
                this.logger.log(
                  `🔍 Duplicate detected by content hash: ${filename} (${buffer.length} bytes, empleado: ${classification.empleadoId || 'unknown'})`,
                );
              }
            }
          }

          const normalizedFilename = this.normalizeFilename(filename);

          documents.push({
            id: idempotencyKey, // Use idempotency key as temporary ID
            filename,
            normalizedFilename,
            contentType,
            size: buffer.length,
            preview,
            classification: {
              ...classification,
              empleadoNombreFromDb,
            },
            folderMetadata: {
              folderPath: path,
              folderName: folderName, // Root folder (e.g., "Personal DeCamino 2025")
              subfolderName: subfolderName, // Immediate subfolder (e.g., "Vacaciones" or "ZUÑIGA AZCARATE CARLOS ADOLFO")
              employeeFolderName: employeeFolderName || null, // Employee folder name if subfolder is generic (e.g., "NEACSU DECEBAL MARIUS")
            },
            idempotencyKey,
            isDuplicate,
            content: buffer.toString('base64'), // Store content as base64 for frontend
          });
        } catch (error: any) {
          this.logger.error(
            `❌ Error processing file ${path}: ${error.message}`,
          );
        }
      }
    }

    return {
      success: true,
      documents,
    };
  }

  /**
   * Save selected documents from folder preview
   */
  async saveFolderDocuments(
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
        subfolderName: string;
        employeeFolderName: string | null;
      };
      idempotencyKey: string;
      contentBase64?: string; // Base64 encoded content from frontend
    }>,
  ): Promise<{
    success: boolean;
    saved: number;
    skipped: number;
    errors: number;
  }> {
    if (!selectedDocuments || selectedDocuments.length === 0) {
      return { success: true, saved: 0, skipped: 0, errors: 0 };
    }

    let saved = 0;
    let skipped = 0;
    let errors = 0;

    this.logger.log(
      `💾 Saving ${selectedDocuments.length} documents from folder`,
    );

    for (let i = 0; i < selectedDocuments.length; i++) {
      const doc = selectedDocuments[i];

      // Add small delay between documents to avoid overwhelming the database connection
      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms delay between documents
      }
      try {
        // Check if document already exists (idempotency) with retry logic
        let isDuplicate = false;
        let retriesCheck = 3;
        while (retriesCheck > 0) {
          try {
            const existing = await this.prisma.$queryRawUnsafe<any[]>(
              `SELECT doc_id FROM DocumentosOficiales WHERE idempotency_key = ${this.escapeSql(doc.idempotencyKey)} LIMIT 1`,
            );
            isDuplicate = existing && existing.length > 0;
            break; // Success, exit retry loop
          } catch (error: any) {
            retriesCheck--;
            const errorMessage = error.message || 'Unknown error';
            const errorCode = error.code || '';
            const isConnectionError =
              errorMessage.includes('Server has closed the connection') ||
              errorMessage.includes('Connection lost') ||
              errorMessage.includes('ECONNRESET') ||
              errorMessage === 'N/A' ||
              errorCode === 'PROTOCOL_CONNECTION_LOST' ||
              errorCode === 'ECONNRESET' ||
              errorCode === 'ETIMEDOUT' ||
              errorCode === 'P2010' ||
              (errorMessage.includes('Raw query failed') &&
                (errorCode === 'N/A' || errorCode === 'P2010'));

            if (isConnectionError && retriesCheck > 0) {
              this.logger.warn(
                `⚠️ Connection error checking idempotency for ${doc.filename}, retrying... (${retriesCheck} retries left)`,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (4 - retriesCheck)),
              );
            } else {
              this.logger.warn(
                `⚠️ Error checking idempotency for ${doc.filename}: ${errorMessage}, assuming not duplicate`,
              );
              isDuplicate = false; // Assume not duplicate on error
              break;
            }
          }
        }

        // Also check by filename + size + empleadoId (catches same file sent in different emails or folders)
        if (!isDuplicate) {
          isDuplicate = await this.checkDuplicateByFilenameAndSize(
            doc.filename,
            doc.size,
            doc.classification.empleadoId || null,
          );
          if (isDuplicate) {
            this.logger.log(
              `🔍 Duplicate detected by filename + size + empleado: ${doc.filename} (${doc.size} bytes, empleado: ${doc.classification.empleadoId || 'unknown'})`,
            );
          }
        }

        // For images, also check by content hash (most reliable for detecting exact duplicates)
        if (!isDuplicate && doc.contentBase64) {
          try {
            const contentBuffer = Buffer.from(doc.contentBase64, 'base64');
            // Only check hash for smaller files (< 5MB) to avoid performance issues
            if (contentBuffer.length < 5 * 1024 * 1024) {
              isDuplicate = await this.checkDuplicateByContentHash(
                contentBuffer,
                doc.classification.empleadoId || null,
              );
              if (isDuplicate) {
                this.logger.log(
                  `🔍 Duplicate detected by content hash: ${doc.filename} (${doc.size} bytes, empleado: ${doc.classification.empleadoId || 'unknown'})`,
                );
              }
            }
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Error checking hash for ${doc.filename}: ${error.message}`,
            );
          }
        }

        if (isDuplicate) {
          this.logger.log(`⏭️ Skipping duplicate document: ${doc.filename}`);
          skipped++;
          continue;
        }

        // Get employee name and email from database (if we have empleadoId)
        let empleadoNombreFromDb: string | null = null;
        let empleadoEmailFromDb: string | null = null;
        if (doc.classification.empleadoId) {
          try {
            empleadoNombreFromDb = await this.getEmpleadoNombreByCodigo(
              doc.classification.empleadoId,
            );
            empleadoEmailFromDb = await this.getEmpleadoEmailByCodigo(
              doc.classification.empleadoId,
            );
          } catch {
            // Silently fail
          }
        }

        // Use DB name if available, otherwise fallback to extracted name
        const nombreToSave =
          empleadoNombreFromDb || doc.classification.empleadoNombre || null;

        // Prepare metadata (ensure all values are safe for JSON)
        const ingestionMetadata = {
          source: 'folder',
          folderPath: doc.folderMetadata.folderPath || '',
          folderName: doc.folderMetadata.folderName || '',
          subfolderName: doc.folderMetadata.subfolderName || null,
          employeeFolderName: doc.folderMetadata.employeeFolderName || null,
        };

        // Ensure JSON string is safe (escape any problematic characters)
        let metadataJson: string;
        try {
          metadataJson = JSON.stringify(ingestionMetadata);
        } catch (jsonError: any) {
          this.logger.warn(
            `⚠️ Error stringifying metadata for ${doc.filename}, using minimal metadata: ${jsonError.message}`,
          );
          metadataJson = JSON.stringify({
            source: 'folder',
            folderName: doc.folderMetadata.folderName || '',
          });
        }

        // Decode content from base64
        let contentBuffer: Buffer | null = null;
        if (doc.contentBase64) {
          try {
            contentBuffer = Buffer.from(doc.contentBase64, 'base64');
          } catch (error: any) {
            this.logger.warn(
              `⚠️ Failed to decode base64 content for ${doc.filename}: ${error.message}`,
            );
            errors++;
            continue;
          }
        }

        if (!contentBuffer || contentBuffer.length === 0) {
          this.logger.warn(
            `⚠️ No content for document ${doc.filename}, skipping`,
          );
          errors++;
          continue;
        }

        // Check file size limit (5MB) - larger files cause query size issues
        // When converted to hex in SQL, a 5MB file becomes ~10MB query, which is manageable
        // Files larger than 5MB will create queries > 10MB which can cause P2010 errors
        const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
        if (contentBuffer.length > MAX_FILE_SIZE) {
          this.logger.warn(
            `⚠️ File ${doc.filename} is too large (${(contentBuffer.length / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB. Skipping...`,
          );
          errors++;
          continue;
        }

        // Normalize folder path for source_message_id to avoid encoding issues
        const normalizedFolderPath = this.normalizeFilename(
          doc.folderMetadata.folderPath,
        );
        const sourceMessageId = `folder:${normalizedFolderPath}`;

        // Insert document as PENDING_REVIEW
        const query = `
          INSERT INTO \`DocumentosOficiales\` (
            \`id\`,
            \`correo_electronico\`,
            \`tipo_documento\`,
            \`nombre_archivo\`,
            \`nombre_empleado\`,
            \`fecha_creacion\`,
            \`archivo\`,
            \`status\`,
            \`source_message_id\`,
            \`source_attachment_id\`,
            \`source_mailbox\`,
            \`idempotency_key\`,
            \`detected_empleado_id\`,
            \`detected_tipo_documento\`,
            \`ingestion_metadata\`
          ) VALUES (
            ${this.escapeSql(doc.classification.empleadoId || 'PENDING')},
            ${this.escapeSql(empleadoEmailFromDb)},
            ${this.escapeSql(doc.classification.tipoDocumento || null)},
            ${this.escapeSql(doc.normalizedFilename)},
            ${this.escapeSql(nombreToSave)},
            NOW(),
            ${contentBuffer.length > 0 ? `0x${contentBuffer.toString('hex')}` : 'NULL'},
            'PENDING_REVIEW',
            ${this.escapeSql(sourceMessageId)},
            ${this.escapeSql(doc.normalizedFilename)},
            ${this.escapeSql('FOLDER')},
            ${this.escapeSql(doc.idempotencyKey)},
            ${this.escapeSql(doc.classification.empleadoId || null)},
            ${this.escapeSql(doc.classification.tipoDocumento || null)},
            ${this.escapeSql(metadataJson)}
          )
        `;

        // Retry logic for database operations (handles connection errors)
        let retries = 3;
        let savedSuccessfully = false;
        while (retries > 0 && !savedSuccessfully) {
          try {
            // Log query size for debugging (but not the full query to avoid log spam)
            const querySize = query.length;
            const contentSize = contentBuffer.length;
            if (querySize > 1000000 || contentSize > 10 * 1024 * 1024) {
              this.logger.warn(
                `⚠️ Large query detected for ${doc.filename}: query=${(querySize / 1024).toFixed(1)}KB, content=${(contentSize / 1024 / 1024).toFixed(1)}MB`,
              );
            }

            await this.prisma.$executeRawUnsafe(query);
            saved++;
            savedSuccessfully = true;
            this.logger.log(
              `✅ Saved document: ${doc.filename} (detected: ${doc.classification.tipoDocumento || 'unknown'}, empleado: ${doc.classification.empleadoId || 'unknown'})`,
            );
          } catch (error: any) {
            retries--;
            const errorMessage = error.message || 'Unknown error';
            const errorCode = error.code || '';

            // Log full error details for P2010 errors (query syntax issues)
            if (
              errorCode === 'P2010' ||
              errorMessage.includes('Raw query failed')
            ) {
              this.logger.error(
                `❌ P2010 Query error for ${doc.filename}: ${errorMessage} (code: ${errorCode})`,
              );
              // Log query preview (first 500 chars) for debugging
              this.logger.error(
                `   Query preview: ${query.substring(0, 500)}... (total length: ${query.length})`,
              );
            }

            // Detect connection errors (including "N/A" which indicates connection issues)
            // P2010 can be connection-related OR query syntax-related
            const isConnectionError =
              errorMessage.includes('Server has closed the connection') ||
              errorMessage.includes('Connection lost') ||
              errorMessage.includes('ECONNRESET') ||
              errorMessage === 'N/A' ||
              errorCode === 'PROTOCOL_CONNECTION_LOST' ||
              errorCode === 'ECONNRESET' ||
              errorCode === 'ETIMEDOUT' ||
              (errorCode === 'P2010' && errorMessage.includes('N/A')); // Only treat P2010 as connection error if message is N/A

            if (isConnectionError && retries > 0) {
              this.logger.warn(
                `⚠️ Connection error saving ${doc.filename}, retrying... (${retries} retries left, error: ${errorMessage})`,
              );
              // Wait before retrying (exponential backoff: 1s, 2s, 3s)
              await new Promise((resolve) =>
                setTimeout(resolve, 1000 * (4 - retries)),
              );

              // Try to reconnect Prisma if connection is lost
              try {
                // Force disconnect and reconnect
                try {
                  await this.prisma.$disconnect();
                } catch {
                  // Ignore disconnect errors
                }
                // Wait a bit before reconnecting
                await new Promise((resolve) => setTimeout(resolve, 500));
                // Simple ping query to test connection (this will auto-reconnect)
                await this.prisma.$queryRawUnsafe('SELECT 1');
                this.logger.log(`✅ Prisma connection restored`);
              } catch (reconnectError: any) {
                this.logger.warn(
                  `⚠️ Connection test failed, will retry anyway: ${reconnectError.message}`,
                );
              }
            } else {
              // P2010 with detailed error message = query syntax issue, don't retry
              this.logger.error(
                `❌ Error saving document ${doc.filename}: ${errorMessage} (code: ${errorCode || 'N/A'})`,
              );
              errors++;
              break;
            }
          }
        }
      } catch (error: any) {
        // Outer catch for any other errors (shouldn't happen, but safety net)
        this.logger.error(
          `❌ Unexpected error processing document ${doc.filename}: ${error.message || 'Unknown error'}`,
        );
        errors++;
      }
    }

    return {
      success: true,
      saved,
      skipped,
      errors,
    };
  }
}
