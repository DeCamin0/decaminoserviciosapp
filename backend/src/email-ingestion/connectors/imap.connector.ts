import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImapFlow } from 'imapflow';
import {
  EmailConnector,
  EmailMessage,
  EmailAttachment,
} from '../interfaces/email-connector.interface';

@Injectable()
export class ImapConnector implements EmailConnector {
  private readonly logger = new Logger(ImapConnector.name);
  private client: ImapFlow | null = null;
  private isConnected = false;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Check if IMAP is configured
   * Note: IMAP_HOST has a default value, so we only need to check user and password
   */
  isConfigured(): boolean {
    const user =
      this.configService.get<string>('SMTP_USER') ||
      this.configService.get<string>('IMAP_USER');
    const password =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('IMAP_PASSWORD');

    // IMAP_HOST has a default ('imap.serviciodecorreo.es'), so we only need user and password
    return !!(user && password);
  }

  /**
   * Connect to IMAP server
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      this.logger.log('✅ Already connected to IMAP');
      return;
    }

    const host =
      this.configService.get<string>('IMAP_HOST') || 'imap.serviciodecorreo.es'; // Default based on SMTP host
    const port = this.configService.get<number>('IMAP_PORT') || 993;
    const secure = this.configService.get<string>('IMAP_SECURE') !== 'false'; // Default true
    const user =
      this.configService.get<string>('SMTP_USER') ||
      this.configService.get<string>('IMAP_USER');
    const password =
      this.configService.get<string>('SMTP_PASSWORD') ||
      this.configService.get<string>('IMAP_PASSWORD');
    const mailbox = this.configService.get<string>('IMAP_MAILBOX') || 'INBOX';

    if (!user || !password) {
      throw new Error(
        'IMAP credentials not configured. Set SMTP_USER and SMTP_PASSWORD (or IMAP_USER and IMAP_PASSWORD)',
      );
    }

    this.logger.log(
      `🔌 Connecting to IMAP: ${host}:${port} (secure: ${secure})`,
    );
    this.logger.log(`   User: ${user}`);
    this.logger.log(`   Mailbox: ${mailbox}`);

    this.client = new ImapFlow({
      host,
      port,
      secure,
      auth: {
        user,
        pass: password,
      },
      logger: false, // Disable imapflow internal logging
    });

    try {
      await this.client.connect();
      this.isConnected = true;
      this.logger.log('✅ Connected to IMAP server');
    } catch (error: any) {
      this.logger.error(`❌ Failed to connect to IMAP: ${error.message}`);
      this.client = null;
      this.isConnected = false;
      throw new Error(`IMAP connection failed: ${error.message}`);
    }
  }

  /**
   * Disconnect from IMAP server
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        await this.client.logout();
        this.logger.log('✅ Disconnected from IMAP server');
      } catch (error: any) {
        this.logger.warn(`⚠️ Error during IMAP disconnect: ${error.message}`);
      } finally {
        this.client = null;
        this.isConnected = false;
      }
    }
  }

  /**
   * Fetch messages from mailbox
   * @param limit - Maximum number of messages (null or 0 = no limit)
   */
  async fetchMessages(
    readStatus: 'read' | 'unread' | 'all',
    limit: number | null = 50,
    extractAttachments: boolean = true,
    subjectFilter: string | null = null,
  ): Promise<EmailMessage[]> {
    if (!this.client || !this.isConnected) {
      throw new Error('Not connected to IMAP server. Call connect() first.');
    }

    const mailbox = this.configService.get<string>('IMAP_MAILBOX') || 'INBOX';
    const messages: EmailMessage[] = [];

    try {
      // Select mailbox
      const lock = await this.client.getMailboxLock(mailbox);
      try {
        // Build search criteria based on readStatus
        const searchCriteria: any = {};
        if (readStatus === 'read') {
          searchCriteria.seen = true;
        } else if (readStatus === 'unread') {
          searchCriteria.seen = false;
        }
        // 'all' means no filter

        // Fetch messages (no sort option in imapflow search, we'll sort manually)
        const messageListResult = await this.client.search(searchCriteria);

        if (messageListResult === false) {
          this.logger.log('📧 No messages found');
          return messages;
        }

        // Apply limit and reverse for most recent first (search returns oldest first)
        // If limit is null or 0, process all messages
        const messageList =
          limit && limit > 0
            ? messageListResult.slice(-limit).reverse()
            : messageListResult.reverse();

        this.logger.log(
          `📧 Found ${messageList.length} messages (readStatus: ${readStatus}, limit: ${limit || 'unlimited'})`,
        );

        // Fetch message details
        for (const seq of messageList) {
          try {
            const messageResult = await this.client.fetchOne(seq, {
              envelope: true,
              bodyStructure: true,
              flags: true,
            });

            if (messageResult === false) {
              this.logger.warn(`⚠️ Skipping message ${seq}: fetch failed`);
              continue;
            }

            const message = messageResult;

            if (!message.envelope) {
              this.logger.warn(`⚠️ Skipping message ${seq}: missing envelope`);
              continue;
            }

            // Extract subject correctly (can be string, array of strings, or array of objects)
            let subject = 'No Subject';
            if (message.envelope.subject) {
              if (typeof message.envelope.subject === 'string') {
                subject = message.envelope.subject;
              } else if (Array.isArray(message.envelope.subject)) {
                // If it's an array, join all elements (handles encoded subjects)
                const subjectArray = message.envelope.subject as any[];
                subject = subjectArray
                  .map((part: any) => {
                    if (typeof part === 'string') {
                      return part;
                    } else if (
                      part &&
                      typeof part === 'object' &&
                      'value' in part
                    ) {
                      return part.value;
                    } else if (
                      part &&
                      typeof part === 'object' &&
                      'text' in part
                    ) {
                      return part.text;
                    }
                    return String(part || '');
                  })
                  .filter((s: string) => s && s.length > 0)
                  .join(' ');
              }
            }

            // Filter by subject if subjectFilter is provided
            if (
              subjectFilter &&
              !subject.toUpperCase().includes(subjectFilter.toUpperCase())
            ) {
              this.logger.log(
                `⏭️ Skipping message ${seq}: subject "${subject}" does not contain "${subjectFilter}"`,
              );
              continue;
            }

            const from = message.envelope.from?.[0]?.address || 'Unknown';
            const date = message.envelope.date || new Date();
            const messageId =
              message.envelope.messageId || `msg_${seq}_${Date.now()}`;
            const read = message.flags?.has('\\Seen') || false;

            // Extract body (text and HTML) for name extraction
            let emailBody: { text?: string; html?: string } | undefined;
            try {
              if (message.bodyStructure) {
                const bodyParts = await this.extractBodyText(
                  seq,
                  message.bodyStructure,
                );
                if (bodyParts.text || bodyParts.html) {
                  emailBody = bodyParts;
                  this.logger.log(
                    `📄 Extracted body from message ${seq} (text: ${!!bodyParts.text}, html: ${!!bodyParts.html})`,
                  );
                }
              }
            } catch (bodyError: any) {
              // Non-critical: log but don't fail message processing
              this.logger.warn(
                `⚠️ Could not extract body from message ${seq}: ${bodyError.message}`,
              );
            }

            // Extract attachments only if requested
            const attachments: EmailAttachment[] = [];
            if (extractAttachments && message.bodyStructure) {
              const extractedAttachments = await this.extractAttachments(
                seq,
                message.bodyStructure,
              );
              attachments.push(...extractedAttachments);
              if (extractedAttachments.length > 0) {
                this.logger.log(
                  `📎 Extracted ${extractedAttachments.length} attachment(s) from message: ${subject}`,
                );
              }
            } else if (!message.bodyStructure) {
              this.logger.log(
                `⚠️ No bodyStructure for message ${seq}, cannot extract attachments`,
              );
            }

            const emailMessage: EmailMessage & {
              seq?: number;
              bodyStructure?: any;
            } = {
              messageId,
              subject,
              from,
              date,
              read,
              attachments,
              ...(emailBody && { body: emailBody }),
            };

            // Store sequence number and bodyStructure for later attachment extraction if needed
            if (!extractAttachments && message.bodyStructure) {
              emailMessage.seq = seq;
              emailMessage.bodyStructure = message.bodyStructure;
            }

            messages.push(emailMessage);

            this.logger.log(
              `✅ Processed message: ${subject} (from: ${from}, attachments: ${attachments.length})`,
            );
          } catch (msgError: any) {
            this.logger.warn(
              `⚠️ Error processing message ${seq}: ${msgError.message}`,
            );
            // Continue with next message
          }
        }
      } finally {
        lock.release();
      }
    } catch (error: any) {
      this.logger.error(`❌ Error fetching messages: ${error.message}`);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    return messages;
  }

  /**
   * Extract attachments from message
   */
  async extractAttachmentsForMessage(
    message: EmailMessage & { seq?: number; bodyStructure?: any },
  ): Promise<EmailAttachment[]> {
    if (!message.seq || !message.bodyStructure) {
      this.logger.warn(
        `⚠️ Cannot extract attachments: missing seq or bodyStructure`,
      );
      return [];
    }
    return this.extractAttachments(message.seq, message.bodyStructure);
  }

  /**
   * Extract attachments from message (internal method)
   */
  private async extractAttachments(
    seq: number,
    bodyStructure: any,
  ): Promise<EmailAttachment[]> {
    const attachments: EmailAttachment[] = [];

    if (!this.client) {
      return attachments;
    }

    this.logger.log(`🔍 Extracting attachments from message ${seq}...`);

    // Debug: Log bodyStructure structure
    if (bodyStructure) {
      this.logger.log(
        `🔍 DEBUG bodyStructure: type=${bodyStructure.type}, subtype=${bodyStructure.subtype}, childNodes=${bodyStructure.childNodes ? bodyStructure.childNodes.length : 'none'}, isArray=${Array.isArray(bodyStructure)}, keys=${Object.keys(bodyStructure || {}).join(', ')}`,
      );
    }

    const extractFromPart = async (part: any, partNumber?: string) => {
      // Debug: Log part structure for multipart (only for first few to avoid spam)
      if (
        (partNumber === undefined || parseInt(partNumber) <= 3) &&
        (part.type === 'multipart' ||
          (part.type && part.type.toLowerCase().includes('multipart')))
      ) {
        this.logger.log(
          `🔍 DEBUG multipart: type=${part.type}, subtype=${part.subtype}, childNodes=${part.childNodes ? part.childNodes.length : 'none'}, partNumber=${partNumber || 'root'}, hasChildNodes=${!!part.childNodes}`,
        );
      }

      // Get filename from disposition or from part parameters
      const filename =
        part.disposition?.filename ||
        part.parameters?.filename ||
        part.parameters?.name ||
        null;

      // Skip multipart containers (they are not attachments themselves)
      // Check both 'multipart' type and if it has childNodes (imapflow structure)
      if (
        part.type === 'multipart' ||
        (part.childNodes &&
          Array.isArray(part.childNodes) &&
          part.childNodes.length > 0)
      ) {
        // Process children recursively
        if (part.childNodes && Array.isArray(part.childNodes)) {
          this.logger.log(
            `📦 Processing multipart with ${part.childNodes.length} child nodes (partNumber: ${partNumber || 'root'})`,
          );
          for (let i = 0; i < part.childNodes.length; i++) {
            const childPart = part.childNodes[i];
            const childPartNumber = partNumber
              ? `${partNumber}.${i + 1}`
              : `${i + 1}`;
            await extractFromPart(childPart, childPartNumber);
          }
        } else {
          this.logger.warn(
            `⚠️ Multipart part has no childNodes: type=${part.type}, subtype=${part.subtype}, partNumber=${partNumber || 'root'}`,
          );
        }
        return; // Don't process multipart containers as attachments
      }

      // Check if part is an attachment
      // A part is an attachment if:
      // 1. It has a filename (from disposition or parameters)
      // 2. It's not a multipart container (already handled above)
      // 3. It's not a plain text/html body without explicit attachment disposition
      // 4. OR it's a PDF/Office/image file even without explicit filename (common in some email clients)
      const isTextBody =
        part.type === 'text' &&
        (part.subtype === 'plain' || part.subtype === 'html') &&
        (!part.disposition || part.disposition.type === 'inline');

      // Check if it's a document type (PDF, Office, images) - these should be treated as attachments
      const isDocumentType =
        (part.type === 'application' &&
          (part.subtype === 'pdf' ||
            part.subtype?.includes('msword') ||
            part.subtype?.includes('excel') ||
            part.subtype?.includes('spreadsheet') ||
            part.subtype?.includes('wordprocessing'))) ||
        (part.type === 'image' && part.subtype);

      // If it has a filename and is not a text body, OR it's a document type, it's an attachment
      const isAttachment =
        (filename && !isTextBody) || (isDocumentType && !isTextBody);

      if (isAttachment) {
        // Generate default filename if missing (for document types without explicit filename)
        // Define outside try-catch so it's available in catch block
        const finalFilename =
          filename ||
          (isDocumentType
            ? `document_${part.type}_${part.subtype}_${Date.now()}.${part.subtype === 'pdf' ? 'pdf' : part.subtype?.includes('word') ? 'docx' : part.subtype?.includes('excel') ? 'xlsx' : 'bin'}`
            : `attachment_${partNumber || '1'}_${Date.now()}.bin`);

        try {
          this.logger.log(
            `🔍 Found potential attachment: ${finalFilename} (type: ${part.type}/${part.subtype}, disposition: ${part.disposition?.type || 'none'}, partNumber: ${partNumber || '1'}, hasFilename: ${!!filename})`,
          );

          // Download attachment - use partNumber if available, otherwise '1'
          const downloadPartNumber = partNumber || '1';
          const attachmentData = await this.client!.download(
            seq,
            downloadPartNumber,
            {
              uid: false,
            },
          );

          if (!attachmentData) {
            this.logger.warn(`⚠️ No data for attachment: ${finalFilename}`);
            return;
          }

          // Check if content is available and is iterable
          if (!attachmentData.content) {
            this.logger.warn(
              `⚠️ No content stream for attachment: ${finalFilename} (partNumber: ${downloadPartNumber})`,
            );
            return;
          }

          const chunks: Buffer[] = [];
          try {
            for await (const chunk of attachmentData.content) {
              chunks.push(chunk);
            }
          } catch (streamError: any) {
            this.logger.warn(
              `⚠️ Error reading content stream for attachment ${finalFilename}: ${streamError.message}`,
            );
            return;
          }

          if (chunks.length === 0) {
            this.logger.warn(
              `⚠️ Empty content for attachment: ${finalFilename}`,
            );
            return;
          }

          const content = Buffer.concat(chunks);

          // Filter out signature/logo images (not real documents)
          const filenameLower = finalFilename.toLowerCase();
          const fileSize = content.length;
          const isImage = /\.(png|jpg|jpeg|gif)$/i.test(filename);

          // Check if filename is purely numeric (e.g., "1000046909.jpg") - these are usually real documents, not signatures
          const isNumericFilename = /^\d+\.(png|jpg|jpeg|gif)$/i.test(filename);

          // Check if filename is a hex hash with letters (e.g., "1f6cbf6f.png") - these are usually signature images
          const isHexHashWithLetters =
            /^[a-f0-9]{8,16}\.(png|jpg|jpeg|gif)$/i.test(filename) &&
            /[a-f]/.test(filename.toLowerCase());

          const isSignatureImage =
            // Outlook signature images (Outlook-*.png)
            filenameLower.startsWith('outlook-') ||
            // Hash-like filenames with hex letters (1f6cbf6f.png, etc.) - typically inline signature images
            // BUT: Skip if it's purely numeric (1000046909.jpg) - these are usually real scanned documents
            (isHexHashWithLetters && !isNumericFilename) ||
            // Logo files in signatures (explicit logo names)
            (filenameLower.includes('logo') &&
              filenameLower.length < 50 &&
              isImage) ||
            // Signature-related images (explicit signature/firma in name)
            ((filenameLower.includes('signature') ||
              filenameLower.includes('firma')) &&
              isImage) ||
            // Generic image names (image.png, image001.png, image1.jpg, etc.) that are small (< 100KB) - likely signature images
            // Real scanned documents are usually larger than 100KB
            ((/^image\.(png|jpg|jpeg|gif)$/i.test(filename) ||
              /^image\d+\.(png|jpg|jpeg|gif)$/i.test(filename)) &&
              fileSize < 100 * 1024);

          if (isSignatureImage) {
            this.logger.log(
              `⏭️ Skipping signature/logo image: ${filename} (size: ${(fileSize / 1024).toFixed(2)} KB)`,
            );
            return;
          }

          // Filter by supported file types
          const contentType = `${part.type}/${part.subtype}`;
          const supportedTypes = [
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ];

          if (
            supportedTypes.includes(contentType.toLowerCase()) ||
            finalFilename.match(/\.(pdf|png|jpg|jpeg|doc|docx|xls|xlsx)$/i)
          ) {
            attachments.push({
              attachmentId: `${seq}_${partNumber || '1'}`,
              filename: finalFilename,
              contentType,
              size: content.length,
              content,
            });

            this.logger.log(
              `📎 Extracted attachment: ${finalFilename} (${content.length} bytes, ${contentType})`,
            );
          } else {
            this.logger.log(
              `⏭️ Skipping unsupported attachment: ${finalFilename} (${contentType})`,
            );
          }
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Error extracting attachment ${finalFilename}: ${error.message}`,
          );
        }
      } else {
        // Log parts that are not attachments for debugging
        const partFilename =
          part.disposition?.filename ||
          part.parameters?.filename ||
          part.parameters?.name ||
          'no filename';

        // If it's multipart but we didn't catch it earlier, log detailed info
        if (
          part.type === 'multipart' ||
          (part.type && part.type.toLowerCase().includes('multipart'))
        ) {
          this.logger.warn(
            `⚠️ Multipart part reached else block! type=${part.type}, subtype=${part.subtype}, childNodes=${part.childNodes ? part.childNodes.length : 'none'}, partNumber=${partNumber || '1'}`,
          );
        }

        this.logger.log(
          `⏭️ Skipping non-attachment part: ${part.type}/${part.subtype} (filename: ${partFilename}, partNumber: ${partNumber || '1'}, isTextBody: ${isTextBody})`,
        );
      }
    };

    await extractFromPart(bodyStructure);

    this.logger.log(
      `✅ Finished extracting attachments from message ${seq}: found ${attachments.length} attachment(s)`,
    );

    return attachments;
  }

  /**
   * Extract text and HTML body from message
   * @param seq - Message sequence number
   * @param bodyStructure - Message body structure
   * @returns Object with text and/or html body
   */
  private async extractBodyText(
    seq: number,
    bodyStructure: any,
  ): Promise<{ text?: string; html?: string }> {
    const result: { text?: string; html?: string } = {};

    if (!this.client) {
      return result;
    }

    const extractFromPart = async (part: any, partNumber?: string) => {
      // Skip multipart containers - process children
      if (
        part.type === 'multipart' ||
        (part.childNodes &&
          Array.isArray(part.childNodes) &&
          part.childNodes.length > 0)
      ) {
        if (part.childNodes && Array.isArray(part.childNodes)) {
          for (let i = 0; i < part.childNodes.length; i++) {
            const childPart = part.childNodes[i];
            const childPartNumber = partNumber
              ? `${partNumber}.${i + 1}`
              : `${i + 1}`;
            await extractFromPart(childPart, childPartNumber);
          }
        }
        return;
      }

      // Log part structure for debugging
      this.logger.log(
        `🔍 DEBUG extractBodyText: part.type=${part.type}, part.subtype=${part.subtype}, partNumber=${partNumber || 'root'}, contentType=${part.contentType || 'none'}`,
      );

      // Extract text/plain and text/html parts
      // part.type can be either 'text' (with subtype) or 'text/plain'/'text/html' (complete string)
      const typeStr =
        typeof part.type === 'string' ? part.type.toLowerCase() : '';
      const contentType =
        part.contentType ||
        (part.subtype ? `${part.type}/${part.subtype}` : part.type);
      const contentTypeStr =
        typeof contentType === 'string' ? contentType.toLowerCase() : '';

      const isPlainText =
        (part.type === 'text' && part.subtype === 'plain') ||
        typeStr === 'text/plain' ||
        contentTypeStr === 'text/plain';
      const isHtml =
        (part.type === 'text' && part.subtype === 'html') ||
        typeStr === 'text/html' ||
        contentTypeStr === 'text/html';

      if (isPlainText || isHtml) {
        try {
          const downloadPartNumber = partNumber || '1';
          this.logger.log(
            `🔍 Attempting to download ${part.subtype || contentType.split('/')[1]} body from part ${downloadPartNumber}`,
          );
          const bodyData = await this.client!.download(
            seq,
            downloadPartNumber,
            {
              uid: false,
            },
          );

          if (bodyData && bodyData.content) {
            const chunks: Buffer[] = [];
            for await (const chunk of bodyData.content) {
              chunks.push(chunk);
            }

            if (chunks.length > 0) {
              const content = Buffer.concat(chunks).toString('utf-8');
              if (isPlainText && !result.text) {
                result.text = content;
                this.logger.log(
                  `✅ Extracted text/plain body (${content.length} chars) from part ${downloadPartNumber}`,
                );
              } else if (isHtml && !result.html) {
                result.html = content;
                this.logger.log(
                  `✅ Extracted text/html body (${content.length} chars) from part ${downloadPartNumber}`,
                );
              }
            } else {
              this.logger.warn(
                `⚠️ No content chunks for ${part.subtype || contentType.split('/')[1]} body from part ${downloadPartNumber}`,
              );
            }
          } else {
            this.logger.warn(
              `⚠️ No bodyData or content for ${part.subtype || contentType.split('/')[1]} body from part ${downloadPartNumber}`,
            );
          }
        } catch (error: any) {
          const partNum = partNumber || '1';
          this.logger.warn(
            `⚠️ Error extracting body from part ${partNum}: ${error.message}`,
          );
        }
      }
    };

    await extractFromPart(bodyStructure);

    return result;
  }

  /**
   * Mark message as processed (read + custom flag if supported)
   * @param messageId - Message ID to mark
   * @returns true if successful, false otherwise
   */
  async markMessageAsProcessed(messageId: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      this.logger.warn('⚠️ Cannot mark message: not connected to IMAP');
      return false;
    }

    const sourceMailbox =
      this.configService.get<string>('IMAP_MAILBOX') || 'INBOX';

    this.logger.log(
      `🏷️ markMessageAsProcessed: messageId=${messageId}, sourceMailbox=${sourceMailbox}`,
    );

    try {
      const lock = await this.client.getMailboxLock(sourceMailbox);
      try {
        await this.client.mailboxOpen(sourceMailbox);

        // Search for the message by messageId
        let searchMessageId = messageId;
        if (messageId.startsWith('<') && messageId.endsWith('>')) {
          searchMessageId = messageId.slice(1, -1);
        }

        this.logger.log(
          `🔍 Searching for messageId: ${searchMessageId} in ${sourceMailbox}`,
        );

        let searchResult = await this.client.search({
          header: { 'message-id': searchMessageId },
        });

        if (!searchResult || searchResult.length === 0) {
          // Try with <> wrapped
          if (!messageId.startsWith('<')) {
            const wrappedMessageId = `<${messageId}>`;
            this.logger.log(
              `🔍 Trying with wrapped messageId: ${wrappedMessageId}`,
            );
            const searchResult2 = await this.client.search({
              header: { 'message-id': wrappedMessageId },
            });
            if (searchResult2 && searchResult2.length > 0) {
              searchResult = searchResult2;
            }
          }

          if (!searchResult || searchResult.length === 0) {
            this.logger.warn(
              `⚠️ Message not found for messageId: ${messageId} in ${sourceMailbox}`,
            );
            return false;
          }
        }

        const seq = searchResult[0];
        this.logger.log(
          `✅ Found message at sequence ${seq} in ${sourceMailbox}`,
        );

        // Mark as read (Seen flag)
        await this.client.messageFlagsAdd(seq, ['\\Seen']);
        this.logger.log(
          `✅ Marked message ${seq} as read (\\Seen) in ${sourceMailbox}`,
        );

        // Try to add a custom flag if server supports it (e.g., $Processed)
        // Some servers support custom flags, others don't - we'll try but not fail if it doesn't work
        try {
          await this.client.messageFlagsAdd(seq, ['$Processed']);
          this.logger.log(`✅ Added custom flag $Processed to message ${seq}`);
        } catch (flagError: any) {
          // Custom flags might not be supported - that's OK, we still marked it as read
          this.logger.log(
            `ℹ️ Could not add custom flag $Processed (server may not support it): ${flagError.message}`,
          );
        }

        this.logger.log(
          `✅ Successfully marked message ${messageId} as processed in ${sourceMailbox}`,
        );
        return true;
      } finally {
        lock.release();
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error marking message ${messageId} as processed: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Move message to another folder (e.g., from INBOX to "Extrase")
   * @param messageId - Message ID to move
   * @param targetFolder - Target folder name (e.g., "Extrase")
   * @returns true if successful, false otherwise
   */
  async moveMessage(
    messageId: string,
    targetFolder: string = 'Extrase',
  ): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      this.logger.warn('⚠️ Cannot move message: not connected to IMAP');
      return false;
    }

    const sourceMailbox =
      this.configService.get<string>('IMAP_MAILBOX') || 'INBOX';

    this.logger.log(
      `🔄 moveMessage: messageId=${messageId}, sourceMailbox=${sourceMailbox}, targetFolder=${targetFolder}`,
    );

    try {
      // First, we need to find the message by messageId
      // We'll search in the source mailbox
      const lock = await this.client.getMailboxLock(sourceMailbox);
      try {
        // Open source mailbox to ensure we're searching in the right place
        await this.client.mailboxOpen(sourceMailbox);

        // Search for the message by messageId
        // Note: messageId might be wrapped in <>, so we search for it
        // Also try without <> if messageId includes them
        let searchMessageId = messageId;
        if (messageId.startsWith('<') && messageId.endsWith('>')) {
          searchMessageId = messageId.slice(1, -1);
        }

        this.logger.log(
          `🔍 Searching for messageId: ${searchMessageId} in ${sourceMailbox}`,
        );

        let searchResult = await this.client.search({
          header: { 'message-id': searchMessageId },
        });

        if (!searchResult || searchResult.length === 0) {
          // Try with <> wrapped
          if (!messageId.startsWith('<')) {
            const wrappedMessageId = `<${messageId}>`;
            this.logger.log(
              `🔍 Trying with wrapped messageId: ${wrappedMessageId}`,
            );
            const searchResult2 = await this.client.search({
              header: { 'message-id': wrappedMessageId },
            });
            if (searchResult2 && searchResult2.length > 0) {
              searchResult = searchResult2;
            }
          }

          if (!searchResult || searchResult.length === 0) {
            this.logger.warn(
              `⚠️ Message not found for messageId: ${messageId} (tried ${searchMessageId} and ${messageId.startsWith('<') ? messageId : `<${messageId}>`}) in ${sourceMailbox}`,
            );
            return false;
          }
        }

        // Get the sequence number (should be the first result)
        const seq = searchResult[0];
        this.logger.log(
          `✅ Found message at sequence ${seq} in ${sourceMailbox}`,
        );

        // Ensure target folder exists (create if it doesn't)
        try {
          await this.client.mailboxOpen(targetFolder);
          this.logger.log(`✅ Target folder ${targetFolder} exists`);
        } catch {
          // Folder doesn't exist, try to create it
          this.logger.log(`📁 Creating folder: ${targetFolder}`);
          try {
            await this.client.mailboxCreate(targetFolder);
            this.logger.log(`✅ Created folder: ${targetFolder}`);
          } catch (createError: any) {
            this.logger.error(
              `❌ Failed to create folder ${targetFolder}: ${createError.message}`,
            );
            return false;
          }
        }

        // Get message count in target folder before copy (for verification)
        let messageCountBefore = 0;
        try {
          await this.client.mailboxOpen(targetFolder);
          const mailboxStatus = await this.client.status(targetFolder, {
            messages: true,
          });
          messageCountBefore = mailboxStatus.messages || 0;
          this.logger.log(
            `📊 Message count in ${targetFolder} before copy: ${messageCountBefore}`,
          );
        } catch (error: any) {
          this.logger.warn(
            `⚠️ Could not get message count before copy: ${error.message}`,
          );
        }

        // Copy message to target folder
        this.logger.log(
          `📋 Copying message ${seq} from ${sourceMailbox} to ${targetFolder}...`,
        );
        try {
          // messageCopy returns the UID of the copied message in the target folder
          const copyResult = await this.client.messageCopy(seq, targetFolder);
          this.logger.log(
            `✅ Copied message ${seq} to ${targetFolder} (result: ${JSON.stringify(copyResult)})`,
          );

          // If copyResult is an object with uid, log it
          if (
            copyResult &&
            typeof copyResult === 'object' &&
            'uid' in copyResult
          ) {
            this.logger.log(
              `📌 Copied message has UID ${copyResult.uid} in ${targetFolder}`,
            );
          }
        } catch (copyError: any) {
          this.logger.error(
            `❌ Error copying message ${seq} to ${targetFolder}: ${copyError.message}`,
            copyError.stack,
          );
          return false;
        }

        // IMPORTANT: Verify that message exists in target folder BEFORE deleting from source
        // This prevents data loss if the copy failed silently
        // Wait a bit for the message to be indexed in the target folder
        // Some IMAP servers need more time to index the message
        this.logger.log(
          `⏳ Waiting for message to be indexed in ${targetFolder}...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds for indexing (increased from 1s)

        this.logger.log(
          `🔍 Verifying message exists in ${targetFolder} before deleting from ${sourceMailbox}...`,
        );
        try {
          // Re-open target folder to ensure we're searching in the right place
          await this.client.mailboxOpen(targetFolder);

          // Method 1: Check if message count increased (simple verification)
          const mailboxStatusAfter = await this.client.status(targetFolder, {
            messages: true,
          });
          const messageCountAfter = mailboxStatusAfter.messages || 0;
          const countIncreased = messageCountAfter > messageCountBefore;

          this.logger.log(
            `📊 Message count in ${targetFolder} after copy: ${messageCountAfter} (increased: ${countIncreased})`,
          );

          // Method 2: Search for the message by messageId (more precise)
          let verifySearchMessageId = searchMessageId;
          if (!verifySearchMessageId.startsWith('<')) {
            verifySearchMessageId = `<${verifySearchMessageId}>`;
          }

          this.logger.log(
            `🔍 Searching for messageId: ${verifySearchMessageId} in ${targetFolder}...`,
          );
          const verifySearchResult = await this.client.search({
            header: { 'message-id': verifySearchMessageId },
          });

          // Try without <> if first search failed
          let foundBySearch =
            verifySearchResult && verifySearchResult.length > 0;
          if (!foundBySearch) {
            this.logger.log(
              `🔍 Trying search without <>: ${searchMessageId}...`,
            );
            const verifySearchResult2 = await this.client.search({
              header: { 'message-id': searchMessageId },
            });
            foundBySearch =
              verifySearchResult2 && verifySearchResult2.length > 0;
            if (foundBySearch) {
              this.logger.log(
                `✅ Found message by search (without <>): sequence ${verifySearchResult2[0]}`,
              );
            }
          } else {
            this.logger.log(
              `✅ Found message by search (with <>): sequence ${verifySearchResult[0]}`,
            );
          }

          // Method 3: List all messages in target folder to see what's there (debugging)
          if (!foundBySearch && countIncreased) {
            this.logger.log(
              `🔍 Listing recent messages in ${targetFolder} for debugging...`,
            );
            try {
              const allMessages = await this.client.search({});
              if (allMessages && allMessages.length > 0) {
                const recentMessages = allMessages.slice(-5); // Last 5 messages
                this.logger.log(
                  `📋 Found ${allMessages.length} total messages in ${targetFolder}, checking last 5...`,
                );
                for (const msgSeq of recentMessages) {
                  try {
                    const msgData = await this.client.fetchOne(msgSeq, {
                      envelope: true,
                    });
                    if (msgData && msgData.envelope) {
                      const msgId =
                        msgData.envelope.messageId || 'no-message-id';
                      const subject = msgData.envelope.subject || 'no-subject';
                      this.logger.log(
                        `  📧 Message ${msgSeq}: subject="${subject}", messageId="${msgId}"`,
                      );
                    }
                  } catch (fetchError: any) {
                    this.logger.warn(
                      `  ⚠️ Could not fetch message ${msgSeq}: ${fetchError.message}`,
                    );
                  }
                }
              }
            } catch (listError: any) {
              this.logger.warn(
                `⚠️ Could not list messages in ${targetFolder}: ${listError.message}`,
              );
            }
          }

          // Accept verification if EITHER count increased OR message found by search
          // But if count increased, we assume copy was successful even if search fails (search might be slow)
          if (!countIncreased && !foundBySearch) {
            this.logger.error(
              `❌ Message verification failed: message ${messageId} not found in ${targetFolder} (count: ${messageCountBefore} → ${messageCountAfter}, search: ${foundBySearch}). NOT deleting from ${sourceMailbox} to prevent data loss.`,
            );
            // Even if verification fails, if messageCopy didn't throw an error, the message was likely copied
            // Log a warning but don't fail - the message should be in Extrase even if we can't verify it immediately
            this.logger.warn(
              `⚠️ Verification failed but messageCopy succeeded. Message may be in ${targetFolder} but not yet indexed. Check manually.`,
            );
            return false;
          }

          // If count increased but search failed, still accept it (search might be slow or messageId format issue)
          if (countIncreased && !foundBySearch) {
            this.logger.warn(
              `⚠️ Message count increased but search failed. Assuming copy successful (count: ${messageCountBefore} → ${messageCountAfter}). Message may be in ${targetFolder} with different messageId format.`,
            );
          }

          if (foundBySearch) {
            this.logger.log(
              `✅ Verified: message ${messageId} exists in ${targetFolder} (found at sequence ${verifySearchResult?.[0] || 'unknown'})`,
            );
          } else if (countIncreased) {
            this.logger.log(
              `✅ Verified: message count increased in ${targetFolder} (${messageCountBefore} → ${messageCountAfter}), assuming message was copied successfully`,
            );
          }
        } catch (verifyError: any) {
          this.logger.error(
            `❌ Error verifying message in ${targetFolder}: ${verifyError.message}. NOT deleting from ${sourceMailbox} to prevent data loss.`,
          );
          return false;
        }

        // Only delete from source AFTER successful verification
        // Re-open source mailbox to mark message as deleted and expunge
        await this.client.mailboxOpen(sourceMailbox);

        // Mark message as deleted in source folder
        await this.client.messageFlagsAdd(seq, ['\\Deleted']);
        this.logger.log(
          `🗑️ Marked message ${seq} as deleted in ${sourceMailbox}`,
        );

        // Note: In imapflow, expunge happens automatically when the mailbox lock is released
        // The lock.release() in the finally block will trigger automatic expunge
        // This ensures the message is permanently removed from INBOX after we're done
        this.logger.log(
          `📝 Message marked as deleted. Expunge will happen automatically when lock is released.`,
        );

        this.logger.log(
          `✅ Successfully moved message ${messageId} from ${sourceMailbox} to ${targetFolder}`,
        );
        return true;
      } finally {
        lock.release();
      }
    } catch (error: any) {
      this.logger.error(
        `❌ Error moving message ${messageId} to ${targetFolder}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }
}
