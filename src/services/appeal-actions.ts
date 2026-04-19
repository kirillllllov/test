import type { AppealContext } from './dynamo-service.js';
import { createAppeal } from './dynamo-service.js';
import { moveTempToAppeal } from './s3-service.js';
import { changeAppealStatus, getAppealById } from '../db/tables/appeal.js';
import { getAppealStatusById } from '../db/tables/references/appeal-status.js';
import { APPEAL_STATUS_NAMES } from '../db/types.js';

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


/**
 * Изменить статус обращения.
 *
 * Бизнес-правила:
 * - Обращение со статусом "Закрыт" (Closed) не может быть изменено.
 * - Новый статус должен существовать в таблице статусов.
 *
 * @param appealId  - ID обращения (формат: APPEAL#<cuid>)
 * @param newStatusId - ID нового статуса (формат: STATUS#<cuid>)
 */
export async function updateAppealStatus(
    appealId: string,
    newStatusId: string,
): Promise<void> {
    const appeal = await getAppealById(appealId);
    if (!appeal) {
        throw new Error(`Обращение ${appealId} не найдено`);
    }
    // Проверяем текущий статус: закрытые обращения нельзя изменить
    const currentStatus = await getAppealStatusById(appeal.appealStatusId);
    if (currentStatus?.name === APPEAL_STATUS_NAMES.CLOSED) {
        throw new Error(
            `Невозможно изменить статус закрытого обращения ${appealId}`,
        );
    }
    // Делегируем DB-слою (там проверяется существование нового статуса)
    await changeAppealStatus(appealId, newStatusId);
}