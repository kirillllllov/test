import { createMachine } from 'xstate';

export interface AppealJoinContext {
    userId: string;
    appealId: string | undefined;
    connectorName: string;
    chatId: string;
}

export type AppealJoinEvent =
    | { type: 'CONFIRM' }
    | { type: 'CANCEL_JOIN' }
    | { type: 'QUIT_FROM_MASTER' }
    | { type: 'HELP' };

export const appealJoinMachine = createMachine(
    {
        id: 'appealMenu',
        initial: 'confirmJoin',

        types: {} as {
            context: AppealJoinContext;
            events: AppealJoinEvent;
            input: {
                userId: string;
                appealId: string | undefined;
                connectorName: string;
                chatId: string;
            };
        },

        context: ({ input }) => ({
            userId: input?.userId ?? '',
            appealId: input?.appealId,
            connectorName: input?.connectorName ?? '',
            chatId: input?.chatId ?? '',
        }),

        states: {
            confirmJoin: {
                entry: 'askJoinConfirmation',
                on: {
                    CONFIRM: { target: 'registerJoin' },
                    CANCEL_JOIN: { target: 'cancelJoinProcess' },
                    HELP: { actions: 'showHelp' },
                },
            },

            registerJoin: {
                entry: 'registerUserToAppeal',
                type: 'final',
            },

            cancelJoinProcess: {
                entry: 'notifyJoinCancelled',
                type: 'final',
            },
        },
    },
    {
        actions: {
            askJoinConfirmation: ({ context }) => {
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
                            `❓ Вы хотите присоединиться к обращению ${appealId ?? ''}?`,
                            [{ text: 'Да, присоединиться' }, { text: 'Нет, назад' }],
                        );
                    } catch (err) {
                        console.error('[askJoinConfirmation] Ошибка:', err);
                    }
                })();
            },

            registerUserToAppeal: ({ context }) => {
                const { connectorName, userId, chatId, appealId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            `✅ Вы присоединились к обращению ${appealId ?? ''}. Вы будете получать уведомления о его статусе.`,
                        );
                    } catch (err) {
                        console.error('[registerUserToAppeal] Ошибка:', err);
                    }
                })();
            },

            notifyJoinCancelled: ({ context }) => {
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
                            '↩️ Присоединение отменено. Возврат к списку обращений.',
                        );
                    } catch (err) {
                        console.error('[notifyJoinCancelled] Ошибка:', err);
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
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            '❓ Доступные кнопки: "Да, присоединиться" / "Нет, назад"',
                        );
                    } catch (err) {
                        console.error('[showHelp] Ошибка:', err);
                    }
                })();
            },
        },
    },
);
