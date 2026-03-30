import { assign, createMachine, fromPromise, sendParent } from 'xstate';

import { createAppeal } from '../services/dynamo-service.js';

export interface AppealCreateContext {
    userId: string;
    connectorName: string;
    chatId: string;
    description: string;
    category: string;
    software: string;
    criticality: string;
    attachments: string[];
    createdAppealId: string | undefined;
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
            input: { userId: string; connectorName: string; chatId: string };
        },

        context: ({ input }) => ({
            userId: input?.userId ?? '',
            connectorName: input?.connectorName ?? '',
            chatId: input?.chatId ?? '',
            description: '',
            category: '',
            software: '',
            criticality: '',
            attachments: [],
            createdAppealId: undefined,
        }),

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
                    ATTACH_FILE: {
                        actions: 'addAttachmentFromEvent',
                    },
                    BACK: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            fixationAppeal: {
                entry: 'showAppealPreview',
                on: {
                    CONFIRM_FIXATION: { target: 'savingAppeal' },
                    CANCEL_FIXATION: { target: 'manageAppeal' },
                    HELP: { actions: 'showHelp' },
                },
            },

            savingAppeal: {
                entry: 'notifySaving',
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
                        return { appealId };
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
                        actions: [
                            assign({
                                createdAppealId: ({ event }) =>
                                    event.output?.appealId,
                            }),
                            'notifyCreated',
                            'notifyParentCreated',
                        ],
                    },
                    onError: {
                        target: 'manageAppeal',
                        actions: 'notifySaveError',
                    },
                },
            },

            created: {
                type: 'final',
                output: () => ({ result: 'created' as const }),
            },

            cancelled: {
                type: 'final',
                output: () => ({ result: 'cancelled' as const }),
            },
        },
    },
    {
        actions: {
            showManageMenu: ({ context }) => {
                const { connectorName, userId, chatId, description, category, software, criticality, attachments } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        const filled: string[] = [];
                        if (description) filled.push(`📝 ${description.slice(0, 30)}`);
                        if (category) filled.push(`📂 ${category}`);
                        if (software) filled.push(`💻 ${software}`);
                        if (criticality) filled.push(`⚠️ ${criticality}`);
                        if (attachments.length > 0)
                            filled.push(`📎 ${attachments.length} файл(ов)`);

                        const preview =
                            filled.length > 0
                                ? '\n\nЗаполнено:\n' + filled.join('\n')
                                : '';

                        await messagingService.sendKeyboard(
                            connectorName,
                            userId,
                            chatId,
                            `🧭 Создание обращения${preview}`,
                            [
                                { text: 'Добавить описание' },
                                { text: 'Выбрать категорию' },
                                { text: 'Указать ПО' },
                                { text: 'Задать критичность' },
                                { text: 'Прикрепить файл' },
                                { text: 'Подтвердить' },
                                { text: 'Отмена' },
                            ],
                        );
                    } catch (err) {
                        console.error('[showManageMenu] Ошибка:', err);
                    }
                })();
            },

            promptDescription: ({ context }) => {
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
                            '📝 Введите описание обращения:',
                        );
                    } catch (err) {
                        console.error('[promptDescription] Ошибка:', err);
                    }
                })();
            },

            promptCategory: ({ context }) => {
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
                            '📂 Выберите категорию обращения:',
                            [
                                { text: 'Техподдержка' },
                                { text: 'Программное обеспечение' },
                                { text: 'Оборудование' },
                                { text: 'Другое' },
                                { text: 'Назад' },
                            ],
                        );
                    } catch (err) {
                        console.error('[promptCategory] Ошибка:', err);
                    }
                })();
            },

            promptSoftware: ({ context }) => {
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
                            '💻 Укажите название программного обеспечения:',
                        );
                    } catch (err) {
                        console.error('[promptSoftware] Ошибка:', err);
                    }
                })();
            },

            promptCriticality: ({ context }) => {
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
                            '⚠️ Укажите степень критичности:',
                            [
                                { text: 'Критическая' },
                                { text: 'Высокая' },
                                { text: 'Нормальная' },
                                { text: 'Низкая' },
                                { text: 'Назад' },
                            ],
                        );
                    } catch (err) {
                        console.error('[promptCriticality] Ошибка:', err);
                    }
                })();
            },

            promptAttachments: ({ context }) => {
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
                            '📎 Отправьте изображения. Когда закончите — нажмите "Готово":',
                            [{ text: 'Готово' }, { text: 'Назад' }],
                        );
                    } catch (err) {
                        console.error('[promptAttachments] Ошибка:', err);
                    }
                })();
            },

            showAppealPreview: ({ context }) => {
                const { connectorName, userId, chatId, description, category, software, criticality, attachments } =
                    context;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        const preview =
                            `📌 Предпросмотр обращения:\n` +
                            `📝 Описание: ${description || '(не указано)'}\n` +
                            `📂 Категория: ${category || '(не указана)'}\n` +
                            `💻 ПО: ${software || '(не указано)'}\n` +
                            `⚠️ Критичность: ${criticality || '(не указана)'}\n` +
                            `📎 Вложений: ${attachments.length}`;

                        await messagingService.sendKeyboard(
                            connectorName,
                            userId,
                            chatId,
                            preview,
                            [
                                { text: 'Подтвердить и создать' },
                                { text: 'Вернуться к редактированию' },
                            ],
                        );
                    } catch (err) {
                        console.error('[showAppealPreview] Ошибка:', err);
                    }
                })();
            },

            notifySaving: ({ context }) => {
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
                            '💾 Сохраняем обращение...',
                        );
                    } catch (err) {
                        console.error('[notifySaving] Ошибка:', err);
                    }
                })();
            },

            notifyCreated: ({ context, event }) => {
                const { connectorName, userId, chatId } = context;
                const appealId = (event as any).output?.appealId;
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            `✅ Обращение ${appealId ? `#${appealId}` : ''} успешно создано! Ожидайте ответа от специалиста.`,
                        );
                    } catch (err) {
                        console.error('[notifyCreated] Ошибка:', err);
                    }
                })();
            },

            notifySaveError: ({ context, event }) => {
                const { connectorName, userId, chatId } = context;
                const error = (event as any).error;
                console.error('[savingAppeal] Ошибка:', error);
                (async () => {
                    try {
                        const { default: messagingService } = await import(
                            '../services/messaging-service.js'
                        );
                        await messagingService.sendText(
                            connectorName,
                            userId,
                            chatId,
                            '❌ Не удалось сохранить обращение. Попробуйте ещё раз.',
                        );
                    } catch (err) {
                        console.error('[notifySaveError] Ошибка:', err);
                    }
                })();
            },

            notifyParentCreated: sendParent(() => ({
                type: 'CREATION_RESULT',
                result: 'created' as const,
            })),

            notifyParentCancelled: sendParent(() => ({
                type: 'CREATION_RESULT',
                result: 'cancelled' as const,
            })),

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

            addAttachmentFromEvent: assign({
                attachments: ({ context, event }) =>
                    event.type === 'ATTACH_FILE' && event.fileId
                        ? [...context.attachments, event.fileId]
                        : context.attachments,
            }),

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
                            '❓ Команды: "Добавить описание", "Выбрать категорию", "Указать ПО", "Задать критичность", "Прикрепить файл", "Подтвердить", "Отмена"',
                        );
                    } catch (err) {
                        console.error('[showHelp] Ошибка:', err);
                    }
                })();
            },
        },
    },
);
