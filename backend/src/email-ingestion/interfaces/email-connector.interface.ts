/**
 * Interface for email connectors (IMAP, Gmail API, etc.)
 */
export interface EmailMessage {
  messageId: string;
  subject: string;
  from: string;
  date: Date;
  read: boolean;
  attachments: EmailAttachment[];
}

export interface EmailAttachment {
  attachmentId: string;
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export interface EmailConnector {
  /**
   * Connect to email server
   */
  connect(): Promise<void>;

  /**
   * Disconnect from email server
   */
  disconnect(): Promise<void>;

  /**
   * Fetch messages from mailbox
   * @param readStatus - 'read', 'unread', or 'all'
   * @param limit - Maximum number of messages to fetch
   * @param extractAttachments - Whether to extract attachments (default: true)
   * @param subjectFilter - Optional subject filter (messages must contain this string in subject)
   */
  fetchMessages(
    readStatus: 'read' | 'unread' | 'all',
    limit?: number | null,
    extractAttachments?: boolean,
    subjectFilter?: string | null,
  ): Promise<EmailMessage[]>;

  /**
   * Check if connector is configured
   */
  isConfigured(): boolean;
}
