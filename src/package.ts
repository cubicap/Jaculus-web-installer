import { untarGzUrl } from "./untarGz";
import { Buffer } from "buffer";
import {Transport} from "esptool-js";
import {IEspLoaderTerminal} from "esptool-js/lib/esploader";
import {Esp32Flasher} from "./esp32/esp32Flasher";
import {UploadReporter} from "./UploadReporter";

/**
 * Module for loading and flashing package files
 *
 * Package file is a tar.gz archive containing a manifest.json file and arbitrary files,
 * which can be used by the flasher for the corresponding platform.
 *
 * The manifest.json file contains the following fields:
 * - board: The board name
 * - version: The version of the package
 * - platform: The platform the package is for (determines which flasher to use)
 * - config: An arbitrary json object containing configuration for the flasher (documented in the flasher module)
 *
 * Example manifest.json can be found in the flasher module.
 */

/**
 * Manifest class
 */
export class Manifest {
  private board: string;
  private version: string;
  private platform: string;
  private config: Record<string, any>;

  constructor(board: string, version: string, platform: string, config: Record<string, any>) {
    this.board = board;
    this.version = version;
    this.platform = platform;
    this.config = config;
  }

  public getBoard(): string {
    return this.board;
  }

  public getVersion(): string {
    return this.version;
  }

  public getPlatform(): string {
    return this.platform;
  }

  public getConfig(): Record<string, any> {
    return this.config;
  }
}

/**
 * Parse the manifest file
 * @param data Manifest file data
 * @returns The manifest
 */
function parseManifest(data: string) {
  const manifest = JSON.parse(data);

  const board = manifest["board"];
  if (!board) {
    throw new Error("No board defined in manifest");
  }

  const version = manifest["version"];
  if (!version) {
    throw new Error("No version defined in manifest");
  }

  const platform = manifest["platform"];
  if (!platform) {
    throw new Error("No platform defined in manifest");
  }

  const config = manifest["config"];
  if (!config) {
    throw new Error("No config defined in manifest");
  }

  return new Manifest(board, version, platform, config);
}

export class Package {
  private manifest: Manifest;
  private esp32Flasher: Esp32Flasher;
  private data: Record<string, Buffer>;

  constructor(manifest: Manifest, data: Record<string, Buffer>) {
    this.manifest = manifest;
    this.data = data;
    this.esp32Flasher = new Esp32Flasher();
  }

  public getManifest(): Manifest {
    return this.manifest;
  }

  public getData(): Record<string, Buffer> {
    return this.data;
  }

  public async setup(transport: Transport, espLoaderTerminal: IEspLoaderTerminal, noErase: boolean, uploadReporter: UploadReporter): Promise<string> {
    switch (this.manifest.getPlatform()) {
      case "esp32":
        return await this.esp32Flasher.setup(this, transport, espLoaderTerminal, noErase, uploadReporter);
      default:
        throw new Error("Unsupported platform");
    }
  }

  public async flash(): Promise<void> {
    switch (this.manifest.getPlatform()) {
      case "esp32":
        await this.esp32Flasher.flash();
        break;
      default:
        throw new Error("Unsupported platform");
    }

    return;
  }

  public info(): string {
    switch (this.manifest.getPlatform()) {
      case "esp32":
        return this.esp32Flasher.info();
      default:
        throw new Error("Unsupported platform");
    }
  }
}

/**
 * Load the package file from the given URI
 * @param {string} uri The URI of the package file
 * @returns {Promise<Package>} The loaded package
 */
export async function loadPackage(uri: string): Promise<Package> {
  const loadedFiles: TarFile[] = await untarGzUrl(uri);

  return new Promise((resolve, reject) => {
    let manifest: Manifest = new Manifest("", "", "", {});
    const files: Record<string, Buffer> = {};

    const manifestFile = loadedFiles.filter((file) => file.name === "manifest.json")[0];

    if (!manifestFile) {
      reject(new Error("No manifest.json file found"));
      return;
    }
    manifest = parseManifest(manifestFile.readAsString());

    for (const file in loadedFiles) {
      if (file !== "manifest.json") {
        files[loadedFiles[file].name] = Buffer.from(loadedFiles[file].buffer);
      }
    }

    resolve(new Package(manifest, files));
  });
}
