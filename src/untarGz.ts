import pako from "pako";
import untar from "js-untar";


/**
 * Untar a tar.gz file
 * @param {string} tarGzFileUrl The URL of the tar.gz file
 * @returns {Promise<TarFile[]>} The extracted tar files
 */
export async function untarGzUrl(tarGzFileUrl: string): Promise<TarFile[]> {
  const response = await fetch(tarGzFileUrl);
  const arrayBuffer = await response.arrayBuffer();

  // Decompress the gzip file
  const decompressedData = pako.ungzip(new Uint8Array(arrayBuffer));
  console.log("Decompressed data: ", decompressedData);

  // Extract tar files using js-untar
  return new Promise((resolve, reject) => {
    untar(decompressedData.buffer)
      .progress((extractedFile) => {
        console.log("Extracted file: ", extractedFile);
      })
      .then((extractedFiles: TarFile[]) => {
        console.log("Extracted files: ", extractedFiles);
        resolve(extractedFiles);
      })
      .catch((error: Error) => {
        reject(error);
      });
  });
}
