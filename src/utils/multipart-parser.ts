import * as http from "http";
import Busboy from "busboy";
import { PayloadTooLargeError, BadRequestError } from "../errors/app-error";

export interface ParsedFile {
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface MultipartLimits {
  /** Maximum file size in bytes. */
  maxFileSize: number;
  /** Maximum number of files per request. */
  maxFiles?: number;
}

/**
 * Parses a multipart/form-data request using busboy and extracts file parts.
 * Enforces optional size and count limits.
 */
export function parseMultipartBody(
  req: http.IncomingMessage,
  limits?: MultipartLimits,
): Promise<ParsedFile[]> {
  return new Promise((resolve, reject) => {
    const files: ParsedFile[] = [];
    let rejected = false;

    const busboyLimits: Record<string, number> = {};
    if (limits?.maxFileSize) busboyLimits.fileSize = limits.maxFileSize;
    if (limits?.maxFiles) busboyLimits.files = limits.maxFiles;

    try {
      const busboy = Busboy({
        headers: req.headers,
        limits: busboyLimits,
      });

      busboy.on("file", (_fieldname, fileStream, info) => {
        const { filename, mimeType } = info;
        const chunks: Buffer[] = [];
        let truncated = false;

        fileStream.on("data", (chunk: Buffer) => chunks.push(chunk));

        fileStream.on("limit", () => {
          truncated = true;
          // Drain the rest so busboy can continue cleanly
          fileStream.resume();
        });

        fileStream.on("end", () => {
          if (truncated) {
            rejected = true;
            reject(
              new PayloadTooLargeError(
                `File "${filename || "unknown"}" exceeds the maximum allowed size of ` +
                  `${((limits?.maxFileSize ?? 0) / 1024 / 1024).toFixed(0)} MB`,
              ),
            );
            return;
          }

          files.push({
            filename: filename || "unknown",
            mimeType,
            data: Buffer.concat(chunks),
          });
        });
      });

      busboy.on("filesLimit", () => {
        if (!rejected) {
          rejected = true;
          reject(
            new BadRequestError(
              `Too many files — maximum ${limits?.maxFiles ?? "?"} allowed per request`,
            ),
          );
        }
      });

      busboy.on("finish", () => {
        if (!rejected) resolve(files);
      });

      busboy.on("error", (err: Error) => {
        if (!rejected) {
          rejected = true;
          reject(err);
        }
      });

      req.pipe(busboy);
    } catch (err) {
      reject(err);
    }
  });
}
