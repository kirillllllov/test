import { assign, createMachine } from 'xstate';

/**
 * Контекст машины обращения в поддержке
 */
export interface SupportAppealContext {
    appealId: string;
    accepterEmployeeId: string | undefined; // ID принявшего сотрудника (Accepter_employee)
    accepterEmployeeName: string | undefined;
    solutionText: string | undefined;
}

/**
 * События машины обращения
 */
export type SupportAppealEvent =
    | { type: 'TAKE_WORK'; userId: string; userName: string }
    | { type: 'SOLVE' }
    | { type: 'REASSIGN'; newUserId: string; newUserName: string }
    | { type: 'RELEASE' }
    | { type: 'SUBMIT_SOLUTION'; text: string }
    | { type: 'CANCEL' }
    | { type: 'AUTO_REMIND' };

/**
 * Машина состояний для управления жизненным циклом обращения в чате техподдержки.
 *
 * Статусы:
 * - Created: Новое обращение, ожидает распределения.
 * - In_progress: В работе у конкретного сотрудника.
 * - Closed: Обращение закрыто, решение зафиксировано.
 *
 * Внутренние состояния:
 * - Solving: Сотрудник пишет текст решения.
 */
export const supportAppealMachine = createMachine(
    {
        id: 'supportAppeal',
        initial: 'Created',

        types: {} as {
            context: SupportAppealContext;
            events: SupportAppealEvent;
            input: { appealId: string };
        },

        context: ({ input }) => ({
            appealId: input?.appealId || '',
            accepterEmployeeId: undefined,
            accepterEmployeeName: undefined,
            solutionText: undefined,
        }),

        states: {
            /**
             * 1. Created (Новый)
             * Обращение создано и ожидает, пока кто-то из поддержки возьмет его в работу.
             */
            Created: {
                entry: 'logCreated',
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

            /**
             * 2. In_progress (В работе)
             * Обращение закреплено за сотрудником.
             */
            In_progress: {
                entry: 'logInProgress',
                on: {
                    SOLVE: {
                        target: 'Solving',
                    },
                    REASSIGN: {
                        actions: ['reassignEmployee', 'notifyReassigned'],
                    },
                    RELEASE: {
                        target: 'Created',
                        actions: ['releaseEmployee', 'notifyReleased'],
                    },
                },
            },

            /**
             * 3. Solving (Написание решения)
             * Внутреннее состояние, когда сотрудник вводит текст решения.
             * В БД статус остается In_progress.
             */
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

            /**
             * 4. Closed (Закрыт)
             * Финальное состояние.
             */
            Closed: {
                type: 'final',
                entry: 'logClosed',
            },
        },
    },
    {
        actions: {
            // Логирование входов в состояния
            logCreated: ({ context }) =>
                console.log(`[Обращение ${context.appealId}] Статус: Создано`),
            logInProgress: ({ context }) =>
                console.log(
                    `[Обращение ${context.appealId}] Статус: В работе (Исполнитель: ${context.accepterEmployeeName})`,
                ),
            logClosed: ({ context }) =>
                console.log(`[Обращение ${context.appealId}] Статус: Закрыто`),

            // Действия с контекстом
            assignEmployee: assign({
                accepterEmployeeId: ({ event }) => {
                    if (event.type === 'TAKE_WORK') return event.userId;
                    return;
                },
                accepterEmployeeName: ({ event }) => {
                    if (event.type === 'TAKE_WORK') return event.userName;
                    return;
                },
            }),

            reassignEmployee: assign({
                accepterEmployeeId: ({ event }) => {
                    if (event.type === 'REASSIGN') return event.newUserId;
                    return;
                },
                accepterEmployeeName: ({ event }) => {
                    if (event.type === 'REASSIGN') return event.newUserName;
                    return;
                },
            }),

            releaseEmployee: assign({
                accepterEmployeeId: undefined,
                accepterEmployeeName: undefined,
            }),

            saveSolution: assign({
                solutionText: ({ event }) => {
                    if (event.type === 'SUBMIT_SOLUTION') return event.text;
                    return;
                },
            }),

            // Сайд-эффекты (заглушки для интеграции с Telegram API)
            notifyTaken: ({ context }) => {
                console.log(
                    `📢 Обращение взято в работу сотрудником ${context.accepterEmployeeName}`,
                );
            },

            notifyReassigned: ({ context }) => {
                console.log(
                    `🔄 Ответственный изменен на ${context.accepterEmployeeName}`,
                );
            },

            notifyReleased: () => {
                console.log(`🔓 Обращение возвращено в общую очередь`);
            },

            promptSolution: () => {
                console.log(`✍️ Ожидание ввода решения от сотрудника...`);
            },

            notifySolved: ({ context }) => {
                console.log(
                    `✅ Решение зафиксировано: "${context.solutionText}"`,
                );
                console.log(`🏁 Обращение закрыто.`);
            },

            notifySolutionCancelled: () => {
                console.log(
                    `❌ Ввод решения отменен. Возврат к статусу В работе.`,
                );
            },

            sendReminder: ({ context }) => {
                console.log(
                    `⏰ Напоминание: Обращение ${context.appealId} ожидает распределения!`,
                );
            },
        },
    },
);
