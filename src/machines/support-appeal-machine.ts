import { assign, createMachine } from 'xstate';

export interface SupportAppealContext {
    appealId: string;
    staffUserId: string;
    staffConnectorName: string;
    staffChatId: string;
    userUserId: string;
    userConnectorName: string;
    userChatId: string;
    accepterEmployeeId: string | undefined;
    accepterEmployeeName: string | undefined;
    solutionText: string | undefined;
}

export type SupportAppealEvent =
    | { type: 'TAKE_WORK'; userId: string; userName: string }
    | { type: 'SOLVE' }
    | { type: 'REASSIGN'; newUserId: string; newUserName: string }
    | { type: 'RELEASE' }
    | { type: 'SUBMIT_SOLUTION'; text: string }
    | { type: 'CANCEL' }
    | { type: 'AUTO_REMIND' };

export const supportAppealMachine = createMachine(
    {
        id: 'supportAppeal',
        initial: 'Created',

        types: {} as {
            context: SupportAppealContext;
            events: SupportAppealEvent;
            input: {
                appealId: string;
                staffUserId: string;
                staffConnectorName: string;
                staffChatId: string;
                userUserId: string;
                userConnectorName: string;
                userChatId: string;
            };
        },

        context: ({ input }) => ({
            appealId: input?.appealId ?? '',
            staffUserId: input?.staffUserId ?? '',
            staffConnectorName: input?.staffConnectorName ?? '',
            staffChatId: input?.staffChatId ?? '',
            userUserId: input?.userUserId ?? '',
            userConnectorName: input?.userConnectorName ?? '',
            userChatId: input?.userChatId ?? '',
            accepterEmployeeId: undefined,
            accepterEmployeeName: undefined,
            solutionText: undefined,
        }),

        states: {
            Created: {
                entry: 'notifyCreated',
                on: {
                    TAKE_WORK: {
                        target: 'In_progress',
                        actions: ['assignEmployee', 'notifyTaken'],
                    },
                    AUTO_REMIND: {
                        actions: 'sendReminder',
                    },
                },
            },

            In_progress: {
                entry: 'notifyInProgress',
                on: {
                    SOLVE: { target: 'Solving' },
                    REASSIGN: {
                        actions: ['reassignEmployee', 'notifyReassigned'],
                    },
                    RELEASE: {
                        target: 'Created',
                        actions: ['releaseEmployee', 'notifyReleased'],
                    },
                },
            },

            Solving: {
                entry: 'promptSolution',
                on: {
                    SUBMIT_SOLUTION: {
                        target: 'Closed',
                        actions: ['saveSolution', 'notifySolved'],
                    },
                    CANCEL: {
                        target: 'In_progress',
                        actions: 'notifySolutionCancelled',
                    },
                },
            },

            Closed: {
                type: 'final',
                entry: 'notifyClosed',
            },
        },
    },
    {
        actions: {
            assignEmployee: assign({
                accepterEmployeeId: ({ event }) =>
                    event.type === 'TAKE_WORK' ? event.userId : undefined,
                accepterEmployeeName: ({ event }) =>
                    event.type === 'TAKE_WORK' ? event.userName : undefined,
            }),

            reassignEmployee: assign({
                accepterEmployeeId: ({ event }) =>
                    event.type === 'REASSIGN' ? event.newUserId : undefined,
                accepterEmployeeName: ({ event }) =>
                    event.type === 'REASSIGN' ? event.newUserName : undefined,
            }),

            releaseEmployee: assign({
                accepterEmployeeId: undefined,
                accepterEmployeeName: undefined,
            }),

            saveSolution: assign({
                solutionText: ({ event }) =>
                    event.type === 'SUBMIT_SOLUTION' ? event.text : undefined,
            }),

            notifyCreated: ({ context }) => {
                const { staffConnectorName, staffUserId, staffChatId, appealId } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendKeyboard(
                            staffConnectorName,
                            staffUserId,
                            staffChatId,
                            `📥 Новое обращение #${appealId} ожидает распределения`,
                            [{ text: `Взять в работу` }, { text: 'Напомнить позже' }],
                        );
                    } catch (err) {
                        console.error('[support:notifyCreated] Ошибка:', err);
                    }
                })();
            },

            notifyInProgress: ({ context }) => {
                const { staffConnectorName, staffUserId, staffChatId, appealId, accepterEmployeeName } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendKeyboard(
                            staffConnectorName,
                            staffUserId,
                            staffChatId,
                            `🔧 Обращение #${appealId} в работе у ${accepterEmployeeName ?? 'вас'}`,
                            [
                                { text: 'Закрыть обращение' },
                                { text: 'Переназначить' },
                                { text: 'Вернуть в очередь' },
                            ],
                        );
                    } catch (err) {
                        console.error('[support:notifyInProgress] Ошибка:', err);
                    }
                })();
            },

            notifyTaken: ({ context }) => {
                const {
                    userConnectorName,
                    userUserId,
                    userChatId,
                    appealId,
                    accepterEmployeeName,
                } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            userConnectorName,
                            userUserId,
                            userChatId,
                            `📢 Ваше обращение #${appealId} взято в работу специалистом ${accepterEmployeeName ?? ''}.`,
                        );
                    } catch (err) {
                        console.error('[support:notifyTaken] Ошибка:', err);
                    }
                })();
            },

            notifyReassigned: ({ context }) => {
                const {
                    userConnectorName,
                    userUserId,
                    userChatId,
                    appealId,
                    accepterEmployeeName,
                } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            userConnectorName,
                            userUserId,
                            userChatId,
                            `🔄 Ваше обращение #${appealId} переназначено специалисту ${accepterEmployeeName ?? ''}.`,
                        );
                    } catch (err) {
                        console.error('[support:notifyReassigned] Ошибка:', err);
                    }
                })();
            },

            notifyReleased: ({ context }) => {
                const { userConnectorName, userUserId, userChatId, appealId } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            userConnectorName,
                            userUserId,
                            userChatId,
                            `🔓 Ваше обращение #${appealId} возвращено в очередь. Ожидайте назначения специалиста.`,
                        );
                    } catch (err) {
                        console.error('[support:notifyReleased] Ошибка:', err);
                    }
                })();
            },

            promptSolution: ({ context }) => {
                const { staffConnectorName, staffUserId, staffChatId, appealId } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendKeyboard(
                            staffConnectorName,
                            staffUserId,
                            staffChatId,
                            `✍️ Введите текст решения для обращения #${appealId}:`,
                            [{ text: 'Отмена' }],
                        );
                    } catch (err) {
                        console.error('[support:promptSolution] Ошибка:', err);
                    }
                })();
            },

            notifySolved: ({ context }) => {
                const {
                    userConnectorName,
                    userUserId,
                    userChatId,
                    staffConnectorName,
                    staffUserId,
                    staffChatId,
                    appealId,
                    solutionText,
                } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            userConnectorName,
                            userUserId,
                            userChatId,
                            `✅ Ваше обращение #${appealId} закрыто.\n\nРешение: ${solutionText}`,
                        );
                        await messagingService.sendText(
                            staffConnectorName,
                            staffUserId,
                            staffChatId,
                            `🏁 Обращение #${appealId} успешно закрыто.`,
                        );
                    } catch (err) {
                        console.error('[support:notifySolved] Ошибка:', err);
                    }
                })();
            },

            notifySolutionCancelled: ({ context }) => {
                const { staffConnectorName, staffUserId, staffChatId } = context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            staffConnectorName,
                            staffUserId,
                            staffChatId,
                            '❌ Ввод решения отменён. Обращение остаётся в работе.',
                        );
                    } catch (err) {
                        console.error('[support:notifySolutionCancelled] Ошибка:', err);
                    }
                })();
            },

            notifyClosed: ({ context }) => {
                console.log(`[Обращение ${context.appealId}] Статус: Закрыто`);
            },

            sendReminder: ({ context }) => {
                const { staffConnectorName, staffUserId, staffChatId, appealId } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            staffConnectorName,
                            staffUserId,
                            staffChatId,
                            `⏰ Напоминание: обращение #${appealId} всё ещё ожидает распределения!`,
                        );
                    } catch (err) {
                        console.error('[support:sendReminder] Ошибка:', err);
                    }
                })();
            },
        },
    },
);
