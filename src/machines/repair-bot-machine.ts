import { assign, createMachine } from 'xstate';

export interface BotContext {
    problem?: string;
    solution?: string;
}

type BotEvent =
    | { type: 'START' }
    | { type: 'DESCRIBE_PROBLEM'; problem: string }
    | { type: 'CONFIRM' }
    | { type: 'NEW_PROBLEM' }
    | { type: 'FINISH' };

export const repairBotMachine = createMachine({
    id: 'repairBot',
    initial: 'idle',
    context: {
        problem: '',
        solution: '',
    },
    types: {} as {
        context: BotContext;
        events: BotEvent;
    },
    states: {
        idle: {
            on: {
                START: {
                    target: 'awaitingProblem',
                    actions: () =>
                        console.log('🎯 Переход: idle -> awaitingProblem'),
                },
            },
        },
        awaitingProblem: {
            entry: () => console.log('📝 Вход: awaitingProblem'),
            on: {
                DESCRIBE_PROBLEM: {
                    target: 'solution',
                    actions: [
                        () =>
                            console.log(
                                '🎯 Переход: awaitingProblem -> solution',
                            ),
                        assign({
                            problem: ({ context, event }) => {
                                console.log(
                                    '📋 Проблема получена:',
                                    event.problem,
                                );
                                return event.problem;
                            },
                            solution: ({ context, event }) => {
                                const problem = event.problem.toLowerCase();
                                let solution = '';

                                if (
                                    problem.includes('скрипит') ||
                                    problem.includes('заедает')
                                ) {
                                    solution = 'WD-40';
                                } else if (
                                    problem.includes('трещит') ||
                                    problem.includes('отваливается')
                                ) {
                                    solution = 'Изолента';
                                } else {
                                    solution = 'WD-40 или изолента';
                                }

                                console.log('💡 Решение определено:', solution);
                                return solution;
                            },
                        }),
                    ],
                },
            },
        },
        solution: {
            entry: ({ context }) =>
                console.log('✅ Вход: solution с контекстом:', context),
            on: {
                CONFIRM: 'success',
                NEW_PROBLEM: 'awaitingProblem',
                FINISH: 'idle',
            },
        },
        success: {
            entry: () => console.log('🎉 Вход: success'),
            on: {
                NEW_PROBLEM: 'awaitingProblem',
                FINISH: 'idle',
            },
        },
    },
});
