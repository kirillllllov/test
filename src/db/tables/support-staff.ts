
import {
    createEntityId,
    METADATA_SK,
    TABLE_NAMES,
    type SupportStaff,
} from '../types.js';
import { deleteItem, getItem, putItem } from './base.js';

/**
 * Добавить пользователя в таблицу сотрудников.
 * @param userId — ID пользователя из таблицы User (например, USER#<cuid>)
 */
export async function createSupportStaff(
    userId: string,
): Promise<SupportStaff> {
    const id = createEntityId('SUPPORT_STAFF', userId);
    const now = new Date().toISOString();
    const staff: SupportStaff = {
        id,
        sk: METADATA_SK,
        userId,
        createdAt: now,
    };

    await putItem(TABLE_NAMES.SUPPORT_STAFF, staff);
    return staff;
}

/**
 * Получить запись сотрудника по userId.
 * @param userId — ID пользователя из таблицы User (например, USER#<cuid>)
 */
export async function getSupportStaffByUserId(
    userId: string,
): Promise<SupportStaff | undefined> {
    const id = createEntityId('SUPPORT_STAFF', userId);
    return getItem<SupportStaff>(TABLE_NAMES.SUPPORT_STAFF, id);
}

/**
 * Проверить, является ли пользователь сотрудником.
 * @param userId — ID пользователя из таблицы User (например, USER#<cuid>)
 */
export async function isSupportStaff(userId: string): Promise<boolean> {
    const staff = await getSupportStaffByUserId(userId);
    return staff !== undefined;
}

/**
 * Удалить пользователя из таблицы сотрудников.
 * @param userId — ID пользователя из таблицы User (например, USER#<cuid>)
 */
export async function removeSupportStaff(userId: string): Promise<void> {
    const id = createEntityId('SUPPORT_STAFF', userId);
    await deleteItem(TABLE_NAMES.SUPPORT_STAFF, id);
}