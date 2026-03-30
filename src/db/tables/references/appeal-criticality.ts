import { createId } from '@paralleldrive/cuid2';

import {
    type AppealCriticality,
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createAppealCriticality(
    input: ReferenceCreateInput,
): Promise<AppealCriticality> {
    const id = createEntityId('CRITICALITY', createId());

    const criticality: AppealCriticality = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.APPEAL_CRITICALITY, criticality);
    return criticality;
}

export async function getAppealCriticalityById(
    criticalityId: string,
): Promise<AppealCriticality | undefined> {
    return getItem<AppealCriticality>(
        TABLE_NAMES.APPEAL_CRITICALITY,
        criticalityId,
    );
}

export async function getAppealCriticalityByName(
    name: string,
): Promise<AppealCriticality | undefined> {
    const criticality = await queryByGSI<AppealCriticality>(
        TABLE_NAMES.APPEAL_CRITICALITY,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return criticality[0] || undefined;
}

export async function deleteAppealCriticality(
    criticalityId: string,
): Promise<void> {
    await deleteItem(TABLE_NAMES.APPEAL_CRITICALITY, criticalityId);
}
