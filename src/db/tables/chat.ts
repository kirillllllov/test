import { createId } from '@paralleldrive/cuid2';

import {
    type Chat,
    type ChatCreateInput,
    createEntityId,
    METADATA_SK,
    TABLE_NAMES,
} from '../types.js';
import {
    deleteItem,
    getItem,
    putItem,
    queryByGSI,
    updateItem,
    validateFKExists,
} from './base.js';

export async function createChat(input: ChatCreateInput): Promise<Chat> {
    // Validate FKs
    const [messengerExists, chatTypeExists] = await Promise.all([
        validateFKExists(TABLE_NAMES.MESSENGERS, input.messengerId),
        validateFKExists(TABLE_NAMES.CHAT_TYPES, input.chatTypeId),
    ]);

    if (!messengerExists) {
        throw new Error(`Messenger ${input.messengerId} does not exist`);
    }
    if (!chatTypeExists) {
        throw new Error(`ChatType ${input.chatTypeId} does not exist`);
    }

    const id = createEntityId('CHAT', createId());
    const now = new Date().toISOString();

    const chat: Chat = {
        id,
        sk: METADATA_SK,
        messengerId: input.messengerId,
        chatMessengerId: input.chatMessengerId,
        chatTypeId: input.chatTypeId,
        createdAt: now,
        updatedAt: now,
    };

    await putItem(TABLE_NAMES.CHATS, chat);
    return chat;
}

export async function getChatById(chatId: string): Promise<Chat | undefined> {
    return getItem<Chat>(TABLE_NAMES.CHATS, chatId);
}

export async function getChatsByMessenger(
    messengerId: string,
): Promise<Chat[]> {
    return queryByGSI<Chat>(
        TABLE_NAMES.CHATS,
        'MessengerIndex',
        'messengerId = :messengerId',
        { ':messengerId': messengerId },
    );
}

export async function updateChat(
    chatId: string,
    updates: Partial<Omit<Chat, 'id' | 'sk' | 'createdAt'>>,
): Promise<void> {
    const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await updateItem(
        TABLE_NAMES.CHATS,
        chatId,
        METADATA_SK,
        updatesWithTimestamp,
    );
}

export async function deleteChat(chatId: string): Promise<void> {
    await updateItem(TABLE_NAMES.CHATS, chatId, METADATA_SK, {
        deletedAt: new Date().toISOString(),
    });
}
