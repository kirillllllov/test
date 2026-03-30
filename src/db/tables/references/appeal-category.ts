import { createId } from '@paralleldrive/cuid2';

import {
    type AppealCategory,
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createAppealCategory(
    input: ReferenceCreateInput,
): Promise<AppealCategory> {
    const id = createEntityId('CATEGORY', createId());

    const category: AppealCategory = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.APPEAL_CATEGORIES, category);
    return category;
}

export async function getAppealCategoryById(
    categoryId: string,
): Promise<AppealCategory | undefined> {
    return getItem<AppealCategory>(TABLE_NAMES.APPEAL_CATEGORIES, categoryId);
}

export async function getAppealCategoryByName(
    name: string,
): Promise<AppealCategory | undefined> {
    const categories = await queryByGSI<AppealCategory>(
        TABLE_NAMES.APPEAL_CATEGORIES,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return categories[0] || undefined;
}

export async function deleteAppealCategory(categoryId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.APPEAL_CATEGORIES, categoryId);
}
