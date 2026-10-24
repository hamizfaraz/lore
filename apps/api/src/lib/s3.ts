import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env';

/** Vultr Object Storage (S3-compatible). Bucket is private; reads use 1-hour signed GETs (section 4). */
let client: S3Client | null = null;
export function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: true,
      credentials:
        env.S3_ACCESS_KEY && env.S3_SECRET_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY }
          : undefined,
    });
  }
  return client;
}

export const s3Configured = () => Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

export async function presignPut(key: string, mime: string, expiresIn = 300) {
  const url = await getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: mime }),
    { expiresIn },
  );
  return { url, headers: { 'Content-Type': mime } };
}

export async function presignGet(key: string, expiresIn = 3600) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn });
}

export async function putObject(key: string, body: Buffer, mime: string) {
  await s3().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: mime }));
}

export async function getObject(key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return Buffer.from(bytes);
}

export async function headObject(key: string) {
  return s3().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
