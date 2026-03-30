import { createId } from '@paralleldrive/cuid2';

import {
    type AppealSoftware,
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createAppealSoftware(
    input: ReferenceCreateInput,
): Promise<AppealSoftware> {
    const id = createEntityId('SOFTWARE', createId());

    const software: AppealSoftware = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.APPEAL_SOFTWARE, software);
    return software;
}

export async function getAppealSoftwareById(
    softwareId: string,
): Promise<AppealSoftware | undefined> {
    return getItem<AppealSoftware>(TABLE_NAMES.APPEAL_SOFTWARE, softwareId);
}

export async function getAppealSoftwareByName(
    name: string,
): Promise<AppealSoftware | undefined> {
    const software = await queryByGSI<AppealSoftware>(
        TABLE_NAMES.APPEAL_SOFTWARE,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return software[0] || undefined;
}

export async function deleteAppealSoftware(softwareId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.APPEAL_SOFTWARE, softwareId);
}
