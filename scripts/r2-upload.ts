/**
 * Shared helper for uploading files to Cloudflare R2.
 * Uses the S3-compatible API.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID      — Cloudflare account ID (visible in the R2 dashboard URL)
 *   R2_ACCESS_KEY_ID   — R2 API token access key
 *   R2_SECRET_ACCESS_KEY — R2 API token secret
 *   R2_BUCKET          — bucket name (e.g. fisiaprep-audio)
 *   R2_PUBLIC_URL      — public base URL of the bucket
 *                        (e.g. https://pub-xxxx.r2.dev  or  https://audio.yourdomain.com)
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID not set");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

export async function uploadToR2(
  key: string,
  data: Buffer,
  contentType = "application/octet-stream",
): Promise<string> {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET not set");
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!publicUrl) throw new Error("R2_PUBLIC_URL not set");

  const client = getClient();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }),
  );
  return `${publicUrl}/${key}`;
}
