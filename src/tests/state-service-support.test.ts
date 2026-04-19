import { createId } from '@paralleldrive/cuid2';
import { createActor } from 'xstate';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { supportAppealMachine } from '../machines/support-appeal-machine.js';

// ============================================================================
// Мокаем DB-слой, чтобы тесты не требовали запущенного DynamoDB
// ============================================================================

vi.mock('../db/tables/support-state.js', () => ({
    createSupportAppealState: vi.fn(),
    getSupportAppealState: vi.fn(),
    updateSupportAppealState: vi.fn(),
    deleteSupportAppealState: vi.fn(),
}));

vi.mock('../db/tables/user-state.js', () => ({
    createUserState: vi.fn(),
    getUserState: vi.fn(),
    updateUserState: vi.fn(),
    deleteUserState: vi.fn(),
}));

// Импортируем моки ПОСЛЕ vi.mock
import {
    createSupportAppealState,
    deleteSupportAppealState,
    getSupportAppealState,
    updateSupportAppealState,
} from '../db/tables/support-state.js';

import {
    getUserState as getUserStateFromDB,
} from '../db/tables/user-state.js';

// Импортируем сам сервис после объявления моков
import stateService from '../services/state-service.js';

// ============================================================================
// Вспомогательные функции
// ============================================================================

function buildFakeSnapshot(appealId: string, stateName = 'Created') {
    return {
        value: stateName,
        context: {
            appealId,
            accepterEmployeeId: undefined,
            accepterEmployeeName: undefined,
            solutionText: undefined,
        },
        status: 'active',
    };
}

// ============================================================================
// Тесты
// ============================================================================

