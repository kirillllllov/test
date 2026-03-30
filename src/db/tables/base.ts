import {
    DeleteCommand,
    GetCommand,
    PutCommand,
    QueryCommand,
    ScanCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { createId } from '@paralleldrive/cuid2';

import { docClient } from '../dynamodb.js';
import { METADATA_SK } from '../types.js';

// Generic Get Item
export async function getItem<T extends Record<string, any>>(
    tableName: string,
    id: string,
    sk: string = METADATA_SK,
): Promise<T | undefined> {
    const result = await docClient.send(
        new GetCommand({
            TableName: tableName,
            Key: { id, sk },
        }),
    );
    return (result.Item as T) || undefined;
}

// Generic Put Item
export async function putItem<T extends Record<string, any>>(
    tableName: string,
    item: T,
): Promise<T> {
    await docClient.send(
        new PutCommand({
            TableName: tableName,
            Item: item,
        }),
    );
    return item;
}

// Generic Update Item
export async function updateItem(
    tableName: string,
    id: string,
    sk: string,
    updates: Record<string, any>,
): Promise<void> {
    const updateExpression = Object.keys(updates)
        .map((key, index) => `#${key} = :val${index}`)
        .join(', ');

    const expressionAttributeNames = Object.fromEntries(
        Object.keys(updates).map(key => [`#${key}`, key]),
    );

    const expressionAttributeValues = Object.fromEntries(
        Object.keys(updates).map((key, index) => [
            `:val${index}`,
            updates[key],
        ]),
    );

    await docClient.send(
        new UpdateCommand({
            TableName: tableName,
            Key: { id, sk },
            UpdateExpression: `SET ${updateExpression}`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
        }),
    );
}

// Generic Delete Item
export async function deleteItem(
    tableName: string,
    id: string,
    sk: string = METADATA_SK,
): Promise<void> {
    await docClient.send(
        new DeleteCommand({
            TableName: tableName,
            Key: { id, sk },
        }),
    );
}

// Generic Query by GSI
export async function queryByGSI<T>(
    tableName: string,
    indexName: string,
    keyConditionExpression: string,
    expressionAttributeValues: Record<string, any>,
    expressionAttributeNames?: Record<string, any>,
): Promise<T[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: tableName,
            IndexName: indexName,
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ExpressionAttributeNames: expressionAttributeNames,
        }),
    );
    return (result.Items as T[]) || [];
}

// Generic Scan (use sparingly!)
export async function scanTable<T>(
    tableName: string,
    limit?: number,
): Promise<T[]> {
    const result = await docClient.send(
        new ScanCommand({
            TableName: tableName,
            Limit: limit,
        }),
    );
    return (result.Items as T[]) || [];
}

// Validate FK exists
export async function validateFKExists(
    tableName: string,
    entityId: string,
): Promise<boolean> {
    const item = await getItem(tableName, entityId);
    return item !== undefined;
}

// Generate CUID
export function generateCuid(): string {
    return createId();
}
