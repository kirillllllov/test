import { createId } from '@paralleldrive/cuid2';

import {
    type AppealStatus,
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createAppealStatus(
    input: ReferenceCreateInput,
): Promise<AppealStatus> {
    const id = createEntityId('STATUS', createId());

    const status: AppealStatus = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.APPEAL_STATUSES, status);
    return status;
}

export async function getAppealStatusById(
    statusId: string,
): Promise<AppealStatus | undefined> {
    return getItem<AppealStatus>(TABLE_NAMES.APPEAL_STATUSES, statusId);
}

export async function getAppealStatusByName(
    name: string,
): Promise<AppealStatus | undefined> {
    const statuses = await queryByGSI<AppealStatus>(
        TABLE_NAMES.APPEAL_STATUSES,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return statuses[0] || undefined;
}

export async function deleteAppealStatus(statusId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.APPEAL_STATUSES, statusId);
}
