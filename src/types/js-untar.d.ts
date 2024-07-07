/* globals window: false, Promise: false */

/**
 Returns a Promise decorated with a progress() event.
 */
declare function ProgressivePromise(fn: (resolve: (value?: any) => void, reject: (reason?: any) => void, doProgress: (value?: any) => void) => void): Promise<any> & { progress(cb: (value?: any) => void): Promise<any>; };

/* globals postMessage: false, DataView: false, self: false, window: false, ArrayBuffer: false, Uint8Array: false */

declare class UntarWorker {
  onmessage(msg: MessageEvent): void;
  postError(err: Error): void;
  postLog(level: string, msg: string): void;
  untarBuffer(arrayBuffer: ArrayBuffer): void;
  postMessage(msg: any, transfers?: Transferable[]): void;
}

declare function decodeUTF8(bytes: Uint8Array): string;

declare class PaxHeader {
  private _fields: { name: string, value: any }[];
  constructor(fields: { name: string, value: any }[]);
  static parse(buffer: ArrayBuffer): PaxHeader;
  applyHeader(file: TarFile): void;
}

declare class TarFile {
  name: string;
  mode: string;
  uid: number;
  gid: number;
  size: number;
  mtime: number;
  checksum: number;
  type: string;
  linkname: string;
  ustarFormat: string;
  version?: string;
  uname?: string;
  gname?: string;
  devmajor?: number;
  devminor?: number;
  namePrefix?: string;
  buffer?: ArrayBuffer;
  _blob?: Blob;
  _blobUrl?: string;
  _string?: string;
  blob: Blob;
  getBlobUrl(): string;
  readAsString(): string;
  readAsJSON(): any;
}

declare class UntarStream {
  private _bufferView: DataView;
  private _position: number;
  constructor(arrayBuffer: ArrayBuffer);
  readString(charCount: number): string;
  readBuffer(byteCount: number): ArrayBuffer;
  seek(byteCount: number): void;
  peekUint32(): number;
  position(newpos?: number): number;
  size(): number;
}

declare class UntarFileStream {
  private _stream: UntarStream;
  private _globalPaxHeader: PaxHeader | null;
  constructor(arrayBuffer: ArrayBuffer);
  hasNext(): boolean;
  next(): TarFile;
  private _readNextFile(): TarFile;
}

/* globals Blob: false, Promise: false, console: false, Worker: false, ProgressivePromise: false */

declare let workerScriptUri: string;

declare function untar(arrayBuffer: ArrayBuffer): Promise<TarFile[]>;

declare let decoratedFileProps: {
  blob: {
    get(): Blob;
  };
  getBlobUrl: {
    value(): string;
  };
  readAsString: {
    value(): string;
  };
  readAsJSON: {
    value(): any;
  };
};

declare function decorateExtractedFile(file: TarFile): TarFile;

declare module 'js-untar';