describe('StateService — поддержка машины техподдержки (supportAppealMachine)', () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        // Очищаем кэш после каждого теста
        for (const id of stateService.getAllSupportAppeals()) {
            stateService.deleteSupportState(id);
        }
        for (const id of stateService.getAllUsers()) {
            stateService.deleteUserState(id);
        }
    });

    // ==========================================================================
    // 1. Операции с кэшем техподдержки
    // ==========================================================================

    describe('1. Кэш техподдержки', () => {

        it('setSupportState сохраняет состояние в кэш и возвращает true', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            const state = { actor, context: actor.getSnapshot().context, history: [] };
            const result = stateService.setSupportState(appealId, state);

            expect(result).toBe(true);
        });

        it('getSupportState возвращает ранее сохранённое состояние', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            const state = { actor, context: actor.getSnapshot().context, history: [] };
            stateService.setSupportState(appealId, state);

            const retrieved = stateService.getSupportState(appealId);

            expect(retrieved).toBeDefined();
            expect(retrieved?.actor).toBe(actor);
            expect(retrieved?.context.appealId).toBe(appealId);
        });

        it('getSupportState возвращает undefined для незарегистрированного обращения', () => {
            const result = stateService.getSupportState('non-existent-appeal');
            expect(result).toBeUndefined();
        });

        it('deleteSupportState удаляет состояние из кэша', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            stateService.deleteSupportState(appealId);

            expect(stateService.getSupportState(appealId)).toBeUndefined();
        });

        it('getAllSupportAppeals возвращает все appealId из кэша', () => {
            const ids = [createId(), createId(), createId()];

            for (const id of ids) {
                const actor = createActor(supportAppealMachine, { input: { appealId: id } });
                actor.start();
                stateService.setSupportState(id, {
                    actor,
                    context: actor.getSnapshot().context,
                    history: [],
                });
            }

            const all = stateService.getAllSupportAppeals();

            expect(all).toHaveLength(ids.length);
            for (const id of ids) {
                expect(all).toContain(id);
            }
        });

    });

    // ==========================================================================
    // 2. Изоляция кэшей: техподдержка vs пользователи
    // ==========================================================================

    describe('2. Изоляция кэша техподдержки от пользовательского', () => {

        it('один и тот же ключ в разных кэшах не пересекается', () => {
            const sharedId = createId();

            const supportActor = createActor(supportAppealMachine, { input: { appealId: sharedId } });
            supportActor.start();
            const supportState = {
                actor: supportActor,
                context: supportActor.getSnapshot().context,
                history: [],
            };

            // Кладём в оба кэша один ключ, но разные данные
            stateService.setSupportState(sharedId, supportState);
            stateService.setUserState(sharedId, {
                actor: null,
                context: { userId: 'user-marker' },
                history: [],
            });

            const fromSupportCache = stateService.getSupportState(sharedId);
            const fromUserCache = stateService.getUserState(sharedId);

            // Данные не должны перемешиваться
            expect(fromSupportCache?.context.appealId).toBe(sharedId);
            expect(fromUserCache?.context.userId).toBe('user-marker');
        });

        it('deleteSupportState не затрагивает пользовательский кэш', () => {
            const id = createId();

            stateService.setSupportState(id, {
                actor: null,
                context: { appealId: id },
                history: [],
            });
            stateService.setUserState(id, {
                actor: null,
                context: { userId: id },
                history: [],
            });

            stateService.deleteSupportState(id);

            expect(stateService.getSupportState(id)).toBeUndefined();
            expect(stateService.getUserState(id)).toBeDefined();
        });

        it('getAllSupportAppeals не возвращает ключи из пользовательского кэша', () => {
            const supportId = createId();
            const userId = createId();

            stateService.setSupportState(supportId, {
                actor: null,
                context: {},
                history: [],
            });
            stateService.setUserState(userId, {
                actor: null,
                context: {},
                history: [],
            });

            const supportKeys = stateService.getAllSupportAppeals();
            const userKeys = stateService.getAllUsers();

            expect(supportKeys).toContain(supportId);
            expect(supportKeys).not.toContain(userId);

            expect(userKeys).toContain(userId);
            expect(userKeys).not.toContain(supportId);
        });

    });

    // ==========================================================================
    // 3. XState актор: жизненный цикл и переходы состояний
    // ==========================================================================

    describe('3. Работа актора supportAppealMachine через StateService', () => {

        it('новый актор стартует в состоянии Created', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            const retrieved = stateService.getSupportState(appealId);
            const snapshot = retrieved!.actor.getSnapshot();

            expect(snapshot.value).toBe('Created');
            expect(snapshot.context.appealId).toBe(appealId);
        });

        it('событие TAKE_WORK переводит актора в состояние In_progress', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            actor.send({ type: 'TAKE_WORK', userId: 'emp-1', userName: 'Иван' });

            const snapshot = stateService.getSupportState(appealId)!.actor.getSnapshot();

            expect(snapshot.value).toBe('In_progress');
            expect(snapshot.context.accepterEmployeeId).toBe('emp-1');
            expect(snapshot.context.accepterEmployeeName).toBe('Иван');
        });

        it('событие SOLVE из In_progress переводит в Solving', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            actor.send({ type: 'TAKE_WORK', userId: 'emp-1', userName: 'Иван' });
            actor.send({ type: 'SOLVE' });

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            const snapshot = stateService.getSupportState(appealId)!.actor.getSnapshot();

            expect(snapshot.value).toBe('Solving');
        });

        it('полный цикл: Created → In_progress → Solving → Closed', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            actor.send({ type: 'TAKE_WORK', userId: 'emp-2', userName: 'Мария' });
            expect(stateService.getSupportState(appealId)!.actor.getSnapshot().value).toBe('In_progress');

            actor.send({ type: 'SOLVE' });
            expect(stateService.getSupportState(appealId)!.actor.getSnapshot().value).toBe('Solving');

            actor.send({ type: 'SUBMIT_SOLUTION', text: 'Проблема устранена' });
            const finalSnapshot = stateService.getSupportState(appealId)!.actor.getSnapshot();

            expect(finalSnapshot.value).toBe('Closed');
            expect(finalSnapshot.context.solutionText).toBe('Проблема устранена');
        });

        it('событие CANCEL из Solving возвращает в In_progress', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            actor.send({ type: 'TAKE_WORK', userId: 'emp-3', userName: 'Пётр' });
            actor.send({ type: 'SOLVE' });
            actor.send({ type: 'CANCEL' });

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            expect(stateService.getSupportState(appealId)!.actor.getSnapshot().value).toBe('In_progress');
        });

        it('событие RELEASE из In_progress возвращает в Created и сбрасывает исполнителя', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            actor.send({ type: 'TAKE_WORK', userId: 'emp-4', userName: 'Анна' });
            actor.send({ type: 'RELEASE' });

            stateService.setSupportState(appealId, {
                actor,
                context: actor.getSnapshot().context,
                history: [],
            });

            const snapshot = stateService.getSupportState(appealId)!.actor.getSnapshot();

            expect(snapshot.value).toBe('Created');
            expect(snapshot.context.accepterEmployeeId).toBeUndefined();
            expect(snapshot.context.accepterEmployeeName).toBeUndefined();
        });

        it('история состояний обновляется при переходах через subscribe', () => {
            const appealId = createId();
            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            const state = {
                actor,
                context: actor.getSnapshot().context,
                history: [] as Array<{ state: string; timestamp: string }>,
            };
            stateService.setSupportState(appealId, state);

            actor.subscribe(snapshot => {
                const current = stateService.getSupportState(appealId);
                if (current) {
                    current.history.push({
                        state: snapshot.value as string,
                        timestamp: new Date().toISOString(),
                    });
                    current.context = snapshot.context;
                    stateService.setSupportState(appealId, current);
                }
            });

            actor.send({ type: 'TAKE_WORK', userId: 'emp-5', userName: 'Алексей' });
            actor.send({ type: 'SOLVE' });

            const finalState = stateService.getSupportState(appealId);

            expect(finalState!.history.length).toBeGreaterThanOrEqual(2);
            const stateNames = finalState!.history.map(h => h.state);
            expect(stateNames).toContain('In_progress');
            expect(stateNames).toContain('Solving');
        });

    });

    // ==========================================================================
    // 4. DynamoDB: персистентность (через моки)
    // ==========================================================================

    describe('4. Персистентность состояний в DynamoDB (мок)', () => {

        it('saveSupportSnapshot вызывает createSupportAppealState если запись отсутствует', async () => {
            const appealId = createId();

            vi.mocked(getSupportAppealState).mockResolvedValueOnce(undefined);
            vi.mocked(createSupportAppealState).mockResolvedValueOnce({} as any);

            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            const result = await stateService.saveSupportSnapshot(appealId, actor, 'supportAppeal');

            expect(result).toBe(true);
            expect(createSupportAppealState).toHaveBeenCalledOnce();
            expect(updateSupportAppealState).not.toHaveBeenCalled();

            const call = vi.mocked(createSupportAppealState).mock.calls[0]![0];
            expect(call.appealId).toBe(appealId);
            expect(call.machineType).toBe('supportAppeal');
            expect(call.currentState).toBe('Created');
        });

        it('saveSupportSnapshot вызывает updateSupportAppealState если запись уже существует', async () => {
            const appealId = createId();
            const fakeSnapshot = buildFakeSnapshot(appealId, 'In_progress');

            vi.mocked(getSupportAppealState).mockResolvedValueOnce({
                id: `SUPPORT_STATE#${appealId}`,
                sk: 'METADATA',
                appealId,
                snapshot: fakeSnapshot,
                context: {},
                currentState: 'In_progress',
                machineType: 'supportAppeal',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });
            vi.mocked(updateSupportAppealState).mockResolvedValueOnce(undefined);

            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            const result = await stateService.saveSupportSnapshot(appealId, actor, 'supportAppeal');

            expect(result).toBe(true);
            expect(updateSupportAppealState).toHaveBeenCalledOnce();
            expect(createSupportAppealState).not.toHaveBeenCalled();

            const [calledId, calledUpdates] = vi.mocked(updateSupportAppealState).mock.calls[0]!;
            expect(calledId).toBe(appealId);
            expect(calledUpdates.machineType).toBe('supportAppeal');
        });

        it('saveSupportSnapshot возвращает false при ошибке DynamoDB', async () => {
            const appealId = createId();

            vi.mocked(getSupportAppealState).mockRejectedValueOnce(new Error('DynamoDB unavailable'));

            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            const result = await stateService.saveSupportSnapshot(appealId, actor, 'supportAppeal');

            expect(result).toBe(false);
        });

        it('loadSupportSnapshot возвращает снимок из DynamoDB если он есть', async () => {
            const appealId = createId();
            const fakeSnapshot = buildFakeSnapshot(appealId, 'Solving');

            vi.mocked(getSupportAppealState).mockResolvedValueOnce({
                id: `SUPPORT_STATE#${appealId}`,
                sk: 'METADATA',
                appealId,
                snapshot: fakeSnapshot,
                context: {},
                currentState: 'Solving',
                machineType: 'supportAppeal',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            const snapshot = await stateService.loadSupportSnapshot(appealId);

            expect(snapshot).toBeDefined();
            expect(snapshot.value).toBe('Solving');
            expect(snapshot.context.appealId).toBe(appealId);
        });

        it('loadSupportSnapshot возвращает undefined если записи нет', async () => {
            vi.mocked(getSupportAppealState).mockResolvedValueOnce(undefined);

            const snapshot = await stateService.loadSupportSnapshot('missing-appeal');

            expect(snapshot).toBeUndefined();
        });

        it('deleteSupportSnapshot вызывает deleteSupportAppealState и возвращает true', async () => {
            const appealId = createId();

            vi.mocked(deleteSupportAppealState).mockResolvedValueOnce(undefined);

            const result = await stateService.deleteSupportSnapshot(appealId);

            expect(result).toBe(true);
            expect(deleteSupportAppealState).toHaveBeenCalledWith(appealId);
        });

        it('deleteSupportSnapshot возвращает false при ошибке DynamoDB', async () => {
            vi.mocked(deleteSupportAppealState).mockRejectedValueOnce(new Error('Delete failed'));

            const result = await stateService.deleteSupportSnapshot('any-id');

            expect(result).toBe(false);
        });

        it('getSupportSnapshotWithMeta возвращает снимок с machineType и currentState', async () => {
            const appealId = createId();
            const fakeSnapshot = buildFakeSnapshot(appealId, 'In_progress');

            vi.mocked(getSupportAppealState).mockResolvedValueOnce({
                id: `SUPPORT_STATE#${appealId}`,
                sk: 'METADATA',
                appealId,
                snapshot: fakeSnapshot,
                context: {},
                currentState: 'In_progress',
                machineType: 'supportAppeal',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            const meta = await stateService.getSupportSnapshotWithMeta(appealId);

            expect(meta).toBeDefined();
            expect(meta!.machineType).toBe('supportAppeal');
            expect(meta!.currentState).toBe('In_progress');
            expect(meta!.snapshot.value).toBe('In_progress');
        });

        it('getSupportSnapshotWithMeta возвращает undefined если записи нет', async () => {
            vi.mocked(getSupportAppealState).mockResolvedValueOnce(undefined);

            const meta = await stateService.getSupportSnapshotWithMeta('missing');

            expect(meta).toBeUndefined();
        });

        it('clearSupportState удаляет и из кэша, и из DynamoDB', async () => {
            const appealId = createId();

            vi.mocked(deleteSupportAppealState).mockResolvedValueOnce(undefined);

            stateService.setSupportState(appealId, {
                actor: null,
                context: {},
                history: [],
            });
            expect(stateService.getSupportState(appealId)).toBeDefined();

            await stateService.clearSupportState(appealId);

            expect(stateService.getSupportState(appealId)).toBeUndefined();
            expect(deleteSupportAppealState).toHaveBeenCalledWith(appealId);
        });

        it('saveSupportSnapshot использует machineType=supportAppeal по умолчанию', async () => {
            const appealId = createId();

            vi.mocked(getSupportAppealState).mockResolvedValueOnce(undefined);
            vi.mocked(createSupportAppealState).mockResolvedValueOnce({} as any);

            const actor = createActor(supportAppealMachine, { input: { appealId } });
            actor.start();

            // Вызываем без явного указания machineType
            await stateService.saveSupportSnapshot(appealId, actor);

            const call = vi.mocked(createSupportAppealState).mock.calls[0]![0];
            expect(call.machineType).toBe('supportAppeal');
        });

    });

    // ==========================================================================
    // 5. Независимость DynamoDB-методов пользователя от техподдержки
    // ==========================================================================

    describe('5. Методы пользователя не затрагивают техподдержку', () => {

        it('loadUserSnapshot не вызывает getSupportAppealState', async () => {
            vi.mocked(getUserStateFromDB).mockResolvedValueOnce(undefined);

            await stateService.loadUserSnapshot('some-user');

            expect(getSupportAppealState).not.toHaveBeenCalled();
        });

        it('clearUserState не затрагивает кэш техподдержки', async () => {
            const appealId = createId();

            vi.mocked(getUserStateFromDB).mockResolvedValueOnce(undefined);
            vi.mocked(deleteSupportAppealState).mockResolvedValueOnce(undefined);

            stateService.setSupportState(appealId, {
                actor: null,
                context: {},
                history: [],
            });

            await stateService.clearUserState('irrelevant-user');

            // Кэш техподдержки должен остаться нетронутым
            expect(stateService.getSupportState(appealId)).toBeDefined();
        });

    });

});
