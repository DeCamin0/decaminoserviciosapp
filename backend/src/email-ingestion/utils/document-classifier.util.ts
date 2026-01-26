import { Logger } from '@nestjs/common';
import * as pdfParseModule from 'pdf-parse';

const logger = new Logger('DocumentClassifierUtil');

/**
 * Document types that can be detected
 */
export type DocumentType =
  | 'nomina'
  | 'vida_laboral'
  | 'contrato'
  | 'anexo'
  | 'sancion'
  | 'certificado'
  | 'baja'
  | 'alta'
  | 'cv'
  | 'liquidacion'
  | 'finiquito'
  | 'sello'
  | 'ficha'
  | 'disminucion'
  | 'otro';

/**
 * Result of document classification
 */
export interface ClassificationResult {
  tipoDocumento: DocumentType | null;
  empleadoId: string | null;
  empleadoNombre: string | null; // Employee name extracted from filename/content
  dniNie: string | null; // DNI/NIE extracted from document
  segSocial: string | null; // Social security number extracted from document
  confidence: number; // 0-1, how confident we are
}

/**
 * Classify document from filename, subject, and optionally PDF content
 */
export async function classifyDocument(
  filename: string,
  emailSubject: string,
  pdfContent?: Buffer,
): Promise<ClassificationResult> {
  const result: ClassificationResult = {
    tipoDocumento: null,
    empleadoId: null,
    empleadoNombre: null,
    dniNie: null,
    segSocial: null,
    confidence: 0,
  };

  // Normalize inputs
  const filenameLower = filename.toLowerCase();
  const subjectLower = emailSubject.toLowerCase();
  const combinedText = `${filenameLower} ${subjectLower}`;

  // 1. Detect document type from keywords
  // IMPORTANT: Check if it's an image first - images should not be classified as "alta" from subject
  const isImage =
    /\.(png|jpg|jpeg|gif|jpeg)$/i.test(filename) &&
    (!pdfContent || pdfContent.length === 0);

  // Detect document type from filename (needed for both images and non-images, and for PDF detection later)
  const tipoFromFilename = detectDocumentType(filenameLower);

  // For images: set as "otro" immediately (before any other detection)
  // This prevents "alta" from being detected from subject
  if (isImage) {
    if (
      tipoFromFilename &&
      [
        'sello',
        'baja',
        'cv',
        'liquidacion',
        'finiquito',
        'ficha',
        'disminucion',
      ].includes(tipoFromFilename)
    ) {
      // Only allow specific types from filename (NOT "alta" - images are not "alta" documents)
      result.tipoDocumento = tipoFromFilename;
      result.confidence += 0.3;
      logger.log(
        `✅ Detected document type "${tipoFromFilename}" from filename for image`,
      );
    } else {
      // Explicitly set as "otro" for images (not "alta")
      result.tipoDocumento = 'otro';
      result.confidence += 0.1;
      logger.log(`✅ Image classified as "otro" (not "alta" from subject)`);
    }
  } else {
    // For non-images: normal detection logic
    // IMPORTANT: Check filename first for specific types like "sello" to avoid confusion
    // (e.g., "SELLO YUSBEL.pdf" contains "CONTRATO" in PDF text, but filename says "sello")

    // If filename indicates a specific type (sello, alta, baja, etc.), use it with high priority
    // Don't override with PDF text detection for these types
    if (
      tipoFromFilename &&
      [
        'sello',
        'alta',
        'baja',
        'cv',
        'liquidacion',
        'finiquito',
        'ficha',
        'disminucion',
      ].includes(tipoFromFilename)
    ) {
      result.tipoDocumento = tipoFromFilename;
      result.confidence += 0.6; // Very high confidence for filename-based detection
    } else {
      // Otherwise, check only filename (NOT combined text with subject - subject can mislead)
      // PDF detection will happen later if PDF content is available
      // IMPORTANT: Don't use subject for type detection - subject can say "ALTA OPERARIA/O"
      // but the document itself might be a different type (e.g., "documento elena rocio.pdf")
      if (tipoFromFilename) {
        result.tipoDocumento = tipoFromFilename;
        result.confidence += 0.5;
      }
      // If no type from filename, wait for PDF detection (or set as "otro" if no PDF)
      // PDF detection happens later in the code (around line 186)
    }
  }

  // 2. DO NOT extract employee ID/code from documents - codes only exist in database
  // Codes are associated with employee names in the database, not in documents
  // We'll extract the name and then look up the code in the database
  // const empleadoId = extractEmpleadoId(combinedText); // REMOVED - codes don't exist in documents

  // 2.5. Try to extract employee name from filename (especially for "sello" documents)
  // BUT: Don't extract from filename if we'll extract from PDF (PDF is more reliable)
  // Only extract from filename if PDF is not available
  // SPECIAL HANDLING FOR IMAGES: Extract name from email subject (images don't have text content)
  // Note: isImage is already defined above

  let empleadoNombre = null;
  if (isImage) {
    // For images: extract name from email subject (multiple patterns)
    // Pattern 1: "ALTA OPERARIA/O: 134 SANCHEZ EMILIO ALEXIS" (with code)
    let subjectNameMatch = emailSubject.match(
      /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
    );
    if (subjectNameMatch) {
      empleadoNombre = subjectNameMatch[1].trim();
      result.empleadoNombre = empleadoNombre;
      result.confidence += 0.3; // High confidence for subject extraction in images
      logger.log(
        `✅ Extracted name from email subject (ALTA OPERARIA/O pattern) for image: ${empleadoNombre}`,
      );
    } else {
      // Pattern 2: "ALTA OPERARIA/O: ELENA ROCIO LIVIA DONGO" (without code)
      subjectNameMatch = emailSubject.match(
        /ALTA\s+OPERARIA\/O:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
      );
      if (subjectNameMatch) {
        empleadoNombre = subjectNameMatch[1].trim();
        result.empleadoNombre = empleadoNombre;
        result.confidence += 0.3; // High confidence for subject extraction in images
        logger.log(
          `✅ Extracted name from email subject (ALTA OPERARIA/O without code) for image: ${empleadoNombre}`,
        );
      } else {
        // Pattern 2.5: "ALTA OPERARIA SOFIA BITLAN - 09.06.2025" (without "OPERARIA/O:" and colon, just "OPERARIA" followed by name)
        subjectNameMatch = emailSubject.match(
          /ALTA\s+OPERARIA\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s*-\s*\d{2}\.\d{2}\.\d{4}|\s*$)/i,
        );
        if (subjectNameMatch) {
          empleadoNombre = subjectNameMatch[1].trim();
          result.empleadoNombre = empleadoNombre;
          result.confidence += 0.3; // High confidence for subject extraction in images
          logger.log(
            `✅ Extracted name from email subject (ALTA OPERARIA pattern) for image: ${empleadoNombre}`,
          );
        } else {
          // Pattern 3: "ALTA OPERARIO - ANTEMIR NICOLAS VLAD - 04.07.2025" or "ALTA OPERARIO Veronica, MENDEZ ROMERO - 03.07.2025"
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIO\s+(?:-\s*)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+?)(?:\s*-\s*\d{2}\.\d{2}\.\d{4}|$)/i,
          );
          if (subjectNameMatch) {
            // Remove comma and clean up the name
            empleadoNombre = subjectNameMatch[1]
              .trim()
              .replace(/,/g, ' ')
              .replace(/\s+/g, ' ')
              .toUpperCase();
            result.empleadoNombre = empleadoNombre;
            result.confidence += 0.3; // High confidence for subject extraction in images
            logger.log(
              `✅ Extracted name from email subject (ALTA OPERARIO pattern) for image: ${empleadoNombre}`,
            );
          } else {
            // Pattern 4: "BAJA VOLUNTARIA - HIDALGO MONJE DAVID EDUARDO 04.08.2025"
            subjectNameMatch = emailSubject.match(
              /BAJA\s+VOLUNTARIA\s*-\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|$)/i,
            );
            if (subjectNameMatch) {
              empleadoNombre = subjectNameMatch[1].trim();
              result.empleadoNombre = empleadoNombre;
              result.confidence += 0.3; // High confidence for subject extraction in images
              logger.log(
                `✅ Extracted name from email subject (BAJA VOLUNTARIA pattern) for image: ${empleadoNombre}`,
              );
            } else {
              // Pattern 4b: "CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES" or "Re: CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES"
              // Use greedy match to capture full name
              subjectNameMatch = emailSubject.match(
                /CARTA\s+DESPIDO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s*$)/i,
              );
              if (subjectNameMatch) {
                empleadoNombre = subjectNameMatch[1].trim();
                // Validate that it looks like a name (not an address or other false positive)
                const nameWords = empleadoNombre
                  .split(/\s+/)
                  .filter((w) => w.length >= 2);
                if (
                  nameWords.length >= 2 &&
                  nameWords.length <= 5 &&
                  !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(
                    empleadoNombre,
                  )
                ) {
                  result.empleadoNombre = empleadoNombre;
                  result.confidence += 0.3; // High confidence for subject extraction in images
                  logger.log(
                    `✅ Extracted name from email subject (CARTA DESPIDO pattern) for image: ${empleadoNombre}`,
                  );
                } else {
                  empleadoNombre = null; // Reject if doesn't look like a name
                }
              }
              if (!empleadoNombre) {
                // Pattern 5: Generic - look for name-like pattern after common prefixes
                // Format: "SUBJECT - NAME" or "SUBJECT: NAME" or "SUBJECT NAME"
                subjectNameMatch = emailSubject.match(
                  /(?:ALTA|BAJA|CONTRATO|DISMINUCION|LIQUIDACION|FINIQUITO|SELLO|FICHA)\s*(?:VOLUNTARIA|OPERARIA\/O:?|OPERARIO|:|-)\s*(?:\d+\s+)?([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s+\d+|\s*$)/i,
                );
                if (subjectNameMatch) {
                  empleadoNombre = subjectNameMatch[1].trim();
                  // Validate that it looks like a name (not an address or other false positive)
                  const nameWords = empleadoNombre
                    .split(/\s+/)
                    .filter((w) => w.length >= 2);
                  if (
                    nameWords.length >= 2 &&
                    nameWords.length <= 5 &&
                    !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(
                      empleadoNombre,
                    )
                  ) {
                    result.empleadoNombre = empleadoNombre;
                    result.confidence += 0.2; // Medium confidence for generic subject extraction
                    logger.log(
                      `✅ Extracted name from email subject (generic pattern) for image: ${empleadoNombre}`,
                    );
                  }
                }
              }

              // Pattern 6: Generic fallback - look for name in subject
              // Pattern 6a: Name at the beginning (after "Re: " or similar): "Re: Andrea Belen Castro Caceres - posible despido"
              if (!empleadoNombre) {
                subjectNameMatch = emailSubject.match(
                  /^(?:Re:\s*|Fwd:\s*|Fw:\s*)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})\s*[-–—]\s*(?:posible|despido|sanci[oó]n|advertencia|alegaciones|escrito)/i,
                );
                if (subjectNameMatch) {
                  empleadoNombre = subjectNameMatch[1].trim().toUpperCase();
                  // Validate that it looks like a name
                  const nameWords = empleadoNombre
                    .split(/\s+/)
                    .filter((w) => w.length >= 2);
                  if (
                    nameWords.length >= 2 &&
                    nameWords.length <= 5 &&
                    !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI|PRESENTACI[OÓ]N|ALEGACIONES|ESCRITO|ADVERTENCIA|SANCI[OÓ]N|GERENCIA|ASISTENCIAL|NUEVA|AUSENCIA|REGISTRADA)/i.test(
                      empleadoNombre,
                    )
                  ) {
                    result.empleadoNombre = empleadoNombre;
                    result.confidence += 0.15; // Lower confidence for generic fallback extraction
                    logger.log(
                      `✅ Extracted name from email subject (generic fallback pattern - beginning) for image: ${empleadoNombre}`,
                    );
                  } else {
                    empleadoNombre = null; // Reject if doesn't look like a name
                  }
                }
              }

              // Pattern 6b: Name at the end of subject (for cases like "Presentación de alegaciones... Andrea Castro")
              if (!empleadoNombre) {
                // Look for name pattern: 2-5 capitalized words at the end of subject
                // Pattern: "text... FirstName LastName" or "text... FirstName LastName1 LastName2"
                subjectNameMatch = emailSubject.match(
                  /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})\s*$/,
                );
                if (subjectNameMatch) {
                  empleadoNombre = subjectNameMatch[1].trim().toUpperCase();
                  // Validate that it looks like a name (not an address or other false positive)
                  const nameWords = empleadoNombre
                    .split(/\s+/)
                    .filter((w) => w.length >= 2);
                  if (
                    nameWords.length >= 2 &&
                    nameWords.length <= 5 &&
                    !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI|PRESENTACI[OÓ]N|ALEGACIONES|ESCRITO|ADVERTENCIA|SANCI[OÓ]N|GERENCIA|ASISTENCIAL|NUEVA|AUSENCIA|REGISTRADA)/i.test(
                      empleadoNombre,
                    )
                  ) {
                    result.empleadoNombre = empleadoNombre;
                    result.confidence += 0.15; // Lower confidence for generic fallback extraction
                    logger.log(
                      `✅ Extracted name from email subject (generic fallback pattern - end) for image: ${empleadoNombre}`,
                    );
                  } else {
                    empleadoNombre = null; // Reject if doesn't look like a name
                  }
                }
              }
            }
          }
        }
      }
    }

    // Fallback: try to extract from filename if subject extraction failed
    if (!empleadoNombre) {
      empleadoNombre = extractEmpleadoNombre(filename, combinedText);
      if (empleadoNombre) {
        result.empleadoNombre = empleadoNombre;
        result.confidence += 0.1;
        logger.log(
          `⚠️ Extracted name from filename for image (subject extraction failed): ${empleadoNombre}`,
        );
      }
    }

    // Note: Document type for images is already set above (before name extraction)
    // It's set to "otro" by default, or to a specific type from filename (but never "alta")
  }

  // For non-image documents without PDF content, extract name from filename
  if (!isImage && (!pdfContent || pdfContent.length === 0)) {
    empleadoNombre = extractEmpleadoNombre(filename, combinedText);
    if (empleadoNombre) {
      result.empleadoNombre = empleadoNombre;
      result.confidence += 0.1;
    }
  }

  // 3. If PDF content is available, parse it for additional clues
  if (pdfContent && pdfContent.length > 0) {
    try {
      const PDFParse = pdfParseModule.PDFParse;
      const pdfInstance = new PDFParse({
        data: new Uint8Array(pdfContent),
      });
      const textResult = await pdfInstance.getText();
      const pdfTextRaw =
        textResult && typeof textResult === 'object' && 'text' in textResult
          ? textResult.text
          : typeof textResult === 'string'
            ? textResult
            : '';
      const pdfText = pdfTextRaw.toLowerCase();

      // Check for document type in PDF (only if not already detected from filename)
      // IMPORTANT: Don't override filename detection (e.g., "sello" from filename should not become "contrato" from PDF text)
      // If filename already gave us a specific type (sello, alta, baja, etc.), NEVER override it with PDF text
      if (
        !tipoFromFilename ||
        ![
          'sello',
          'alta',
          'baja',
          'cv',
          'liquidacion',
          'finiquito',
          'ficha',
          'disminucion',
        ].includes(tipoFromFilename)
      ) {
        const tipoFromPdf = detectDocumentType(pdfText);
        if (tipoFromPdf) {
          // Only use PDF detection if filename didn't give us a specific type
          if (!result.tipoDocumento) {
            result.tipoDocumento = tipoFromPdf;
            result.confidence += 0.2;
          }
        }
      }

      // IMPORTANT: Check email subject for clear patterns, even if PDF detected a type
      // This is because PDFs may contain generic words (e.g., "sello" appears in many official documents)
      // but the subject is more specific (e.g., "ALTA OPERARIA/O: ...")
      // Subject patterns have higher priority than generic PDF detection
      if (
        !tipoFromFilename ||
        ![
          'sello',
          'alta',
          'baja',
          'cv',
          'liquidacion',
          'finiquito',
          'ficha',
          'disminucion',
        ].includes(tipoFromFilename)
      ) {
        // Check for clear patterns in email subject
        if (/ALTA\s+OPERARIA\/O:/i.test(emailSubject)) {
          // Subject says "ALTA" - this is very specific, override PDF detection if it's generic (e.g., "sello")
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'sello' ||
            result.tipoDocumento === 'otro'
          ) {
            result.tipoDocumento = 'alta';
            result.confidence = Math.max(result.confidence, 0.4); // Higher confidence for subject-based detection
            logger.log(
              `✅ Detected document type "alta" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (/BAJA\s+VOLUNTARIA\s*-/i.test(emailSubject)) {
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'sello' ||
            result.tipoDocumento === 'otro'
          ) {
            result.tipoDocumento = 'baja';
            result.confidence = Math.max(result.confidence, 0.4);
            logger.log(
              `✅ Detected document type "baja" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (
          /CONTRATO/i.test(emailSubject) &&
          !/ANEXO/i.test(emailSubject)
        ) {
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'sello' ||
            result.tipoDocumento === 'otro'
          ) {
            result.tipoDocumento = 'contrato';
            result.confidence = Math.max(result.confidence, 0.3);
            logger.log(
              `✅ Detected document type "contrato" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (/DISMINUCION|REDUCCION\s+JORNADA/i.test(emailSubject)) {
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'sello' ||
            result.tipoDocumento === 'otro'
          ) {
            result.tipoDocumento = 'disminucion';
            result.confidence = Math.max(result.confidence, 0.3);
            logger.log(
              `✅ Detected document type "disminucion" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (/LIQUIDACION/i.test(emailSubject)) {
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'sello' ||
            result.tipoDocumento === 'otro'
          ) {
            result.tipoDocumento = 'liquidacion';
            result.confidence = Math.max(result.confidence, 0.3);
            logger.log(
              `✅ Detected document type "liquidacion" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (/FINIQUITO/i.test(emailSubject)) {
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'sello' ||
            result.tipoDocumento === 'otro'
          ) {
            result.tipoDocumento = 'finiquito';
            result.confidence = Math.max(result.confidence, 0.3);
            logger.log(
              `✅ Detected document type "finiquito" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (
          /\b(curriculum|curriculum\s+vitae|cv|resume|resumen)\b/i.test(
            emailSubject,
          )
        ) {
          // CV/Curriculum detection from subject - high priority
          if (
            !result.tipoDocumento ||
            result.tipoDocumento === 'otro' ||
            result.tipoDocumento === 'certificado' ||
            result.tipoDocumento === 'contrato'
          ) {
            result.tipoDocumento = 'cv';
            result.confidence = Math.max(result.confidence, 0.5);
            logger.log(
              `✅ Detected document type "cv" from email subject (overriding PDF detection: ${result.tipoDocumento || 'none'})`,
            );
          }
        } else if (!result.tipoDocumento) {
          // If no type detected yet, try generic subject patterns as fallback
          if (/ALTA/i.test(emailSubject) && !/BAJA/i.test(emailSubject)) {
            result.tipoDocumento = 'alta';
            result.confidence += 0.2;
            logger.log(
              `✅ Detected document type "alta" from email subject (fallback, PDF didn't contain type keywords)`,
            );
          } else if (/BAJA/i.test(emailSubject)) {
            result.tipoDocumento = 'baja';
            result.confidence += 0.2;
            logger.log(
              `✅ Detected document type "baja" from email subject (fallback, PDF didn't contain type keywords)`,
            );
          }
        }
      }

      // Try to extract employee name from PDF (more reliable than filename for sello/alta documents)
      // For "contrato" documents, prioritize filename (more reliable) because PDFs are often scanned/filled forms
      // IMPORTANT: Use pdfTextRaw (original case) for name extraction, as patterns look for uppercase letters
      const nombreFromPdf = extractEmpleadoNombre('', pdfTextRaw);
      const nombreFromFilename = extractEmpleadoNombre(filename, combinedText);

      logger.log(
        `🔍 Name extraction for ${result.tipoDocumento}: nombreFromPdf="${nombreFromPdf || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}"`,
      );

      if (
        result.tipoDocumento === 'contrato' ||
        result.tipoDocumento === 'disminucion'
      ) {
        // For contracts and disminucion: try to extract name from email subject first (most reliable - contains full name)
        // Pattern 1: "ALTA OPERARIA/O: 150 JAQUI CORREA DAYSI MARIBEL" (with code)
        let subjectNameMatch = emailSubject.match(
          /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
        );
        let nombreFromSubject = subjectNameMatch
          ? subjectNameMatch[1].trim()
          : null;

        // Pattern 2: "ALTA OPERARIA/O: ELENA ROCIO LIVIA DONGO" (without code)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIA\/O:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        // Pattern 3: "FICHA CARRASCO HARO JULLY PETTY" - extract name after "FICHA"
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /FICHA\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        // Pattern 4: "ALTA OPERARIO Veronica, MENDEZ ROMERO - 03.07.2025" - extract name after "ALTA OPERARIO"
        // Format: "ALTA OPERARIO Name, LastName - Date" or "ALTA OPERARIO Name LastName - Date"
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+?)(?:\s*-\s*\d|$)/i,
          );
          if (subjectNameMatch) {
            // Remove comma and clean up the name
            nombreFromSubject = subjectNameMatch[1]
              .trim()
              .replace(/,/g, ' ')
              .replace(/\s+/g, ' ')
              .toUpperCase();
          }
        }

        // Pattern 5: "CONTRATO NAME" - extract name after "CONTRATO"
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /CONTRATO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        logger.log(
          `🔍 ${result.tipoDocumento} name extraction: nombreFromSubject="${nombreFromSubject || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}", nombreFromPdf="${nombreFromPdf || 'null'}"`,
        );

        // Priority 1: Use name from email subject (most reliable for contracts/disminucion)
        if (nombreFromSubject) {
          result.empleadoNombre = nombreFromSubject;
          result.confidence += 0.4; // Very high confidence for subject extraction
          logger.log(
            `✅ Using subject name for ${result.tipoDocumento}: ${nombreFromSubject}`,
          );
        } else if (nombreFromPdf) {
          // Priority 2: Use PDF if available (more reliable than filename for contracts/disminucion)
          // Check if PDF name is longer/more complete than filename (if filename exists)
          if (
            !nombreFromFilename ||
            nombreFromPdf.length > nombreFromFilename.length
          ) {
            result.empleadoNombre = nombreFromPdf;
            result.confidence += 0.2; // Medium confidence for PDF extraction
            logger.log(
              `✅ Using PDF name for ${result.tipoDocumento}: ${nombreFromPdf}`,
            );
          } else {
            // Filename is longer/more complete - use it
            result.empleadoNombre = nombreFromFilename;
            result.confidence += 0.1; // Lower confidence for filename extraction
            logger.log(
              `⚠️ Using filename name for ${result.tipoDocumento} (longer than PDF): ${nombreFromFilename}`,
            );
          }
        } else if (nombreFromFilename) {
          // Priority 3: Use filename as fallback (if PDF extraction failed)
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.1; // Lower confidence for filename extraction
          logger.log(
            `⚠️ Using filename name for ${result.tipoDocumento} (fallback): ${nombreFromFilename}`,
          );
        } else {
          logger.log(
            `❌ No name extracted for ${result.tipoDocumento} (neither subject, PDF nor filename)`,
          );
        }
      } else if (
        result.tipoDocumento === 'liquidacion' ||
        result.tipoDocumento === 'finiquito'
      ) {
        // For liquidacion and finiquito: try email subject first, then PDF, then filename
        // Pattern 1: "ALTA OPERARIA/O: 142 DE DIOS MERELO JUAN ANTONIO" (with code)
        let subjectNameMatch = emailSubject.match(
          /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
        );
        let nombreFromSubject = subjectNameMatch
          ? subjectNameMatch[1].trim()
          : null;

        // Pattern 2: "ALTA OPERARIA/O: ELENA ROCIO LIVIA DONGO" (without code)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIA\/O:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        logger.log(
          `🔍 Liquidacion/Finiquito name extraction: nombreFromSubject="${nombreFromSubject || 'null'}", nombreFromPdf="${nombreFromPdf || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}"`,
        );

        // Priority 1: Use name from email subject (most reliable - contains full name)
        if (nombreFromSubject) {
          logger.log(
            `✅ Using subject name for ${result.tipoDocumento}: ${nombreFromSubject}`,
          );
          result.empleadoNombre = nombreFromSubject;
          result.confidence += 0.4; // Very high confidence for subject extraction
        } else if (nombreFromPdf) {
          // Priority 2: Use PDF extraction (more reliable than filename - contains full name)
          // But filter out false positives like "A FIRMA PERSONA TRABAJADORA" and long termination reasons
          const isFalsePositive =
            /^A\s+FIRMA|^FIRMA\s+PERSONA\s+TRABAJADORA|^PERSONA\s+TRABAJADORA\s*$/i.test(
              nombreFromPdf,
            );
          // Also reject if it's too long (likely a termination reason, not a name)
          const isTooLong =
            nombreFromPdf.length > 50 || nombreFromPdf.split(/\s+/).length > 5;
          // Reject if it contains termination phrases
          const containsTerminationPhrase =
            /CESE|EXPIRACIÓN|TIEMPO|CONVENIDO|CONTRATO|DURACIÓN|DETERMINADA|DESPIDO|DIMISIÓN|JUBILACIÓN/i.test(
              nombreFromPdf,
            ) && nombreFromPdf.length > 20;

          if (!isFalsePositive && !isTooLong && !containsTerminationPhrase) {
            logger.log(
              `✅ Using PDF name for ${result.tipoDocumento}: ${nombreFromPdf}`,
            );
            result.empleadoNombre = nombreFromPdf;
            result.confidence += 0.3; // High confidence for PDF extraction in liquidacion/finiquito
          } else {
            logger.log(
              `⏭️ Rejected PDF name extraction (false positive, too long, or termination phrase): ${nombreFromPdf}`,
            );
            // Fallback to filename if PDF extraction is false positive
            if (nombreFromFilename) {
              logger.log(
                `⚠️ Falling back to filename name for ${result.tipoDocumento}: ${nombreFromFilename}`,
              );
              result.empleadoNombre = nombreFromFilename;
              result.confidence += 0.1;
            }
          }
        } else if (nombreFromFilename) {
          // Fallback to filename if PDF extraction failed
          logger.log(
            `⚠️ PDF extraction failed, using filename name for ${result.tipoDocumento}: ${nombreFromFilename}`,
          );
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.1;
        } else {
          logger.log(
            `❌ No name extracted for ${result.tipoDocumento} (neither subject, PDF nor filename)`,
          );
        }
      } else if (result.tipoDocumento === 'alta') {
        // For alta documents: prioritize PDF extraction, but use subject if PDF doesn't contain valid name
        // Pattern 1: "ALTA OPERARIA/O: 142 DE DIOS MERELO JUAN ANTONIO" (with code)
        let subjectNameMatch = emailSubject.match(
          /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
        );
        let nombreFromSubject = subjectNameMatch
          ? subjectNameMatch[1].trim()
          : null;

        // Pattern 2: "ALTA OPERARIA/O: ELENA ROCIO LIVIA DONGO" (without code)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIA\/O:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        logger.log(
          `🔍 Alta name extraction: nombreFromPdf="${nombreFromPdf || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}", nombreFromSubject="${nombreFromSubject || 'null'}"`,
        );

        // Priority 1: Use PDF extraction (most reliable - contains full name from document)
        if (nombreFromPdf) {
          // Filter out false positives
          const isFalsePositive =
            /^A\s+FIRMA|^FIRMA\s+PERSONA\s+TRABAJADORA|^PERSONA\s+TRABAJADORA\s*$|raz[óo]n\s+social/i.test(
              nombreFromPdf,
            );
          if (!isFalsePositive) {
            result.empleadoNombre = nombreFromPdf;
            result.confidence += 0.3; // High confidence for PDF extraction
            logger.log(`✅ Using PDF name for alta: ${nombreFromPdf}`);
          } else {
            logger.log(
              `⏭️ Rejected PDF name extraction (false positive): ${nombreFromPdf}`,
            );
            // Fallback: try subject first (more reliable than filename), then filename
            if (nombreFromSubject) {
              result.empleadoNombre = nombreFromSubject;
              result.confidence += 0.3; // High confidence for subject extraction
              logger.log(
                `✅ Using subject name for alta (PDF was false positive): ${nombreFromSubject}`,
              );
            } else if (nombreFromFilename) {
              result.empleadoNombre = nombreFromFilename;
              result.confidence += 0.2;
              logger.log(
                `✅ Using filename name for alta (PDF was false positive, subject not available): ${nombreFromFilename}`,
              );
            }
          }
        } else if (nombreFromSubject) {
          // Priority 2: Use subject if PDF extraction failed (subject is more reliable than filename for alta)
          result.empleadoNombre = nombreFromSubject;
          result.confidence += 0.3; // High confidence for subject extraction
          logger.log(
            `✅ Using subject name for alta (PDF extraction failed): ${nombreFromSubject}`,
          );
        } else if (nombreFromFilename) {
          // Priority 3: Use filename as fallback if both PDF and subject failed
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.2;
          logger.log(
            `✅ Using filename name for alta (fallback): ${nombreFromFilename}`,
          );
        } else {
          logger.log(
            `❌ No name extracted for alta (neither PDF, subject nor filename)`,
          );
        }
      } else if (result.tipoDocumento === 'baja') {
        // For baja documents: try email subject first, then PDF, then filename
        // Email subject contains full name like "BAJA VOLUNTARIA - HIDALGO MONJE DAVID EDUARDO 04.08.2025"
        // OR "ALTA OPERARIO YURLEDINSON HERNÁNDEZ - 27.07.2024" (when baja document is sent with alta subject)
        // OR "CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES" (carta de despido)
        // Pattern 1: "BAJA VOLUNTARIA - HIDALGO MONJE DAVID EDUARDO 04.08.2025"
        let subjectNameMatch = emailSubject.match(
          /BAJA\s+VOLUNTARIA\s*-\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|$)/i,
        );
        let nombreFromSubject = subjectNameMatch
          ? subjectNameMatch[1].trim()
          : null;

        // Pattern 1b: "CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES" or "Re: CARTA DESPIDO ANDREA BELEN CASTRO CÁCERES"
        // Note: Pattern allows optional date at the end, but also works without date
        // Use greedy match to capture full name
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /CARTA\s+DESPIDO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s*$)/i,
          );
          if (subjectNameMatch) {
            nombreFromSubject = subjectNameMatch[1].trim();
            // Validate that it looks like a name (not an address or other false positive)
            const nameWords = nombreFromSubject
              .split(/\s+/)
              .filter((w) => w.length >= 2);
            if (
              nameWords.length >= 2 &&
              nameWords.length <= 5 &&
              !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(
                nombreFromSubject,
              )
            ) {
              // Valid name extracted
            } else {
              nombreFromSubject = null; // Reject if doesn't look like a name
            }
          }
        }

        // Pattern 2: "ALTA OPERARIA/O: 134 NAME" (with code) - sometimes baja documents have alta subject
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        // Pattern 3: "ALTA OPERARIA/O: NAME" (without code)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIA\/O:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        // Pattern 4: "ALTA OPERARIO NAME - DATE" or "BAJA - NAME"
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /(?:ALTA\s+OPERARIO|BAJA)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s*-\s*\d|$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        // Pattern 5: "ALTA OPERARIO Veronica, MENDEZ ROMERO - 03.07.2025"
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIO\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+?)(?:\s*-\s*\d|$)/i,
          );
          if (subjectNameMatch) {
            // Remove comma and clean up the name
            nombreFromSubject = subjectNameMatch[1]
              .trim()
              .replace(/,/g, ' ')
              .replace(/\s+/g, ' ')
              .toUpperCase();
          }
        }

        // Pattern 6: Generic "BAJA - NAME" or "BAJA NAME"
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /BAJA\s*(?:VOLUNTARIA\s*)?(?:-|:)?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+\d{2}\.\d{2}\.\d{4}|\s+\d{4}-\d{2}-\d{2}|\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        logger.log(
          `🔍 Baja name extraction: nombreFromSubject="${nombreFromSubject || 'null'}", nombreFromPdf="${nombreFromPdf || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}"`,
        );

        // Priority 1: Use name from email subject (most reliable - contains full name)
        if (nombreFromSubject) {
          logger.log(`✅ Using subject name for baja: ${nombreFromSubject}`);
          result.empleadoNombre = nombreFromSubject;
          result.confidence += 0.4; // Very high confidence for subject extraction
        } else if (nombreFromPdf) {
          // Priority 2: Use PDF extraction (more reliable than filename - contains full name)
          // Filter out false positives
          const isFalsePositive =
            /^A\s+FIRMA|^FIRMA\s+PERSONA\s+TRABAJADORA|^PERSONA\s+TRABAJADORA\s*$|raz[óo]n\s+social/i.test(
              nombreFromPdf,
            );
          if (!isFalsePositive) {
            logger.log(`✅ Using PDF name for baja: ${nombreFromPdf}`);
            result.empleadoNombre = nombreFromPdf;
            result.confidence += 0.3; // High confidence for PDF extraction in baja
          } else {
            logger.log(
              `⏭️ Rejected PDF name extraction (false positive): ${nombreFromPdf}`,
            );
            // Fallback to filename if PDF extraction is false positive
            if (nombreFromFilename) {
              logger.log(
                `⚠️ Falling back to filename name for baja: ${nombreFromFilename}`,
              );
              result.empleadoNombre = nombreFromFilename;
              result.confidence += 0.1;
            }
          }
        } else if (nombreFromFilename) {
          // Fallback to filename if PDF extraction failed
          logger.log(
            `⚠️ PDF extraction failed, using filename name for baja: ${nombreFromFilename}`,
          );
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.1;
        } else {
          logger.log(
            `❌ No name extracted for baja (neither subject, PDF nor filename)`,
          );
        }
      } else if (result.tipoDocumento === 'sello') {
        // For sello documents: try email subject first, then PDF, then filename
        // Email subject contains full name like "ALTA OPERARIA/O: 133 GLADIS MARIA GONZALO CASTRO"
        // Pattern 1: "ALTA OPERARIA/O: 133 GLADIS MARIA GONZALO CASTRO" (with code)
        let subjectNameMatch = emailSubject.match(
          /ALTA\s+OPERARIA\/O:\s*\d+\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})/i,
        );
        let nombreFromSubject = subjectNameMatch
          ? subjectNameMatch[1].trim()
          : null;

        // Pattern 2: "ALTA OPERARIA/O: GLADIS MARIA GONZALO CASTRO" (without code)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /ALTA\s+OPERARIA\/O:\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,})(?:\s+\d+|\s*$)/i,
          );
          nombreFromSubject = subjectNameMatch
            ? subjectNameMatch[1].trim()
            : null;
        }

        logger.log(
          `🔍 Sello name extraction: nombreFromSubject="${nombreFromSubject || 'null'}", nombreFromPdf="${nombreFromPdf || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}"`,
        );

        // Priority 1: Use name from email subject (most reliable - contains full name)
        if (nombreFromSubject) {
          logger.log(`✅ Using subject name for sello: ${nombreFromSubject}`);
          result.empleadoNombre = nombreFromSubject;
          result.confidence += 0.4; // Very high confidence for subject extraction
        } else if (nombreFromPdf) {
          // Priority 2: Use PDF extraction (more reliable than filename - contains full name)
          // Filter out false positives
          const isFalsePositive =
            /^A\s+FIRMA|^FIRMA\s+PERSONA\s+TRABAJADORA|^PERSONA\s+TRABAJADORA\s*$|raz[óo]n\s+social/i.test(
              nombreFromPdf,
            );
          if (!isFalsePositive) {
            logger.log(`✅ Using PDF name for sello: ${nombreFromPdf}`);
            result.empleadoNombre = nombreFromPdf;
            result.confidence += 0.3; // High confidence for PDF extraction in sello
          } else {
            logger.log(
              `⏭️ Rejected PDF name extraction (false positive): ${nombreFromPdf}`,
            );
            // Fallback to filename if PDF extraction is false positive
            if (nombreFromFilename) {
              logger.log(
                `⚠️ Falling back to filename name for sello: ${nombreFromFilename}`,
              );
              result.empleadoNombre = nombreFromFilename;
              result.confidence += 0.1;
            }
          }
        } else if (nombreFromFilename) {
          // Fallback to filename if PDF extraction failed
          logger.log(
            `⚠️ PDF extraction failed, using filename name for sello: ${nombreFromFilename}`,
          );
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.1;
        } else {
          logger.log(
            `❌ No name extracted for sello (neither subject, PDF nor filename)`,
          );
        }
      } else if (result.tipoDocumento === 'cv') {
        // For CV documents: try email subject first, then PDF, then filename
        // Email subject contains name like "Curriculum Jeincy", "Curriculum Dora Vidal", "Curriculum Vitae Francisco"
        let nombreFromSubject = null;

        // Pattern 1: "Curriculum NAME" or "Curriculum Vitae NAME" or "CV NAME"
        let subjectNameMatch = emailSubject.match(
          /\b(?:curriculum|curriculum\s+vitae|cv)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})(?:\s|$)/i,
        );
        if (subjectNameMatch) {
          nombreFromSubject = subjectNameMatch[1].trim().toUpperCase();
        }

        // Pattern 2: "NAME - curriculum" or "NAME curriculum" (name at the beginning)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /^(?:Re:\s*|Fwd:\s*|Fw:\s*)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})\s*(?:[-–—]|\s+)(?:curriculum|curriculum\s+vitae|cv|posible|despido|sanci[oó]n)/i,
          );
          if (subjectNameMatch) {
            nombreFromSubject = subjectNameMatch[1].trim().toUpperCase();
          }
        }

        // Pattern 3: "Curriculum /NAME" or "Curriculum: NAME" (with separator)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /\b(?:curriculum|curriculum\s+vitae|cv)\s*[\/:]\s*([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})(?:\s|$)/i,
          );
          if (subjectNameMatch) {
            nombreFromSubject = subjectNameMatch[1].trim().toUpperCase();
          }
        }

        // Pattern 4: Generic - look for name at the end of subject (2-5 capitalized words)
        if (!nombreFromSubject) {
          subjectNameMatch = emailSubject.match(
            /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})\s*$/,
          );
          if (subjectNameMatch) {
            nombreFromSubject = subjectNameMatch[1].trim().toUpperCase();
            // Validate that it looks like a name (not an address or other false positive)
            const nameWords = nombreFromSubject
              .split(/\s+/)
              .filter((w) => w.length >= 2);
            if (
              !(
                nameWords.length >= 2 &&
                nameWords.length <= 5 &&
                !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI|CURRICULUM|VITAE|RESUME|RESUMEN|SOCORRISTA|ASESOR|FINANCIERO|PROFESIONAL|CORPORATIVO)/i.test(
                  nombreFromSubject,
                )
              )
            ) {
              nombreFromSubject = null; // Reject if doesn't look like a name
            }
          }
        }

        logger.log(
          `🔍 CV name extraction: nombreFromSubject="${nombreFromSubject || 'null'}", nombreFromPdf="${nombreFromPdf || 'null'}", nombreFromFilename="${nombreFromFilename || 'null'}"`,
        );

        // Priority 1: Use name from email subject (most reliable - contains full name)
        if (nombreFromSubject) {
          logger.log(`✅ Using subject name for cv: ${nombreFromSubject}`);
          result.empleadoNombre = nombreFromSubject;
          result.confidence += 0.4; // Very high confidence for subject extraction
        } else if (nombreFromPdf) {
          // Priority 2: Use PDF extraction (more reliable than filename - contains full name)
          logger.log(`✅ Using PDF name for cv: ${nombreFromPdf}`);
          result.empleadoNombre = nombreFromPdf;
          result.confidence += 0.3; // High confidence for PDF extraction in cv
        } else if (nombreFromFilename) {
          // Priority 3: Use filename as fallback
          logger.log(
            `⚠️ Using filename name for cv (fallback): ${nombreFromFilename}`,
          );
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.1;
        } else {
          logger.log(
            `❌ No name extracted for cv (neither subject, PDF nor filename)`,
          );
        }
      } else {
        // For other documents (ficha, etc.): prioritize PDF extraction
        // But filter out false positives like "razón social de la empresa" and "A FIRMA PERSONA TRABAJADORA"
        if (nombreFromPdf) {
          // Filter out false positives
          const isFalsePositive =
            /^A\s+FIRMA|^FIRMA\s+PERSONA\s+TRABAJADORA|^PERSONA\s+TRABAJADORA\s*$|raz[óo]n\s+social/i.test(
              nombreFromPdf,
            );
          if (!isFalsePositive) {
            result.empleadoNombre = nombreFromPdf;
            result.confidence += 0.2; // Higher confidence for PDF extraction
          } else {
            logger.log(
              `⏭️ Rejected PDF name extraction (false positive): ${nombreFromPdf}`,
            );
            // Fallback to filename if PDF extraction is false positive
            if (nombreFromFilename) {
              result.empleadoNombre = nombreFromFilename;
              result.confidence += 0.1;
            }
          }
        } else if (nombreFromFilename) {
          result.empleadoNombre = nombreFromFilename;
          result.confidence += 0.1;
        }
      }

      // DO NOT extract employee code from PDF - codes only exist in database
      // Codes are associated with employee names in the database, not in documents
      // We extract the name and then look up the code in the database
      // const empleadoFromPdf = extractEmpleadoId(pdfText); // REMOVED - codes don't exist in documents

      // Extract DNI/NIE and Social Security Number from PDF (more reliable than name for contracts)
      const dniNie = extractDNINIE(pdfText);
      if (dniNie) {
        result.dniNie = dniNie;
        result.confidence += 0.2; // High confidence for DNI/NIE
      }

      const segSocial = extractSegSocial(pdfText);
      if (segSocial) {
        result.segSocial = segSocial;
        result.confidence += 0.2; // High confidence for Social Security Number
      }
    } catch (error: any) {
      logger.warn(`⚠️ Error parsing PDF for classification: ${error.message}`);
    }
  }

  // If no document type was detected, set as "otro"
  if (!result.tipoDocumento) {
    result.tipoDocumento = 'otro';
    result.confidence += 0.1;
    logger.log(`⚠️ No document type detected, defaulting to "otro"`);
  }

  // For documents classified as "otro" or "certificado" that don't have a name extracted yet, try to extract from email subject
  // This handles cases like "Presentación de alegaciones... Andrea Castro" or "Re: Andrea Belen Castro Caceres - posible despido"
  // Also handles "ALTA OPERARIA Raul, RAMA ROMERO - 04.07.2025" pattern
  if (
    (result.tipoDocumento === 'otro' ||
      result.tipoDocumento === 'certificado') &&
    !result.empleadoNombre &&
    emailSubject
  ) {
    let nombreFromSubject = null;

    // Pattern 0: "ALTA OPERARIA Raul, RAMA ROMERO - 04.07.2025" or "ALTA OPERARIA SOFIA BITLAN - 09.06.2025"
    // This pattern handles both with and without comma in name
    let subjectNameMatch = emailSubject.match(
      /ALTA\s+OPERARIA\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s,]+?)(?:\s*-\s*\d{2}\.\d{2}\.\d{4}|\s*$)/i,
    );
    if (subjectNameMatch) {
      nombreFromSubject = subjectNameMatch[1].trim();
      // Remove comma and clean up the name
      nombreFromSubject = nombreFromSubject
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .toUpperCase();
      // Validate that it looks like a name
      const nameWords = nombreFromSubject
        .split(/\s+/)
        .filter((w) => w.length >= 2);
      if (
        nameWords.length >= 2 &&
        nameWords.length <= 5 &&
        !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI)/i.test(
          nombreFromSubject,
        )
      ) {
        result.empleadoNombre = nombreFromSubject;
        result.confidence += 0.3; // Higher confidence for ALTA OPERARIA pattern
        logger.log(
          `✅ Extracted name from email subject (ALTA OPERARIA pattern) for "${result.tipoDocumento}" document: ${nombreFromSubject}`,
        );
        return result; // Early return since we found a name
      } else {
        nombreFromSubject = null; // Reject if doesn't look like a name
      }
    }

    // Pattern 1: Name at the beginning (after "Re: " or similar): "Re: Andrea Belen Castro Caceres - posible despido"
    if (!nombreFromSubject) {
      subjectNameMatch = emailSubject.match(
        /^(?:Re:\s*|Fwd:\s*|Fw:\s*)?([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})\s*[-–—]\s*(?:posible|despido|sanci[oó]n|advertencia|alegaciones|escrito)/i,
      );
      if (subjectNameMatch) {
        nombreFromSubject = subjectNameMatch[1].trim().toUpperCase();
        // Validate that it looks like a name
        const nameWords = nombreFromSubject
          .split(/\s+/)
          .filter((w) => w.length >= 2);
        if (
          !(
            nameWords.length >= 2 &&
            nameWords.length <= 5 &&
            !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI|PRESENTACI[OÓ]N|ALEGACIONES|ESCRITO|ADVERTENCIA|SANCI[OÓ]N|GERENCIA|ASISTENCIAL|NUEVA|AUSENCIA|REGISTRADA)/i.test(
              nombreFromSubject,
            )
          )
        ) {
          nombreFromSubject = null; // Reject if doesn't look like a name
        }
      }
    }

    // Pattern 2: Name at the end of subject (2-5 capitalized words)
    // Example: "Presentación de alegaciones al escrito de advertencia/sanción Andrea Castro"
    if (!nombreFromSubject) {
      subjectNameMatch = emailSubject.match(
        /([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,4})\s*$/,
      );
      if (subjectNameMatch) {
        nombreFromSubject = subjectNameMatch[1].trim().toUpperCase();
        // Validate that it looks like a name (not an address or other false positive)
        const nameWords = nombreFromSubject
          .split(/\s+/)
          .filter((w) => w.length >= 2);
        if (
          !(
            nameWords.length >= 2 &&
            nameWords.length <= 5 &&
            !/^(AV|AVENIDA|CALLE|C\/|PLAZA|MADRID|BARCELONA|EUZCADI|PRESENTACI[OÓ]N|ALEGACIONES|ESCRITO|ADVERTENCIA|SANCI[OÓ]N|GERENCIA|ASISTENCIAL|NUEVA|AUSENCIA|REGISTRADA)/i.test(
              nombreFromSubject,
            )
          )
        ) {
          nombreFromSubject = null; // Reject if doesn't look like a name
        }
      }
    }

    if (nombreFromSubject) {
      result.empleadoNombre = nombreFromSubject;
      result.confidence += 0.15; // Lower confidence for generic fallback extraction
      logger.log(
        `✅ Extracted name from email subject (generic fallback) for "${result.tipoDocumento}" document: ${nombreFromSubject}`,
      );
    }
  }

  // Cap confidence at 1.0
  result.confidence = Math.min(result.confidence, 1.0);

  return result;
}

