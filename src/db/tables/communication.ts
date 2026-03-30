import { createId } from '@paralleldrive/cuid2';

import {
    type CommunicationCreateInput,
    type CommunicationWithUser,
    createEntityId,
    METADATA_SK,
    TABLE_NAMES,
} from '../types.js';
import {
    deleteItem,
    getItem,
    putItem,
    queryByGSI,
    validateFKExists,
} from './base.js';

export async function createCommunication(
    input: CommunicationCreateInput,
): Promise<CommunicationWithUser> {
    // Validate FKs
    const [chatExists, userExists] = await Promise.all([
        validateFKExists(TABLE_NAMES.CHATS, input.chatId),
        validateFKExists(TABLE_NAMES.USERS, input.userId),
    ]);

    if (!chatExists) {
        throw new Error(`Chat ${input.chatId} does not exist`);
    }
    if (!userExists) {
        throw new Error(`User ${input.userId} does not exist`);
    }

    const id = createEntityId('COMM', createId());

    const communication: CommunicationWithUser = {
        id,
        sk: METADATA_SK,
        chatId: input.chatId,
        userId: input.userId,
        userMessengerId: input.userMessengerId,
        ...(input.email ? { email: input.email } : {}),
        ...(input.numberPhone ? { numberPhone: input.numberPhone } : {}),
    };

    await putItem(TABLE_NAMES.COMMUNICATIONS, communication);
    return communication;
}

export async function getCommunicationById(
    commId: string,
): Promise<CommunicationWithUser | undefined> {
    return getItem<CommunicationWithUser>(TABLE_NAMES.COMMUNICATIONS, commId);
}

export async function getCommunicationsByChat(
    chatId: string,
): Promise<CommunicationWithUser[]> {
    return queryByGSI<CommunicationWithUser>(
        TABLE_NAMES.COMMUNICATIONS,
        'ChatIndex',
        'chatId = :chatId',
        { ':chatId': chatId },
    );
}

export async function getCommunicationsByUser(
    userId: string,
): Promise<CommunicationWithUser[]> {
    return queryByGSI<CommunicationWithUser>(
        TABLE_NAMES.COMMUNICATIONS,
        'UserIndex',
        'userId = :userId',
        { ':userId': userId },
    );
}

export async function deleteCommunication(commId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.COMMUNICATIONS, commId);
}
