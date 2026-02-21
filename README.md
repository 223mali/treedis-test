# Media Management Service

A custom Node.js media management service built with TypeScript, featuring an HTTP server without Express and AWS S3 integration.

## Project Structure

```
src/
  server.ts       # Main HTTP server with custom router
dist/             # Compiled JavaScript output
```

## Setup Instructions

### Prerequisites

- Node.js 14+
- npm or yarn
- AWS credentials (for S3 operations)

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file for AWS configuration:
   ```
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   S3_BUCKET=your-bucket-name
   PORT=3000
   ```

## Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

- **GET** `/health`
  - Response: `{ "status": "healthy", "timestamp": "2026-02-21T08:01:08.348Z" }`
  - Status: 200 OK

## Features (In Progress)

- ✅ Custom HTTP Server with basic routing
- ✅ Health check endpoint
- 🔄 Media upload to AWS S3
- 🔄 Media retrieval from S3
- 🔄 Media updates
- 🔄 Media deletion
- 🔄 File metadata storage
- 🔄 File type validation
- 🔄 Error handling and logging

## Technical Stack

- **Language**: TypeScript
- **Runtime**: Node.js (native http module)
- **Storage**: AWS S3
- **AWS SDK**: v2
- **Development**: ts-node, typescript

## Development Notes

- Uses native Node.js `http` module (no Express)
- Custom router implementation for API endpoints
- Strict TypeScript configuration for type safety
