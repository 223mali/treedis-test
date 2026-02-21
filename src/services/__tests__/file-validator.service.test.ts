import { FileValidator } from "../file-validator.service";
import { Logger } from "../../logger";
import { AppConfig } from "../../config";
import {
  BadRequestError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from "../../errors/app-error";

// ── Helpers ─────────────────────────────────────────────────────────────

const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

const TEN_MB = 10 * 1024 * 1024;

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    maxFileSizeBytes: TEN_MB,
    ...overrides,
  } as AppConfig;
}

// Valid magic-byte headers for each allowed type
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]);
const GIF87_HEADER = Buffer.concat([Buffer.from("GIF87a"), Buffer.alloc(4)]);
const GIF89_HEADER = Buffer.concat([Buffer.from("GIF89a"), Buffer.alloc(4)]);
const PDF_HEADER = Buffer.concat([Buffer.from("%PDF-1.4"), Buffer.alloc(4)]);

/** Build a buffer with valid magic bytes padded to a given size. */
function makeFile(header: Buffer, totalSize: number = 1024): Buffer {
  const buf = Buffer.alloc(totalSize);
  header.copy(buf);
  return buf;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("FileValidator", () => {
  let validator: FileValidator;

  beforeEach(() => {
    jest.clearAllMocks();
    validator = new FileValidator(mockLogger, makeConfig());
  });

  // ─── validate (happy paths) ───────────────────────────────────────

  describe("validate – accepted files", () => {
    it("should accept a valid JPEG file", () => {
      expect(() =>
        validator.validate(makeFile(JPEG_HEADER), "image/jpeg", "photo.jpg"),
      ).not.toThrow();
    });

    it("should accept a valid PNG file", () => {
      expect(() =>
        validator.validate(makeFile(PNG_HEADER), "image/png", "image.png"),
      ).not.toThrow();
    });

    it("should accept a valid GIF87a file", () => {
      expect(() =>
        validator.validate(makeFile(GIF87_HEADER), "image/gif", "anim.gif"),
      ).not.toThrow();
    });

    it("should accept a valid GIF89a file", () => {
      expect(() =>
        validator.validate(makeFile(GIF89_HEADER), "image/gif", "anim.gif"),
      ).not.toThrow();
    });

    it("should accept a valid PDF file", () => {
      expect(() =>
        validator.validate(makeFile(PDF_HEADER), "application/pdf", "doc.pdf"),
      ).not.toThrow();
    });

    it("should accept a file exactly at the size limit", () => {
      const file = makeFile(JPEG_HEADER, TEN_MB);
      expect(() =>
        validator.validate(file, "image/jpeg", "big.jpg"),
      ).not.toThrow();
    });
  });

  // ─── validate – empty file ────────────────────────────────────────

  describe("validate – empty file", () => {
    it("should throw BadRequestError for an empty buffer", () => {
      expect(() =>
        validator.validate(Buffer.alloc(0), "image/jpeg", "empty.jpg"),
      ).toThrow(BadRequestError);
    });

    it("should include a meaningful message", () => {
      expect(() =>
        validator.validate(Buffer.alloc(0), "image/jpeg", "empty.jpg"),
      ).toThrow(/empty/i);
    });
  });

  // ─── validate – size limit ────────────────────────────────────────

  describe("validate – size limit", () => {
    it("should throw PayloadTooLargeError when file exceeds the limit", () => {
      const oversized = makeFile(JPEG_HEADER, TEN_MB + 1);
      expect(() =>
        validator.validate(oversized, "image/jpeg", "huge.jpg"),
      ).toThrow(PayloadTooLargeError);
    });

    it("should include file size and limit in the error message", () => {
      const oversized = makeFile(JPEG_HEADER, TEN_MB + 1);
      expect(() =>
        validator.validate(oversized, "image/jpeg", "huge.jpg"),
      ).toThrow(/MB/);
    });

    it("should respect a custom maxFileSizeBytes config", () => {
      const smallLimit = new FileValidator(mockLogger, makeConfig({ maxFileSizeBytes: 500 }));
      const file = makeFile(JPEG_HEADER, 501);

      expect(() =>
        smallLimit.validate(file, "image/jpeg", "photo.jpg"),
      ).toThrow(PayloadTooLargeError);
    });
  });

  // ─── validate – MIME type allowlist ───────────────────────────────

  describe("validate – MIME type allowlist", () => {
    it("should throw UnsupportedMediaTypeError for a disallowed MIME type", () => {
      const file = makeFile(Buffer.from("RIFF"), 1024);
      expect(() =>
        validator.validate(file, "image/webp", "photo.webp"),
      ).toThrow(UnsupportedMediaTypeError);
    });

    it("should include the rejected MIME type in the error", () => {
      const file = makeFile(Buffer.from("data"), 1024);
      expect(() =>
        validator.validate(file, "text/plain", "readme.txt"),
      ).toThrow(/text\/plain/);
    });

    it("should be case-insensitive for MIME type check", () => {
      expect(() =>
        validator.validate(makeFile(JPEG_HEADER), "IMAGE/JPEG", "photo.jpg"),
      ).not.toThrow();
    });
  });

  // ─── validate – magic bytes ───────────────────────────────────────

  describe("validate – magic byte verification", () => {
    it("should throw when JPEG header does not match image/jpeg", () => {
      const fakeJpeg = makeFile(PNG_HEADER); // PNG bytes but claims JPEG
      expect(() =>
        validator.validate(fakeJpeg, "image/jpeg", "fake.jpg"),
      ).toThrow(UnsupportedMediaTypeError);
    });

    it("should throw when PNG header does not match image/png", () => {
      const fakePng = makeFile(JPEG_HEADER);
      expect(() =>
        validator.validate(fakePng, "image/png", "fake.png"),
      ).toThrow(UnsupportedMediaTypeError);
    });

    it("should throw when PDF header does not match application/pdf", () => {
      const fakePdf = makeFile(JPEG_HEADER);
      expect(() =>
        validator.validate(fakePdf, "application/pdf", "fake.pdf"),
      ).toThrow(UnsupportedMediaTypeError);
    });

    it("should include a meaningful message about mismatched content", () => {
      const fakeJpeg = makeFile(PNG_HEADER);
      expect(() =>
        validator.validate(fakeJpeg, "image/jpeg", "fake.jpg"),
      ).toThrow(/content does not match/i);
    });

    it("should log a warning for magic byte mismatch", () => {
      const fakeJpeg = makeFile(PNG_HEADER);
      try {
        validator.validate(fakeJpeg, "image/jpeg", "fake.jpg");
      } catch {
        // expected
      }

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("content signature does not match"),
      );
    });

    it("should reject a file too short to contain the magic bytes", () => {
      const tinyFile = Buffer.from([0xff]); // 1 byte, JPEG needs ≥ 3
      expect(() =>
        validator.validate(tinyFile, "image/jpeg", "tiny.jpg"),
      ).toThrow(UnsupportedMediaTypeError);
    });
  });

  // ─── isAllowedMimeType ────────────────────────────────────────────

  describe("isAllowedMimeType", () => {
    it.each(["image/jpeg", "image/png", "image/gif", "application/pdf"])(
      "should return true for %s",
      (mime) => {
        expect(validator.isAllowedMimeType(mime)).toBe(true);
      },
    );

    it.each(["image/webp", "text/plain", "video/mp4", "application/zip"])(
      "should return false for %s",
      (mime) => {
        expect(validator.isAllowedMimeType(mime)).toBe(false);
      },
    );

    it("should be case-insensitive", () => {
      expect(validator.isAllowedMimeType("IMAGE/JPEG")).toBe(true);
    });
  });

  // ─── getMimeTypeFromExtension ─────────────────────────────────────

  describe("getMimeTypeFromExtension", () => {
    it.each([
      ["photo.jpg", "image/jpeg"],
      ["photo.jpeg", "image/jpeg"],
      ["image.png", "image/png"],
      ["anim.gif", "image/gif"],
      ["doc.pdf", "application/pdf"],
    ])("should return correct MIME type for %s", (filename, expected) => {
      expect(validator.getMimeTypeFromExtension(filename)).toBe(expected);
    });

    it("should be case-insensitive for extensions", () => {
      expect(validator.getMimeTypeFromExtension("PHOTO.JPG")).toBe("image/jpeg");
    });

    it("should return null for an unknown extension", () => {
      expect(validator.getMimeTypeFromExtension("file.bmp")).toBeNull();
    });

    it("should return null for a file with no extension", () => {
      expect(validator.getMimeTypeFromExtension("README")).toBeNull();
    });

    it("should use the last extension when multiple dots exist", () => {
      expect(validator.getMimeTypeFromExtension("archive.tar.pdf")).toBe("application/pdf");
    });
  });

  // ─── getAllowedTypes ──────────────────────────────────────────────

  describe("getAllowedTypes", () => {
    it("should return all four allowed MIME types", () => {
      const types = validator.getAllowedTypes();
      expect(types).toHaveLength(4);
      expect(types).toContain("image/jpeg");
      expect(types).toContain("image/png");
      expect(types).toContain("image/gif");
      expect(types).toContain("application/pdf");
    });

    it("should return an array (not a Set)", () => {
      expect(Array.isArray(validator.getAllowedTypes())).toBe(true);
    });
  });
});
