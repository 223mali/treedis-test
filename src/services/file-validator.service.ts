import { Logger } from "../logger";

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

export class FileValidator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  public isAllowedMimeType(mimeType: string): boolean {
    const allowed = ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
    if (!allowed) {
      this.logger.warn(`Rejected file with mime type: ${mimeType}`);
    }
    return allowed;
  }

  public getMimeTypeFromExtension(filename: string): string | null {
    const ext = filename.substring(filename.lastIndexOf(".")).toLowerCase();
    return EXTENSION_TO_MIME[ext] || null;
  }

  public getAllowedTypes(): string[] {
    return Array.from(ALLOWED_MIME_TYPES);
  }
}