/**
 * Detect document type from text
 */
function detectDocumentType(text: string): DocumentType | null {
  // Patterns for different document types
  // IMPORTANT: Order matters - more specific patterns should come first
  const typePatterns: { type: DocumentType; patterns: RegExp[] }[] = [
    {
      type: 'vida_laboral',
      // Vida laboral patterns - check BEFORE "nomina" for higher priority
      // "Vida laboral" is a specific document type (work history certificate)
      patterns: [
        /vida\s+laboral/i,
        /vida\s+laboral\s+certificado/i,
        /certificado\s+de\s+vida\s+laboral/i,
        /certificado.*vida.*laboral/i,
        /informe\s+de\s+vida\s+laboral/i,
        /historial\s+laboral/i,
        /historia\s+laboral/i,
        /work\s+history/i,
        /employment\s+history/i,
        /certificado\s+de\s+empresas/i,
        /certificado\s+de\s+empresas\s+y\s+actividades/i,
      ],
    },
    {
      type: 'nomina',
      patterns: [
        /nomina/i,
        /nómina/i,
        /nomina/i,
        /payslip/i,
        /recibo.*nomina/i,
      ],
    },
    {
      type: 'cv',
      // CV patterns - check before "certificado" to avoid confusion
      patterns: [
        /^cv[_\-\s]/i, // CV-*, CV_*, CV *
        /[_\-\s]cv\./i, // *-CV.pdf, *_CV.pdf
        /\bcv\b/i, // CV as word
        /\bcurriculum\s*vitae\b/i,
        /\bcurriculum\b/i,
        /\bresume\b/i,
        /\bresumen\b/i,
      ],
    },
    {
      type: 'liquidacion',
      // Liquidacion patterns - check BEFORE "sello" for higher priority
      // "sello" is generic and appears in many documents, but "liquidacion" is specific
      patterns: [
        /\bdocumento\s+de\s+liquidacion\b/i,
        /\bdocumento\s+de\s+liquidación\b/i,
        /\bdocumento\s+liquidacion\b/i,
        /\bdocumento\s+liquidación\b/i,
        /\bliquidacion\s+final\b/i,
        /\bliquidación\s+final\b/i,
        /\bliquidacion\b/i,
        /\bliquidación\b/i,
        /\bliquidation\b/i,
      ],
    },
    {
      type: 'sello',
      // Sello patterns - check before "contrato" because sello documents may contain "contrato" in text
      // BUT: liquidacion has higher priority (checked above)
      patterns: [
        /\bsello\b/i,
        /\bstamp\b/i,
        /\bsello\s+oficial\b/i,
        /\bsello\s+empresarial\b/i,
      ],
    },
    {
      type: 'ficha',
      // Ficha patterns - check before "contrato" because ficha documents may contain "contrato" in text
      patterns: [
        /^ficha[_\-\s]/i, // Ficha_*, Ficha-*, Ficha *
        /[_\-\s]ficha\./i, // *_Ficha.pdf, *-Ficha.pdf
        /\bficha\s+empleado\b/i,
        /\bficha\s+trabajador\b/i,
        /\bficha\s+personal\b/i,
        /\bficha\s+de\s+empleado\b/i,
        /\bficha\s+de\s+trabajador\b/i,
        /\bemployee\s+file\b/i,
        /\bemployee\s+record\b/i,
      ],
    },
    {
      type: 'disminucion',
      // Disminucion patterns - check before "contrato" because disminucion documents may contain "contrato" in text
      patterns: [
        /\bdisminucion\b/i,
        /\bdisminución\b/i,
        /\breduccion\s+jornada\b/i,
        /\breducción\s+jornada\b/i,
        /\breduccion\s+de\s+jornada\b/i,
        /\breducción\s+de\s+jornada\b/i,
        /\bcomunicacion\s+de\s+disminucion\b/i,
        /\bcomunicación\s+de\s+disminución\b/i,
      ],
    },
    {
      type: 'contrato',
      patterns: [/contrato/i, /contract/i, /contratacion/i],
    },
    {
      type: 'anexo',
      patterns: [/anexo/i, /annex/i, /addendum/i],
    },
    {
      type: 'sancion',
      patterns: [/sancion/i, /sanction/i, /amonestacion/i],
    },
    {
      type: 'certificado',
      patterns: [
        /certificado/i,
        /certificate/i,
        /certificacion/i,
        /certificat/i,
      ],
    },
    {
      type: 'finiquito',
      // Finiquito patterns - check before "alta" for higher priority (finiquito is more specific)
      patterns: [
        /\bfiniquito\b/i,
        /\bfiniquito\s+final\b/i,
        /\bdocumento\s+finiquito\b/i,
        /\bsettlement\b/i,
        /\bseverance\b/i,
      ],
    },
    {
      type: 'baja',
      // Use word boundaries to avoid matching "alta" (which contains "baja" as substring)
      patterns: [/\bbaja\b/i, /\btermination\b/i, /\bdespido\b/i, /\bcese\b/i],
    },
    {
      type: 'alta',
      patterns: [
        /\balta\b/i,
        /\bincorporacion\b/i,
        /\bincorporación\b/i,
        /\bentrada\b/i,
      ],
    },
  ];

  for (const { type, patterns } of typePatterns) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        logger.log(
          `🔍 Detected document type: ${type} (from pattern: ${pattern})`,
        );
        return type;
      }
    }
  }

  return null;
}

