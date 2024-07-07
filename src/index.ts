import { IEspLoaderTerminal } from "esptool-js/lib/esploader";

const baudrates = document.getElementById("baudrates") as HTMLSelectElement;
const boardIndex = document.getElementById("boardIndex") as HTMLSelectElement;
const boardFlashErase = document.getElementById("boardFlashErase") as HTMLSelectElement;
const boardVersions = document.getElementById("boardVersions") as HTMLSelectElement;
const consoleBaudrates = document.getElementById("consoleBaudrates") as HTMLSelectElement;
const connectButton = document.getElementById("connectButton") as HTMLButtonElement;
const flashButton = document.getElementById("flashButton") as HTMLButtonElement;
const traceButton = document.getElementById("copyTraceButton") as HTMLButtonElement;
const disconnectButton = document.getElementById("disconnectButton") as HTMLButtonElement;
const resetButton = document.getElementById("resetButton") as HTMLButtonElement;
const consoleStartButton = document.getElementById("consoleStartButton") as HTMLButtonElement;
const consoleStopButton = document.getElementById("consoleStopButton") as HTMLButtonElement;
const eraseButton = document.getElementById("eraseButton") as HTMLButtonElement;
const terminal = document.getElementById("terminal");
const programDiv = document.getElementById("program");
const consoleDiv = document.getElementById("console");
const lblBaudrate = document.getElementById("lblBaudrate");
const lblConnTo = document.getElementById("lblConnTo");
const alertDiv = document.getElementById("alertDiv");
const progressBarDiv = document.getElementById("progressBarDiv") as HTMLDivElement;

const BOARD_INDEX_URL = "https://f.jaculus.org/bin";
// const BOARD_INDEX_URL = "https://f.kubaandrysek.cz/bin"; // proxy to f.jaculus.org (added CORS headers)
// const BOARD_INDEX_URL = "http://localhost:8080/bin";
const BOARDS_INDEX_JSON = "boards.json";
const BOARD_VERSIONS_JSON = "versions.json";

// This is a frontend example of Esptool-JS using local bundle file
// To optimize use a CDN hosted version like
// https://unpkg.com/esptool-js@0.2.0/bundle.js
import { ESPLoader, Transport } from "esptool-js";
import { serial } from "web-serial-polyfill";
import { loadPackage, Package } from "./package";
import { UploadReporter } from "./UploadReporter";

// @ts-ignore
if (!navigator.serial && navigator.usb) navigator.serial = serial;

declare let Terminal; // Terminal is imported in HTML script
declare let CryptoJS; // CryptoJS is imported in HTML script

const term = new Terminal({ cols: 120, rows: 40 });
term.open(terminal);

let device = null;
let transport: Transport;
let esploader: ESPLoader;
let chip: string = null

disconnectButton.style.display = "none";
flashButton.style.display = "none";
traceButton.style.display = "none";
eraseButton.style.display = "none";
consoleStopButton.style.display = "none";
resetButton.style.display = "none";

type BoardsIndex = {
  board: string;
  id: string;
}[];

type BoardVersions = {
  version: string;
}[];

/**
 * Fetch boards index from the server
 * @returns {Promise<BoardsIndex>} - List of boards
 */
async function getBoardsIndex(): Promise<BoardsIndex> {
  const url = `${BOARD_INDEX_URL}/${BOARDS_INDEX_JSON}`;
  try {
    const response = fetch(url);
    const res = await response;
    return await res.json();
  } catch (e) {
    console.error(e);
    alertDiv.style.display = "block";
    alertDiv.innerHTML = "Failed to load boards index - " + e.message;
  }
  return [];
}

/**
 * Fetch board versions from the server
 * @param {string} boardId - Board ID
 * @returns {Promise<BoardVersions>} - List of board versions
 */
async function getBoardVersions(boardId: string): Promise<BoardVersions> {
  const url = `${BOARD_INDEX_URL}/${boardId}/${BOARD_VERSIONS_JSON}`;
  try {
    const response = fetch(url);
    const res = await response;
    return await res.json();
  } catch (e) {
    console.error(e);
    alertDiv.style.display = "block";
    alertDiv.innerHTML = "Failed to load board versions: - " + e.message;
  }
  return [];
}

/**
 * Fetch board version firmware from the server
 * @param {string} boardId - Board ID
 * @param {string} version - Board version
 * @returns {string} - Board version firmware URL
 */
function getBoardVersionFirmwareTarUrl(boardId: string, version: string): string {
  return `${BOARD_INDEX_URL}/${boardId}/${boardId}-${version}.tar.gz`;
}

/**
 * Load board versions and populate the dropdown
 */
async function loadBoardsVersions() {
  const boardId = boardIndex.value;
  const versions = await getBoardVersions(boardId);
  boardVersions.innerHTML = "";
  for (const version of versions) {
    const option = document.createElement("option");
    option.value = version.version;
    option.text = version.version;
    boardVersions.appendChild(option);
  }
}

const espLoaderTerminal: IEspLoaderTerminal = {
  clean() {
    term.clear();
  },
  writeLine(data) {
    term.writeln(data);
  },
  write(data) {
    term.write(data);
  },
};

