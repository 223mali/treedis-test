import * as http from "http";
import { v4 as uuidv4 } from "uuid";
import { Logger } from "../logger";
import { Router } from "../router";
import { S3Service } from "../services/s3.service";
import { FileValidator } from "../services/file-validator.service";
import { MetadataStore } from "../services/metadata-store.service";
import { FileMetadata } from "../models/file-metadata.model";
import { parseMultipartBody } from "../utils/multipart-parser";

export class MediaController {
  private logger: Logger;
  private s3Service: S3Service;
  private fileValidator: FileValidator;
  private metadataStore: MetadataStore;

  constructor(
    logger: Logger,
    router: Router,
    s3Service: S3Service,
    fileValidator: FileValidator,
    metadataStore: MetadataStore,
  ) {
    this.logger = logger;
    this.s3Service = s3Service;
    this.fileValidator = fileValidator;
    this.metadataStore = metadataStore;
    this.registerRoutes(router);
  }

  private registerRoutes(router: Router): void {
    router.post("/media/upload", (req, res) => this.uploadFile(req, res));
  }

  private async uploadFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    // #swagger.tags = ['Media']
    // #swagger.summary = 'Upload a media file'
    // #swagger.description = 'Uploads a file to AWS S3. Allowed types: jpeg, png, gif, pdf. Send as multipart/form-data with a "file" field.'
    /* #swagger.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            required: ['file'],
            properties: {
              file: {
                type: 'string',
                format: 'binary',
                description: 'The media file to upload (jpeg, png, gif, pdf)'
              }
            }
          }
        }
      }
    } */
    /* #swagger.responses[201] = {
      description: 'File uploaded successfully',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              message: { type: 'string', example: 'File uploaded successfully' },
              file: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  originalName: { type: 'string', example: 'photo.jpg' },
                  mimeType: { type: 'string', example: 'image/jpeg' },
                  size: { type: 'number', example: 102400 },
                  uploadedAt: { type: 'string', format: 'date-time' }
                }
              }
            }
          }
        }
      }
    } */
    /* #swagger.responses[400] = {
      description: 'Bad request — missing file or invalid file type',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              allowedTypes: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    } */

    try {
      const contentType = req.headers["content-type"] || "";

      if (!contentType.includes("multipart/form-data")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Content-Type must be multipart/form-data",
          }),
        );
        return;
      }

      const files = await parseMultipartBody(req);

      if (files.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No file provided in the request" }));
        return;
      }

      const file = files[0];

      // Validate mime type — prefer the Content-Type from the multipart header,
      // fall back to extension-based detection
      let mimeType = file.mimeType;
      if (mimeType === "application/octet-stream") {
        const detected = this.fileValidator.getMimeTypeFromExtension(
          file.filename,
        );
        if (detected) mimeType = detected;
      }

      if (!this.fileValidator.isAllowedMimeType(mimeType)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: `File type "${mimeType}" is not allowed`,
            allowedTypes: this.fileValidator.getAllowedTypes(),
          }),
        );
        return;
      }

      // Generate a unique key and upload to S3
      const fileId = uuidv4();
      const ext = file.filename.substring(file.filename.lastIndexOf("."));
      const s3Key = `uploads/${fileId}${ext}`;

      const { bucket, key } = await this.s3Service.upload(
        s3Key,
        file.data,
        mimeType,
      );

      // Store metadata
      const metadata: FileMetadata = {
        id: fileId,
        originalName: file.filename,
        mimeType,
        size: file.data.length,
        s3Key: key,
        s3Bucket: bucket,
        uploadedAt: new Date().toISOString(),
      };

      this.metadataStore.save(metadata);

      this.logger.info("File uploaded successfully", {
        id: fileId,
        originalName: file.filename,
        size: file.data.length,
      });

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "File uploaded successfully",
          file: {
            id: metadata.id,
            originalName: metadata.originalName,
            mimeType: metadata.mimeType,
            size: metadata.size,
            uploadedAt: metadata.uploadedAt,
          },
        }),
      );
    } catch (err) {
      this.logger.error(`Upload failed: ${err}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Upload failed" }));
    }
  }
}
