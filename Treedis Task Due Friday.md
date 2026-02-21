# NodeJS Developer Interview Task: Custom Media Service

## Requirements

Create a NodeJS application without Express that provides a media management service with the following features:

1. **Custom HTTP Server**
   - Implement a basic router for handling API endpoints
   - Support for common HTTP methods (GET, POST, PUT, DELETE)

2. **Media Operations**
   - Create: Upload media files to AWS S3
   - Read: Retrieve media files from S3
   - Update: Replace media files
   - Delete: Remove media files from storage

3. **AWS S3 Integration**
   - Upload files to S3 using the AWS SDK
   - Handle large file uploads efficiently
   - Basic error handling

4. **Basic Features**
   - Store metadata about uploaded files
   - Implement simple file type validation

## Technical Requirements

- Use only native NodeJS modules and AWS SDK (no Express)
- Implement error handling for common scenarios
- Include simple logging
- Document your API in a README file


## Deliverables

1. Source code in a Git repository
2. README with setup instructions
3. Brief explanation of how to use the API