let packageEsp32: Package;
const uploadReporter: UploadReporter = new UploadReporter(progressBarDiv);

/**
 * The built-in Event object.
 * @external Event
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Event}
 */


/**
 * Load boards index and populate the dropdown
 */
window.onload = async () => {
  const boards = await getBoardsIndex();
  for (const board of boards) {
    const option = document.createElement("option");
    option.value = board.id;
    option.text = board.board;
    boardIndex.appendChild(option);
  }
  // Load board versions for the first board
  await loadBoardsVersions();
};

/**
 * Listen to board index change event
 */
boardIndex.onchange = async () => {
  await loadBoardsVersions();
};

/**
 * Connect to the device event
 */
connectButton.onclick = async () => {
  if (boardVersions.value === "") {
    alertDiv.style.display = "block";
    alertDiv.innerHTML = "Please select board and version";
    return;
  }
  alertDiv.style.display = "none";
  baudrates.disabled = true;
  boardIndex.disabled = true;
  boardVersions.disabled = true;
  boardFlashErase.disabled = true;

  if (device === null) {
    // @ts-ignore
    device = await navigator.serial.requestPort({});
    transport = new Transport(device, true);
  }

  try {
    console.log("Loading package...\n");

    const pkgPath = getBoardVersionFirmwareTarUrl(boardIndex.value, boardVersions.value);
    packageEsp32 = await loadPackage(pkgPath);

    console.log("Version: " + packageEsp32.getManifest().getVersion() + "\n");
    console.log("Board: " + packageEsp32.getManifest().getBoard() + "\n");
    console.log("Platform: " + packageEsp32.getManifest().getPlatform() + "\n");
    console.log("\n");

    const noErase = boardFlashErase.value === "noErase";

    chip = await packageEsp32.setup(transport, espLoaderTerminal, noErase, uploadReporter);
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  }

  console.log("Settings done for :" + chip);
  lblBaudrate.style.display = "none";
  lblConnTo.innerHTML = "Connected to device: " + chip;
  lblConnTo.style.display = "block";
  baudrates.style.display = "none";
  connectButton.style.display = "none";
  disconnectButton.style.display = "initial";
  flashButton.style.display = "initial";
  traceButton.style.display = "initial";
  eraseButton.style.display = "initial";
  consoleDiv.style.display = "none";
};

flashButton.onclick = async () => {
  flashButton.disabled = true;
  try {
    await packageEsp32.flash();
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    flashButton.disabled = false;
  }
}


traceButton.onclick = async () => {
  if (transport) {
    transport.returnTrace();
  }
};

resetButton.onclick = async () => {
  if (transport) {
    await transport.setDTR(false);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await transport.setDTR(true);
  }
};

eraseButton.onclick = async () => {
  eraseButton.disabled = true;
  try {
    await esploader.eraseFlash();
  } catch (e) {
    console.error(e);
    term.writeln(`Error: ${e.message}`);
  } finally {
    eraseButton.disabled = false;
  }
};

/**
 * The built-in HTMLTableRowElement object.
 * @external HTMLTableRowElement
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLTableRowElement}
 */



/**
 * Clean devices variables on chip disconnect. Remove stale references if any.
 */
function cleanUp() {
  device = null;
  transport = null;
  chip = null;
}

disconnectButton.onclick = async () => {
  if (transport) await transport.disconnect();

  term.reset();
  lblBaudrate.style.display = "initial";
  baudrates.style.display = "initial";
  consoleBaudrates.style.display = "initial";
  connectButton.style.display = "initial";
  disconnectButton.style.display = "none";
  traceButton.style.display = "none";
  flashButton.style.display = "none";
  eraseButton.style.display = "none";
  lblConnTo.style.display = "none";
  alertDiv.style.display = "none";
  consoleDiv.style.display = "initial";

  baudrates.disabled = false;
  boardIndex.disabled = false;
  boardVersions.disabled = false;
  boardFlashErase.disabled = false;

  cleanUp();
};

let isConsoleClosed = false;
consoleStartButton.onclick = async () => {
  if (device === null) {
    // @ts-ignore
    device = await navigator.serial.requestPort({});
    transport = new Transport(device, true);
  }
  consoleBaudrates.disabled = true;
  consoleStartButton.style.display = "none";
  consoleStopButton.style.display = "initial";
  resetButton.style.display = "initial";
  programDiv.style.display = "none";

  await transport.connect(parseInt(consoleBaudrates.value));
  isConsoleClosed = false;

  while (!isConsoleClosed) {
    const val = await transport.rawRead();
    if (typeof val !== "undefined") {
      term.write(val);
    } else {
      break;
    }
  }
  console.log("quitting console");
};

consoleStopButton.onclick = async () => {
  isConsoleClosed = true;
  if (transport) {
    await transport.disconnect();
    await transport.waitForUnlock(1500);
  }
  term.reset();
  consoleBaudrates.disabled = false;
  consoleStartButton.style.display = "initial";
  consoleStopButton.style.display = "none";
  resetButton.style.display = "none";
  resetButton.style.display = "none";
  programDiv.style.display = "initial";
  cleanUp();
};