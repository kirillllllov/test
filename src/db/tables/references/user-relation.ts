import { createId } from '@paralleldrive/cuid2';

import {
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
    type UserRelationToAppeal,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createUserRelationToAppeal(
    input: ReferenceCreateInput,
): Promise<UserRelationToAppeal> {
    const id = createEntityId('RELATION', createId());

    const relation: UserRelationToAppeal = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.USER_RELATIONS, relation);
    return relation;
}

export async function getUserRelationById(
    relationId: string,
): Promise<UserRelationToAppeal | undefined> {
    return getItem<UserRelationToAppeal>(
        TABLE_NAMES.USER_RELATIONS,
        relationId,
    );
}

export async function getUserRelationByName(
    name: string,
): Promise<UserRelationToAppeal | undefined> {
    const relations = await queryByGSI<UserRelationToAppeal>(
        TABLE_NAMES.USER_RELATIONS,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return relations[0] || undefined;
}

export async function deleteUserRelation(relationId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.USER_RELATIONS, relationId);
}
