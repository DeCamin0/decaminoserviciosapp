import {
  contentDisposition,
  sanitizeContentDispositionFilename,
} from './content-disposition';

describe('content disposition', () => {
  it('elimină ghilimelele, punctul și virgula și liniile noi din numele fișierului', () => {
    expect(sanitizeContentDispositionFilename('nomina".pdf\r\nX-Evil: 1')).toBe(
      'nomina.pdfX-Evil: 1',
    );
    const header = contentDisposition('attachment', 'a";b\n.pdf');
    expect(header).toContain('filename="ab.pdf"');
    expect(header).not.toMatch(/[\r\n]/);
  });

  it('păstrează un nume legitim, inclusiv literele spaniole', () => {
    expect(contentDisposition('inline', 'Nómina marzo.pdf')).toContain(
      'filename="Nómina marzo.pdf"',
    );
  });

  it('folosește un nume de rezervă când valoarea este goală', () => {
    expect(sanitizeContentDispositionFilename(' \r\n ')).toBe('archivo');
    expect(sanitizeContentDispositionFilename('', 'documento.pdf')).toBe(
      'documento.pdf',
    );
  });
});
