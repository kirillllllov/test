import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

import { docClient, TABLE_NAME } from '../config/dynamo-db.js';

export class CounterService {
    async getCurrentCount(): Promise<number> {
        try {
            const command = new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: 'COUNTER',
                    sk: 'MAIN',
                },
            });

            const result = await docClient.send(command);
            return result.Item?.count || 0;
        } catch (error) {
            console.error('Ошибка получения счетчика:', error);
            return 0;
        }
    }

    async incrementCounter(): Promise<number> {
        try {
            const command = new UpdateCommand({
                TableName: TABLE_NAME,
                Key: {
                    pk: 'COUNTER',
                    sk: 'MAIN',
                },
                UpdateExpression: 'ADD #count :inc SET #updatedAt = :now',
                ExpressionAttributeNames: {
                    '#count': 'count',
                    '#updatedAt': 'updatedAt',
                },
                ExpressionAttributeValues: {
                    ':inc': 1,
                    ':now': new Date().toISOString(),
                },
                ReturnValues: 'ALL_NEW',
            });

            const result = await docClient.send(command);
            return result.Attributes?.count || 0;
        } catch (error: any) {
            // Если записи нет - создаём первую
            if (error.name === 'ResourceNotFoundException') {
                await this.createCounter();
                return 1;
            }
            console.error('Ошибка инкремента счетчика:', error);
            return 0;
        }
    }

    private async createCounter(): Promise<void> {
        try {
            const command = new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'COUNTER',
                    sk: 'MAIN',
                    count: 1,
                    updatedAt: new Date().toISOString(),
                },
            });

            await docClient.send(command);
        } catch (error) {
            console.error('Ошибка создания счетчика:', error);
        }
    }

    async resetCounter(): Promise<void> {
        try {
            const command = new PutCommand({
                TableName: TABLE_NAME,
                Item: {
                    pk: 'COUNTER',
                    sk: 'MAIN',
                    count: 0,
                    updatedAt: new Date().toISOString(),
                },
            });

            await docClient.send(command);
        } catch (error) {
            console.error('Ошибка сброса счетчика:', error);
        }
    }
}

export default new CounterService();