// REMOVED: extractEmpleadoId function - not used (codes don't exist in documents)
// Function was previously used to extract employee codes from text but was removed
// as employee codes don't typically appear in document text

/**
 * Extract DNI/NIE from text
 * Looks for patterns like "NIF/NIE: 12345678A" or "DNI: 12345678" or "12345678A"
 */
function extractDNINIE(text: string): string | null {
  if (!text || text.length === 0) {
    return null;
  }

  // Pattern 1: "NIF/NIE: 12345678A" or "NIF: 12345678A" or "NIE: X1234567A"
  const nifNiePattern =
    /(?:nif|nie|dni|d\.n\.i\.)\s*\/?\s*(?:nie|nif)?\s*:?\s*([A-Z]?\d{7,8}[A-Z]?)/i;
  const nifNieMatch = text.match(nifNiePattern);
  if (nifNieMatch && nifNieMatch[1]) {
    const dniNie = nifNieMatch[1].trim().toUpperCase();
    logger.log(`🔍 Extracted DNI/NIE: ${dniNie} (from NIF/NIE pattern)`);
    return dniNie;
  }

  // Pattern 2: Standalone DNI format (8 digits + optional letter) - but not if it's part of "número de afiliación"
  const dniStandalonePattern = /\b([A-Z]\d{7,8}[A-Z]?|\d{8}[A-Z]?)\b/i;
  const dniStandaloneMatch = text.match(dniStandalonePattern);
  if (dniStandaloneMatch && dniStandaloneMatch[1]) {
    // Check if this is preceded by "número de afiliación" or "afiliación" (should be excluded)
    const beforeMatch = text.substring(0, dniStandaloneMatch.index || 0);
    if (
      !/n[úu]mero\s+de\s+afiliaci[óo]n|afiliaci[óo]n|seguridad\s+social/i.test(
        beforeMatch,
      )
    ) {
      const dniNie = dniStandaloneMatch[1].trim().toUpperCase();
      logger.log(`🔍 Extracted DNI/NIE: ${dniNie} (from standalone pattern)`);
      return dniNie;
    }
  }

  return null;
}

