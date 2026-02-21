# Media Management Service

A custom Node.js media management service built with TypeScript. Uses the native `http` module (no Express), AWS S3 for file storage, SQLite for metadata persistence, and Swagger UI for interactive API documentation.

## Project Structure

```
src/
├── server.ts                  # Composition root — wires all dependencies
├── http-server.ts             # HTTP server with timeout & error handling
├── router.ts                  # Custom router (find-my-way)
├── config.ts                  # Environment-based configuration with validation
├── logger.ts                  # Pino-based structured logger
├── controllers/
│   ├── health.controller.ts   # GET /health
│   ├── media.controller.ts    # CRUD endpoints for media files
│   └── swagger.controller.ts  # Serves Swagger UI at /api-docs
├── services/
│   ├── s3.service.ts          # AWS S3 upload / download / delete
│   ├── file-validator.service.ts  # MIME-type, size & magic-byte validation
│   ├── metadata-store.service.ts  # SQLite-backed file metadata store
│   └── __tests__/             # Unit tests (Jest)
├── models/
│   └── file-metadata.model.ts
├── dtos/
│   └── upload-file.dto.ts
├── errors/
│   └── app-error.ts           # Typed HTTP errors (400, 404, 413, 415, 500)
├── utils/
│   ├── multipart-parser.ts    # Busboy-based multipart/form-data parser
│   ├── json-body-parser.ts
│   └── validate.ts
└── swagger/
    ├── swagger.ts             # swagger-autogen config
    └── swagger-output.json    # Generated OpenAPI 3.0 spec
```

## Prerequisites

- Node.js ≥ 18
- npm
- AWS credentials with S3 access

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
S3_BUCKET=your-bucket-name

# Database
DB_PATH=media.db

# Limits
MAX_FILE_SIZE_BYTES=10485760   # 10 MB
REQUEST_TIMEOUT_MS=30000       # 30 s
```

### 3. Run the server

**Development** (auto-generates Swagger docs, then starts with ts-node):

```bash
npm run dev
```

**Production**:

```bash
npm run build
npm start
```

## Scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm run dev`     | Generate Swagger docs & start dev server |
| `npm run build`   | Compile TypeScript to `dist/`            |
| `npm start`       | Run compiled server from `dist/`         |
| `npm run swagger` | Regenerate `swagger-output.json`         |
| `npm test`        | Run all unit tests                       |

## API Endpoints

Interactive documentation is available at **http://localhost:3000/api-docs** when the server is running.

### Health

| Method | Path      | Description                   |
| ------ | --------- | ----------------------------- |
| GET    | `/health` | Returns service health status |

### Media

| Method | Path            | Description                         |
| ------ | --------------- | ----------------------------------- |
| POST   | `/media/upload` | Upload a file (multipart/form-data) |
| GET    | `/media`        | List all uploaded files (metadata)  |
| GET    | `/media/:id`    | Download a file by ID               |
| PUT    | `/media/:id`    | Replace an existing file            |
| DELETE | `/media/:id`    | Delete a file                       |

**Allowed file types:** JPEG, PNG, GIF, PDF

### Example — Upload

```bash
curl -X POST http://localhost:3000/media/upload \
  -F "file=@photo.jpg"
```

### Example — Download

```bash
curl http://localhost:3000/media/<file-id> --output photo.jpg
```

## Testing

Unit tests use **Jest** with **ts-jest** and cover:

- `MetadataStore` — SQLite CRUD operations (in-memory DB)
- `S3Service` — upload / download / delete with mocked AWS SDK
- `FileValidator` — MIME-type checks, size limits, magic-byte verification

```bash
npm test
```

## Technical Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Language     | TypeScript (strict mode)            |
| Runtime      | Node.js — native `http` module      |
| Routing      | find-my-way                         |
| File Storage | AWS S3 (SDK v3)                     |
| Metadata DB  | SQLite via better-sqlite3           |
| Validation   | class-validator / class-transformer |
| File Parsing | Busboy (multipart/form-data)        |
| Logging      | Pino (+ pino-pretty for dev)        |
| API Docs     | swagger-autogen + swagger-ui-dist   |
| Testing      | Jest + ts-jest                      |
