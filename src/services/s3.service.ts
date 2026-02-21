import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
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

  public getBucket(): string {
    return this.bucket;
  }
}
