# Support Bot IST — Документация по модулю машин состояний

## Содержание

1. [Обзор архитектуры](#обзор-архитектуры)
2. [Технологии](#технологии)
3. [Машины состояний](#машины-состояний)
   - [supportAppealMachine — Машина обращения (сотрудник поддержки)](#1-supportappealmachine--машина-обращения-сотрудник-поддержки)
   - [appealRootMachine — Корневая машина пользователя](#2-appealrootmachine--корневая-машина-пользователя)
   - [appealCreateMachine — Машина создания обращения](#3-appealcreatemachine--машина-создания-обращения)
   - [appealJoinMachine — Машина присоединения к обращению](#4-appealjoinmachine--машина-присоединения-к-обращению)
   - [repairBotMachine — Демо-машина диагностики](#5-repairbotmachine--демо-машина-диагностики)
4. [StateService — Управление состояниями](#stateservice--управление-состояниями)
5. [Взаимодействие между машинами](#взаимодействие-между-машинами)
6. [Диаграммы переходов](#диаграммы-переходов)

---

## Обзор архитектуры

Система использует **конечные автоматы (State Machines)** на базе библиотеки [XState v5](https://stately.ai/docs/xstate) для управления логикой обработки обращений в службу поддержки. Каждый пользователь (клиент или сотрудник) имеет свою изолированную машину состояний, сериализованную в DynamoDB и кэшированную в памяти.

Сообщения из мессенджеров (Telegram, WhatsApp и др.) поступают через **MessengerAggregator**, нормализуются в единый формат `UnifiedMessage` и транслируются в события XState, которые двигают машины состояний.

Все машины создаются с помощью `createMachine()` из XState v5 и имеют строгую типизацию через TypeScript: контекст, события и входные данные описываются отдельными интерфейсами.

---

## Технологии

| Технология | Назначение |
|---|---|
| **XState v5** | Конечные автоматы (FSM / Statecharts) |
| **NodeCache** | In-memory кэш (L1) для состояний пользователей |
| **DynamoDB** | Постоянное хранилище снимков машин (L2) |
| **Express.js** | HTTP-сервер и маршруты API |
| **TypeScript** | Строгая типизация всего кода |
| **MinIO (S3)** | Хранение вложений (файлов/изображений) |

---

## Машины состояний

---

### 1. `supportAppealMachine` — Машина обращения (сотрудник поддержки)

**Файл:** `src/machines/support-appeal-machine.ts`

Главная машина жизненного цикла обращения со стороны **сотрудника поддержки**. Управляет назначением, переназначением, вводом решения и закрытием обращения. Уведомляет как сотрудника, так и клиента о каждом изменении статуса через соответствующие мессенджер-коннекторы.

---

#### Контекст (`SupportAppealContext`)

```ts
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
```

| Поле | Тип | Описание |
|---|---|---|
| `appealId` | `string` | Уникальный идентификатор обращения |
| `staffUserId` | `string` | ID пользователя-сотрудника в канале поддержки |
| `staffConnectorName` | `string` | Имя коннектора (мессенджера) сотрудника (напр. `telegram`) |
| `staffChatId` | `string` | ID чата сотрудника в мессенджере |
| `userUserId` | `string` | ID пользователя-клиента |
| `userConnectorName` | `string` | Имя коннектора (мессенджера) клиента |
| `userChatId` | `string` | ID чата клиента в мессенджере |
| `accepterEmployeeId` | `string \| undefined` | ID сотрудника, взявшего обращение в работу |
| `accepterEmployeeName` | `string \| undefined` | Имя сотрудника, взявшего обращение в работу |
| `solutionText` | `string \| undefined` | Текст решения, введённого сотрудником при закрытии |

Поля `accepterEmployeeId`, `accepterEmployeeName`, `solutionText` инициализируются как `undefined` и заполняются при соответствующих событиях.

---

#### Входные данные (`input`)

При создании (`createActor(supportAppealMachine, { input: ... })`) передаются обязательные поля:

```ts
input: {
    appealId: string;
    staffUserId: string;
    staffConnectorName: string;
    staffChatId: string;
    userUserId: string;
    userConnectorName: string;
    userChatId: string;
}
```

---

#### События (`SupportAppealEvent`)

```ts
export type SupportAppealEvent =
    | { type: 'TAKE_WORK'; userId: string; userName: string }
    | { type: 'SOLVE' }
    | { type: 'REASSIGN'; newUserId: string; newUserName: string }
    | { type: 'RELEASE' }
    | { type: 'SUBMIT_SOLUTION'; text: string }
    | { type: 'CANCEL' }
    | { type: 'AUTO_REMIND' };
```

| Событие | Доп. поля | Описание |
|---|---|---|
| `TAKE_WORK` | `userId`, `userName` | Сотрудник берёт обращение в работу |
| `SOLVE` | — | Сотрудник инициирует закрытие обращения (переход к вводу решения) |
| `REASSIGN` | `newUserId`, `newUserName` | Переназначение другому сотруднику (без смены состояния) |
| `RELEASE` | — | Возврат обращения в очередь (снятие исполнителя) |
| `SUBMIT_SOLUTION` | `text` | Сотрудник отправляет текст решения |
| `CANCEL` | — | Отмена ввода решения, возврат в `In_progress` |
| `AUTO_REMIND` | — | Внешний триггер-напоминание (обращение долго без исполнителя) |

---

#### Состояния

| Состояние | Тип | `entry`-действие | Описание |
|---|---|---|---|
| `Created` | обычное | `notifyCreated` | Обращение создано, ожидает назначения |
| `In_progress` | обычное | `notifyInProgress` | Обращение взято в работу сотрудником |
| `Solving` | обычное | `promptSolution` | Запрашивается текст решения у сотрудника |
| `Closed` | `final` | `notifyClosed` | Обращение закрыто (терминальное) |

**Переходы из `Created`:**
- `TAKE_WORK` → `In_progress` + действия `assignEmployee`, `notifyTaken`
- `AUTO_REMIND` → (остаётся в `Created`) + действие `sendReminder`

**Переходы из `In_progress`:**
- `SOLVE` → `Solving`
- `REASSIGN` → (остаётся в `In_progress`) + действия `reassignEmployee`, `notifyReassigned`
- `RELEASE` → `Created` + действия `releaseEmployee`, `notifyReleased`

**Переходы из `Solving`:**
- `SUBMIT_SOLUTION` → `Closed` + действия `saveSolution`, `notifySolved`
- `CANCEL` → `In_progress` + действие `notifySolutionCancelled`

---

#### Действия (`actions`)

**Мутации контекста (`assign`):**

| Действие | Что изменяет |
|---|---|
| `assignEmployee` | Записывает `accepterEmployeeId` и `accepterEmployeeName` из события `TAKE_WORK` |
| `reassignEmployee` | Обновляет `accepterEmployeeId` и `accepterEmployeeName` из события `REASSIGN` |
| `releaseEmployee` | Сбрасывает `accepterEmployeeId` и `accepterEmployeeName` в `undefined` |
| `saveSolution` | Записывает `solutionText` из поля `text` события `SUBMIT_SOLUTION` |

**Side-effects (уведомления, все асинхронные):**

| Действие | Канал | Сообщение |
|---|---|---|
| `notifyCreated` | → сотрудник | Клавиатура: "Взять в работу" / "Напомнить позже" |
| `notifyInProgress` | → сотрудник | Клавиатура: "Закрыть обращение" / "Переназначить" / "Вернуть в очередь" |
| `notifyTaken` | → клиент | Текст: обращение взято в работу специалистом `accepterEmployeeName` |
| `notifyReassigned` | → клиент | Текст: обращение переназначено специалисту `accepterEmployeeName` |
| `notifyReleased` | → клиент | Текст: обращение возвращено в очередь |
| `promptSolution` | → сотрудник | Клавиатура: запрос ввода текста решения + кнопка "Отмена" |
| `notifySolved` | → клиент + сотрудник | Клиенту: текст решения; сотруднику: подтверждение закрытия |
| `notifySolutionCancelled` | → сотрудник | Текст: ввод решения отменён, обращение остаётся в работе |
| `notifyClosed` | console.log | Логирует факт закрытия |
| `sendReminder` | → сотрудник | Текст: напоминание о необработанном обращении |

Все side-effect действия используют паттерн `(async () => { ... })()` — немедленно вызываемая асинхронная функция внутри синхронного коллбека XState. `messagingService` импортируется динамически (`await import(...)`) для избежания циклических зависимостей.

---

#### Уведомления по каналам

Машина работает одновременно с **двумя каналами**:

| Переменные | Назначение |
|---|---|
| `staffConnectorName`, `staffChatId`, `staffUserId` | Чат сотрудника поддержки |
| `userConnectorName`, `userChatId`, `userUserId` | Чат клиента |

---

### 2. `appealRootMachine` — Корневая машина пользователя

**Файл:** `src/machines/main-states.ts`

Корневая машина навигации со стороны **клиента**. Управляет перемещением между экранами: приветствие → список обращений → карточка обращения. Запускает дочерние машины через механизм `invoke`.

---

#### Контекст (`AppealRootContext`)

```ts
export interface AppealRootContext {
    userId: string;
    connectorName: string;
    chatId: string;
    keyboardMessageId: string | undefined;
    appealId: string | undefined;
}
```

| Поле | Тип | Описание |
|---|---|---|
| `userId` | `string` | ID пользователя-клиента |
| `connectorName` | `string` | Имя мессенджера (напр. `telegram`) |
| `chatId` | `string` | ID чата пользователя |
| `keyboardMessageId` | `string \| undefined` | ID сообщения с клавиатурой (резерв для редактирования) |
| `appealId` | `string \| undefined` | ID выбранного обращения при просмотре карточки |

---

#### События (`AppealRootEvent`)

| Событие | Поля | Описание |
|---|---|---|
| `START` | — | Зарезервировано |
| `OPEN_LIST` | — | Перейти к списку обращений |
| `SELECT_APPEAL` | `appealId: string` | Выбрать конкретное обращение из списка |
| `OPEN_CREATE` | — | Перейти к созданию нового обращения |
| `JOIN_APPEAL` | — | Запустить процесс присоединения к обращению |
| `BACK` | — | Вернуться назад (зависит от текущего состояния) |
| `HELP` | — | Показать справку (side-effect, без смены состояния) |
| `CREATION_RESULT` | `result: 'created' \| 'cancelled'` | Результат от дочерней машины (дублирует `onDone`) |
| `ADD_DESCRIPTION` | `description?: string` | Проксируется в `appealCreateMachine` |
| `SELECT_CATEGORY` | `category?: string` | Проксируется в `appealCreateMachine` |
| `CHOOSE_SOFTWARE` | `software?: string` | Проксируется в `appealCreateMachine` |
| `SET_CRITICALITY` | `criticality?: string` | Проксируется в `appealCreateMachine` |
| `ATTACH_FILE` | `fileId?: string` | Проксируется в `appealCreateMachine` |
| `STOP_ATTACHING` | — | Проксируется в `appealCreateMachine` |
| `CONFIRM_CREATION` | — | Проксируется в `appealCreateMachine` |
| `CANCEL_CREATION` | — | Проксируется в `appealCreateMachine` |
| `CONFIRM_FIXATION` | — | Проксируется в `appealCreateMachine` |
| `CANCEL_FIXATION` | — | Проксируется в `appealCreateMachine` |
| `TEXT_INPUT` | `text: string` | Проксируется в `appealCreateMachine` |

---

#### Состояния

| Состояние | `entry` | Описание |
|---|---|---|
| `welcome` | `showWelcome` | Главное меню: "Мои обращения" / "Создать обращение" / "Помощь" |
| `listAppeals` | `showAppealList` | Список обращений пользователя (загружается из БД) |
| `specificAppeal` | `showAppealCard` | Карточка выбранного обращения с кнопкой "Присоединиться" |
| `joinMaster` | — | Invoke: `appealJoinMachine` |
| `createAppeal` | — | Invoke: `appealCreateMachine` + форвардинг событий |

**Переход `SELECT_APPEAL`** сопровождается `assign({ appealId: event.appealId })` — ID обращения сохраняется в контекст и передаётся в дочернюю машину.

**Форвардинг событий в `createAppeal`:** все события, относящиеся к заполнению формы, перенаправляются напрямую в дочернюю машину через `forwardTo('appealCreateMachine')`. Корневая машина выступает тонким прокси.

---

#### Действия

| Действие | Что делает |
|---|---|
| `showWelcome` | Отправляет клавиатуру с главным меню |
| `showAppealList` | Вызывает `listRequestsForUser(userId)`, отправляет клавиатуру + текстовый список обращений |
| `showAppealCard` | Показывает карточку обращения (`appealId`) с кнопками "Присоединиться" / "Назад" |
| `handleAppealCreated` | Уведомление об успешном создании обращения |
| `handleAppealCancelled` | Уведомление об отмене создания обращения |
| `showHelp` | Клавиатура со справкой по доступным командам |

---

### 3. `appealCreateMachine` — Машина создания обращения

**Файл:** `src/machines/master-create-appeal.ts`

Дочерняя машина, управляющая **пошаговым заполнением формы** нового обращения. Запускается через `invoke` из `appealRootMachine`. По завершении передаёт результат родителю через `sendParent` и через стандартный механизм `output` финального состояния.

---

#### Контекст (`AppealCreateContext`)

```ts
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
```

| Поле | Тип | Начальное значение | Описание |
|---|---|---|---|
| `userId` | `string` | из `input` | ID пользователя |
| `connectorName` | `string` | из `input` | Имя мессенджера |
| `chatId` | `string` | из `input` | ID чата |
| `description` | `string` | `''` | Описание проблемы |
| `category` | `string` | `''` | Категория обращения |
| `software` | `string` | `''` | Название ПО |
| `criticality` | `string` | `''` | Степень критичности |
| `attachments` | `string[]` | `[]` | Массив ID вложенных файлов (S3-ключи) |
| `createdAppealId` | `string \| undefined` | `undefined` | ID созданного обращения (заполняется после сохранения) |

---

#### События (`AppealCreateEvent`)

| Событие | Поля | Описание |
|---|---|---|
| `ADD_DESCRIPTION` | `description?: string` | Переход к вводу описания |
| `SELECT_CATEGORY` | `category?: string` | Переход к выбору категории |
| `CHOOSE_SOFTWARE` | `software?: string` | Переход к вводу ПО |
| `SET_CRITICALITY` | `criticality?: string` | Переход к выбору критичности |
| `ATTACH_FILE` | `fileId?: string` | Прикрепить файл (добавляется в массив `attachments`) |
| `STOP_ATTACHING` | — | Завершить прикрепление файлов |
| `CONFIRM_CREATION` | — | Перейти к предпросмотру перед созданием |
| `CANCEL_CREATION` | — | Отменить создание и выйти |
| `CONFIRM_FIXATION` | — | Подтвердить предпросмотр и сохранить в БД |
| `CANCEL_FIXATION` | — | Вернуться к редактированию из предпросмотра |
| `BACK` | — | Вернуться к главному меню формы |
| `HELP` | — | Показать справку |
| `TEXT_INPUT` | `text: string` | Ввод свободного текста пользователем |

---

#### Состояния

| Состояние | `entry` | Описание |
|---|---|---|
| `manageAppeal` | `showManageMenu` | Главное меню формы, отображает заполненные поля |
| `waitingDescription` | `promptDescription` | Ожидание текстового ввода описания |
| `chooseCategory` | `promptCategory` | Выбор категории из клавиатуры |
| `waitingSoftware` | `promptSoftware` | Ожидание текстового ввода названия ПО |
| `waitingCriticality` | `promptCriticality` | Выбор критичности из клавиатуры |
| `waitingAttachments` | `promptAttachments` | Ожидание прикрепления файлов |
| `fixationAppeal` | `showAppealPreview` | Предпросмотр всех полей перед сохранением |
| `savingAppeal` | `notifySaving` + `invoke` | Асинхронное сохранение в DynamoDB |
| `created` | — | `final`: успех, `output: { result: 'created' }` |
| `cancelled` | — | `final`: отмена, `output: { result: 'cancelled' }` |

---

#### Асинхронный `invoke` в состоянии `savingAppeal`

```ts
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
    input: ({ context }) => ({ ...context }),
    onDone: {
        target: 'created',
        actions: [assign({ createdAppealId: event.output.appealId }), 'notifyCreated', 'notifyParentCreated']
    },
    onError: {
        target: 'manageAppeal',
        actions: 'notifySaveError'
    }
}
```

При успехе `notifyParentCreated` вызывает `sendParent({ type: 'CREATION_RESULT', result: 'created' })`, уведомляя `appealRootMachine`.

---

#### Действия `assign` (мутации контекста)

| Действие | Источник данных | Поле контекста |
|---|---|---|
| `saveDescriptionFromEvent` | `ADD_DESCRIPTION.description` | `description` |
| `saveDescriptionFromTextInput` | `TEXT_INPUT.text` | `description` |
| `saveCategoryFromEvent` | `SELECT_CATEGORY.category` | `category` |
| `saveCategoryFromTextInput` | `TEXT_INPUT.text` | `category` |
| `saveSoftwareFromEvent` | `CHOOSE_SOFTWARE.software` | `software` |
| `saveSoftwareFromTextInput` | `TEXT_INPUT.text` | `software` |
| `saveCriticalityFromEvent` | `SET_CRITICALITY.criticality` | `criticality` |
| `saveCriticalityFromTextInput` | `TEXT_INPUT.text` | `criticality` |
| `addAttachmentFromEvent` | `ATTACH_FILE.fileId` | `attachments` (push) |

---

#### Справочники значений

**Категории** (клавиатура в `promptCategory`):
- `Техподдержка`
- `Программное обеспечение`
- `Оборудование`
- `Другое`

**Критичность** (клавиатура в `promptCriticality`):
- `Критическая`
- `Высокая`
- `Нормальная`
- `Низкая`

---

### 4. `appealJoinMachine` — Машина присоединения к обращению

**Файл:** `src/machines/master-join-appeal.ts`

Короткая дочерняя машина для подтверждения присоединения к уже существующему обращению. Запускается через `invoke` из `appealRootMachine` в состоянии `joinMaster`.

---

#### Контекст (`AppealJoinContext`)

```ts
export interface AppealJoinContext {
    userId: string;
    appealId: string | undefined;
    connectorName: string;
    chatId: string;
}
```

| Поле | Тип | Описание |
|---|---|---|
| `userId` | `string` | ID пользователя |
| `appealId` | `string \| undefined` | ID обращения, к которому присоединяется пользователь |
| `connectorName` | `string` | Имя мессенджера |
| `chatId` | `string` | ID чата |

---

#### События (`AppealJoinEvent`)

```ts
export type AppealJoinEvent =
    | { type: 'CONFIRM' }
    | { type: 'CANCEL_JOIN' }
    | { type: 'QUIT_FROM_MASTER' }
    | { type: 'HELP' };
```

| Событие | Описание |
|---|---|
| `CONFIRM` | Подтвердить присоединение |
| `CANCEL_JOIN` | Отменить присоединение |
| `QUIT_FROM_MASTER` | Выйти из мастера (зарезервировано) |
| `HELP` | Показать справку по кнопкам |

---

#### Состояния

| Состояние | Тип | `entry` | Описание |
|---|---|---|---|
| `confirmJoin` | обычное | `askJoinConfirmation` | Запрос подтверждения: "Да, присоединиться" / "Нет, назад" |
| `registerJoin` | `final` | `registerUserToAppeal` | Уведомление об успешном присоединении |
| `cancelJoinProcess` | `final` | `notifyJoinCancelled` | Уведомление об отмене |

При завершении машины (`onDone`) родительская `appealRootMachine` переходит в `listAppeals`.

---

#### Действия

| Действие | Что делает |
|---|---|
| `askJoinConfirmation` | Клавиатура с вопросом о присоединении к `appealId` |
| `registerUserToAppeal` | Текст: подтверждение присоединения, пользователь будет получать уведомления |
| `notifyJoinCancelled` | Текст: присоединение отменено, возврат к списку |
| `showHelp` | Текст: доступные кнопки |

---

### 5. `repairBotMachine` — Демо-машина диагностики

**Файл:** `src/machines/repair-bot-machine.ts`

Простая демонстрационная машина состояний, реализующая диагностику неисправностей на основе ключевых слов в тексте. Не связана с основным бизнес-флоу и используется для демонстрации принципа работы XState.

---

#### Контекст (`BotContext`)

```ts
export interface BotContext {
    problem?: string;
    solution?: string;
}
```

| Поле | Описание |
|---|---|
| `problem` | Описание проблемы, введённое пользователем |
| `solution` | Вычисленное решение (`WD-40`, `Изолента` или их комбинация) |

---

#### Логика определения решения

Вычисляется синхронно в `assign` при событии `DESCRIBE_PROBLEM`:

```ts
solution: ({ event }) => {
    const problem = event.problem.toLowerCase();
    if (problem.includes('скрипит') || problem.includes('заедает')) return 'WD-40';
    if (problem.includes('трещит') || problem.includes('отваливается')) return 'Изолента';
    return 'WD-40 или изолента';
}
```

| Ключевые слова | Решение |
|---|---|
| `скрипит`, `заедает` | `WD-40` |
| `трещит`, `отваливается` | `Изолента` |
| (любое другое) | `WD-40 или изолента` |

---

#### Состояния

| Состояние | Описание |
|---|---|
| `idle` | Начальное состояние, ожидает `START` |
| `awaitingProblem` | Ожидает описания проблемы |
| `solution` | Отображает вычисленное решение |
| `success` | Подтверждённое решение принято |

---

## `StateService` — Управление состояниями

**Файл:** `src/services/state-service.ts`

Синглтон-сервис (`export default new StateService()`) с двухуровневым хранилищем для персистентности состояний XState-машин каждого пользователя.

---

### Архитектура хранения (L1 + L2)

```
Запрос userId
     │
     ├─► L1: NodeCache (in-memory)
     │       TTL: 3600 сек (1 час)
     │       Быстрый доступ, теряется при рестарте сервера
     │
     └─► L2: DynamoDB
             Постоянное хранилище
             Переживает рестарты, масштабируется горизонтально
```

---

### Структура `UserState`

```ts
interface UserState {
    actor: any;          // Экземпляр XState actor
    context: any;        // Контекст машины
    history: Array<{
        state: string;       // Имя состояния
        timestamp: string;   // ISO-метка времени перехода
    }>;
}
```

---

### Методы

#### In-memory (L1) — синхронные операции

| Метод | Сигнатура | Описание |
|---|---|---|
| `getUserState` | `(userId: string) => UserState \| undefined` | Читает состояние из NodeCache |
| `setUserState` | `(userId: string, state: UserState) => boolean` | Записывает в NodeCache |
| `deleteUserState` | `(userId: string) => number` | Удаляет из NodeCache |
| `getAllUsers` | `() => string[]` | Возвращает все ключи из кэша |

#### DynamoDB (L2) — асинхронные операции

| Метод | Сигнатура | Описание |
|---|---|---|
| `saveUserSnapshot` | `(userId, actor, machineType) => Promise<boolean>` | Сохраняет или обновляет снимок машины |
| `loadUserSnapshot` | `(userId) => Promise<any \| undefined>` | Загружает снимок из DynamoDB |
| `deleteSnapshot` | `(userId) => Promise<boolean>` | Удаляет снимок из DynamoDB |
| `getUserSnapshotWithMeta` | `(userId) => Promise<{ snapshot, machineType, currentState } \| undefined>` | Загружает снимок с метаданными |
| `clearUserState` | `(userId) => Promise<void>` | Полная очистка: L1 кэш + L2 DynamoDB |

---

### `saveUserSnapshot` — детали работы

```ts
async saveUserSnapshot(userId: string, actor: any, machineType: string): Promise<boolean>
```

1. Получает снимок: `actor.getPersistedSnapshot()` или `actor.getSnapshot()`
2. Определяет имя текущего состояния из `snapshot.value`
3. Проверяет наличие записи в DynamoDB через `getUserState(userId)`
4. **Если запись существует** → `updateUserState(userId, { snapshot, context, currentState, machineType })`
5. **Если записи нет** → `createUserState({ userId, snapshot, context, currentState, machineType })`

**Параметр `machineType`** позволяет при загрузке снимка определить, какую именно машину нужно восстановить (напр. `appealRoot`, `supportAppeal`).

---

## Взаимодействие между машинами

```
appealRootMachine (клиент)
│
├── state: createAppeal
│   └── invoke: appealCreateMachine (дочерняя)
│       ├── onDone(result='created')  → appealRootMachine → listAppeals
│       └── onDone(result='cancelled') → appealRootMachine → welcome
│       (дополнительно: sendParent({ type: 'CREATION_RESULT' }) для обратной совместимости)
│
└── state: joinMaster
    └── invoke: appealJoinMachine (дочерняя)
        └── onDone → appealRootMachine → listAppeals

supportAppealMachine (сотрудник)
    Независимый actor, не связан иерархически с машиной клиента
    Параллельно уведомляет обе стороны через два коннектора:
    ├── staffConnector → чат сотрудника
    └── userConnector  → чат клиента
```

---

## Диаграммы переходов

### `supportAppealMachine`

```
                  AUTO_REMIND (side-effect, без смены состояния)
                       ↕
┌──────────┐  TAKE_WORK   ┌─────────────┐  SOLVE  ┌─────────┐  SUBMIT_SOLUTION  ┌────────┐
│ Created  │─────────────►│ In_progress │────────►│ Solving │─────────────────►│ Closed │
└──────────┘              └─────────────┘         └─────────┘   (final)         └────────┘
                           │          ▲               │
                           │  RELEASE │            CANCEL
                           │          │               │
                           └──────────┘    ◄──────────┘
                        REASSIGN (в том же состоянии)
```

---

### `appealRootMachine`

```
             OPEN_LIST          SELECT_APPEAL         JOIN_APPEAL
  welcome ──────────► listAppeals ──────────► specificAppeal ──────────► joinMaster
     ▲                    │  ▲                    │ BACK                 (appealJoinMachine)
     │                 BACK│  │                   ▼                      onDone → listAppeals
     │                    │  └──────────────── listAppeals
     │                    │
     │  OPEN_CREATE        │  OPEN_CREATE
     └────────────────────┴──────────────────────────────► createAppeal
                                                           (appealCreateMachine)
                                                           onDone(created)   → listAppeals
                                                           onDone(cancelled) → welcome
```

---

### `appealCreateMachine`

```
manageAppeal ──ADD_DESCRIPTION──► waitingDescription ──TEXT_INPUT──► manageAppeal
      │
      ├──SELECT_CATEGORY──► chooseCategory ──TEXT_INPUT──► manageAppeal
      │
      ├──CHOOSE_SOFTWARE──► waitingSoftware ──TEXT_INPUT──► manageAppeal
      │
      ├──SET_CRITICALITY──► waitingCriticality ──TEXT_INPUT──► manageAppeal
      │
      ├──ATTACH_FILE──► waitingAttachments ──STOP_ATTACHING──► manageAppeal
      │                       │ ATTACH_FILE (накопление)
      │
      ├──CONFIRM_CREATION──► fixationAppeal
      │                          ├─CONFIRM_FIXATION──► savingAppeal ──onDone──► created (final)
      │                          │                                   ──onError──► manageAppeal
      │                          └─CANCEL_FIXATION──► manageAppeal
      │
      └──CANCEL_CREATION──► cancelled (final)
```

---

### `appealJoinMachine`

```
confirmJoin ──CONFIRM──► registerJoin (final)
     │
     └──CANCEL_JOIN──► cancelJoinProcess (final)
```
 