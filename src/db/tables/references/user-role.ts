import { createId } from '@paralleldrive/cuid2';

import {
    createEntityId,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
    type UserRole,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createUserRole(
    input: ReferenceCreateInput,
): Promise<UserRole> {
    const id = createEntityId('ROLE', createId());

    const role: UserRole = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.USER_ROLES, role);
    return role;
}

export async function getUserRoleById(
    roleId: string,
): Promise<UserRole | undefined> {
    return getItem<UserRole>(TABLE_NAMES.USER_ROLES, roleId);
}

export async function getUserRoleByName(
    name: string,
): Promise<UserRole | undefined> {
    const roles = await queryByGSI<UserRole>(
        TABLE_NAMES.USER_ROLES,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return roles[0] || undefined;
}

export async function deleteUserRole(roleId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.USER_ROLES, roleId);
}
