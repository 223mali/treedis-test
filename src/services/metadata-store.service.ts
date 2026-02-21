import Database, { Database as DatabaseType } from "better-sqlite3";
import { FileMetadata } from "../models/file-metadata.model";
import { Logger } from "../logger";
import { AppConfig } from "../config";

/**
 * SQLite-backed metadata store.
 */
export class MetadataStore {
  private db: DatabaseType;
  private logger: Logger;

  constructor(logger: Logger, config: AppConfig) {
    this.logger = logger;
    this.db = new Database(config.dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initialise();
  }

  private initialise(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_metadata (
        id            TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type     TEXT NOT NULL,
        size          INTEGER NOT NULL,
        s3_key        TEXT NOT NULL,
        s3_bucket     TEXT NOT NULL,
        uploaded_at   TEXT NOT NULL
      )
    `);
    this.logger.info("Metadata store initialised (SQLite)");
  }

  public save(metadata: FileMetadata): void {
    const stmt = this.db.prepare(`
      INSERT INTO file_metadata (id, original_name, mime_type, size, s3_key, s3_bucket, uploaded_at)
      VALUES (@id, @originalName, @mimeType, @size, @s3Key, @s3Bucket, @uploadedAt)
    `);
    stmt.run(metadata);
  }

  public findById(id: string): FileMetadata | undefined {
    const stmt = this.db.prepare("SELECT * FROM file_metadata WHERE id = ?");
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? this.toMetadata(row) : undefined;
  }

  public findAll(): FileMetadata[] {
    const stmt = this.db.prepare(
      "SELECT * FROM file_metadata ORDER BY uploaded_at DESC",
    );
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => this.toMetadata(r));
  }

  public delete(id: string): boolean {
    const stmt = this.db.prepare("DELETE FROM file_metadata WHERE id = ?");
    const result = stmt.run(id);
    return result.changes > 0;
  }

  public update(
    id: string,
    metadata: Partial<FileMetadata>,
  ): FileMetadata | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...metadata };
    const stmt = this.db.prepare(`
      UPDATE file_metadata
      SET original_name = @originalName,
          mime_type     = @mimeType,
          size          = @size,
          s3_key        = @s3Key,
          s3_bucket     = @s3Bucket,
          uploaded_at   = @uploadedAt
      WHERE id = @id
    `);
    stmt.run(updated);
    return updated;
  }

  private toMetadata(row: Record<string, unknown>): FileMetadata {
    return {
      id: row.id as string,
      originalName: row.original_name as string,
      mimeType: row.mime_type as string,
      size: row.size as number,
      s3Key: row.s3_key as string,
      s3Bucket: row.s3_bucket as string,
      uploadedAt: row.uploaded_at as string,
    };
  }

  public close(): void {
    this.db.close();
  }
}
