import type { Request, Response } from 'express';
import { createActor } from 'xstate';

import { isSupportStaff } from '../db/tables/support-staff.js';
import { appealRootMachine } from '../machines/main-states.js';
import {
    type MessengerAggregator,
    messengerAggregator,
} from '../modules/messenger-aggregator/messenger-aggregator.js';
import type {
    Actions,
    Commands,
    InputKeyboard,
    messageImage,
    userMessage,
} from '../modules/messenger-aggregator/types.js';
import stateService from '../services/state-service.js';

/**
 * MainBotController - Обрабатывает полный цикл обработки вебхуков
 *
 * Рабочий процесс:
 * 1. Получить вебхук от WebServer
 * 2. Разобрать вебхук через MessengerAggregator -> UnifiedMessage
 * 3. Извлечь userId из сообщения
 * 4. Проверить наличие снимка состояния в БД
 * 5а. Если снимок существует:
 *     - Восстановить машину состояний из снимка (userId уже в контексте)
 *     - Отправить событие машине
 *     - Actions машины выводят сообщения в консоль
 *     - Сохранить обновленный снимок
 * 5б. Если снимка нет:
 *     - Создать новую машину состояний с userId в input
 *     - Actions машины выводят приветствие в консоль
 *     - Сохранить снимок
 */
class MainBotController {
    private messengerAggregator: MessengerAggregator;

    constructor(messengerAggregator: MessengerAggregator) {
        this.messengerAggregator = messengerAggregator;
    }

