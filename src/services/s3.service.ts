import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Logger } from "../logger";
import { AppConfig } from "../config";

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

    await this.client.send(new PutObjectCommand(params));

    this.logger.info(`Upload complete: ${this.bucket}/${key}`);

    return { bucket: this.bucket, key };
  }

  public async download(
    key: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    this.logger.info(`Downloading from S3: ${this.bucket}/${key}`);

    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

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

    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    this.logger.info(`Deleted from S3: ${this.bucket}/${key}`);
  }

  public getBucket(): string {
    return this.bucket;
  }
}
