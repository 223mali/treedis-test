export interface FileMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  s3Key: string;
  s3Bucket: string;
  uploadedAt: string;
}
