import { createId } from '@paralleldrive/cuid2';

import {
    type AppealSubdivision,
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createAppealSubdivision(
    input: ReferenceCreateInput,
): Promise<AppealSubdivision> {
    const id = createEntityId('SUBDIVISION', createId());

    const subdivision: AppealSubdivision = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.APPEAL_SUBDIVISIONS, subdivision);
    return subdivision;
}

export async function getAppealSubdivisionById(
    subdivisionId: string,
): Promise<AppealSubdivision | undefined> {
    return getItem<AppealSubdivision>(
        TABLE_NAMES.APPEAL_SUBDIVISIONS,
        subdivisionId,
    );
}

export async function getAppealSubdivisionByName(
    name: string,
): Promise<AppealSubdivision | undefined> {
    const subdivisions = await queryByGSI<AppealSubdivision>(
        TABLE_NAMES.APPEAL_SUBDIVISIONS,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return subdivisions[0] || undefined;
}

export async function deleteAppealSubdivision(
    subdivisionId: string,
): Promise<void> {
    await deleteItem(TABLE_NAMES.APPEAL_SUBDIVISIONS, subdivisionId);
}
