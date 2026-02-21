import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Logger } from "../logger";
import { AppConfig } from "../config";
import { AppError, NotFoundError, InternalError } from "../errors/app-error";

export class S3Service {
  private client: S3Client;
  private bucket: string;
  private logger: Logger;

  constructor(logger: Logger, config: AppConfig) {
    this.logger = logger;
    this.bucket = config.s3Bucket;

    this.client = new S3Client({
      region: config.awsRegion,
      ...(config.awsAccessKeyId && {
        credentials: {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: config.awsSecretAccessKey || "",
        },
      }),
    });
  }

  public async upload(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ bucket: string; key: string }> {
    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    };

    this.logger.info(`Uploading to S3: ${this.bucket}/${key}`, {
      bucket: this.bucket,
      key,
      contentType,
      size: body.length,
    });

    try {
      await this.client.send(new PutObjectCommand(params));
    } catch (err) {
      throw this.mapS3Error(err, "upload", key);
    }

    this.logger.info(`Upload complete: ${this.bucket}/${key}`);

    return { bucket: this.bucket, key };
  }

  public async download(
    key: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    this.logger.info(`Downloading from S3: ${this.bucket}/${key}`);

    let response;
    try {
      response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      throw this.mapS3Error(err, "download", key);
    }

    const stream = response.Body as NodeJS.ReadableStream;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }

    return {
      body: Buffer.concat(chunks),
      contentType: response.ContentType || "application/octet-stream",
    };
  }

  public async remove(key: string): Promise<void> {
    this.logger.info(`Deleting from S3: ${this.bucket}/${key}`);

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      throw this.mapS3Error(err, "delete", key);
    }

    this.logger.info(`Deleted from S3: ${this.bucket}/${key}`);
  }

  public getBucket(): string {
    return this.bucket;
  }

  // ─── S3 error mapping ───────────────────────────────────────────────

  /**
   * Translates raw AWS SDK errors into typed AppErrors so the router's
   * catch-all handler can return the correct HTTP status code.
   */
  private mapS3Error(err: unknown, operation: string, key: string): AppError {
    const awsError = err as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
      message?: string;
    };
    const code = awsError.name || "";
    const httpCode = awsError.$metadata?.httpStatusCode;

    this.logger.error(`S3 ${operation} failed for key "${key}": ${code}`, {
      s3ErrorCode: code,
      httpStatusCode: httpCode,
      message: awsError.message,
    });

    switch (code) {
      case "NoSuchKey":
      case "NotFound":
        return new NotFoundError(`Object "${key}" not found in S3`);

      case "NoSuchBucket":
        return new InternalError(
          `S3 bucket "${this.bucket}" does not exist — check configuration`,
        );

      case "AccessDenied":
      case "Forbidden":
        return new InternalError(
          "Access denied to S3 — check AWS credentials and bucket policy",
        );

      case "InvalidAccessKeyId":
      case "SignatureDoesNotMatch":
        return new InternalError(
          "Invalid AWS credentials — check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY",
        );

      case "RequestTimeout":
      case "TimeoutError":
        return new InternalError(
          `S3 ${operation} timed out for key "${key}" — try again`,
        );

      default:
        return new InternalError(
          `S3 ${operation} failed: ${awsError.message || code}`,
        );
    }
  }
}
