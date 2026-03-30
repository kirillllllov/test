import type { Request, Response } from 'express';
import { createActor } from 'xstate';

import { isSupportStaff } from '../db/tables/support-staff.js';
import { appealRootMachine } from '../machines/main-states.js';
import { supportAppealMachine } from '../machines/support-appeal-machine.js';
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
import { uploadBase64Images } from '../services/s3-service.js';
import stateService from '../services/state-service.js';

const SUPPORT_MACHINE_KEY_PREFIX = 'appeal';

class MainBotController {
    private messengerAggregator: MessengerAggregator;

    constructor(aggregator: MessengerAggregator) {
        this.messengerAggregator = aggregator;
    }

    // =========================================================================
    // HTTP handlers
    // =========================================================================

    async handleImage(req: Request, res: Response): Promise<void> {
        try {
            const image = await this.messengerAggregator.parseMessageImage(
                req.body,
            );
            const attachmentsBase64: string[] = image.attachments_base64 ?? [];

            if (attachmentsBase64.length === 0) {
                res.status(200).json({ attachment_urls: [] });
                return;
            }

            const urls = await uploadBase64Images(attachmentsBase64);

            await this.processImage(
                image,
                urls,
                req.connectorName,
            );

            res.status(200).json({ attachment_urls: urls });
        } catch (error) {
            console.error('❌ handleImage error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async handleKeyboardInput(req: Request, res: Response): Promise<void> {
        try {
            const keyboard = await this.messengerAggregator.parseKeyboard(
                req.body,
            );
            const connectorName = req.connectorName;
            const isStaff = await isSupportStaff(keyboard.user_id).catch(() => false);

            if (isStaff) {
                await this.processStaffKeyboard(keyboard, connectorName);
            } else {
                await this.processUserKeyboard(keyboard, connectorName);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ handleKeyboardInput error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async handleAction(req: Request, res: Response): Promise<void> {
        try {
            const action = await this.messengerAggregator.parseAction(req.body);
            const connectorName = req.connectorName;
            const isStaff = await isSupportStaff(action.user_id).catch(() => false);

            if (isStaff) {
                await this.processStaffAction(action, connectorName);
            } else {
                await this.processUserAction(action, connectorName);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ handleAction error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async handleCommand(req: Request, res: Response): Promise<void> {
        try {
            const command = await this.messengerAggregator.parseCommand(req.body);
            const connectorName = req.connectorName;
            await this.processCommand(command, connectorName);
            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ handleCommand error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    async handleUserMessage(req: Request, res: Response): Promise<void> {
        try {
            const message = await this.messengerAggregator.parseUserMessage(
                req.body,
            );
            const connectorName = req.connectorName;
            const isStaff = await isSupportStaff(message.user_id).catch(() => false);

            if (isStaff) {
                await this.processStaffMessage(message, connectorName);
            } else {
                await this.processUserMessage(message, connectorName);
            }

            res.status(200).json({ success: true });
        } catch (error) {
            console.error('❌ handleUserMessage error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // =========================================================================
    // User processing
    // =========================================================================

    private async processCommand(command: Commands, connectorName: string): Promise<void> {
        const userId = command.user_id;
        const chatId = command.place.chat_id;

        console.log(`\n👤 [User] Command from ${userId}: ${command.name}`);

        const actor = await this.loadOrCreateUserMachine(userId, connectorName, chatId);
        const event = this.mapCommandToEvent(command.name);

        await this.sendEventAndSave(actor, event, userId, 'appealRoot');
    }

    private async processUserAction(action: Actions, connectorName: string): Promise<void> {
        const userId = action.user_id;
        const chatId = action.place.chat_id;

        console.log(`\n👤 [User] Action from ${userId}: ${action.action}`);

        const actor = await this.loadOrCreateUserMachine(userId, connectorName, chatId);
        const event = this.mapActionToEvent(action.action);

        await this.sendEventAndSave(actor, event, userId, 'appealRoot');
    }

    private async processUserKeyboard(keyboard: InputKeyboard, connectorName: string): Promise<void> {
        const userId = keyboard.user_id;
        const chatId = keyboard.place.chat_id;

        console.log(`\n👤 [User] Keyboard input from ${userId}: ${keyboard.button}`);

        const actor = await this.loadOrCreateUserMachine(userId, connectorName, chatId);
        const event = this.mapButtonToEvent(keyboard.button);

        await this.sendEventAndSave(actor, event, userId, 'appealRoot');
    }

    private async processUserMessage(message: userMessage, connectorName: string): Promise<void> {
        const userId = message.user_id;
        const chatId = message.place.chat_id;

        console.log(`\n👤 [User] Message from ${userId}: ${message.text}`);

        const actor = await this.loadOrCreateUserMachine(userId, connectorName, chatId);

        await this.sendEventAndSave(
            actor,
            { type: 'TEXT_INPUT', text: message.text },
            userId,
            'appealRoot',
        );
    }

    private async processImage(
        image: messageImage,
        imageUrls: string[],
        connectorName: string,
    ): Promise<void> {
        const userId = image.user_id;
        const chatId = image.place.chat_id;

        console.log(`\n👤 [User] Image(s) from ${userId}: ${imageUrls.join(', ')}`);

        const actor = await this.loadOrCreateUserMachine(userId, connectorName, chatId);

        for (const url of imageUrls) {
            actor.send({ type: 'ATTACH_FILE', fileId: url });
        }

        await stateService.saveUserSnapshot(userId, actor, 'appealRoot');
    }

    // =========================================================================
    // Support staff processing
    // =========================================================================

    private async processStaffAction(action: Actions, connectorName: string): Promise<void> {
        const staffUserId = action.user_id;
        const staffChatId = action.place.chat_id;
        const rawAction = action.action.trim();

        console.log(`\n🛠️ [Staff] Action from ${staffUserId}: ${rawAction}`);

        const { eventType, appealId, extra } = this.parseStaffAction(rawAction);

        if (!appealId) {
            console.warn('[Staff] Действие не содержит ID обращения:', rawAction);
            return;
        }

        const actor = await this.loadOrCreateSupportMachine(
            appealId,
            staffUserId,
            staffChatId,
            connectorName,
        );

        const event = this.buildSupportEvent(eventType, staffUserId, 'Сотрудник', extra);
        if (!event) {
            console.warn('[Staff] Неизвестный тип события:', eventType);
            return;
        }

        const machineKey = `${SUPPORT_MACHINE_KEY_PREFIX}:${appealId}`;
        await this.sendEventAndSave(actor, event, machineKey, 'supportAppeal');
    }

    private async processStaffKeyboard(keyboard: InputKeyboard, connectorName: string): Promise<void> {
        const staffUserId = keyboard.user_id;
        const staffChatId = keyboard.place.chat_id;
        const buttonText = keyboard.button.trim();

        console.log(`\n🛠️ [Staff] Keyboard from ${staffUserId}: ${buttonText}`);

        const { eventType, appealId, extra } = this.parseStaffAction(buttonText);

        if (!appealId) {
            console.warn('[Staff] Кнопка не содержит ID обращения:', buttonText);
            return;
        }

        const actor = await this.loadOrCreateSupportMachine(
            appealId,
            staffUserId,
            staffChatId,
            connectorName,
        );

        const event = this.buildSupportEvent(eventType, staffUserId, 'Сотрудник', extra);
        if (!event) return;

        const machineKey = `${SUPPORT_MACHINE_KEY_PREFIX}:${appealId}`;
        await this.sendEventAndSave(actor, event, machineKey, 'supportAppeal');
    }

    private async processStaffMessage(message: userMessage, connectorName: string): Promise<void> {
        const staffUserId = message.user_id;
        const staffChatId = message.place.chat_id;

        console.log(`\n🛠️ [Staff] Message from ${staffUserId}: ${message.text}`);

        const snapshotMeta = await stateService.getUserSnapshotWithMeta(
            `${SUPPORT_MACHINE_KEY_PREFIX}:current:${staffUserId}`,
        );

        if (!snapshotMeta?.snapshot?.context?.appealId) {
            console.warn('[Staff] Нет активного обращения для сотрудника:', staffUserId);
            return;
        }

        const appealId = snapshotMeta.snapshot.context.appealId as string;
        const actor = await this.loadOrCreateSupportMachine(
            appealId,
            staffUserId,
            staffChatId,
            connectorName,
        );

        await this.sendEventAndSave(
            actor,
            { type: 'SUBMIT_SOLUTION', text: message.text },
            `${SUPPORT_MACHINE_KEY_PREFIX}:${appealId}`,
            'supportAppeal',
        );
    }

    // =========================================================================
    // Machine helpers
    // =========================================================================

    private async loadOrCreateUserMachine(
        userId: string,
        connectorName: string,
        chatId: string,
    ): Promise<any> {
        const snapshotMeta = await stateService.getUserSnapshotWithMeta(userId);

        if (snapshotMeta?.snapshot) {
            console.log(
                `📦 [User] Restoring machine (state: ${snapshotMeta.currentState})`,
            );
            return this.restoreActor(appealRootMachine, snapshotMeta.snapshot);
        }

        console.log('🆕 [User] Creating new appealRootMachine');
        const actor = createActor(appealRootMachine, {
            input: { userId, connectorName, chatId },
        });
        actor.start();
        return actor;
    }

    private async loadOrCreateSupportMachine(
        appealId: string,
        staffUserId: string,
        staffChatId: string,
        staffConnectorName: string,
    ): Promise<any> {
        const machineKey = `${SUPPORT_MACHINE_KEY_PREFIX}:${appealId}`;
        const snapshotMeta = await stateService.getUserSnapshotWithMeta(machineKey);

        if (snapshotMeta?.snapshot) {
            console.log(
                `📦 [Support] Restoring machine for appeal ${appealId} (state: ${snapshotMeta.currentState})`,
            );
            return this.restoreActor(supportAppealMachine, snapshotMeta.snapshot);
        }

        console.log(`🆕 [Support] Creating new supportAppealMachine for ${appealId}`);

        const { userConnectorName, userUserId, userChatId } =
            await this.lookupUserConnectorInfo(appealId);

        const actor = createActor(supportAppealMachine, {
            input: {
                appealId,
                staffUserId,
                staffConnectorName,
                staffChatId,
                userUserId,
                userConnectorName,
                userChatId,
            },
        });
        actor.start();
        return actor;
    }

    private restoreActor(machine: any, snapshot: any): any {
        const actor = createActor(machine, { snapshot });
        actor.start();
        return actor;
    }

    private async sendEventAndSave(
        actor: any,
        event: any,
        key: string,
        machineType: string,
    ): Promise<void> {
        const before = JSON.stringify(actor.getSnapshot().value);

        actor.send(event);

        await new Promise<void>(resolve => {
            let resolved = false;

            const sub = actor.subscribe((snapshot: any) => {
                const current = JSON.stringify(snapshot.value);
                if (current !== before && !resolved) {
                    resolved = true;
                    sub.unsubscribe();
                    setTimeout(resolve, 50);
                }
            });

            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    sub.unsubscribe();
                    resolve();
                }
            }, 5000);
        });

        const state = actor.getSnapshot();
        const stateValue =
            typeof state.value === 'string'
                ? state.value
                : JSON.stringify(state.value);

        console.log(`📍 State after event: ${stateValue}`);

        await stateService.saveUserSnapshot(key, actor, machineType);
    }

    // =========================================================================
    // Event mappers — user
    // =========================================================================

    private mapCommandToEvent(name: string): any {
        const cmd = name.trim().toUpperCase();
        const map: Record<string, any> = {
            START: { type: 'START' },
            ПРИВЕТ: { type: 'START' },
        };
        return map[cmd] ?? { type: 'TEXT_INPUT', text: name };
    }

    private mapActionToEvent(action: string): any {
        const content = action.trim().toUpperCase();

        const map: Record<string, any> = {
            OPEN_LIST: { type: 'OPEN_LIST' },
            СПИСОК: { type: 'OPEN_LIST' },
            OPEN_CREATE: { type: 'OPEN_CREATE' },
            СОЗДАТЬ: { type: 'OPEN_CREATE' },
            BACK: { type: 'BACK' },
            НАЗАД: { type: 'BACK' },
            HELP: { type: 'HELP' },
            ПОМОЩЬ: { type: 'HELP' },
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
            JOIN_APPEAL: { type: 'JOIN_APPEAL' },
            CONFIRM: { type: 'CONFIRM' },
            CANCEL_JOIN: { type: 'CANCEL_JOIN' },
        };

        if (map[content]) return map[content];

        if (content.startsWith('SELECT_APPEAL')) {
            const parts = content.split(' ');
            if (parts.length > 1) {
                return { type: 'SELECT_APPEAL', appealId: parts[1] };
            }
        }

        return { type: 'TEXT_INPUT', text: action };
    }

    private mapButtonToEvent(buttonText: string): any {
        const text = buttonText.trim();
        const upper = text.toUpperCase();

        const map: Record<string, any> = {
            'МОИ ОБРАЩЕНИЯ': { type: 'OPEN_LIST' },
            'СОЗДАТЬ ОБРАЩЕНИЕ': { type: 'OPEN_CREATE' },
            ПОМОЩЬ: { type: 'HELP' },
            НАЗАД: { type: 'BACK' },
            ПРИСОЕДИНИТЬСЯ: { type: 'JOIN_APPEAL' },
            'ДА, ПРИСОЕДИНИТЬСЯ': { type: 'CONFIRM' },
            'НЕТ, НАЗАД': { type: 'CANCEL_JOIN' },
            'ДОБАВИТЬ ОПИСАНИЕ': { type: 'ADD_DESCRIPTION' },
            'ВЫБРАТЬ КАТЕГОРИЮ': { type: 'SELECT_CATEGORY' },
            'УКАЗАТЬ ПО': { type: 'CHOOSE_SOFTWARE' },
            'ЗАДАТЬ КРИТИЧНОСТЬ': { type: 'SET_CRITICALITY' },
            'ПРИКРЕПИТЬ ФАЙЛ': { type: 'ATTACH_FILE' },
            ГОТОВО: { type: 'STOP_ATTACHING' },
            ПОДТВЕРДИТЬ: { type: 'CONFIRM_CREATION' },
            'ПОДТВЕРДИТЬ И СОЗДАТЬ': { type: 'CONFIRM_FIXATION' },
            'ВЕРНУТЬСЯ К РЕДАКТИРОВАНИЮ': { type: 'CANCEL_FIXATION' },
            ОТМЕНА: { type: 'CANCEL_CREATION' },
        };

        if (map[upper]) return map[upper];

        if (upper.startsWith('ОБРАЩЕНИЕ') || upper.startsWith('ID:')) {
            const parts = text.split(' ');
            const id = parts.find(p => p.startsWith('APPEAL#') || p.length > 10);
            if (id) return { type: 'SELECT_APPEAL', appealId: id };
        }

        return { type: 'TEXT_INPUT', text };
    }

    // =========================================================================
    // Event mappers — support staff
    // =========================================================================

    /**
     * Парсит строку действия сотрудника формата: "COMMAND:APPEAL#id[:extra]"
     */
    private parseStaffAction(raw: string): {
        eventType: string;
        appealId: string | undefined;
        extra: string | undefined;
    } {
        const parts = raw.split(':');
        const eventType = (parts[0] ?? '').trim().toUpperCase();

        const appealPart = parts.slice(1).join(':').trim();
        const appealMatch = appealPart.match(/(APPEAL#\S+)/i);
        const appealId = appealMatch ? appealMatch[1] : undefined;

        const extra = appealId ? appealPart.replace(appealId, '').replace(/^:/, '').trim() : undefined;

        return { eventType, appealId, extra };
    }

    private buildSupportEvent(
        eventType: string,
        userId: string,
        userName: string,
        extra?: string,
    ): any | undefined {
        switch (eventType) {
            case 'TAKE_WORK':
                return { type: 'TAKE_WORK', userId, userName };
            case 'SOLVE':
                return { type: 'SOLVE' };
            case 'RELEASE':
                return { type: 'RELEASE' };
            case 'SUBMIT_SOLUTION':
                return { type: 'SUBMIT_SOLUTION', text: extra ?? '' };
            case 'CANCEL':
                return { type: 'CANCEL' };
            case 'AUTO_REMIND':
                return { type: 'AUTO_REMIND' };
            case 'REASSIGN':
                return {
                    type: 'REASSIGN',
                    newUserId: extra ?? userId,
                    newUserName: extra ?? 'Другой сотрудник',
                };
            default:
                return undefined;
        }
    }

    // =========================================================================
    // Utility
    // =========================================================================

    /**
     * Ищет информацию о пользователе-авторе обращения в DynamoDB.
     * Используется для уведомлений пользователя через машину поддержки.
     */
    private async lookupUserConnectorInfo(appealId: string): Promise<{
        userUserId: string;
        userConnectorName: string;
        userChatId: string;
    }> {
        try {
            const { getItem } = await import('../db/tables/base.js');
            const { TABLE_NAMES, METADATA_SK } = await import('../db/types.js');

            const appeal = await getItem<any>(
                TABLE_NAMES.APPEALS,
                appealId,
                METADATA_SK,
            );

            const userUserId = appeal?.user_id ?? '';

            if (userUserId) {
                const userSnapshot = await stateService.getUserSnapshotWithMeta(userUserId);
                const ctx = userSnapshot?.snapshot?.context;
                if (ctx?.connectorName && ctx?.chatId) {
                    return {
                        userUserId,
                        userConnectorName: ctx.connectorName,
                        userChatId: ctx.chatId,
                    };
                }
            }
        } catch (err) {
            console.warn('[lookupUserConnectorInfo] Не удалось получить данные:', err);
        }

        return { userUserId: '', userConnectorName: '', userChatId: '' };
    }
}

export default MainBotController;
export const mainBotController = new MainBotController(messengerAggregator);
