import { assign, createMachine, forwardTo } from 'xstate';

import { appealCreateMachine } from './master-create-appeal.js';
import { appealJoinMachine } from './master-join-appeal.js';

/**
 * Контекст корневой машины
 */
export interface AppealRootContext {
    userId: string | undefined;
    appealId?: string | undefined;
}

/**
 * События для корневой машины
 */
export type AppealRootEvent =
    | { type: 'START' }
    | { type: 'OPEN_LIST' }
    | { type: 'SELECT_APPEAL'; appealId: string }
    | { type: 'OPEN_CREATE' }
    | { type: 'JOIN_APPEAL' }
    | { type: 'BACK' }
    | { type: 'CREATION_RESULT'; result: 'created' | 'cancelled' }
    | { type: 'HELP' }
    // События для пересылки в дочернюю машину создания обращения
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

/**
 * Корневая машина, объединяющая создание и присоединение к обращениям
 */
export const appealRootMachine = createMachine(
    {
        id: 'appealRoot',
        initial: 'welcome',

        types: {} as {
            context: AppealRootContext;
            events: AppealRootEvent;
            input: { userId: string } | undefined;
        },

        context: ({ input }) => ({
            userId: input?.userId || undefined,
            appealId: undefined,
        }),

        states: {
            /** 👋 Приветствие */
            welcome: {
                entry: 'showWelcome',
                on: {
                    OPEN_LIST: { target: 'listAppeals' },
                    OPEN_CREATE: { target: 'createAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            /** 📋 Список обращений */
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

            /** 📄 Просмотр конкретного обращения */
            specificAppeal: {
                entry: 'showAppealCard',
                on: {
                    JOIN_APPEAL: { target: 'joinMaster' },
                    BACK: { target: 'listAppeals' },
                    HELP: { actions: 'showHelp' },
                },
            },

            /** 🤝 Мастер присоединения (вложенная машина) */
            joinMaster: {
                invoke: {
                    id: 'appealMenuMachine',
                    src: appealJoinMachine,
                    input: ({ context }) => ({
                        userId: context.userId,
                        appealId: context.appealId,
                    }),
                    onDone: { target: 'listAppeals' },
                },
                on: {
                    HELP: { actions: 'showHelp' },
                },
            },

            /** 🆕 Мастер создания обращения (вложенная машина) */
            createAppeal: {
                invoke: {
                    id: 'appealCreateMachine',
                    src: appealCreateMachine,
                    input: ({ context }) => ({
                        userId: context.userId,
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
                    /** Пересылаем все события дочерней машине */
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
                    /** Дополнительный fallback — если событие придёт напрямую */
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
            /** Приветствие */
            showWelcome: () => {
                console.log('👋 Добро пожаловать в систему обращений!');
                console.log('→ [OPEN_LIST] — перейти к списку обращений');
                console.log('→ [OPEN_CREATE] — создать новое обращение');
            },

            /** Показ списка обращений */
            showAppealList: ({ context }) => {
                // Try to fetch the list of appeals from the service and print it.
                // We intentionally don't await here so this action stays synchronous for XState entry,
                // but we log the result when it arrives.
                import('../services/appeal-service.js')
                    .then(({ listRequestsForUser }) => {
                        return listRequestsForUser(context.userId ?? undefined);
                    })
                    .then(text => {
                        console.log('📋 Список обращений:');
                        console.log(text);
                        console.log('→ [SELECT_APPEAL id] — открыть обращение');
                        console.log(
                            '→ [OPEN_CREATE] — создать новое обращление',
                        );
                        console.log('→ [BACK] — назад');
                    })
                    .catch(error => {
                        console.error(
                            'Не удалось получить список обращений:',
                            error,
                        );
                        console.log('📋 Список обращений:');
                        console.log(
                            'Ошибка при загрузке списка. Попробуйте позже.',
                        );
                    });
            },

            /** Просмотр карточки обращения */
            showAppealCard: ({ context }) => {
                console.log('📄 Карточка обращения:');
                console.log(`→ ID: ${context.appealId}`);
                console.log('→ [JOIN_APPEAL] — присоединиться');
                console.log('→ [BACK] — назад');
            },

            /** Обработка успешного создания */
            handleAppealCreated: () => {
                console.log(
                    '✅ Обращение успешно создано! Возврат к списку обращений.',
                );
            },

            /** Обработка отмены создания */
            handleAppealCancelled: () => {
                console.log(
                    '↩️ Создание обращения отменено. Возврат в приветствие.',
                );
            },

            /** Показать справку */
            showHelp: () => {
                console.log('Список доступных вам команд: ');
            },
        },
    },
);
