import type { AppealContext } from './dynamo-service.js';
import { createAppeal } from './dynamo-service.js';
import { moveTempToAppeal } from './s3-service.js';

export const saveAppealToDB = async (ctx: AppealContext) => {
    const appealId = await createAppeal(ctx);

    // Переносим все временные файлы
    const finalAttachments = [];
    for (const tempKey of ctx.attachments || []) {
        const newKey = await moveTempToAppeal(tempKey, appealId);
        finalAttachments.push(newKey);
    }

    return { appealId, attachments: finalAttachments };
};
