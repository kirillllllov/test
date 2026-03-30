import { createId } from '@paralleldrive/cuid2';

import {
    createEntityId,
    type Messenger,
    METADATA_SK,
    type ReferenceCreateInput,
    TABLE_NAMES,
} from '../../types.js';
import { deleteItem, getItem, putItem, queryByGSI } from '../base.js';

export async function createMessenger(
    input: ReferenceCreateInput,
): Promise<Messenger> {
    const id = createEntityId('MESSENGER', createId());

    const messenger: Messenger = {
        id,
        sk: METADATA_SK,
        name: input.name,
    };

    await putItem(TABLE_NAMES.MESSENGERS, messenger);
    return messenger;
}

export async function getMessengerById(
    messengerId: string,
): Promise<Messenger | undefined> {
    return getItem<Messenger>(TABLE_NAMES.MESSENGERS, messengerId);
}

export async function getMessengerByName(
    name: string,
): Promise<Messenger | undefined> {
    const messengers = await queryByGSI<Messenger>(
        TABLE_NAMES.MESSENGERS,
        'NameIndex',
        '#name = :name',
        { ':name': name },
        { '#name': 'name' },
    );
    return messengers[0] || undefined;
}

export async function deleteMessenger(messengerId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.MESSENGERS, messengerId);
}
