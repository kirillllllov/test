import { assign, createMachine, fromPromise, sendParent } from 'xstate';

import { createAppeal } from '../services/dynamo-service.js';

export interface AppealCreateContext {
    userId: string | undefined;
    description?: string;
    category?: string;
    software?: string;
    criticality?: string;
    attachments?: string[];
}

export type AppealCreateEvent =
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
    | { type: 'BACK' }
    | { type: 'HELP' }
    | { type: 'TEXT_INPUT'; text: string };

export const appealCreateMachine = createMachine(
    {
        id: 'appealCreate',
        initial: 'manageAppeal',

        types: {} as {
            context: AppealCreateContext;
            events: AppealCreateEvent;
        },

        context: {
            userId: undefined,
            description: '',
            category: '',
            software: '',
            criticality: '',
            attachments: [],
        },

        states: {
            manageAppeal: {
                entry: 'showManageMenu',
                on: {
                    ADD_DESCRIPTION: {
                        target: 'waitingDescription',
                        actions: 'saveDescriptionFromEvent',
                    },
                    SELECT_CATEGORY: {
                        target: 'chooseCategory',
                        actions: 'saveCategoryFromEvent',
                    },
                    CHOOSE_SOFTWARE: {
                        target: 'waitingSoftware',
                        actions: 'saveSoftwareFromEvent',
                    },
                    SET_CRITICALITY: {
                        target: 'waitingCriticality',
                        actions: 'saveCriticalityFromEvent',
                    },
                    ATTACH_FILE: {
                        target: 'waitingAttachments',
                        actions: 'addAttachmentFromEvent',
                    },
                    CONFIRM_CREATION: { target: 'fixationAppeal' },
                    CANCEL_CREATION: {
                        target: 'cancelled',
                        actions: 'notifyParentCancelled',
                    },
                    HELP: { actions: 'showHelp' },
                },
            },

            waitingDescription: {
                entry: 'promptDescription',
                on: {
                    TEXT_INPUT: {
                        target: 'manageAppeal',
                        actions: 'saveDescriptionFromTextInput',
                    },
                    BACK: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            chooseCategory: {
                entry: 'promptCategory',
                on: {
                    TEXT_INPUT: {
                        target: 'manageAppeal',
                        actions: 'saveCategoryFromTextInput',
                    },
                    BACK: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            waitingSoftware: {
                entry: 'promptSoftware',
                on: {
                    TEXT_INPUT: {
                        target: 'manageAppeal',
                        actions: 'saveSoftwareFromTextInput',
                    },
                    BACK: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            waitingCriticality: {
                entry: 'promptCriticality',
                on: {
                    TEXT_INPUT: {
                        target: 'manageAppeal',
                        actions: 'saveCriticalityFromTextInput',
                    },
                    BACK: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            waitingAttachments: {
                entry: 'promptAttachments',
                on: {
                    STOP_ATTACHING: { target: 'manageAppeal' },
                    BACK: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            fixationAppeal: {
                entry: 'showAppealPreview',
                on: {
                    CONFIRM_FIXATION: {
                        target: 'savingAppeal',
                    },
                    CANCEL_FIXATION: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            /** Сохранение обращения в БД */
            savingAppeal: {
                entry: () =>
                    console.log('💾 Сохранение обращения в базу данных...'),
                invoke: {
                    id: 'saveAppeal',
                    src: fromPromise(async ({ input }) => {
                        const appealId = await createAppeal({
                            userId: input.userId,
                            description: input.description,
                            category: input.category,
                            software: input.software,
                            criticality: input.criticality,
                            attachments: input.attachments,
                        });
                        return appealId;
                    }),
                    input: ({ context }) => ({
                        userId: context.userId,
                        description: context.description,
                        category: context.category,
                        software: context.software,
                        criticality: context.criticality,
                        attachments: context.attachments,
                    }),
                    onDone: {
                        target: 'created',
                        actions: ['logAppealCreated', 'notifyParentCreated'],
                    },
                    onError: {
                        target: 'manageAppeal',
                        actions: 'logSaveError',
                    },
                },
            },

            created: {
                type: 'final',
            },

            cancelled: {
                type: 'final',
            },
        },
    },
    {
        actions: {
            showManageMenu: () => {
                console.log('🧭 Управление обращением:');
            },

            promptDescription: () =>
                console.log('📝 Введите описание обращения...'),
            saveDescriptionFromEvent: assign({
                description: ({ context, event }) =>
                    event.type === 'ADD_DESCRIPTION' && event.description
                        ? event.description
                        : context.description,
            }),
            saveDescriptionFromTextInput: assign({
                description: ({ event }) =>
                    event.type === 'TEXT_INPUT' ? event.text : '',
            }),

            promptCategory: () =>
                console.log('📂 Выберите категорию обращения...'),
            saveCategoryFromEvent: assign({
                category: ({ context, event }) =>
                    event.type === 'SELECT_CATEGORY' && event.category
                        ? event.category
                        : context.category,
            }),
            saveCategoryFromTextInput: assign({
                category: ({ event }) =>
                    event.type === 'TEXT_INPUT' ? event.text : '',
            }),

            promptSoftware: () =>
                console.log('💻 Выберите программное обеспечение...'),
            saveSoftwareFromEvent: assign({
                software: ({ context, event }) =>
                    event.type === 'CHOOSE_SOFTWARE' && event.software
                        ? event.software
                        : context.software,
            }),
            saveSoftwareFromTextInput: assign({
                software: ({ event }) =>
                    event.type === 'TEXT_INPUT' ? event.text : '',
            }),

            promptCriticality: () =>
                console.log('⚠️ Укажите степень критичности...'),
            saveCriticalityFromEvent: assign({
                criticality: ({ context, event }) =>
                    event.type === 'SET_CRITICALITY' && event.criticality
                        ? event.criticality
                        : context.criticality,
            }),
            saveCriticalityFromTextInput: assign({
                criticality: ({ event }) =>
                    event.type === 'TEXT_INPUT' ? event.text : '',
            }),

            promptAttachments: () => console.log('📎 Прикрепите файлы...'),
            addAttachmentFromEvent: assign({
                attachments: ({ context, event }) =>
                    event.type === 'ATTACH_FILE' && event.fileId
                        ? [...(context.attachments ?? []), event.fileId]
                        : context.attachments,
            }),

            showAppealPreview: ({ context }) => {
                console.log('📌 Предпросмотр обращения:');
                console.log(`🧑 Пользователь: ${context.userId ?? '—'}`);
                console.log(
                    `📝 Описание: ${context.description || '(не указано)'}`,
                );
                console.log(
                    `📂 Категория: ${context.category || '(не указана)'}`,
                );
                console.log(`💻 ПО: ${context.software || '(не указано)'}`);
                console.log(
                    `⚠️ Критичность: ${context.criticality || '(не указана)'}`,
                );
                console.log(`📎 Вложений: ${context.attachments?.length || 0}`);
                console.log('');
                console.log('→ [CONFIRM_FIXATION] — подтвердить и создать');
                console.log('→ [CANCEL_FIXATION] — вернуться к редактированию');
            },

            notifyParentCreated: sendParent(() => ({
                type: 'CREATION_RESULT',
                result: 'created' as const,
            })),

            logAppealCreated: ({ event }) => {
                const appealId = (event as any).output;
                console.log(`✅ Обращение ${appealId} успешно сохранено!`);
            },

            logSaveError: ({ event }) => {
                console.error(
                    '❌ Ошибка при сохранении обращения:',
                    (event as any).error,
                );
            },

            notifyParentCancelled: sendParent(() => ({
                type: 'CREATION_RESULT',
                result: 'cancelled' as const,
            })),

            showHelp: () => {
                console.log('Список доступных вам команд: ');
            },
        },
    },
);
