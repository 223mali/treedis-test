import * as http from "http";
import Busboy from "busboy";

export interface ParsedFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

/**
 * Parses a multipart/form-data request using busboy and extracts file parts.
 */
export function parseMultipartBody(
  req: http.IncomingMessage,
): Promise<ParsedFile[]> {
  return new Promise((resolve, reject) => {
    const files: ParsedFile[] = [];

    try {
      const busboy = Busboy({ headers: req.headers });

      busboy.on("file", (_fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        const chunks: Buffer[] = [];

        fileStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        fileStream.on("end", () => {
          files.push({
            filename: filename || "unknown",
            mimeType,
            data: Buffer.concat(chunks),
          });
        });
      });

      busboy.on("finish", () => resolve(files));
      busboy.on("error", (err: Error) => reject(err));

      req.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });
}
