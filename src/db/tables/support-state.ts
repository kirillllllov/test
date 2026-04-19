import {
    createEntityId,
    METADATA_SK,
    type SupportAppealState,
    type SupportAppealStateCreateInput,
    TABLE_NAMES,
} from '../types.js';
import { deleteItem, getItem, putItem, updateItem } from './base.js';

export async function createSupportAppealState(
    input: SupportAppealStateCreateInput,
): Promise<SupportAppealState> {
    const id = createEntityId('SUPPORT_STATE', input.appealId);
    const now = new Date().toISOString();

    const supportState: SupportAppealState = {
        id,
        sk: METADATA_SK,
        appealId: input.appealId,
        snapshot: input.snapshot,
        context: input.context || {},
        currentState: input.currentState,
        machineType: input.machineType,
        createdAt: now,
        updatedAt: now,
    };

    await putItem(TABLE_NAMES.USER_STATES, supportState);
    return supportState;
}

export async function getSupportAppealState(
    appealId: string,
): Promise<SupportAppealState | undefined> {
    const id = createEntityId('SUPPORT_STATE', appealId);
    return getItem<SupportAppealState>(TABLE_NAMES.USER_STATES, id);
}

export async function updateSupportAppealState(
    appealId: string,
    updates: {
        snapshot: any;
        context?: Record<string, any>;
        currentState: string;
        machineType?: string;
    },
): Promise<void> {
    const id = createEntityId('SUPPORT_STATE', appealId);

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

export async function deleteSupportAppealState(appealId: string): Promise<void> {
    const id = createEntityId('SUPPORT_STATE', appealId);
    await deleteItem(TABLE_NAMES.USER_STATES, id);
}
