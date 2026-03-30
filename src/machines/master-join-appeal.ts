import { createMachine } from 'xstate';

/**
 * Контекст мастера присоединения к обращению
 */
export interface AppealJoinContext {
    userId: string | undefined;
    appealId: string | undefined;
}

/**
 * Возможные события
 */
export type AppealJoinEvent =
    | { type: 'CONFIRM' }
    | { type: 'CANCEL_JOIN' }
    | { type: 'QUIT_FROM_MASTER' }
    | { type: 'HELP' };

/**
 * Машина состояний для мастера присоединения к обращению.
 * Оптимизированный вариант без состояния getAppealCard.
 */
export const appealJoinMachine = createMachine(
    {
        id: 'appealMenu',
        /** Машина сразу начинается с шага подтверждения */
        initial: 'confirmJoin',

        types: {} as {
            context: AppealJoinContext;
            events: AppealJoinEvent;
        },

        context: {
            userId: undefined,
            appealId: undefined,
        },

        states: {
            /** 1️⃣ Подтверждение присоединения */
            confirmJoin: {
                entry: 'askJoinConfirmation',
                on: {
                    CONFIRM: { target: 'registerJoin' },
                    CANCEL_JOIN: { target: 'cancelJoinProcess' },
                    HELP: { actions: 'showHelp' },
                },
            },

            /** 2️⃣ Регистрация пользователя */
            registerJoin: {
                entry: 'registerUserToAppeal',
                type: 'final',
            },

            /** 3️⃣ Отмена процесса */
            cancelJoinProcess: {
                entry: 'backToListAppeals',
                type: 'final',
            },
        },
    },
    {
        actions: {
            /** Запрос подтверждения */
            askJoinConfirmation: () => {
                console.log('❓ Подтвердите присоединение к обращению.');
                console.log('→ Кнопки: [Да], [Нет]');
            },

            /** Регистрация пользователя в обращении */
            registerUserToAppeal: ({ context }) => {
                console.log('✅ Пользователь присоединён к обращению.');
                console.log(
                    `→ userId: ${context.userId}, appealId: ${context.appealId}`,
                );
                // Здесь в реальном приложении: addUserToAppeal(ctx.userId, ctx.appealId)
            },

            /** Возврат к списку обращений после отмены */
            backToListAppeals: () => {
                console.log(
                    '↩️ Присоединение отменено. Возврат к списку обращений...',
                );
            },

            /** Показать справку */
            showHelp: () => {
                console.log('Список доступных вам команд: ');
            },
        },
    },
);
