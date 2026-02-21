import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from "class-validator";
import { plainToInstance } from "class-transformer";

export class AppConfig {
  @IsNumber()
  port: number = 3000;

  @IsString()
  nodeEnv: string = "development";

  @IsString()
  logLevel: string = "info";

  @IsString()
  @IsNotEmpty()
  s3Bucket: string = "media-uploads";

  @IsString()
  @IsNotEmpty()
  awsRegion: string = "us-east-1";

  @IsString()
  @IsOptional()
  awsAccessKeyId?: string;

  @IsString()
  @IsOptional()
  awsSecretAccessKey?: string;

  @IsString()
  @IsNotEmpty()
  dbPath: string = "media.db";

  /** Maximum upload file size in bytes (default 10 MB). */
  @IsNumber()
  maxFileSizeBytes: number = 10 * 1024 * 1024;

  /** Per-request timeout in milliseconds (default 30 s). */
  @IsNumber()
  requestTimeoutMs: number = 30_000;

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  }
}

export function loadConfig(): AppConfig {
  const raw = {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    logLevel: process.env.LOG_LEVEL || "info",
    s3Bucket: process.env.S3_BUCKET || "media-uploads",
    awsRegion: process.env.AWS_REGION || "us-east-1",
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    dbPath: process.env.DB_PATH || "media.db",
    maxFileSizeBytes:
      Number(process.env.MAX_FILE_SIZE_BYTES) || 10 * 1024 * 1024,
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS) || 30_000,
  };

  const config = plainToInstance(AppConfig, raw);
  const errors = validateSync(config, { whitelist: true });

  if (errors.length > 0) {
    const messages = errors.map((e) =>
      Object.values(e.constraints || {}).join(", "),
    );
    throw new Error(`Invalid configuration:\n  ${messages.join("\n  ")}`);
  }

  return config;
}
