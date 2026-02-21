import * as http from "http";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { Logger } from "../logger";
import { Router } from "../router";
import { S3Service } from "../services/s3.service";
import { FileValidator } from "../services/file-validator.service";
import { MetadataStore } from "../services/metadata-store.service";
import { FileMetadata } from "../models/file-metadata.model";
import { parseMultipartBody, MultipartLimits } from "../utils/multipart-parser";
import { AppConfig } from "../config";
import { BadRequestError, NotFoundError } from "../errors/app-error";

export class MediaController {
  private logger: Logger;
  private s3Service: S3Service;
  private fileValidator: FileValidator;
  private metadataStore: MetadataStore;
  private multipartLimits: MultipartLimits;

  constructor(
    logger: Logger,
    router: Router,
    s3Service: S3Service,
    fileValidator: FileValidator,
    metadataStore: MetadataStore,
    config: AppConfig,
  ) {
    this.logger = logger;
    this.s3Service = s3Service;
    this.fileValidator = fileValidator;
    this.metadataStore = metadataStore;
    this.multipartLimits = {
      maxFileSize: config.maxFileSizeBytes,
      maxFiles: 1,
    };
    this.registerRoutes(router);
  }

  private registerRoutes(router: Router): void {
    router.post("/media/upload", (req, res, _params) => {
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
                file: { $ref: '#/components/schemas/FileMetadata' }
              }
            }
          }
        }
      } */
      /* #swagger.responses[400] = {
        description: 'Bad request — missing file or invalid file type'
      } */
      return this.uploadFile(req, res);
    });
    router.get("/media", (_req, res, _params) => {
      // #swagger.tags = ['Media']
      // #swagger.summary = 'List all media files'
      // #swagger.description = 'Returns metadata for all uploaded media files.'
      /* #swagger.responses[200] = {
        description: 'List of media files',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                files: { type: 'array', items: { $ref: '#/components/schemas/FileMetadata' } },
                total: { type: 'number', example: 5 }
              }
            }
          }
        }
      } */
      return this.listFiles(_req, res);
    });
    router.get("/media/:id", (_req, res, params) => {
      // #swagger.tags = ['Media']
      // #swagger.summary = 'Retrieve a media file'
      // #swagger.description = 'Downloads the file content from S3 by its ID.'
      /* #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        description: 'The unique file ID',
        type: 'string'
      } */
      /* #swagger.responses[200] = {
        description: 'The raw file content with appropriate Content-Type header'
      } */
      /* #swagger.responses[404] = {
        description: 'File not found'
      } */
      return this.getFile(_req, res, params);
    });
    router.put("/media/:id", (req, res, params) => {
      // #swagger.tags = ['Media']
      // #swagger.summary = 'Replace a media file'
      // #swagger.description = 'Replaces an existing file in S3 with a new upload. The file ID stays the same.'
      /* #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        description: 'The unique file ID',
        type: 'string'
      } */
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
                  description: 'The replacement media file'
                }
              }
            }
          }
        }
      } */
      /* #swagger.responses[200] = {
        description: 'File replaced successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'File replaced successfully' },
                file: { $ref: '#/components/schemas/FileMetadata' }
              }
            }
          }
        }
      } */
      /* #swagger.responses[404] = { description: 'File not found' } */
      /* #swagger.responses[400] = { description: 'Bad request' } */
      return this.updateFile(req, res, params);
    });
    router.delete("/media/:id", (_req, res, params) => {
      // #swagger.tags = ['Media']
      // #swagger.summary = 'Delete a media file'
      // #swagger.description = 'Removes a file from S3 and deletes its metadata.'
      /* #swagger.parameters['id'] = {
        in: 'path',
        required: true,
        description: 'The unique file ID',
        type: 'string'
      } */
      /* #swagger.responses[200] = {
        description: 'File deleted successfully',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: 'File deleted successfully' },
                id: { type: 'string', format: 'uuid' }
              }
            }
          }
        }
      } */
      /* #swagger.responses[404] = { description: 'File not found' } */
      return this.deleteFile(_req, res, params);
    });
  }

  // ─── UPLOAD ──────────────────────────────────────────────────────────

  private async uploadFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const contentType = req.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      throw new BadRequestError("Content-Type must be multipart/form-data");
    }

    const files = await parseMultipartBody(req, this.multipartLimits);

    if (files.length === 0) {
      throw new BadRequestError("No file provided in the request");
    }

    const file = files[0];

    let mimeType = file.mimeType;
    if (mimeType === "application/octet-stream") {
      const detected = this.fileValidator.getMimeTypeFromExtension(
        file.filename,
      );
      if (detected) mimeType = detected;
    }

    // Runs size, MIME-type, and magic-bytes checks — throws on failure
    this.fileValidator.validate(file.data, mimeType, file.filename);

    const fileId = uuidv4();
    const ext = file.filename.substring(file.filename.lastIndexOf("."));
    const s3Key = `uploads/${fileId}${ext}`;

    const { bucket, key } = await this.s3Service.upload(
      s3Key,
      file.data,
      mimeType,
    );

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
        file: this.toResponse(metadata),
      }),
    );
  }

  // ─── LIST ALL ────────────────────────────────────────────────────────

  private listFiles(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    const files = this.metadataStore.findAll();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        files: files.map((f) => this.toResponse(f)),
        total: files.length,
      }),
    );
  }

  // ─── GET BY ID ───────────────────────────────────────────────────────

  private async getFile(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>,
  ): Promise<void> {
    const { id } = params;
    this.assertValidUuid(id);

    const metadata = this.metadataStore.findById(id);
    if (!metadata) {
      throw new NotFoundError(`File with id "${id}" not found`);
    }

    const { body, contentType } = await this.s3Service.download(metadata.s3Key);

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${metadata.originalName}"`,
      "Content-Length": body.length.toString(),
    });
    res.end(body);
  }

  // ─── UPDATE (REPLACE) ───────────────────────────────────────────────

  private async updateFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>,
  ): Promise<void> {
    const { id } = params;
    this.assertValidUuid(id);

    const existing = this.metadataStore.findById(id);
    if (!existing) {
      throw new NotFoundError(`File with id "${id}" not found`);
    }

    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new BadRequestError("Content-Type must be multipart/form-data");
    }

    const files = await parseMultipartBody(req, this.multipartLimits);
    if (files.length === 0) {
      throw new BadRequestError("No file provided in the request");
    }

    const file = files[0];

    let mimeType = file.mimeType;
    if (mimeType === "application/octet-stream") {
      const detected = this.fileValidator.getMimeTypeFromExtension(
        file.filename,
      );
      if (detected) mimeType = detected;
    }

    // Runs size, MIME-type, and magic-bytes checks — throws on failure
    this.fileValidator.validate(file.data, mimeType, file.filename);

    // Delete old file from S3 then upload the new one
    await this.s3Service.remove(existing.s3Key);

    const ext = file.filename.substring(file.filename.lastIndexOf("."));
    const newS3Key = `uploads/${id}${ext}`;
    const { bucket, key } = await this.s3Service.upload(
      newS3Key,
      file.data,
      mimeType,
    );

    const updated = this.metadataStore.update(id, {
      originalName: file.filename,
      mimeType,
      size: file.data.length,
      s3Key: key,
      s3Bucket: bucket,
      uploadedAt: new Date().toISOString(),
    });

    this.logger.info("File replaced successfully", {
      id,
      originalName: file.filename,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "File replaced successfully",
        file: this.toResponse(updated!),
      }),
    );
  }

  // ─── DELETE ──────────────────────────────────────────────────────────

  private async deleteFile(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>,
  ): Promise<void> {
    const { id } = params;
    this.assertValidUuid(id);

    const metadata = this.metadataStore.findById(id);
    if (!metadata) {
      throw new NotFoundError(`File with id "${id}" not found`);
    }

    await this.s3Service.remove(metadata.s3Key);
    this.metadataStore.delete(id);

    this.logger.info("File deleted successfully", {
      id,
      originalName: metadata.originalName,
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ message: "File deleted successfully", id }));
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────

  /**
   * Ensures the given string is a valid UUID v4.
   * Throws BadRequestError if not — caught by the router's catch-all.
   */
  private assertValidUuid(value: string): void {
    if (!uuidValidate(value)) {
      throw new BadRequestError(`"${value}" is not a valid UUID`);
    }
  }

  private toResponse(metadata: FileMetadata) {
    return {
      id: metadata.id,
      originalName: metadata.originalName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      uploadedAt: metadata.uploadedAt,
    };
  }
}
