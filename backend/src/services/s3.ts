import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  GetObjectAclCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  ...(process.env.AWS_S3_ENDPOINT_URL && {
    endpoint: process.env.AWS_S3_ENDPOINT_URL,
    forcePathStyle: true, // MinIO / LocalStack 等の互換エンドポイント向け
  }),
});

const bucketName = process.env.S3_BUCKET_NAME || 'redmine-uploads';

/**
 * コメント等の添付アップロード（`attachments` ルート）と同一規則の S3 オブジェクトキー。
 * `uploads/<timestamp>-<random>-<元のファイル名>`
 */
export function buildUploadS3Key(originalFilename: string): string {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
  return `uploads/${uniqueSuffix}-${originalFilename}`;
}

export async function uploadFileToS3(
  key: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  // Ensure bucket exists (helpful for local MinIO setup)
  try {
    const { HeadBucketCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        console.log(`Bucket ${bucketName} not found. Creating...`);
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
      } else {
        throw err;
      }
    }
  } catch (err) {
    console.warn('Bucket existence check failed:', err);
    // Continue anyway, putObject might still work if permissions are different
  }

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return key;
}

export async function getFileFromS3(key: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  const response = await s3Client.send(command);
  if (!response.Body) {
    throw new Error('ファイルが見つかりません');
  }

  const stream = response.Body as Readable;
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export async function deleteFileFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  await s3Client.send(command);
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
}

export function getS3FileUrl(key: string): string {
  return `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}
