import {
    CopyObjectCommand,
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import * as Minio from 'minio';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
const minioPort = process.env.MINIO_PORT
    ? Number(process.env.MINIO_PORT)
    : 9000;
const minioUseSSL = process.env.MINIO_USE_SSL === 'true';
const protocol = minioUseSSL ? 'https://' : 'http://';

const endpoint = process.env.MINIO_ENDPOINT?.startsWith('http')
    ? process.env.MINIO_ENDPOINT
    : `${protocol}${minioEndpoint}:${minioPort}`;

const s3 = new S3Client({
    endpoint,
    region: process.env.MINIO_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true, // важно для MinIO
});

export const uploadTempFile = async (fileBuffer: Buffer, fileName: string) => {
    const tempKey = `temp/${Date.now()}-${fileName}`;
    await s3.send(
        new PutObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: tempKey,
            Body: fileBuffer,
        }),
    );
    return tempKey;
};

export const moveTempToAppeal = async (tempKey: string, appealId: string) => {
    const newKey = `appeals/${appealId}/${tempKey.split('/').pop()}`;
    await s3.send(
        new CopyObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            CopySource: `${process.env.S3_BUCKET}/${tempKey}`,
            Key: newKey,
        }),
    );
    await s3.send(
        new DeleteObjectCommand({
            Bucket: process.env.S3_BUCKET!,
            Key: tempKey,
        }),
    );
    return newKey;
};
