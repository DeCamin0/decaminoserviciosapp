export interface PrepareRequest {
  documentId: string;
  employeeId: string; // ID-ul angajatului
  reason?: string;
  // Nu mai avem nevoie de documentBinary și documentName - se trimite ca file
}

export interface PrepareResponse {
  sessionId: string;
  launchUrl: string;
  statusUrl: string;
  downloadUrl: string;
  token?: string; // Token pentru accesarea PDF-ului original
}

export interface StatusResponse {
  status: 'pending' | 'waiting_signer' | 'done' | 'error';
  message?: string;
}

export interface SignResult {
  sessionId: string;
  installed: boolean;
  token?: string; // Token pentru accesarea PDF-ului original
}

export class SigningError extends Error {
  code?: string;
  status?: number;

  constructor(message: string) {
    super(message);
    this.name = 'SigningError';
  }
}
