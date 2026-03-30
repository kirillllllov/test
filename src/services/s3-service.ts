import {
    CopyObjectCommand,
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
const minioPort = process.env.MINIO_PORT
    ? Number(process.env.MINIO_PORT)
    : 9000;
const minioUseSSL = process.env.MINIO_USE_SSL === 'true';
const protocol = minioUseSSL ? 'https://' : 'http://';

const endpoint = process.env.MINIO_ENDPOINT?.startsWith('http')
    ? process.env.MINIO_ENDPOINT
    : `${protocol}${minioEndpoint}:${minioPort}`;

const bucket =
    process.env.MINIO_BUCKET || process.env.S3_BUCKET || 'support-bot-files';

const s3 = new S3Client({
    endpoint,
    region: process.env.MINIO_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    },
    forcePathStyle: true,
});

/**
 * Загрузить файл (буфер) во временную папку S3/MinIO.
 * Возвращает ключ объекта (путь внутри бакета).
 */
export const uploadTempFile = async (
    fileBuffer: Buffer,
    fileName: string,
): Promise<string> => {
    const tempKey = `temp/${Date.now()}-${fileName}`;
    await s3.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: tempKey,
            Body: fileBuffer,
        }),
    );
    return tempKey;
};

/**
 * Загрузить файл из Base64-строки во временную папку.
 * Возвращает публичный URL объекта.
 */
export const uploadBase64File = async (
    base64: string,
    fileName: string,
): Promise<string> => {
    const buffer = Buffer.from(base64, 'base64');
    const key = await uploadTempFile(buffer, fileName);
    return `${endpoint}/${bucket}/${key}`;
};

/**
 * Загрузить массив Base64-изображений и вернуть их публичные URL.
 */
export const uploadBase64Images = async (
    attachmentsBase64: string[],
): Promise<string[]> => {
    const urls = await Promise.all(
        attachmentsBase64.map((b64, index) =>
            uploadBase64File(b64, `image-${Date.now()}-${index}.jpg`),
        ),
    );
    return urls;
};

/**
 * Переместить файл из временной папки в постоянную (для обращения).
 */
export const moveTempToAppeal = async (
    tempKey: string,
    appealId: string,
): Promise<string> => {
    const newKey = `appeals/${appealId}/${tempKey.split('/').pop()}`;
    await s3.send(
        new CopyObjectCommand({
            Bucket: bucket,
            CopySource: `${bucket}/${tempKey}`,
            Key: newKey,
        }),
    );
    await s3.send(
        new DeleteObjectCommand({
            Bucket: bucket,
            Key: tempKey,
        }),
    );
    return newKey;
};
