import { Logger } from "../logger";
import { AppConfig } from "../config";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "../errors/app-error";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
]);

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

/**
 * Magic-byte signatures used to verify file contents match the claimed MIME type.
 * Each entry maps a MIME type to one or more valid leading-byte sequences.
 */
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "image/jpeg": [Buffer.from([0xff, 0xd8, 0xff])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  "image/gif": [Buffer.from("GIF87a"), Buffer.from("GIF89a")],
  "application/pdf": [Buffer.from("%PDF")],
};

export class FileValidator {
  private logger: Logger;
  private maxFileSizeBytes: number;

  constructor(logger: Logger, config: AppConfig) {
    this.logger = logger;
    this.maxFileSizeBytes = config.maxFileSizeBytes;
  }

  /**
   * Runs all validation rules against the uploaded file in one call.
   * Throws a typed AppError if any check fails — callers don't need
   * to inspect boolean return values.
   */
  public validate(fileData: Buffer, mimeType: string, filename: string): void {
    // 1. File must not be empty
    if (fileData.length === 0) {
      throw new BadRequestError("Uploaded file is empty");
    }

    // 2. Size check
    if (fileData.length > this.maxFileSizeBytes) {
      throw new PayloadTooLargeError(
        `File size ${(fileData.length / 1024 / 1024).toFixed(2)} MB exceeds the ` +
          `${(this.maxFileSizeBytes / 1024 / 1024).toFixed(0)} MB limit`,
      );
    }

    // 3. MIME-type allowlist
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      throw new UnsupportedMediaTypeError(
        `File type "${mimeType}" is not allowed`,
        this.getAllowedTypes(),
      );
    }

    // 4. Magic-byte signature check
    if (!this.matchesMagicBytes(fileData, mimeType)) {
      this.logger.warn(
        `File "${filename}" claims to be ${mimeType} but content signature does not match`,
      );
      throw new UnsupportedMediaTypeError(
        `File content does not match the declared type "${mimeType}". ` +
          "The file may be corrupted or mislabelled.",
      );
    }
  }

  // ── helpers kept public for backward-compat ──

  public isAllowedMimeType(mimeType: string): boolean {
    return ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
  }

  public getMimeTypeFromExtension(filename: string): string | null {
    const dotIndex = filename.lastIndexOf(".");
    if (dotIndex === -1) return null;
    const ext = filename.substring(dotIndex).toLowerCase();
    return EXTENSION_TO_MIME[ext] || null;
  }

  public getAllowedTypes(): string[] {
    return Array.from(ALLOWED_MIME_TYPES);
  }

  // ── private ──

  private matchesMagicBytes(data: Buffer, mimeType: string): boolean {
    const signatures = MAGIC_BYTES[mimeType.toLowerCase()];
    if (!signatures) {
      // No signature registered — accept by default
      return true;
    }

    return signatures.some((sig) => {
      if (data.length < sig.length) return false;
      return data.subarray(0, sig.length).equals(sig);
    });
  }
}