/**
 * Extract Social Security Number (número de afiliación) from text
 * Looks for patterns like "Nº AFILIACIÓN: 1234567890" or "SEG. SOCIAL: 1234567890"
 */
function extractSegSocial(text: string): string | null {
  if (!text || text.length === 0) {
    return null;
  }

  // Pattern 1: "Nº AFILIACIÓN SEGURIDAD SOCIAL: 1234567890" or "Nº AFILIACIÓN: 1234567890"
  const afiliacionPattern =
    /(?:n[º°]|numero|número)\s*(?:de\s+)?afiliaci[óo]n\s*(?:seguridad\s+social)?\s*:?\s*(\d{10})/i;
  const afiliacionMatch = text.match(afiliacionPattern);
  if (afiliacionMatch && afiliacionMatch[1]) {
    const segSocial = afiliacionMatch[1].trim();
    logger.log(
      `🔍 Extracted Seg. Social: ${segSocial} (from afiliación pattern)`,
    );
    return segSocial;
  }

  // Pattern 2: "SEG. SOCIAL: 1234567890" or "SEG SOCIAL: 1234567890"
  const segSocialPattern = /seg\.?\s*social\s*:?\s*(\d{10})/i;
  const segSocialMatch = text.match(segSocialPattern);
  if (segSocialMatch && segSocialMatch[1]) {
    const segSocial = segSocialMatch[1].trim();
    logger.log(
      `🔍 Extracted Seg. Social: ${segSocial} (from SEG. SOCIAL pattern)`,
    );
    return segSocial;
  }

  // Pattern 3: Standalone 10-digit number that might be social security number
  // But be careful - only if it's near "afiliación" or "seguridad social" context
  const contextPattern =
    /(?:afiliaci[óo]n|seguridad\s+social|seg\.\s*social)[\s\S]{0,100}?(\d{10})/i;
  const contextMatch = text.match(contextPattern);
  if (contextMatch && contextMatch[1]) {
    const segSocial = contextMatch[1].trim();
    logger.log(`🔍 Extracted Seg. Social: ${segSocial} (from context pattern)`);
    return segSocial;
  }

  return null;
}

