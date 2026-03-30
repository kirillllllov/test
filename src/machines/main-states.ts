import { assign, createMachine, forwardTo } from 'xstate';

import { appealCreateMachine } from './master-create-appeal.js';
import { appealJoinMachine } from './master-join-appeal.js';

export interface AppealRootContext {
    userId: string;
    connectorName: string;
    chatId: string;
    keyboardMessageId: string | undefined;
    appealId: string | undefined;
}

export type AppealRootEvent =
    | { type: 'START' }
    | { type: 'OPEN_LIST' }
    | { type: 'SELECT_APPEAL'; appealId: string }
    | { type: 'OPEN_CREATE' }
    | { type: 'JOIN_APPEAL' }
    | { type: 'BACK' }
    | { type: 'CREATION_RESULT'; result: 'created' | 'cancelled' }
    | { type: 'HELP' }
    | { type: 'ADD_DESCRIPTION'; description?: string }
    | { type: 'SELECT_CATEGORY'; category?: string }
    | { type: 'CHOOSE_SOFTWARE'; software?: string }
    | { type: 'SET_CRITICALITY'; criticality?: string }
    | { type: 'ATTACH_FILE'; fileId?: string }
    | { type: 'STOP_ATTACHING' }
    | { type: 'CONFIRM_CREATION' }
    | { type: 'CANCEL_CREATION' }
    | { type: 'CONFIRM_FIXATION' }
    | { type: 'CANCEL_FIXATION' }
    | { type: 'TEXT_INPUT'; text: string };