    async handleImage(req: Request, res: Response): Promise<void> {
        try {
            console.log('🖼️ Image received:', req.body);

            // Парсим в тип Image
            const image = await messengerAggregator.parseMessageImage(req.body);

            console.log('✅ Parsed image:', image);

            // Здесь логика обработки изображения
            await this.processImage(image);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ Error handling image:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async processImage(image: messageImage): Promise<void> {
        console.log('Заглушка');
    }

    async handleKeyboardInput(req: Request, res: Response): Promise<void> {
        try {
            console.log('⌨️ Keyboard input received:', req.body);

            // Парсим в тип EnterKeyboard
            const keyboard = await messengerAggregator.parseKeyboard(req.body);

            console.log('✅ Parsed keyboard input:', keyboard);

            // Здесь логика обработки ввода с клавиатуры
            await this.processKeyboard(keyboard);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ Error handling keyboard input:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async processKeyboard(keyboard: InputKeyboard): Promise<void> {
        console.log('Заглушка');
    }

    async handleAction(req: Request, res: Response): Promise<void> {
        try {
            console.log('⚡ Action received:', req.body);

            // Парсим в тип Actions
            const action = await messengerAggregator.parseAction(req.body);

            console.log('✅ Parsed action:', action);

            // Здесь логика обработки действия
            await this.processAction(action);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ Error handling action:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async processAction(action: Actions): Promise<void> {
        const userId = action.user_id;
        console.log(`\n👤 Processing message from user: ${userId}`);

        try {
            // Шаг 1: Проверить наличие существующего снимка
            const snapshotMeta =
                await stateService.getUserSnapshotWithMeta(userId);

            let actor: any;

            if (snapshotMeta) {
                // Сценарий А: Восстановить из снимка
                console.log(
                    `📦 Restoring snapshot (machine: ${snapshotMeta.machineType}, state: ${snapshotMeta.currentState})`,
                );
                actor = this.restoreStateMachine(
                    snapshotMeta.snapshot,
                    snapshotMeta.machineType,
                );
            } else {
                // Сценарий Б: Создать новую машину
                console.log('🆕 Creating new state machine (appealRoot)');
                actor = this.createNewStateMachine(userId);
            }
            const event = this.mapMessageToEvent(action);
            console.log(`📤 Sending event to machine:`, event);
            actor.send(event);
            const initialState = actor.getSnapshot();
            const initialValue = JSON.stringify(initialState.value);

            await new Promise<void>(resolve => {
                let resolved = false;

                const subscription = actor.subscribe((snapshot: any) => {
                    const currentValue = JSON.stringify(snapshot.value);
                    // Если состояние изменилось и нет активных дочерних машин
                    if (currentValue !== initialValue && !resolved) {
                        resolved = true;
                        subscription.unsubscribe();
                        // Даём небольшую задержку для завершения всех side effects
                        setTimeout(() => resolve(), 50);
                    }
                });

                // Таймаут 5 секунд (для долгих DynamoDB операций)
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        subscription.unsubscribe();
                        resolve();
                    }
                }, 5000);
            });
            // Шаг 4: Получить текущее состояние
            const currentState = actor.getSnapshot();
            const stateValue =
                typeof currentState.value === 'string'
                    ? currentState.value
                    : JSON.stringify(currentState.value);

            console.log(`📍 Current state after event: ${stateValue}`);

            // Шаг 5: Сохранить обновленный снимок в БД
            await stateService.saveUserSnapshot(userId, actor, 'appealRoot');

            console.log(
                `✅ Message processed successfully for user ${userId}\\n`,
            );
        } catch (error) {
            console.error(
                `❌ Error processing message for user ${userId}:`,
                error,
            );
        }
    }

    async handleCommand(req: Request, res: Response): Promise<void> {
        try {
            console.log('🎯 Command received:', req.body);

            // Отправляем в агрегатор для парсинга в тип Commands
            const command = await messengerAggregator.parseCommand(req.body);

            // Дальше работаем с типизированным command
            console.log('✅ Parsed command:', command);

            // Здесь ваша логика обработки команды
            await this.processCommand(command);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ Error handling command:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async processCommand(command: Commands): Promise<void> {
        const userId = command.user_id;
        console.log(`\n👤 Processing message from user: ${userId}`);

        try {
            // Шаг 1: Проверить наличие существующего снимка
            const snapshotMeta =
                await stateService.getUserSnapshotWithMeta(userId);

            let actor: any;

            if (snapshotMeta) {
                // Сценарий А: Восстановить из снимка
                console.log(
                    `📦 Restoring snapshot (machine: ${snapshotMeta.machineType}, state: ${snapshotMeta.currentState})`,
                );
                actor = this.restoreStateMachine(
                    snapshotMeta.snapshot,
                    snapshotMeta.machineType,
                );
            } else {
                // Сценарий Б: Создать новую машину
                console.log('🆕 Creating new state machine (appealRoot)');
                actor = this.createNewStateMachine(userId);
            }
            const event = this.mapMessageCommands(command);
            console.log(`📤 Sending event to machine:`, event);
            actor.send(event);
            const initialState = actor.getSnapshot();
            const initialValue = JSON.stringify(initialState.value);

            await new Promise<void>(resolve => {
                let resolved = false;

                const subscription = actor.subscribe((snapshot: any) => {
                    const currentValue = JSON.stringify(snapshot.value);
                    // Если состояние изменилось и нет активных дочерних машин
                    if (currentValue !== initialValue && !resolved) {
                        resolved = true;
                        subscription.unsubscribe();
                        // Даём небольшую задержку для завершения всех side effects
                        setTimeout(() => resolve(), 50);
                    }
                });

                // Таймаут 5 секунд (для долгих DynamoDB операций)
                setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        subscription.unsubscribe();
                        resolve();
                    }
                }, 5000);
            });
            // Шаг 4: Получить текущее состояние
            const currentState = actor.getSnapshot();
            const stateValue =
                typeof currentState.value === 'string'
                    ? currentState.value
                    : JSON.stringify(currentState.value);

            console.log(`📍 Current state after event: ${stateValue}`);

            // Шаг 5: Сохранить обновленный снимок в БД
            await stateService.saveUserSnapshot(userId, actor, 'appealRoot');

            console.log(
                `✅ Message processed successfully for user ${userId}\\n`,
            );
        } catch (error) {
            console.error(
                `❌ Error processing message for user ${userId}:`,
                error,
            );
        }
    }

    async handleUserMessage(req: Request, res: Response): Promise<void> {
        try {
            console.log('💬 User message received:', req.body);

            // Парсим в тип UserMessage
            const message = await messengerAggregator.parseUserMessage(
                req.body,
            );

            console.log('✅ Parsed user message:', message);

            // Здесь логика обработки сообщения
            await this.processUserMessage(message);

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ Error handling user message:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async processUserMessage(message: userMessage): Promise<void> {
        console.log('Заглушка');
    }

    /**
     * Создать новый экземпляр машины состояний
     */
    private createNewStateMachine(userId: string): any {
        const actor = createActor(appealRootMachine, {
            input: { userId },
        });
        actor.start();
        return actor;
    }

    private async Auth(userId: string) {
        if (await isSupportStaff(userId)) return true;
        return false;
    }

    /**
     * Восстановить машину состояний из снимка
     */
    private restoreStateMachine(snapshot: any, machineType: string): any {
        // Пока поддерживается только appealRootMachine
        // В будущем можно переключаться в зависимости от machineType
        // При восстановлении из snapshot, input не требуется - контекст уже в snapshot
        const actor = createActor(appealRootMachine, {
            snapshot,
        });
        actor.start();
        return actor;
    }

    private mapMessageCommands(command: Commands): any {
        const content = command.name.trim().toUpperCase();

        // Сопоставить общие текстовые команды с событиями
        const eventMap: Record<string, any> = {
            ПРИВЕТ: { type: 'START' },
            START: { type: 'START' },
        };

        // Проверить, является ли это прямой командой
        if (eventMap[content]) {
            return eventMap[content];
        }

        // По умолчанию: считать текстовым вводом (для мастеров)
        return { type: 'TEXT_INPUT', text: command.name };
    }

    /**
     * Преобразовать UnifiedMessage в событие XState
     */
    private mapMessageToEvent(action: Actions): any {
        const content = action.action.trim().toUpperCase();

        // Сопоставить общие текстовые команды с событиями
        const eventMap: Record<string, any> = {
            СПИСОК: { type: 'OPEN_LIST' },
            OPEN_LIST: { type: 'OPEN_LIST' },
            СОЗДАТЬ: { type: 'OPEN_CREATE' },
            OPEN_CREATE: { type: 'OPEN_CREATE' },
            CREATE: { type: 'OPEN_CREATE' },
            НАЗАД: { type: 'BACK' },
            BACK: { type: 'BACK' },
            ПОМОЩЬ: { type: 'HELP' },
            HELP: { type: 'HELP' },
            ADD_DESCRIPTION: { type: 'ADD_DESCRIPTION' },
            SELECT_CATEGORY: { type: 'SELECT_CATEGORY' },
            CHOOSE_SOFTWARE: { type: 'CHOOSE_SOFTWARE' },
            SET_CRITICALITY: { type: 'SET_CRITICALITY' },
            ATTACH_FILE: { type: 'ATTACH_FILE' },
            STOP_ATTACHING: { type: 'STOP_ATTACHING' },
            CONFIRM_CREATION: { type: 'CONFIRM_CREATION' },
            CANCEL_CREATION: { type: 'CANCEL_CREATION' },
            CONFIRM_FIXATION: { type: 'CONFIRM_FIXATION' },
            CANCEL_FIXATION: { type: 'CANCEL_FIXATION' },
        };

        // Проверить, является ли это прямой командой
        if (eventMap[content]) {
            return eventMap[content];
        }

        // Проверить, является ли это командой SELECT_APPEAL с ID
        if (content.startsWith('SELECT_APPEAL')) {
            const parts = content.split(' ');
            if (parts.length > 1) {
                return { type: 'SELECT_APPEAL', appealId: parts[1] };
            }
        }

        // По умолчанию: считать текстовым вводом (для мастеров)
        return { type: 'TEXT_INPUT', text: action.action };
    }
}

export default MainBotController;
const messengerAggregatorInstance = messengerAggregator; // или создайте, если нужно
export const mainBotController = new MainBotController(
    messengerAggregatorInstance,
);
