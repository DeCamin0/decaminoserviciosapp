declare module 'heic-convert' {
  type HeicConvertOptions = {
    buffer: Buffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number;
  };

  function convert(options: HeicConvertOptions): Promise<ArrayBuffer>;
  namespace convert {
    function all(
      options: HeicConvertOptions,
    ): Promise<Array<{ convert: () => Promise<ArrayBuffer> }>>;
  }

  export = convert;
}
