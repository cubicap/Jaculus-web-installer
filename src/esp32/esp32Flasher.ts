import { Package } from "../package.js";
import { LoaderOptions, ESPLoader, Transport } from "esptool-js"
import {IEspLoaderTerminal} from "esptool-js/lib/esploader";
import {UploadReporter} from "../UploadReporter";

/**
 * Flasher for the esp32 platform
 *
 * Allows flashing boards based on the esp32 platform
 * Config options in manifest.json:
 * - flashBaud: The baudrate to use for flashing (default: 921600)
 * - chip: The chip type
 * - partitions: An array of partitions to flash
 *   - name: The name of the partition
 *   - address: The start address of the partition
 *   - file: The file from the package to flash
 *
 * Example manifest.json:
 * {
 *     "board": "ESP32-DevKitC",
 *     "version": "v0.0.5",
 *     "platform": "esp32",
 *     "config": {
 *         "flashBaud": 921600,
 *         "chip": "ESP32",
 *         "partitions": [
 *             {
 *                 "name": "bootloader",
 *                 "address": "0x1000",
 *                 "file": "bootloader.bin",
 *                 "isStorage": false
 *             },
 *             ...
 *         ]
 *     }
 * }
 */


/**
 * Flasher for the esp32 platform
 */
export class Esp32Flasher {

  private fileArray: { data: string; address: number; fileName: string }[] = [];
  private skipped: string[] = [];
  private esploader: ESPLoader;
  private Package: Package;
  private transport: Transport;
  private espLoaderTerminal: IEspLoaderTerminal;
  private noErase: boolean;
  private uploadReporter: UploadReporter;


  /**
   * Setup the flasher
   */
  async setup(
      Package: Package,
      transport: Transport,
      baudrate: number,
      espLoaderTerminal: IEspLoaderTerminal,
      noErase: boolean,
      uploadReporter: UploadReporter
  ): Promise<string> {
    this.Package = Package;
    this.transport = transport;
    this.espLoaderTerminal = espLoaderTerminal;
    this.noErase = noErase;
    this.uploadReporter = uploadReporter;

    const config = this.Package.getManifest().getConfig();
    const flashBaud = parseInt(config["flashBaud"] ?? 921600);

    const partitions = config["partitions"];
    if (!partitions) {
      throw new Error("No partitions defined");
    }

    const loaderOptions: LoaderOptions = {
      debugLogging: false,
      transport: this.transport,
      baudrate: flashBaud,
      romBaudrate: baudrate,
      terminal: this.espLoaderTerminal,
    };
    this.esploader = new ESPLoader(loaderOptions);

    for (const partition of partitions) {
      const file = partition["file"];
      if (file === undefined) {
        throw new Error("No file defined for partition");
      }
      const address = parseInt(partition["address"]);
      if (address === undefined) {
        throw new Error("No address defined for partition");
      }
      const isStorage = partition["isStorage"];
      if (isStorage && this.noErase) {
        this.skipped.push(file);
        continue;
      }
      const dataBuffer = this.Package.getData()[file];
      if (dataBuffer === undefined) {
        throw new Error(`File ${file} not found in package`);
      }

      this.fileArray.push({data: this.esploader.ui8ToBstr(dataBuffer), address: address, fileName: file});
    }

    return await this.esploader.main();
  }

  /**
   * Flash the package to the device
   */
  async flash() {

    this.uploadReporter.setup(this.fileArray.map((file) => {
        return {size: file.data.length, name: file.fileName};
    }));

    const config = this.Package.getManifest().getConfig();

    try {
      console.log("Detected chip type: " + this.esploader.chip.CHIP_NAME + "\n");
      console.log("Flash size: " + (await this.esploader.getFlashSize()) + "K\n");

      console.log("\n");

      if (this.esploader.chip.CHIP_NAME !== config["chip"]) {
        throw new Error("Chip type mismatch (expected " + config["chip"] + ", got " + this.esploader.chip.CHIP_NAME + ")");
      }

      for (const file of this.skipped) {
        console.log("Skipping " + file + " (storage partition)\n");
      }

      console.log("\nWriting flash...\n");
      this.uploadReporter.start();

      await this.esploader.writeFlash({
        fileArray: this.fileArray,
        flashSize: "4MB",
        flashMode: "keep",
        flashFreq: "keep",
        eraseAll: false,
        compress: true,
        reportProgress: (fileIndex: number, written: number) => {
          this.uploadReporter.update(fileIndex, written);
        },
      });
    } finally {
      this.uploadReporter.stop();
      await this.esploader.hardReset();
    }
  }

  /**
   * Get information about the package
   */
  info(): string {
    const config = this.Package.getManifest().getConfig();

    let output = "Chip type: " + config["chip"] + "\n";
    if (config["flashBaud"]) {
      output += "Flash baudrate: " + config["flashBaud"] + "\n";
    }
    output += "Partitions:\n";

    const partitions = config["partitions"];
    if (!partitions) {
      throw new Error("No partitions defined");
    }

    for (const partition of partitions) {
      const file = partition["file"];
      if (file === undefined) {
        throw new Error("No file defined for partition");
      }
      const address = parseInt(partition["address"]);
      if (address === undefined) {
        throw new Error("No address defined for partition");
      }
      const dataBuffer = this.Package.getData()[file];
      if (dataBuffer === undefined) {
        throw new Error(`File ${file} not found in package`);
      }

      output += "  " + file + " (at 0x" + address.toString(16) + ", " + dataBuffer.length + " bytes)\n";
    }

    return output;
  }
}
