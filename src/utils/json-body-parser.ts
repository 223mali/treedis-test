import * as http from "http";

/**
 * Reads the full request body and parses it as JSON.
 */
export function parseJsonBody<T = unknown>(
  req: http.IncomingMessage,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("error", (err) => reject(err));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8");
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}
