import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { createId } from '@paralleldrive/cuid2';

import { docClient, TABLE_NAME } from '../config/dynamo-db.js';
import { TABLE_NAMES } from '../db/types.js';

export interface AppealContext {
    appealId?: string;
    userId: string | undefined;
    description?: string;
    category?: string;
    software?: string;
    criticality?: string;
    attachments?: string[];
}




/**
 * Создать новое обращение в DynamoDB
 */
export async function createAppeal(ctx: AppealContext): Promise<string> {
    const appealId = ctx.appealId || createId();
    const timestamp = new Date().toISOString();

    // ❗ ВАЖНО: Sort Key должен быть 'sk', а не 'user_id'
    // 'sk' (Sort Key) должен иметь предсказуемую структуру
    const sortKey = `APPEAL#${timestamp}`; // или другая структура

    // Если userId не указан, создаем временный
    const userId = ctx.userId || `anonymous_${createId()}`;

    const appeal = {
        // Ключевые атрибуты (обязательные)
        id: appealId, // Partition Key (HASH)
        sk: sortKey, // Sort Key (RANGE) - ДОЛЖНО БЫТЬ 'sk'!

        // Атрибуты обращения
        user_id: userId, // Теперь это просто атрибут, не ключ
        title: `Обращение от ${userId.replace('anonymous_', 'Аноним')}`,
        description: ctx.description || '',
        category: ctx.category || 'Общее',
        software: ctx.software || 'Н/Д',
        criticality: ctx.criticality || 'Нормальная',
        status: 'in_progress',
        created_at: timestamp,
        updated_at: timestamp,
        participants: ctx.userId ? [ctx.userId] : [],
        attachments: ctx.attachments || [],

        // Для индексов
        appealStatusId: 'in_progress', // Для GSI StatusIndex
        appealCategoryId: ctx.category || 'general', // Для GSI CategoryIndex
        createdAt: timestamp, // Для GSI
    };

    console.log(`📝 Attempting to save to table: ${TABLE_NAMES.APPEALS}`); // Используйте правильное имя
    console.log(`📝 Appeal data:`, JSON.stringify(appeal, undefined, 2));

    try {
        await docClient.send(
            new PutCommand({
                TableName: TABLE_NAMES.APPEALS, // Используйте константу из types.js
                Item: appeal,
            }),
        );
        console.log(`✅ Обращение ${appealId} создано в базе данных`);
        return appealId;
    } catch (error: any) {
        console.error(`❌ Ошибка при сохранении:`, error.message);
        console.error(`❌ Проверьте что переданы ключи: id и sk`);
        throw error;
    }
}

export default { createAppeal };
