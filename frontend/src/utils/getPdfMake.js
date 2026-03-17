/**
 * Returnează pdfMake cu fonturile VFS încărcate din pachetul npm (first-party).
 * Evită CDN-ul jsdelivr care este blocat de Tracking Prevention (Safari, Brave, etc.).
 */
let pdfMakeInstance = null;

export async function getPdfMake() {
  if (pdfMakeInstance) return pdfMakeInstance;
  const [pdfMakeModule, vfsModule] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts')
  ]);
  const pdfMake = pdfMakeModule.default ?? pdfMakeModule;
  const vfs = vfsModule.default ?? vfsModule;
  if (pdfMake.addVirtualFileSystem && vfs) {
    pdfMake.addVirtualFileSystem(vfs);
  } else if (vfs && typeof pdfMake.vfs !== 'undefined') {
    pdfMake.vfs = vfs;
  }
  pdfMakeInstance = pdfMake;
  return pdfMake;
}
