import { IsNotEmpty, IsString, IsIn } from "class-validator";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
];

export class UploadFileDto {
  @IsString()
  @IsNotEmpty({ message: "filename is required" })
  filename!: string;

  @IsString()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: `mimeType must be one of: ${ALLOWED_MIME_TYPES.join(", ")}`,
  })
  mimeType!: string;
}
