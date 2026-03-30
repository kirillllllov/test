import NodeCache from 'node-cache';
import type { ActorRefFrom } from 'xstate';

import {
    createUserState,
    deleteUserState as deleteUserStateFromDB,
    getUserState as getUserStateFromDB,
    updateUserState as updateUserStateFromDB,
} from '../db/tables/user-state.js';

interface UserState {
    actor: any;
    context: any;
    history: Array<{
        state: string;
        timestamp: string;
    }>;
}

/**
 * StateService - Управляет снимками XState машин с постоянным хранилищем DynamoDB
 *
 * Возможности:
 * - L1 Кэш: In-memory NodeCache для быстрого доступа (TTL: 1 час)
 * - L2 Хранилище: DynamoDB для сохранения при перезапуске сервера
 */
class StateService {
    private cache: NodeCache;

    constructor() {
        this.cache = new NodeCache({ stdTTL: 3600 }); // кэш на 1 час
    }

    /**
     * Получить состояние пользователя - сначала проверяет кэш, затем DynamoDB
     */
    getUserState(userId: string): UserState | undefined {
        return this.cache.get(userId);
    }

    /**
     * Установить состояние пользователя - записывает только в кэш
     * Используйте saveUserSnapshot для постоянного хранения
     */
    setUserState(userId: string, state: UserState): boolean {
        return this.cache.set(userId, state);
    }

    /**
     * Удалить состояние пользователя только из кэша
     */
    deleteUserState(userId: string): number {
        return this.cache.del(userId);
    }

    /**
     * Получить все ID пользователей из кэша
     */
    getAllUsers(): string[] {
        return this.cache.keys();
    }

    // ========================================================================
    // Методы с поддержкой DynamoDB
    // ========================================================================

    /**
     * Сохранить снимок XState в DynamoDB
     * Обновляет существующий снимок или создает новый
     * @param userId - ID пользователя
     * @param actor - Экземпляр XState actor
     * @param machineType - Тип машины (appealRoot, supportAppeal и т.д.)
     * @returns Булево значение успеха
     */
    async saveUserSnapshot(
        userId: string,
        actor: any,
        machineType: string,
    ): Promise<boolean> {
        try {
            // Получить сохраненный снимок от actor
            const snapshot = actor.getPersistedSnapshot
                ? actor.getPersistedSnapshot()
                : actor.getSnapshot();

            // Определить имя текущего состояния
            const currentStateName =
                typeof snapshot.value === 'string'
                    ? snapshot.value
                    : JSON.stringify(snapshot.value);

            // Проверить, существует ли снимок в БД
            const existingState = await getUserStateFromDB(userId);

            if (existingState) {
                // Обновить существующий снимок (удаление не требуется)
                await updateUserStateFromDB(userId, {
                    snapshot,
                    context: snapshot.context || {},
                    currentState: currentStateName,
                    machineType,
                });
                console.log(
                    `✅ Snapshot updated for user ${userId} (state: ${currentStateName})`,
                );
            } else {
                // Создать новый снимок
                await createUserState({
                    userId,
                    snapshot,
                    context: snapshot.context || {},
                    currentState: currentStateName,
                    machineType,
                });
                console.log(
                    `✅ Snapshot created for user ${userId} (state: ${currentStateName})`,
                );
            }

            return true;
        } catch (error) {
            console.error(
                `❌ Failed to save snapshot for user ${userId}:`,
                error,
            );
            return false;
        }
    }

    /**
     * Загрузить снимок XState из DynamoDB
     * @param userId - ID пользователя
     * @returns Снимок или undefined если не найден
     */
    async loadUserSnapshot(userId: string): Promise<any | undefined> {
        try {
            const userState = await getUserStateFromDB(userId);

            if (!userState) {
                console.log(`ℹ️  No snapshot found for user ${userId}`);
                return undefined;
            }

            console.log(
                `✅ Snapshot loaded for user ${userId} (state: ${userState.currentState})`,
            );
            return userState.snapshot;
        } catch (error) {
            console.error(
                `❌ Failed to load snapshot for user ${userId}:`,
                error,
            );
            return undefined;
        }
    }

    /**
     * Удалить снимок из DynamoDB
     * @param userId - ID пользователя
     * @returns Булево значение успеха
     */
    async deleteSnapshot(userId: string): Promise<boolean> {
        try {
            await deleteUserStateFromDB(userId);
            console.log(`🗑️  Snapshot deleted for user ${userId}`);
            return true;
        } catch (error) {
            console.error(
                `❌ Failed to delete snapshot for user ${userId}:`,
                error,
            );
            return false;
        }
    }

    /**
     * Получить снимок с информацией о типе машины
     * Полезно для определения какую машину восстанавливать
     */
    async getUserSnapshotWithMeta(userId: string): Promise<
        | {
              snapshot: any;
              machineType: string;
              currentState: string;
          }
        | undefined
    > {
        try {
            const userState = await getUserStateFromDB(userId);

            if (!userState) {
                return undefined;
            }

            return {
                snapshot: userState.snapshot,
                machineType: userState.machineType,
                currentState: userState.currentState,
            };
        } catch (error) {
            console.error(
                `❌ Failed to get snapshot meta for user ${userId}:`,
                error,
            );
            return undefined;
        }
    }

    /**
     * Очистить и кэш и базу данных для пользователя
     * Используйте с осторожностью!
     */
    async clearUserState(userId: string): Promise<void> {
        this.deleteUserState(userId); // Очистить кэш
        await this.deleteSnapshot(userId); // Очистить БД
        console.log(`🧹 Full state cleared for user ${userId}`);
    }
}

export default new StateService();
