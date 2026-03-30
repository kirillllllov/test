import { createId } from '@paralleldrive/cuid2';

import {
    type Appeal,
    type AppealCreateInput,
    createEntityId,
    METADATA_SK,
    TABLE_NAMES,
} from '../types.js';
import {
    getItem,
    putItem,
    queryByGSI,
    updateItem,
    validateFKExists,
} from './base.js';

export async function createAppeal(input: AppealCreateInput): Promise<Appeal> {
    // Validate all FKs
    const validations = await Promise.all([
        validateFKExists(
            TABLE_NAMES.APPEAL_SUBDIVISIONS,
            input.appealSubdivisionId,
        ),
        validateFKExists(TABLE_NAMES.APPEAL_CATEGORIES, input.appealCategoryId),
        validateFKExists(TABLE_NAMES.APPEAL_SOFTWARE, input.appealSoftwareId),
        validateFKExists(TABLE_NAMES.APPEAL_STATUSES, input.appealStatusId),
        validateFKExists(
            TABLE_NAMES.APPEAL_CRITICALITY,
            input.appealCriticalityId,
        ),
    ]);

    if (validations.some(v => !v)) {
        throw new Error('One or more foreign keys are invalid');
    }

    if (input.solutionId) {
        const solutionExists = await validateFKExists(
            TABLE_NAMES.SOLUTIONS,
            input.solutionId,
        );
        if (!solutionExists) {
            throw new Error(`Solution ${input.solutionId} does not exist`);
        }
    }

    const id = createEntityId('APPEAL', createId());
    const now = new Date().toISOString();

    const appeal: Appeal = {
        id,
        sk: METADATA_SK,
        textOfTheAppeal: input.textOfTheAppeal,
        createdAt: now,
        updatedAt: now,
        appealSubdivisionId: input.appealSubdivisionId,
        appealCategoryId: input.appealCategoryId,
        appealSoftwareId: input.appealSoftwareId,
        appealStatusId: input.appealStatusId,
        appealCriticalityId: input.appealCriticalityId,
        ...(input.solutionId ? { solutionId: input.solutionId } : {}),
    };

    await putItem(TABLE_NAMES.APPEALS, appeal);
    return appeal;
}

export async function getAppealById(
    appealId: string,
): Promise<Appeal | undefined> {
    return getItem<Appeal>(TABLE_NAMES.APPEALS, appealId);
}

export async function getAppealsByStatus(statusId: string): Promise<Appeal[]> {
    return queryByGSI<Appeal>(
        TABLE_NAMES.APPEALS,
        'StatusIndex',
        'appealStatusId = :statusId',
        { ':statusId': statusId },
    );
}

export async function getAppealsByCategory(
    categoryId: string,
): Promise<Appeal[]> {
    return queryByGSI<Appeal>(
        TABLE_NAMES.APPEALS,
        'CategoryIndex',
        'appealCategoryId = :categoryId',
        { ':categoryId': categoryId },
    );
}

export async function updateAppeal(
    appealId: string,
    updates: Partial<Omit<Appeal, 'id' | 'sk' | 'createdAt'>>,
): Promise<void> {
    const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await updateItem(
        TABLE_NAMES.APPEALS,
        appealId,
        METADATA_SK,
        updatesWithTimestamp,
    );
}

export async function deleteAppeal(appealId: string): Promise<void> {
    // Soft delete
    await updateItem(TABLE_NAMES.APPEALS, appealId, METADATA_SK, {
        deletedAt: new Date().toISOString(),
    });
}