/**
 * Extract employee name from filename or text
 * Especially useful for "sello" documents like "SELLO YUSBEL.pdf"
 */
function extractEmpleadoNombre(filename: string, text: string): string | null {
  // Pattern 1: Extract name from filename patterns like "SELLO YUSBEL.pdf", "ALTA YUSBEL.pdf", "Ficha_ORLENA_HERNANDEZ_ESTEVEZ.pdf"
  // Look for words after common document prefixes
  // Use greedy match to get full name (not just first word)
  const filenamePatterns = [
    // Special pattern for "FINIQUITO - [NUME]" format (from gestoria/nominas): "FINIQUITO - IGNACIO LABRADOR ARRIBAS.pdf"
    /^finiquito\s*-\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\.pdf|\.|$)/i,
    /^finiquito\s*-\s*([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\.pdf|\.|$)/i,
    // Special pattern for "documento de liquidacion" format: "documento de liquidacion ignacio.pdf"
    /documento\s+de\s+liquidacion\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\.pdf|\.|$)/i,
    /documento\s+de\s+liquidacion\s+([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\.pdf|\.|$)/i,
    // Special pattern for "Vacaciones [NUME]" format: "Vacaciones NEACSU, DECEBAL MARIUS(2).pdf"
    // Handles formats like "Vacaciones NEACSU, DECEBAL MARIUS(2).pdf" or "Vacaciones NEACSU DECEBAL MARIUS.pdf"
    /^vacaciones\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ,\s]+?)(?:\([^)]+\))?(?:\.pdf|\.|$)/i,
    /^vacaciones\s+([a-záéíóúñ][a-záéíóúñ,\s]+?)(?:\([^)]+\))?(?:\.pdf|\.|$)/i,
    // Standard patterns (including finiquito)
    // Use greedy match to get full name, but stop before dates (01-08, 01-08-2026, etc.)
    // Special pattern for "CONTRATO [NUME]" format (e.g., "CONTRATO MOHAMED AHRAOU.pdf")
    /^contrato\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\.pdf|\.|$)/i,
    /^contrato\s+([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\.pdf|\.|$)/i,
    // Standard patterns for all document types
    /(?:sello|alta|baja|contrato|nomina|liquidacion|finiquito|ficha|vacaciones)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)?(?:\.pdf|\.|$)/i,
    /(?:sello|alta|baja|contrato|nomina|liquidacion|finiquito|ficha|vacaciones)\s+([a-záéíóúñ][a-záéíóúñ\s]+?)(?:\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)?(?:\.pdf|\.|$)/i,
    // Greedy version to capture full name (for cases like "ALTA JUAN ANTONIO DE DISO DE CAMINO 01-08.pdf")
    /(?:sello|alta|baja|contrato|nomina|liquidacion|finiquito|ficha|vacaciones)\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+)(?:\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)?(?:\.pdf|\.|$)/i,
    /(?:sello|alta|baja|contrato|nomina|liquidacion|finiquito|ficha|vacaciones)\s+([a-záéíóúñ][a-záéíóúñ\s]+)(?:\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)?(?:\.pdf|\.|$)/i,
    // Special pattern for Ficha_* format: "Ficha_ORLENA_HERNANDEZ_ESTEVEZ.pdf"
    /^ficha[_\-\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ_\-\s]+?)(?:\.pdf|\.|$)/i,
    /^ficha[_\-\s]+([a-záéíóúñ][a-záéíóúñ_\-\s]+?)(?:\.pdf|\.|$)/i,
  ];

  for (const pattern of filenamePatterns) {
    const match = filename.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      // Replace underscores and hyphens with spaces for Ficha_* format
      name = name.replace(/[_\-\s]+/g, ' ').trim();
      // Remove dates at the end (e.g., "01-08", "01-08-2026", "01/08", "01/08/2026")
      name = name
        .replace(/\s+\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?\s*$/, '')
        .trim();
      // Filter out very short names or numbers
      if (name.length >= 3 && !/^\d+$/.test(name)) {
        logger.log(
          `🔍 Extracted empleado nombre: ${name} (from filename pattern)`,
        );
        return name;
      }
    }
  }

  // Pattern 2: Look for name in "DATOS DEL/LA TRABAJADOR/A" section (common in sello/contract documents)
  // Format: "D/Dª\nYUSBEL ESTRADA SMITH" or "D/Dª YUSBEL ESTRADA SMITH"
  // Also for ALTA documents: "D./Dña. ORLENA HERNANDEZ ESTEVEZ"
  // Also for CONTRATO documents: "D./DÑA." or "D./Dña." followed by name (may be on same line or next line)
  // Also for LIQUIDACION documents: "Persona trabajadora:\nIGNACIO LABRADOR ARRIBAS"
  // Also for FINIQUITO documents: "Periodo de liquidación.:\n[NUME]" or "TRABAJADOR /A\n[NUME]"
  // Also for BAJA documents: "D./Dña. IGNACIO\nLABRADOR ARRIBAS" (name split across lines)

  // SPECIAL HANDLING FOR FINIQUITO: Use line-by-line logic from gestoria (more reliable than regex)
  // Check if text contains finiquito indicators and extract name using gestoria logic
  const textLower = text.toLowerCase();
  const isFiniquito =
    textLower.includes('liquidación, baja y finiquito') ||
    textLower.includes('periodo de liquidación');

  // SPECIAL HANDLING FOR LIQUIDACION: Extract name from "Persona trabajadora:" section
  // Format: "Persona trabajadora:\nCategoría:\nMotivo Baja:\n...\nJAQUI CORREA DAYSI MARIBEL"
  // Similar to finiquito, but for liquidacion documents
  const isLiquidacion =
    textLower.includes('documento de liquidación') ||
    textLower.includes('liquidación') ||
    textLower.includes('liquidacion');

  if (isLiquidacion && !isFiniquito) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Pattern 1: "Persona trabajadora:" - name is on next lines (after Categoría, Motivo, etc.)
    for (let idx = 0; idx < lines.length; idx++) {
      if (lines[idx].match(/Persona\s+trabajadora/i)) {
        // Look for name in next 5-10 lines (skip intermediate fields like Categoría, Motivo, etc.)
        for (let j = idx + 1; j < Math.min(idx + 11, lines.length); j++) {
          const candidateLine = lines[j];
          // Skip lines that are clearly not names (fields, labels, etc.)
          if (
            candidateLine &&
            !candidateLine.match(
              /^(Categoría|Motivo|Baja|N\.I\.F\.|Núm|Ocupación|Seg\.|Social|EMPRESA|del\s+\d+|Fecha|Periodo|A\s+FIRMA|FIRMA\s+PERSONA|AUXILIAR|SERVICIO|DE\s+SERVICIO|PUESTO)/i,
            ) &&
            /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(candidateLine)
          ) {
            // Check if line contains a name (may be followed by DNI or end of line)
            // IMPORTANT: Exclude long phrases that are clearly reasons for termination, not names
            // Names are typically 2-4 words, not long sentences
            const nameMatch = candidateLine.match(
              /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+\d{8}[A-Z]|\s+N\.I\.F\.|\s*\t|\s*DE\s+CAMINO|$)/,
            );
            if (nameMatch) {
              const name = nameMatch[1].trim();

              // Reject if it's too long (likely a reason/motive, not a name)
              // Names are typically 2-4 words (max ~50 characters)
              if (name.length > 50 || name.split(/\s+/).length > 5) {
                logger.log(
                  `⏭️ Rejected liquidacion name (too long, likely a reason): "${name}"`,
                );
                continue;
              }

              // Reject if it contains common phrases from termination reasons
              const terminationPhrases = [
                'CESE',
                'EXPIRACIÓN',
                'TIEMPO',
                'CONVENIDO',
                'CONTRATO',
                'DURACIÓN',
                'DETERMINADA',
                'DESPIDO',
                'DIMISIÓN',
                'JUBILACIÓN',
                'FINALIZACIÓN',
                'RESCISIÓN',
                'TERMINACIÓN',
                'POR',
                'DEL',
                'EN',
                'EL',
                'DE',
                'LA',
                'LAS',
                'LOS',
              ];
              const nameUpper = name.toUpperCase();
              const containsTerminationPhrase = terminationPhrases.some(
                (phrase) => nameUpper.includes(phrase),
              );

              if (containsTerminationPhrase && name.length > 20) {
                logger.log(
                  `⏭️ Rejected liquidacion name (contains termination phrase): "${name}"`,
                );
                continue;
              }

              // Verify it's a valid name (not false positive)
              // Exclude common false positives: AUXILIAR, SERVICIO, DE SERVICIO, PUESTO, etc.
              const falsePositives = [
                'AUXILIAR',
                'SERVICIO',
                'DE SERVICIO',
                'PUESTO',
                'CATEGORÍA',
                'CATEGORIA',
                'EMPRESA',
                'N.I.F.',
                'Núm',
                'Ocupación',
                'Seg.',
                'Social',
                'del',
                'A FIRMA',
                'FIRMA PERSONA',
                'PERSONA TRABAJADORA',
                'RAZÓN',
                'SOCIAL',
                'CAMINO',
                'SERVICIOS',
                'AUXILIARES',
                'DE CAMINO',
              ];
              const isFalsePositive = falsePositives.some(
                (fp) =>
                  nameUpper === fp ||
                  nameUpper.startsWith(`${fp} `) ||
                  nameUpper.endsWith(` ${fp}`) ||
                  nameUpper.includes(` ${fp} `),
              );

              if (
                name.length > 5 &&
                name.length <= 50 &&
                !isFalsePositive &&
                !name.match(
                  /^(EMPRESA|N\.I\.F\.|Núm|Ocupación|Seg\.|Social|del\s+\d+|A\s+FIRMA|FIRMA\s+PERSONA|AUXILIAR|SERVICIO|PUESTO)/i,
                )
              ) {
                logger.log(
                  `🔍 Liquidacion Pattern 1 (Persona trabajadora) matched: "${name}"`,
                );
                return name;
              } else {
                logger.log(
                  `⏭️ Rejected liquidacion name (false positive or invalid): "${name}"`,
                );
              }
            }
          }
        }
      }
    }
  }

  // SPECIAL HANDLING FOR BAJA: Extract name from "D./Dña. [NUME]" format where name may be split across lines
  // Format: "D./Dña. IGNACIO\nLABRADOR ARRIBAS" (name split across lines)
  const isBaja =
    textLower.includes('informe de situación de baja') ||
    textLower.includes('reconocer la baja');

  if (isBaja) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Pattern: Look for "D./Dña." and extract name that may be split across current and next line
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      // Check if line contains "D./Dña." or "D./DÑA."
      const dDnaMatch = line.match(
        /d\.\/d[ñÑña]a\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]*)/i,
      );
      if (dDnaMatch) {
        // Extract name part from current line (after "D./Dña.")
        const namePart1 = dDnaMatch[1].trim();

        // Check if name continues on next line
        if (idx + 1 < lines.length) {
          const nextLine = lines[idx + 1];
          // Check if next line starts with uppercase letters (likely continuation of name)
          // Stop if next line contains "con número", "con fecha", comma followed by "con", etc.
          if (
            nextLine &&
            /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,}/.test(nextLine) &&
            !nextLine.match(
              /^(con\s+número|con\s+fecha|con\s+código|como\s+trabajador)/i,
            )
          ) {
            // Extract name part from next line (stop at comma or "con")
            const namePart2Match = nextLine.match(
              /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s*,\s*con|\s*con\s+número|\s*con\s+fecha|$)/,
            );
            if (namePart2Match) {
              const namePart2 = namePart2Match[1].trim();
              const fullName = `${namePart1} ${namePart2}`.trim();
              logger.log(
                `🔍 BAJA Pattern (D./Dña. split across lines) matched: "${fullName}"`,
              );
              return fullName;
            }
          }
        }

        // If name is complete on same line (stop at comma or "con")
        const sameLineMatch = namePart1.match(
          /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]+?)(?:\s*,\s*con|\s*con\s+número|\s*con\s+fecha|$)/,
        );
        if (sameLineMatch) {
          const fullName = sameLineMatch[1].trim();
          logger.log(
            `🔍 BAJA Pattern (D./Dña. same line) matched: "${fullName}"`,
          );
          return fullName;
        }
      }
    }
  }

  if (isFiniquito) {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Pattern 1: "Periodo de liquidación" - name is on next line
    for (let idx = 0; idx < lines.length; idx++) {
      if (lines[idx].match(/Periodo\s+de\s+liquidación/i)) {
        if (idx + 1 < lines.length) {
          let nombreLine = lines[idx + 1];

          // If line contains tab, take part before tab
          if (nombreLine && nombreLine.includes('\t')) {
            nombreLine = nombreLine.split('\t')[0].trim();
          }
          // If line contains "DE CAMINO", take part before that
          else if (nombreLine && nombreLine.includes('DE CAMINO')) {
            nombreLine = nombreLine.split('DE CAMINO')[0].trim();
          }

          // Verify it's a valid name (not false positive)
          if (
            nombreLine &&
            nombreLine.trim().length > 5 &&
            !nombreLine.match(
              /^(EMPRESA|N\.I\.F\.|Núm|Ocupación|Seg\.|Social|del\s+\d+)/i,
            ) &&
            /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(nombreLine)
          ) {
            const name = nombreLine.trim();
            logger.log(
              `🔍 Finiquito Pattern 1 (Periodo liquidación) matched: "${name}"`,
            );
            return name;
          }
        }
      }
    }

    // Pattern 2: "TRABAJADOR /A" - name is on next 1-3 lines
    for (let idx = 0; idx < Math.min(lines.length, 10); idx++) {
      if (lines[idx].match(/TRABAJADOR\s*\/A/i)) {
        for (let j = idx + 1; j < Math.min(idx + 4, lines.length); j++) {
          const candidateLine = lines[j];
          if (
            candidateLine &&
            !candidateLine.match(
              /^(N\.I\.F\.|Núm|Ocupación|Seg\.|Social|EMPRESA|del\s+\d+)/i,
            ) &&
            /^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}/.test(candidateLine)
          ) {
            const nombreMatch = candidateLine.match(
              /^([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?:\s+N\.I\.F\.|$)/,
            );
            if (nombreMatch) {
              const name = nombreMatch[1].trim();
              logger.log(
                `🔍 Finiquito Pattern 2 (TRABAJADOR /A) matched: "${name}"`,
              );
              return name;
            }
          }
        }
      }
    }
  }

  const trabajadorPatterns = [
    // Pattern 0: "Persona trabajadora:" followed by name (for LIQUIDACION and FINIQUITO documents)
    // Format: "Persona trabajadora:\nCategoría:\nMotivo Baja:\n...\nIGNACIO LABRADOR ARRIBAS 11858699Z"
    // The name comes after intermediate fields (Categoría, Motivo, etc.) and is followed by DNI (8 digits + letter)
    // This pattern skips intermediate fields using (?:[^\n]*\n)*? and captures name followed by DNI
    /persona\s+trabajadora\s*:?\s*\n(?:[^\n]*\n)*?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,3})\s+(\d{8}[A-Z])/i,
    // Pattern 0.5: "Periodo de liquidación.:" followed by name on next line (for FINIQUITO documents from gestoria)
    // Format: "Periodo de liquidación.:\nIGNACIO LABRADOR ARRIBAS\t..." or "Periodo de liquidación.:\nIGNACIO LABRADOR ARRIBAS DE CAMINO..."
    // Logic from gestoria.service.ts: check next line, if it contains tab, take part before tab; if it contains "DE CAMINO", take part before that
    // Must NOT start with false positives: "EMPRESA", "N.I.F.", "Núm", "Ocupación", "Seg.", "Social", "del [număr]"
    // Must start with uppercase and be at least 4 characters (gestoria checks for > 5, but we use >= 4 for flexibility)
    // Capture name that is at least 4 uppercase characters, not starting with false positives
    /periodo\s+de\s+liquidaci[óo]n\s*:?\s*\n\s*(?!(?:EMPRESA|N\.I\.F\.|Núm|Ocupación|Seg\.|Social|del\s+\d+)\b)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?=\s*\t|\s*DE\s+CAMINO|\s*N\.I\.F\.|\s*Núm|\s*Ocupación|\s*Seg\.|\s*Social|\s*EMPRESA|\s*del\s+\d+|\n|$)/i,
    // Pattern 0.6: "TRABAJADOR /A" followed by name on next lines (for FINIQUITO documents from gestoria)
    // Format: "TRABAJADOR /A\n[NUME]" - name is on next 1-3 lines
    // Logic from gestoria.service.ts: check next 1-3 lines, must NOT start with false positives, must start with uppercase and be at least 4 characters
    // Name may be followed by "N.I.F." or end of line
    // Pattern matches name that starts with uppercase, has at least 4 characters, and is followed by "N.I.F." or end of line
    /trabajador\s*\/a\s*\n(?:[^\n]*\n){0,3}?\s*(?!(?:N\.I\.F\.|Núm|Ocupación|Seg\.|Social|EMPRESA|del\s+\d+)\b)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{4,}?)(?=\s+N\.I\.F\.|\s*Núm|\s*Ocupación|\s*Seg\.|\s*Social|\s*EMPRESA|\s*del\s+\d+|\n|$)/i,
    // Pattern 0.8: For CONTRATO/DISMINUCION - "El/la trabajador/a" section followed by "Don/D.:" and name (HIGH PRIORITY)
    // Format: "El/la trabajador/a\nDon/D.:\nD.N.I. Domicilio Fecha\nGRANADO DIUNIS ROSALES\n..."
    // Name appears after "Don/D.:" but may be separated by a line with "D.N.I. Domicilio Fecha"
    // Use multiline matching to find name after "Don/D.:" that is followed by numbers (DNI or date)
    // IMPORTANT: Exclude addresses (AV, AVENIDA, CALLE, etc.) - names don't start with these
    /el\/la\s+trabajador\/a\s*don\/d\.?:?\s*\n(?:[^\n]*\n)*?\s*(?!(?:AV|AVENIDA|CALLE|C\/|PLAZA|PASEO|BULEVAR|CARRETERA|AUTOPISTA|AUTOVIA|EUZCADI|MADRID|BARCELONA)\s+)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,3})\s+\d/i,
    // Pattern 0.9: For CONTRATO/DISMINUCION - "Don/D.:" on its own line followed by name (HIGH PRIORITY)
    // Format: "Don/D.:\nD.N.I. Domicilio Fecha\nGRANADO DIUNIS ROSALES 281668310515"
    // Name appears after "Don/D.:" but may be separated by a line with "D.N.I. Domicilio Fecha"
    // Look for name that is followed by a number (DNI or date like 281668310515 or 01/01/1990)
    // IMPORTANT: Exclude addresses (AV, AVENIDA, CALLE, etc.) - names don't start with these
    /don\/d\.?:?\s*\n(?:[^\n]*\n)*?\s*(?!(?:AV|AVENIDA|CALLE|C\/|PLAZA|PASEO|BULEVAR|CARRETERA|AUTOPISTA|AUTOVIA|EUZCADI|MADRID|BARCELONA)\s+)([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){1,3})\s+\d/i,
    // Pattern 1: "D/Dª" followed by name on next line (PRIORITY - most common in SELLO documents)
    // Format: "D/Dª\nORLENA HERNANDEZ ESTEVEZ\nNIF/NIE"
    // More flexible: allow optional whitespace and ensure name is followed by NIF/NIE or newline
    /d\/d[ªa]\.?\s*:?\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*\n|\s*NIF|\s*NIE|\s*Fecha)/i,
    // Pattern 2: "DATOS DEL/LA TRABAJADOR/A" section followed by "D/Dª" and name
    /(?:datos\s+del\/?la\s+trabajador\/?a)\s*:?\s*\n?\s*d\/d[ªa]\.?\s*:?\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*\n|\s*NIF|\s*NIE|\s*Fecha)/i,
    // Pattern 3: "D/Dª" or "D/Da" (lowercase) on same line or next line, followed by name
    // Must be followed by NIF/NIE or newline to avoid false positives
    /d\/d[ªa]\.?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*\n\s*NIF|\s*\n\s*NIE|\s*\n\s*Fecha|\s*NIF|\s*NIE|\s*Fecha|$)/i,
    // Pattern 3: "D./Dña." (lowercase with ñ) - for ALTA documents
    /d\.\/dña\.\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{3,50})(?:\s*,\s*con\s+fecha\s+de\s+nacimiento|\n|NIF|NIE|Fecha|$)/i,
    // Pattern 4: "D./DÑA." (uppercase with Ñ) - for CONTRATO documents
    // In contract PDFs, the name might be on the same line or next line after "D./DÑA."
    // Capture up to 4 words (typical Spanish name format)
    // Stop at: "FECHA", "NACIMIENTO", "NIF", "NIE", "RÉGIMEN", "CÓDIGO", comma, or newline
    /d\.\/d[ñÑ]a\.\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*FECHA|\s*NACIMIENTO|\s*NIF|\s*NIE|\s*RÉGIMEN|\s*CÓDIGO|\s*CUENTA|\s*COTIZACIÓN|\s*,\s*|\n|$)/i,
    // Pattern 5: More flexible - any "D./D" followed by "ÑA" or "ña" or "ª" or "a"
    // For CONTRATO - capture name that looks like a person name (1-4 words)
    // BUT: Must NOT be preceded by "Nombre o Razón" to avoid false positives
    /(?<!nombre\s+o\s+raz[óo]n\s+social\s+de\s+la\s+empresa\s+)d\.\/d[ñÑ]?[ªa]\.?\s*:?\s*\n?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*FECHA|\s*NACIMIENTO|\s*NIF|\s*NIE|\s*RÉGIMEN|\s*CÓDIGO|\s*CUENTA|\s*COTIZACIÓN|\s*,\s*|\n|$)/i,
    // Pattern 6: For CONTRATO - name might be on next line after "D./DÑA."
    // Look for name on the line immediately after "D./DÑA."
    /d\.\/d[ñÑ]a\.\s*:?\s*\n\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*FECHA|\s*NACIMIENTO|\s*NIF|\s*NIE|\s*RÉGIMEN|\s*CÓDIGO|\s*CUENTA|\s*COTIZACIÓN|\s*,\s*|\n|$)/i,
    // Pattern 7: For CONTRATO - "D./DÑA." followed by name, with more context
    // Look for name between "D./DÑA." and "FECHA NACIMIENTO" or "RÉGIMEN"
    /d\.\/d[ñÑ]a\.\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ]+(?:\s+[A-ZÁÉÍÓÚÑ]+){0,3})(?=\s*FECHA\s+NACIMIENTO|\s*RÉGIMEN|\s*CÓDIGO|\s*CUENTA)/i,
  ];

  for (let i = 0; i < trabajadorPatterns.length; i++) {
    const pattern = trabajadorPatterns[i];
    const match = text.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      // For Pattern 0 (Persona trabajadora), we also capture DNI in match[2], but we only need the name
      // Pattern indices: 0 = Persona trabajadora, 1 = D/Dª, 2 = DATOS DEL/LA, etc.
      // Pattern 0.5 and 0.6 are at indices after Pattern 0, so we need to identify them
      const isPattern05 = pattern
        .toString()
        .includes('periodo\\s+de\\s+liquidaci');
      const isPattern06 = pattern.toString().includes('trabajador\\s*\\/a');
      const patternName =
        i === 0
          ? '0 (Persona trabajadora)'
          : isPattern05
            ? '0.5 (Periodo liquidación)'
            : isPattern06
              ? '0.6 (TRABAJADOR /A)'
              : `${i}`;
      logger.log(
        `🔍 Pattern ${patternName} matched: "${name}" (index: ${match.index})${match[2] ? `, DNI: ${match[2]}` : ''}`,
      );

      // IMMEDIATE REJECTION: reject if name starts with lowercase "o" followed by space (likely "o Razón Social")
      if (/^o\s+/i.test(name)) {
        logger.log(`⏭️ Rejected name starting with "o ": ${name}`);
        continue;
      }

      // IMMEDIATE REJECTION: reject if the match context contains "Nombre o Razón" (false positive)
      const matchIndex = match.index || 0;
      const contextBefore = text
        .substring(Math.max(0, matchIndex - 50), matchIndex)
        .toLowerCase();
      if (
        contextBefore.includes('nombre o razón') ||
        contextBefore.includes('razón social')
      ) {
        logger.log(`⏭️ Rejected name from "Nombre o Razón" context: ${name}`);
        continue;
      }

      // Clean up: remove trailing "Fecha", "NIF", "NIE" if accidentally captured
      name = name
        .replace(/\s*(Fecha|NIF|NIE|NACIMIENTO|,\s*con\s+fecha).*$/i, '')
        .trim();

      // IMMEDIATE REJECTION: reject if name starts with false positives from finiquito/nomina (like "Núm", "afiliación", "N.I.F.", etc.)
      const startsWithFiniquitoFalsePositives =
        /^(n[úu]m|afiliaci[óo]n|n\.i\.f\.|ocupaci[óo]n|seg\.|social|empresa|del\s+\d+)/i.test(
          name,
        );
      if (startsWithFiniquitoFalsePositives) {
        logger.log(
          `⏭️ Rejected name starting with finiquito/nomina false positive: ${name}`,
        );
        continue;
      }

      // IMMEDIATE REJECTION: reject if name contains "razón", "social", "empresa", "camino", "servicios", "auxiliar", "servicio" (common false positives)
      const containsRazonSocial =
        /raz[óo]n|social|empresa|camino|servicios|auxiliares|auxiliar\s+de|servicio\s+de|puesto/i.test(
          name,
        );
      if (containsRazonSocial) {
        logger.log(
          `⏭️ Rejected name containing false positive keywords: ${name}`,
        );
        continue;
      }

      // IMMEDIATE REJECTION: reject addresses (AV, AVENIDA, CALLE, etc.)
      // Addresses often start with "AV" (Avenida), "C/" (Calle), or contain location names
      const isAddress =
        /^(AV|AVENIDA|CALLE|C\/|PLAZA|PASEO|BULEVAR|CARRETERA|AUTOPISTA|AUTOVIA)\s+/i.test(
          name,
        ) ||
        /\b(EUZCADI|MADRID|BARCELONA|VALENCIA|SEVILLA|BILBAO|MURCIA|MÁLAGA|ZARAGOZA|PALMA|LAS\s+PALMAS|SANTA\s+CRUZ|VALLADOLID|CÓRDOBA|VIGO|GIJÓN|HOSPITALET|VITORIA|A CORUÑA|ELCHE|GRANADA|OVIEDO|SANTA\s+CRUZ\s+DE\s+TENERIFE|BADALONA|CARTAGENA|TERRASA|JEREZ|SABADELL|MÓSTOLES|SANTA\s+CRUZ\s+DE\s+TENERIFE|PAMPLONA|ALMERÍA|FUENLABRADA|LEGANÉS|DONOSTIA|SANTANDER|GETAFE|BURGOS|SALAMANCA|ALBACETE|CASTELLÓN|LORCA|TARRAGONA|MATARÓ|LEÓN|CÁDIZ|LINARES|JAÉN|ORENSE|REUS|TELDE|BARAKALDO|SANTIAGO\s+DE\s+COMPOSTELA|LORCA|CEUTA|MELILLA)\b/i.test(
          name,
        );
      if (isAddress) {
        logger.log(`⏭️ Rejected address (not a name): ${name}`);
        continue;
      }

      // IMMEDIATE REJECTION: reject single-word names that are common false positives (AUXILIAR, SERVICIO, PUESTO, etc.)
      const singleWordFalsePositives = [
        'AUXILIAR',
        'SERVICIO',
        'PUESTO',
        'CATEGORÍA',
        'CATEGORIA',
        'OCUPACIÓN',
        'OCUPACION',
      ];
      const nameWords = name.toUpperCase().trim().split(/\s+/);
      if (
        nameWords.length === 1 &&
        singleWordFalsePositives.includes(nameWords[0])
      ) {
        logger.log(`⏭️ Rejected single-word false positive: ${name}`);
        continue;
      }

      // IMMEDIATE REJECTION: reject "A FIRMA PERSONA TRABAJADORA" and similar false positives from liquidacion documents
      const isFirmaTrabajadora =
        /^A\s+FIRMA|^FIRMA\s+PERSONA\s+TRABAJADORA|^PERSONA\s+TRABAJADORA\s*$/i.test(
          name,
        );
      if (isFirmaTrabajadora) {
        logger.log(
          `⏭️ Rejected false positive from liquidacion document: ${name}`,
        );
        continue;
      }

      // Filter out common false positives and technical terms
      // IMPORTANT: Do NOT include common Spanish surnames (DELGADO, IGLESIAS, LABRADOR, ARRIBAS, etc.)
      // as these are valid names and should not be rejected
      const falsePositives = [
        'EMPRESA',
        'RAZÓN',
        'SOCIAL',
        'FECHA',
        'NIF',
        'NIE',
        'NACIMIENTO',
        'RÉGIMEN',
        'CÓDIGO',
        'CUENTA',
        'COTIZACIÓN',
        'ACTIVIDAD',
        'ECONÓMICA',
        'CONTRATO',
        'TRABAJADOR',
        'TRABAJADORA',
        'DATOS',
        'DEL',
        'LA',
        'NOMBRE',
        'APELLIDOS',
        'DNI',
        'DOMICILIO',
        'LOCALIDAD',
        'PROVINCIA',
        'CÓDIGO POSTAL',
        'TELÉFONO',
        'CORREO',
        'ELECTRÓNICO',
        'EMAIL',
        'PUESTO',
        'CATEGORÍA',
        'GRUPO',
        'JORNADA',
        'HORARIO',
        'SALARIO',
        'VACACIONES',
        'BAJA',
        'ALTA',
        'CON',
        'DE',
        'NACIMIENTO',
        'MUNICIPIO',
        'PAÍS',
        'EN',
        'CONCEPTO',
        'NIVEL',
        'FORMATIVO',
        'CAMINO',
        'SERVICIOS',
        'AUXILIARES',
        'DOMICILIO',
        'AVENIDA',
        'CALLE',
      ];

      const nameUpper = name.toUpperCase().trim();

      // Check if any word in the name is a false positive
      // IMPORTANT: Use exact match only, not substring match
      // Otherwise, names like "DELGADO" would be rejected because they contain "DEL"
      const words = nameUpper.split(/\s+/).filter((w) => w.length > 0);
      const hasFalsePositive = words.some(
        (word) => falsePositives.some((fp) => word === fp), // Exact match only, not substring
      );

      // Check if name looks like a real person name:
      // - Should be 1-4 words (can be just first name like "YUSBEL" or full name)
      // - Each word should be 2-20 characters (reasonable name length)
      // - Should not contain technical terms
      // - Should not be too long (max 60 chars total)
      const isValidNameLength = words.length >= 1 && words.length <= 4;
      const hasValidWordLengths = words.every(
        (word) => word.length >= 2 && word.length <= 20,
      );
      const isNotTooLong = nameUpper.length <= 60;

      // Additional check: if it's a single word, it should be at least 3 characters and look like a name
      const isSingleWordValid =
        words.length === 1
          ? words[0].length >= 3 && /^[A-ZÁÉÍÓÚÑ]+$/.test(words[0])
          : true;

      if (
        name.length >= 3 &&
        !/^(EL|LA|LOS|LAS|DE|DEL|Y|O|A|EN|CON|POR|PARA|QUE|ES|SON|ESTA|ESTE|EMPRESA|RAZÓN|SOCIAL|FECHA|NIF|NIE)$/i.test(
          name,
        ) &&
        !hasFalsePositive &&
        !containsRazonSocial &&
        isValidNameLength &&
        hasValidWordLengths &&
        isNotTooLong &&
        isSingleWordValid
      ) {
        logger.log(
          `🔍 Extracted empleado nombre: ${name} (from trabajador/a pattern)`,
        );
        return name;
      } else {
        logger.log(
          `⏭️ Rejected false positive name: ${name} (words: ${words.length}, hasFalsePositive: ${hasFalsePositive}, validLength: ${isValidNameLength}, validWordLengths: ${hasValidWordLengths}, singleWordValid: ${isSingleWordValid})`,
        );
      }
    }
  }

  // Pattern 3: Look for name patterns in text (e.g., "Nombre: YUSBEL", "Empleado: YUSBEL")
  // BUT: Exclude false positives like "de DE CAMINO SERVICIOS AUXILIARES" and "o Razón Social"
  const textPatterns = [
    /(?:nombre|empleado|trabajador|worker|employee)\s*:?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s]{2,30})(?=\s*NIF|\s*NIE|\s*Fecha|\n|$)/i,
    /(?:nombre|empleado|trabajador|worker|employee)\s*:?\s*([a-záéíóúñ][a-záéíóúñ\s]{2,30})(?=\s*NIF|\s*NIE|\s*Fecha|\n|$)/i,
  ];

  // Test textPatterns but reject "o Razón Social" and similar false positives
  for (const pattern of textPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();

      // IMMEDIATE REJECTION: reject if name starts with "o " (likely "o Razón Social")
      if (/^o\s+/i.test(name)) {
        logger.log(`⏭️ Pattern 3 - Rejected name starting with "o ": ${name}`);
        continue;
      }

      // IMMEDIATE REJECTION: reject if name contains "razón", "social", "empresa"
      if (/raz[óo]n|social|empresa|camino|servicios|auxiliares/i.test(name)) {
        logger.log(
          `⏭️ Pattern 3 - Rejected name containing false positive: ${name}`,
        );
        continue;
      }

      // Check context - reject if preceded by "Nombre o Razón"
      const matchIndex = match.index || 0;
      const contextBefore = text
        .substring(Math.max(0, matchIndex - 50), matchIndex)
        .toLowerCase();
      if (
        contextBefore.includes('nombre o razón') ||
        contextBefore.includes('razón social')
      ) {
        logger.log(
          `⏭️ Pattern 3 - Rejected name from "Nombre o Razón" context: ${name}`,
        );
        continue;
      }

      logger.log(`🔍 Extracted empleado nombre: ${name} (from text pattern)`);
      return name;
    }
  }

  // Pattern 3b: For CONTRATO documents - look for name anywhere in text that looks like a person name
  // This is a fallback when "D./DÑA." pattern doesn't work (form fields not extracted properly)
  // Look for words that are all uppercase, 3-20 chars each, 1-4 words total, not technical terms
  // This should catch names like "YUSBEL", "ORLENA", "YUSBEL ESTRADA SMITH", etc.
  // IMPORTANT: Only use this for "contrato" documents, NOT for "sello" or "alta" documents
  // For "sello" and "alta", we should rely on Pattern 1-7 which are more specific
  // Only use this if we haven't found a name yet and text is not empty
  // Skip Pattern 3b for "sello" and "alta" documents to avoid false positives
  if (text && text.length > 0 && filename && !/sello|alta/i.test(filename)) {
    const nameLikePattern =
      /\b([A-ZÁÉÍÓÚÑ]{3,20}(?:\s+[A-ZÁÉÍÓÚÑ]{3,20}){0,3})\b/g;
    const falsePositivesForNameLike = [
      'CONTRATO',
      'TRABAJO',
      'INDEFINIDO',
      'DATOS',
      'EMPRESA',
      'CUENTA',
      'COTIZACIÓN',
      'TRABAJADOR',
      'TRABAJADORA',
      'CENTRO',
      'RÉGIMEN',
      'CÓDIGO',
      'ACTIVIDAD',
      'ECONÓMICA',
      'MUNICIPIO',
      'PAÍS',
      'DOMICILIO',
      'SOCIAL',
      'NOMBRE',
      'RAZÓN',
      'APELLIDOS',
      'FECHA',
      'NACIMIENTO',
      'NIF',
      'NIE',
      'NIVEL',
      'FORMATIVO',
      'CONCEPTO',
      'CLÁUSULAS',
      'PRIMERA',
      'SEGUNDA',
      'TERCERA',
      'CUARTA',
      'QUINTA',
      'SEXTA',
      'SÉPTIMA',
      'OCTAVA',
      'NOVENA',
      'DÉCIMA',
      'UNDÉCIMA',
      'DUODÉCIMA',
      'MOD',
      'CIND',
      'CAS',
      'TIEMPO',
      'COMPLETO',
      'PARCIAL',
      'ORDINARIO',
      // Acronime comune care nu sunt nume
      'ERE',
      'ESS',
      'ERTE',
      'EPA',
      'EPI',
      'IVA',
      'IRPF',
      'SS',
      'TGSS',
      'INEM',
      'CCAA',
      'CCLL',
      'CEOE',
      'CCOO',
      'UGT',
      'CGT',
      'CNT',
      'USO',
    ];

    let match;
    const candidates = [];
    while ((match = nameLikePattern.exec(text)) !== null) {
      const candidate = match[1].trim();
      const words = candidate.split(/\s+/);

      // Check if it looks like a name (not a false positive)
      const isFalsePositive = words.some((word) =>
        falsePositivesForNameLike.some(
          (fp) => word === fp || word.includes(fp),
        ),
      );

      // Additional check: reject single-word candidates that are likely acronyms
      // Acronimele sunt de obicei 3-4 litere, toate majuscule, și nu sunt nume comune
      const isLikelyAcronym =
        words.length === 1 &&
        words[0].length >= 3 &&
        words[0].length <= 4 &&
        /^[A-ZÁÉÍÓÚÑ]+$/.test(words[0]) &&
        ![
          'ANA',
          'MARIA',
          'JOSE',
          'LUIS',
          'CARLOS',
          'PEDRO',
          'JUAN',
          'MANUEL',
          'FRANCISCO',
          'ANTONIO',
        ].includes(words[0]);

      // Additional check: reject candidates that look like phrases or sentences (too many words or too long)
      // Names should be 1-3 words typically, not 4+ words which are likely phrases
      const isLikelyPhrase = words.length > 3 || candidate.length > 40;

      // Additional check: reject candidates that contain common phrase words
      const phraseWords = [
        'PARA',
        'POR',
        'DEL',
        'DE',
        'LA',
        'LAS',
        'LOS',
        'QUE',
        'CON',
        'SIN',
        'DESDE',
        'HASTA',
        'TODAS',
        'TODOS',
        'EXISTE',
        'REPRESENTACIÓN',
        'COMUNICACIÓN',
        'PERSONAS',
        'TRABAJADORAS',
        'BENEFICIARIAS',
        'CUALIFICACIÓN',
        'PRESTACIONES',
        'DURACIÓN',
        'SISTEMA',
        'NACIONAL',
      ];
      const containsPhraseWords = words.some((word) =>
        phraseWords.includes(word),
      );

      // Check if it's a reasonable name (1-3 words typically, each 3-20 chars)
      const isValid =
        !isFalsePositive &&
        !isLikelyAcronym &&
        !isLikelyPhrase &&
        !containsPhraseWords &&
        words.length >= 1 &&
        words.length <= 3 && // Reduced from 4 to 3
        words.every((w) => w.length >= 3 && w.length <= 20) &&
        candidate.length <= 40; // Reduced from 60 to 40

      if (isValid) {
        candidates.push(candidate);
        logger.log(
          `🔍 Pattern 3b candidate: "${candidate}" (isLikelyAcronym: ${isLikelyAcronym}, isFalsePositive: ${isFalsePositive})`,
        );
      } else {
        logger.log(
          `⏭️ Pattern 3b rejected: "${candidate}" (isLikelyAcronym: ${isLikelyAcronym}, isFalsePositive: ${isFalsePositive})`,
        );
      }
    }

    // If we found candidates, return the first one that looks most like a name
    // Prefer longer names (more likely to be complete names) over short acronyms
    // But also prefer names with more words (full names) over single words
    if (candidates.length > 0) {
      logger.log(
        `🔍 Pattern 3b found ${candidates.length} candidates: ${candidates.join(', ')}`,
      );

      // Sort by: word count (more words = better), then length (longer = better)
      // This ensures "ORLENA HERNANDEZ ESTEVEZ" is preferred over "ERE" or "ESS"
      candidates.sort((a, b) => {
        const aWords = a.split(/\s+/).length;
        const bWords = b.split(/\s+/).length;
        // First priority: more words is better (full names over single words)
        if (aWords !== bWords) return bWords - aWords; // Descending: more words first
        // Second priority: longer names are better (complete names over acronyms)
        return b.length - a.length; // Descending: longer first
      });

      const bestCandidate = candidates[0];
      logger.log(
        `🔍 Extracted empleado nombre: ${bestCandidate} (from name-like pattern in text, ${candidates.length} candidates, sorted order: ${candidates.join(' > ')})`,
      );
      return bestCandidate;
    }
  }

  // Note: textPatterns are already tested above with proper filtering (lines 604-631)
  // The previous loop already handles textPatterns with proper rejection of "o Razón Social"

  return null;
}
