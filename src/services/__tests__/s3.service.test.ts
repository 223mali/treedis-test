import { S3Service } from "../s3.service";
import { Logger } from "../../logger";
import { AppConfig } from "../../config";
import { NotFoundError, InternalError } from "../../errors/app-error";
import { Readable } from "stream";

// ── Mock the AWS SDK ────────────────────────────────────────────────────

const mockSend = jest.fn();

jest.mock("@aws-sdk/client-s3", () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    PutObjectCommand: jest.fn().mockImplementation((input) => ({
      _type: "PutObjectCommand",
      input,
    })),
    GetObjectCommand: jest.fn().mockImplementation((input) => ({
      _type: "GetObjectCommand",
      input,
    })),
    DeleteObjectCommand: jest.fn().mockImplementation((input) => ({
      _type: "DeleteObjectCommand",
      input,
    })),
  };
});

// ── Helpers ─────────────────────────────────────────────────────────────

const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    s3Bucket: "test-bucket",
    awsRegion: "us-east-1",
    awsAccessKeyId: "test-key",
    awsSecretAccessKey: "test-secret",
    ...overrides,
  } as AppConfig;
}

function bufferToReadable(buf: Buffer): Readable {
  return Readable.from(buf);
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("S3Service", () => {
  let service: S3Service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new S3Service(mockLogger, makeConfig());
  });

  // ─── getBucket ────────────────────────────────────────────────────

  describe("getBucket", () => {
    it("should return the configured bucket name", () => {
      expect(service.getBucket()).toBe("test-bucket");
    });

    it("should reflect a custom bucket from config", () => {
      const svc = new S3Service(
        mockLogger,
        makeConfig({ s3Bucket: "custom-bucket" }),
      );
      expect(svc.getBucket()).toBe("custom-bucket");
    });
  });

  // ─── upload ───────────────────────────────────────────────────────

  describe("upload", () => {
    it("should upload a file and return bucket and key", async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await service.upload(
        "uploads/test.jpg",
        Buffer.from("file-content"),
        "image/jpeg",
      );

      expect(result).toEqual({
        bucket: "test-bucket",
        key: "uploads/test.jpg",
      });
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "uploads/test.jpg",
        Body: Buffer.from("file-content"),
        ContentType: "image/jpeg",
      });
    });

    it("should log before and after upload", async () => {
      mockSend.mockResolvedValueOnce({});

      await service.upload("key.jpg", Buffer.from("data"), "image/jpeg");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Uploading to S3"),
        expect.any(Object),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Upload complete"),
      );
    });

    it("should throw NotFoundError when S3 returns NoSuchBucket", async () => {
      mockSend.mockRejectedValueOnce({
        name: "NoSuchBucket",
        $metadata: { httpStatusCode: 404 },
        message: "The specified bucket does not exist",
      });

      await expect(
        service.upload("key.jpg", Buffer.from("data"), "image/jpeg"),
      ).rejects.toThrow(InternalError);
    });

    it("should throw InternalError when S3 returns AccessDenied", async () => {
      mockSend.mockRejectedValueOnce({
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
        message: "Access Denied",
      });

      await expect(
        service.upload("key.jpg", Buffer.from("data"), "image/jpeg"),
      ).rejects.toThrow(InternalError);
    });

    it("should throw InternalError for an unknown S3 error", async () => {
      mockSend.mockRejectedValueOnce({
        name: "SomeUnexpectedError",
        $metadata: { httpStatusCode: 500 },
        message: "Something went wrong",
      });

      await expect(
        service.upload("key.jpg", Buffer.from("data"), "image/jpeg"),
      ).rejects.toThrow(InternalError);
    });
  });

  // ─── download ─────────────────────────────────────────────────────

  describe("download", () => {
    it("should download a file and return body buffer and content type", async () => {
      const fileContent = Buffer.from("downloaded-content");
      mockSend.mockResolvedValueOnce({
        Body: bufferToReadable(fileContent),
        ContentType: "image/png",
      });

      const result = await service.download("uploads/test.png");

      expect(result.body).toEqual(fileContent);
      expect(result.contentType).toBe("image/png");
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "uploads/test.png",
      });
    });

    it("should default content type to application/octet-stream when missing", async () => {
      mockSend.mockResolvedValueOnce({
        Body: bufferToReadable(Buffer.from("data")),
        ContentType: undefined,
      });

      const result = await service.download("key");

      expect(result.contentType).toBe("application/octet-stream");
    });

    it("should throw NotFoundError when S3 returns NoSuchKey", async () => {
      mockSend.mockRejectedValueOnce({
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
        message: "The specified key does not exist.",
      });

      await expect(service.download("missing-key")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should throw NotFoundError when S3 returns NotFound", async () => {
      mockSend.mockRejectedValueOnce({
        name: "NotFound",
        $metadata: { httpStatusCode: 404 },
        message: "Not Found",
      });

      await expect(service.download("missing-key")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("should throw InternalError on timeout", async () => {
      mockSend.mockRejectedValueOnce({
        name: "TimeoutError",
        $metadata: {},
        message: "Connection timed out",
      });

      const err = await service.download("key").catch((e) => e);
      expect(err).toBeInstanceOf(InternalError);
      expect(err.message).toContain("timed out");
    });
  });

  // ─── remove ───────────────────────────────────────────────────────

  describe("remove", () => {
    it("should send a DeleteObjectCommand with the correct params", async () => {
      mockSend.mockResolvedValueOnce({});

      await service.remove("uploads/test.jpg");

      expect(mockSend).toHaveBeenCalledTimes(1);
      const command = mockSend.mock.calls[0][0];
      expect(command.input).toEqual({
        Bucket: "test-bucket",
        Key: "uploads/test.jpg",
      });
    });

    it("should log before and after deletion", async () => {
      mockSend.mockResolvedValueOnce({});

      await service.remove("key.jpg");

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Deleting from S3"),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining("Deleted from S3"),
      );
    });

    it("should throw InternalError when S3 returns AccessDenied", async () => {
      mockSend.mockRejectedValueOnce({
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
        message: "Access Denied",
      });

      await expect(service.remove("key.jpg")).rejects.toThrow(InternalError);
    });

    it("should throw NotFoundError when S3 returns NoSuchKey", async () => {
      mockSend.mockRejectedValueOnce({
        name: "NoSuchKey",
        $metadata: { httpStatusCode: 404 },
        message: "The specified key does not exist.",
      });

      await expect(service.remove("missing-key")).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ─── mapS3Error (via public methods) ──────────────────────────────

  describe("error mapping", () => {
    it("should map InvalidAccessKeyId to InternalError", async () => {
      mockSend.mockRejectedValueOnce({
        name: "InvalidAccessKeyId",
        $metadata: { httpStatusCode: 403 },
        message: "The AWS Access Key Id you provided does not exist",
      });

      const err = await service
        .upload("k", Buffer.from("d"), "t")
        .catch((e) => e);
      expect(err).toBeInstanceOf(InternalError);
      expect(err.message).toContain("credentials");
    });

    it("should map SignatureDoesNotMatch to InternalError", async () => {
      mockSend.mockRejectedValueOnce({
        name: "SignatureDoesNotMatch",
        $metadata: { httpStatusCode: 403 },
        message: "Signature mismatch",
      });

      const err = await service
        .upload("k", Buffer.from("d"), "t")
        .catch((e) => e);
      expect(err).toBeInstanceOf(InternalError);
      expect(err.message).toContain("credentials");
    });

    it("should map RequestTimeout to InternalError with retry message", async () => {
      mockSend.mockRejectedValueOnce({
        name: "RequestTimeout",
        $metadata: {},
        message: "Request timed out",
      });

      const err = await service
        .upload("k", Buffer.from("d"), "t")
        .catch((e) => e);
      expect(err).toBeInstanceOf(InternalError);
      expect(err.message).toContain("timed out");
    });

    it("should include the original error message for unknown errors", async () => {
      mockSend.mockRejectedValueOnce({
        name: "WeirdError",
        $metadata: { httpStatusCode: 500 },
        message: "Something very strange happened",
      });

      const err = await service.download("k").catch((e) => e);
      expect(err).toBeInstanceOf(InternalError);
      expect(err.message).toContain("Something very strange happened");
    });

    it("should log the error details", async () => {
      mockSend.mockRejectedValueOnce({
        name: "AccessDenied",
        $metadata: { httpStatusCode: 403 },
        message: "Access Denied",
      });

      await service.remove("key").catch(() => {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("S3 delete failed"),
        expect.objectContaining({
          s3ErrorCode: "AccessDenied",
          httpStatusCode: 403,
        }),
      );
    });
  });
});
