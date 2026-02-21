import { MetadataStore } from "../metadata-store.service";
import { FileMetadata } from "../../models/file-metadata.model";
import { Logger } from "../../logger";
import { AppConfig } from "../../config";

// Minimal logger stub — no real logging during tests
const mockLogger: Logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as Logger;

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    dbPath: ":memory:",
    ...overrides,
  } as AppConfig;
}

function makeSampleMetadata(
  overrides: Partial<FileMetadata> = {},
): FileMetadata {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    originalName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 102400,
    s3Key: "uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg",
    s3Bucket: "media-uploads",
    uploadedAt: "2026-02-21T08:00:00.000Z",
    ...overrides,
  };
}

describe("MetadataStore", () => {
  let store: MetadataStore;

  beforeEach(() => {
    store = new MetadataStore(mockLogger, makeConfig());
  });

  afterEach(() => {
    store.close();
  });

  // ─── SAVE ──────────────────────────────────────────────────────────

  describe("save", () => {
    it("should save a file metadata record", () => {
      const metadata = makeSampleMetadata();

      store.save(metadata);

      const found = store.findById(metadata.id);
      expect(found).toBeDefined();
      expect(found).toEqual(metadata);
    });

    it("should throw when saving a duplicate id", () => {
      const metadata = makeSampleMetadata();
      store.save(metadata);

      expect(() => store.save(metadata)).toThrow();
    });
  });

  // ─── FIND BY ID ───────────────────────────────────────────────────

  describe("findById", () => {
    it("should return the metadata for an existing id", () => {
      const metadata = makeSampleMetadata();
      store.save(metadata);

      const result = store.findById(metadata.id);

      expect(result).toEqual(metadata);
    });

    it("should return undefined for a non-existent id", () => {
      const result = store.findById("non-existent-id");

      expect(result).toBeUndefined();
    });
  });

  // ─── FIND ALL ─────────────────────────────────────────────────────

  describe("findAll", () => {
    it("should return an empty array when no records exist", () => {
      const results = store.findAll();

      expect(results).toEqual([]);
    });

    it("should return all saved records", () => {
      const m1 = makeSampleMetadata({
        id: "id-1",
        uploadedAt: "2026-02-21T01:00:00.000Z",
      });
      const m2 = makeSampleMetadata({
        id: "id-2",
        uploadedAt: "2026-02-21T02:00:00.000Z",
      });
      store.save(m1);
      store.save(m2);

      const results = store.findAll();

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toContain("id-1");
      expect(results.map((r) => r.id)).toContain("id-2");
    });

    it("should return records ordered by uploadedAt descending", () => {
      const older = makeSampleMetadata({
        id: "id-old",
        uploadedAt: "2026-01-01T00:00:00.000Z",
      });
      const newer = makeSampleMetadata({
        id: "id-new",
        uploadedAt: "2026-02-21T12:00:00.000Z",
      });
      store.save(older);
      store.save(newer);

      const results = store.findAll();

      expect(results[0].id).toBe("id-new");
      expect(results[1].id).toBe("id-old");
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe("delete", () => {
    it("should delete an existing record and return true", () => {
      const metadata = makeSampleMetadata();
      store.save(metadata);

      const deleted = store.delete(metadata.id);

      expect(deleted).toBe(true);
      expect(store.findById(metadata.id)).toBeUndefined();
    });

    it("should return false when deleting a non-existent id", () => {
      const deleted = store.delete("non-existent-id");

      expect(deleted).toBe(false);
    });

    it("should not affect other records", () => {
      const m1 = makeSampleMetadata({ id: "id-1" });
      const m2 = makeSampleMetadata({ id: "id-2" });
      store.save(m1);
      store.save(m2);

      store.delete("id-1");

      expect(store.findById("id-1")).toBeUndefined();
      expect(store.findById("id-2")).toBeDefined();
    });
  });

  // ─── UPDATE ───────────────────────────────────────────────────────

  describe("update", () => {
    it("should update fields and return the updated metadata", () => {
      const metadata = makeSampleMetadata();
      store.save(metadata);

      const updated = store.update(metadata.id, {
        originalName: "renamed.png",
        mimeType: "image/png",
        size: 204800,
      });

      expect(updated).toBeDefined();
      expect(updated!.originalName).toBe("renamed.png");
      expect(updated!.mimeType).toBe("image/png");
      expect(updated!.size).toBe(204800);
      // Unchanged fields should remain the same
      expect(updated!.id).toBe(metadata.id);
      expect(updated!.s3Key).toBe(metadata.s3Key);
      expect(updated!.s3Bucket).toBe(metadata.s3Bucket);
    });

    it("should persist the update to the database", () => {
      const metadata = makeSampleMetadata();
      store.save(metadata);

      store.update(metadata.id, { originalName: "updated.jpg" });

      const fromDb = store.findById(metadata.id);
      expect(fromDb!.originalName).toBe("updated.jpg");
    });

    it("should return undefined for a non-existent id", () => {
      const result = store.update("non-existent-id", { originalName: "nope" });

      expect(result).toBeUndefined();
    });

    it("should not alter other records", () => {
      const m1 = makeSampleMetadata({ id: "id-1", originalName: "a.jpg" });
      const m2 = makeSampleMetadata({ id: "id-2", originalName: "b.jpg" });
      store.save(m1);
      store.save(m2);

      store.update("id-1", { originalName: "updated.jpg" });

      expect(store.findById("id-2")!.originalName).toBe("b.jpg");
    });
  });

  // ─── COLUMN MAPPING ──────────────────────────────────────────────

  describe("toMetadata (column mapping)", () => {
    it("should correctly map snake_case DB columns to camelCase properties", () => {
      const metadata = makeSampleMetadata({
        originalName: "my file.pdf",
        mimeType: "application/pdf",
        s3Key: "uploads/key.pdf",
        s3Bucket: "my-bucket",
      });
      store.save(metadata);

      const result = store.findById(metadata.id)!;

      expect(result.originalName).toBe("my file.pdf");
      expect(result.mimeType).toBe("application/pdf");
      expect(result.s3Key).toBe("uploads/key.pdf");
      expect(result.s3Bucket).toBe("my-bucket");
    });
  });

  // ─── CLOSE ────────────────────────────────────────────────────────

  describe("close", () => {
    it("should close the database without error", () => {
      expect(() => store.close()).not.toThrow();
    });

    it("should throw when querying after close", () => {
      store.close();

      expect(() => store.findAll()).toThrow();
    });
  });
});
