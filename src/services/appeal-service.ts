import { QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

import { docClient, TABLE_NAME } from '../config/dynamo-db.js';

export interface Appeal {
    id: string;
    title?: string;
    description?: string;
    status?: string;
    user_id?: string;
    participants?: string[];
    created_at?: string;
}

const ddb = docClient;

/**
 * Перечислить открытые (in_progress) обращения и отформатировать читаемое сообщение.
 * Если существует GSI `status-createdAt-index`, он будет использован; в противном случае используется Scan.
 */
export async function listRequestsForUser(
    currentUserId: string | undefined,
): Promise<string> {
    if (!currentUserId)
        return 'Необходимо авторизоваться, чтобы увидеть обращения.';

    const table = TABLE_NAME;

    const params = {
        removeUndefinedValues: true,
        TableName: table,
        IndexName: 'status-createdAt-index',
        KeyConditionExpression: '#status = :inProgress',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':inProgress': 'in_progress' },
        ScanIndexForward: false,
        Limit: 20,
    } as any;

    let items: Appeal[] = [];

    const isLocal =
        !!process.env.DYNAMODB_ENDPOINT ||
        process.env.NODE_ENV !== 'production';

    if (isLocal) {
        // Для локального DynamoDB (и тестов) предпочитаем Scan, чтобы избежать потенциальных проблем с GSI/query
        // и подписью креденшлов в SDK в некоторых конфигурациях.
        try {
            const scanRes = await ddb.send(
                new ScanCommand({
                    TableName: table,
                    FilterExpression: '#status = :inProgress',
                    ExpressionAttributeNames: { '#status': 'status' },
                    ExpressionAttributeValues: { ':inProgress': 'in_progress' },
                    Limit: 50,
                }),
            );
            items = (scanRes.Items || []) as Appeal[];
        } catch (error) {
            console.error('Failed to fetch appeals:', error);
            return 'Ошибка при получении обращений. Попробуйте позже.';
        }
    } else {
        try {
            const res = await ddb.send(new QueryCommand(params));
            items = (res.Items || []) as Appeal[];
        } catch {
            // Если Query не удался (нет GSI), используем Scan с FilterExpression.
            try {
                const scanRes = await ddb.send(
                    new ScanCommand({
                        TableName: table,
                        FilterExpression: '#status = :inProgress',
                        ExpressionAttributeNames: { '#status': 'status' },
                        ExpressionAttributeValues: {
                            ':inProgress': 'in_progress',
                        },
                        Limit: 50,
                    }),
                );
                items = (scanRes.Items || []) as Appeal[];
            } catch (error) {
                console.error('Failed to fetch appeals:', error);
                return 'Ошибка при получении обращений. Попробуйте позже.';
            }
        }
    }

    if (!items || items.length === 0) return 'Нет обращений в работе.';

    const lines = items.map(req => {
        const createdAtDate = req.created_at
            ? new Date(req.created_at)
            : undefined;
        const createdAtFormatted = createdAtDate
            ? createdAtDate.toLocaleDateString()
            : 'Неизвестно';

        const snippet = `ID: ${req.id}\nНазвание: ${req.title || '(нет названия)'}\nОписание: ${req.description || '(без описания)'}\nСоздано: ${createdAtFormatted}`;

        const isAuthor =
            req.user_id && currentUserId && req.user_id === currentUserId;
        const isJoined =
            req.participants &&
            Array.isArray(req.participants) &&
            req.participants.includes(currentUserId!);

        if (isAuthor) {
            return `★ **${req.title || '(без названия)'}**\n${snippet}`;
        }
        if (isJoined) {
            return `**${req.title || '(без названия)'}**\n${snippet}`;
        }
        return snippet;
    });

    return lines.join('\n\n');
}

export default { listRequestsForUser };
