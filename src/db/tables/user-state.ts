import {
    createEntityId,
    METADATA_SK,
    TABLE_NAMES,
    type UserState,
    type UserStateCreateInput,
} from '../types.js';
import { deleteItem, getItem, putItem, updateItem } from './base.js';

// Create User State (Save Snapshot)
export async function createUserState(
    input: UserStateCreateInput,
): Promise<UserState> {
    const id = createEntityId('USER_STATE', input.userId);
    const now = new Date().toISOString();

    const userState: UserState = {
        id,
        sk: METADATA_SK,
        userId: input.userId,
        snapshot: input.snapshot,
        context: input.context || {},
        currentState: input.currentState,
        machineType: input.machineType,
        createdAt: now,
        updatedAt: now,
    };

    await putItem(TABLE_NAMES.USER_STATES, userState);
    return userState;
}

// Get User State by UserId
export async function getUserState(
    userId: string,
): Promise<UserState | undefined> {
    const id = createEntityId('USER_STATE', userId);
    return getItem<UserState>(TABLE_NAMES.USER_STATES, id);
}

// Update User State (Save New Snapshot)
export async function updateUserState(
    userId: string,
    updates: {
        snapshot: any;
        context?: Record<string, any>;
        currentState: string;
        machineType?: string;
    },
): Promise<void> {
    const id = createEntityId('USER_STATE', userId);

    const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    await updateItem(
        TABLE_NAMES.USER_STATES,
        id,
        METADATA_SK,
        updatesWithTimestamp,
    );
}

// Delete User State (Remove Snapshot)
export async function deleteUserState(userId: string): Promise<void> {
    const id = createEntityId('USER_STATE', userId);
    await deleteItem(TABLE_NAMES.USER_STATES, id);
}
