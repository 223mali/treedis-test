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
        schema: { type: 'string', format: 'uuid' }
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
        schema: { type: 'string', format: 'uuid' }
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
        schema: { type: 'string', format: 'uuid' }
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
    } catch (err) {
      this.logger.error(`Upload failed: ${err}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Upload failed" }));
    }
  }

  // ─── LIST ALL ────────────────────────────────────────────────────────

  private listFiles(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    try {
      const files = this.metadataStore.findAll();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          files: files.map((f) => this.toResponse(f)),
          total: files.length,
        }),
      );
    } catch (err) {
      this.logger.error(`List files failed: ${err}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Failed to list files" }));
    }
  }

  // ─── GET BY ID ───────────────────────────────────────────────────────

  private async getFile(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>,
  ): Promise<void> {
    try {
      const { id } = params;
      const metadata = this.metadataStore.findById(id);

      if (!metadata) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "File not found" }));
        return;
      }

      const { body, contentType } = await this.s3Service.download(
        metadata.s3Key,
      );

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${metadata.originalName}"`,
        "Content-Length": body.length.toString(),
      });
      res.end(body);
    } catch (err) {
      this.logger.error(`Download failed: ${err}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Download failed" }));
    }
  }

  // ─── UPDATE (REPLACE) ───────────────────────────────────────────────

  private async updateFile(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>,
  ): Promise<void> {
    try {
      const { id } = params;
      const existing = this.metadataStore.findById(id);

      if (!existing) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "File not found" }));
        return;
      }

      const contentType = req.headers["content-type"] || "";
      if (!contentType.includes("multipart/form-data")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: "Content-Type must be multipart/form-data" }),
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
    } catch (err) {
      this.logger.error(`Update failed: ${err}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Update failed" }));
    }
  }

  // ─── DELETE ──────────────────────────────────────────────────────────

  private async deleteFile(
    _req: http.IncomingMessage,
    res: http.ServerResponse,
    params: Record<string, string>,
  ): Promise<void> {
    try {
      const { id } = params;
      const metadata = this.metadataStore.findById(id);

      if (!metadata) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "File not found" }));
        return;
      }

      await this.s3Service.remove(metadata.s3Key);
      this.metadataStore.delete(id);

      this.logger.info("File deleted successfully", {
        id,
        originalName: metadata.originalName,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "File deleted successfully", id }));
    } catch (err) {
      this.logger.error(`Delete failed: ${err}`);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Delete failed" }));
    }
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────

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
