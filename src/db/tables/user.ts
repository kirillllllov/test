import { createId } from '@paralleldrive/cuid2';

import {
    createEntityId,
    METADATA_SK,
    TABLE_NAMES,
    type User,
    type UserCreateInput,
} from '../types.js';
import {
    deleteItem,
    getItem,
    putItem,
    queryByGSI,
    updateItem,
    validateFKExists,
} from './base.js';

// Create User
export async function createUser(input: UserCreateInput): Promise<User> {
    // Validate role exists
    const roleExists = await validateFKExists(
        TABLE_NAMES.USER_ROLES,
        input.roleId,
    );
    if (!roleExists) {
        throw new Error(`Role ${input.roleId} does not exist`);
    }

    const id = createEntityId('USER', createId());
    const now = new Date().toISOString();

    const user: User = {
        id,
        sk: METADATA_SK,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        hashedPassword: input.hashedPassword,
        roleId: input.roleId,
        createdAt: now,
        updatedAt: now,
    };

    await putItem(TABLE_NAMES.USERS, user);
    return user;
}

// Get User by ID
export async function getUserById(userId: string): Promise<User | undefined> {
    return getItem<User>(TABLE_NAMES.USERS, userId);
}

// Get User by Email (using GSI)
export async function getUserByEmail(email: string): Promise<User | undefined> {
    const users = await queryByGSI<User>(
        TABLE_NAMES.USERS,
        'EmailIndex',
        '#email = :email',
        { ':email': email.toLowerCase() },
        { '#email': 'email' },
    );
    return users[0] || undefined;
}

// Get Users by Role (using GSI)
export async function getUsersByRole(roleId: string): Promise<User[]> {
    return queryByGSI<User>(
        TABLE_NAMES.USERS,
        'RoleIndex',
        'roleId = :roleId',
        { ':roleId': roleId },
    );
}

// Update User
export async function updateUser(
    userId: string,
    updates: Partial<Omit<User, 'id' | 'sk' | 'createdAt'>>,
): Promise<void> {
    const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await updateItem(
        TABLE_NAMES.USERS,
        userId,
        METADATA_SK,
        updatesWithTimestamp,
    );
}

// Delete User (soft delete)
export async function deleteUser(userId: string): Promise<void> {
    await updateItem(TABLE_NAMES.USERS, userId, METADATA_SK, {
        deletedAt: new Date().toISOString(),
    });
}

// Hard delete
export async function hardDeleteUser(userId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.USERS, userId);
}
