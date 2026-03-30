import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const isLocal = process.env.NODE_ENV !== 'production';

console.log('🔍 DynamoDB Configuration Check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log(
    'Endpoint:',
    process.env.DYNAMODB_ENDPOINT ||
        (isLocal ? 'http://localhost:8000' : 'undefined'),
);

const endpoint =
    process.env.DYNAMODB_ENDPOINT ||
    (isLocal ? 'http://localhost:8000' : undefined);
const region =
    process.env.DYNAMODB_REGION || process.env.AWS_REGION || 'us-east-1';
const accessKeyId =
    process.env.AWS_ACCESS_KEY_ID || (isLocal ? 'fake' : 'undefined');
const secretAccessKey =
    process.env.AWS_SECRET_ACCESS_KEY || (isLocal ? 'fake' : 'undefined');

export const dynamoDBClient = new DynamoDBClient({
    region,
    ...(endpoint ? { endpoint } : {}),
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
});

export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
    },
    unmarshallOptions: {
        wrapNumbers: false,
    },
});