export const appealRootMachine = createMachine(
    {
        id: 'appealRoot',
        initial: 'welcome',

        types: {} as {
            context: AppealRootContext;
            events: AppealRootEvent;
            input: { userId: string; connectorName: string; chatId: string };
        },

        context: ({ input }) => ({
            userId: input?.userId ?? '',
            connectorName: input?.connectorName ?? '',
            chatId: input?.chatId ?? '',
            keyboardMessageId: undefined,
            appealId: undefined,
        }),

        states: {
            welcome: {
                entry: 'showWelcome',
                on: {
                    OPEN_LIST: { target: 'listAppeals' },
                    OPEN_CREATE: { target: 'createAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            listAppeals: {
                entry: 'showAppealList',
                on: {
                    SELECT_APPEAL: {
                        target: 'specificAppeal',
                        actions: assign({
                            appealId: ({ event }) =>
                                event.type === 'SELECT_APPEAL'
                                    ? event.appealId
                                    : undefined,
                        }),
                    },
                    OPEN_CREATE: { target: 'createAppeal' },
                    BACK: { target: 'welcome' },
                    HELP: { actions: 'showHelp' },
                },
            },

            specificAppeal: {
                entry: 'showAppealCard',
                on: {
                    JOIN_APPEAL: { target: 'joinMaster' },
                    BACK: { target: 'listAppeals' },
                    HELP: { actions: 'showHelp' },
                },
            },

            joinMaster: {
                invoke: {
                    id: 'appealMenuMachine',
                    src: appealJoinMachine,
                    input: ({ context }) => ({
                        userId: context.userId,
                        appealId: context.appealId,
                        connectorName: context.connectorName,
                        chatId: context.chatId,
                    }),
                    onDone: { target: 'listAppeals' },
                },
                on: {
                    HELP: { actions: 'showHelp' },
                },
            },

            createAppeal: {
                invoke: {
                    id: 'appealCreateMachine',
                    src: appealCreateMachine,
                    input: ({ context }) => ({
                        userId: context.userId,
                        connectorName: context.connectorName,
                        chatId: context.chatId,
                    }),
                    onDone: [
                        {
                            guard: ({ event }) =>
                                event.output?.result === 'created',
                            target: 'listAppeals',
                            actions: 'handleAppealCreated',
                        },
                        {
                            guard: ({ event }) =>
                                event.output?.result === 'cancelled',
                            target: 'welcome',
                            actions: 'handleAppealCancelled',
                        },
                    ],
                },
                on: {
                    ADD_DESCRIPTION: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    SELECT_CATEGORY: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    CHOOSE_SOFTWARE: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    SET_CRITICALITY: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    ATTACH_FILE: { actions: forwardTo('appealCreateMachine') },
                    STOP_ATTACHING: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    CONFIRM_CREATION: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    CANCEL_CREATION: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    CONFIRM_FIXATION: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    CANCEL_FIXATION: {
                        actions: forwardTo('appealCreateMachine'),
                    },
                    BACK: { actions: forwardTo('appealCreateMachine') },
                    TEXT_INPUT: { actions: forwardTo('appealCreateMachine') },
                    CREATION_RESULT: [
                        {
                            guard: ({ event }) =>
                                event.type === 'CREATION_RESULT' &&
                                event.result === 'created',
                            target: 'listAppeals',
                            actions: 'handleAppealCreated',
                        },
                        {
                            guard: ({ event }) =>
                                event.type === 'CREATION_RESULT' &&
                                event.result === 'cancelled',
                            target: 'welcome',
                            actions: 'handleAppealCancelled',
                        },
                    ],
                    HELP: { actions: 'showHelp' },
                },
            },
        },
    },
    {
        actions: {
            showWelcome: ({ context }) => {
                const { connectorName, userId, chatId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendKeyboard(
                            connectorName,
                            userId,
                            chatId,
                            '👋 Добро пожаловать в систему обращений! Выберите действие:',
                            [
                                { text: 'Мои обращения' },
                                { text: 'Создать обращение' },
                                { text: 'Помощь' },
                            ],
                        );
                    } catch (err) {
                        console.error('[showWelcome] Ошибка отправки:', err);
                    }
                })();
            },

            showAppealList: ({ context }) => {
                const { connectorName, userId, chatId } = context;
                (async () => {
                    try {
                        const [{ listRequestsForUser }, { default: messagingService }] =
                            await Promise.all([
                                import('../services/appeal-service.js'),
                                import('../services/messaging-service.js'),
                            ]);

                        const list = await listRequestsForUser(userId);
                        const text =
                            list +
                            '\n\n🔹 Нажмите на ID обращения или выберите действие:';

                        await messagingService.sendKeyboard(
                            connectorName,
                            userId,
                            chatId,
                            '📋 Список обращений',
                            [
                                { text: 'Создать обращение' },
                                { text: 'Назад' },
                            ],
                        );
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            text,
                        );
                    } catch (err) {
                        console.error('[showAppealList] Ошибка:', err);
                    }
                })();
            },

            showAppealCard: ({ context }) => {
                const { connectorName, userId, chatId, appealId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendKeyboard(
                            connectorName,
                            userId,
                            chatId,
                            `📄 Обращение: ${appealId ?? '—'}`,
                            [
                                { text: 'Присоединиться' },
                                { text: 'Назад' },
                            ],
                        );
                    } catch (err) {
                        console.error('[showAppealCard] Ошибка:', err);
                    }
                })();
            },

            handleAppealCreated: ({ context }) => {
                const { connectorName, userId, chatId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            '✅ Обращение успешно создано! Возврат к списку.',
                        );
                    } catch (err) {
                        console.error('[handleAppealCreated] Ошибка:', err);
                    }
                })();
            },

            handleAppealCancelled: ({ context }) => {
                const { connectorName, userId, chatId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            '↩️ Создание обращения отменено.',
                        );
                    } catch (err) {
                        console.error('[handleAppealCancelled] Ошибка:', err);
                    }
                })();
            },

            showHelp: ({ context }) => {
                const { connectorName, userId, chatId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendKeyboard(
                            connectorName,
                            userId,
                            chatId,
                            '❓ Помощь — доступные команды:',
                            [
                                { text: 'Мои обращения' },
                                { text: 'Создать обращение' },
                                { text: 'Назад' },
                            ],
                        );
                    } catch (err) {
                        console.error('[showHelp] Ошибка:', err);
                    }
                })();
            },
        },
    },
);
