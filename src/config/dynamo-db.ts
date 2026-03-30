import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

// Проверяем загруженные переменные
console.log('🔍 Проверка переменных окружения:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DYNAMODB_ENDPOINT:', process.env.DYNAMODB_ENDPOINT);
console.log('DYNAMODB_REGION:', process.env.DYNAMODB_REGION);

const isLocal = process.env.NODE_ENV !== 'production';

const endpoint =
    process.env.DYNAMODB_ENDPOINT ||
    (isLocal ? 'http://localhost:8000' : undefined);
const region =
    process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1';
const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID || (isLocal ? 'fake' : undefined);
const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY || (isLocal ? 'fake' : undefined);

console.log('🔧 DynamoDB Configuration:', {
    isLocal,
    endpoint,
    region,
});

export const dynamoDBClient = new DynamoDBClient({
    endpoint,
    region,
    credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
    },
} as any);

export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'support-bot-table';
