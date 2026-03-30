import { createId } from '@paralleldrive/cuid2';

import {
    createEntityId,
    METADATA_SK,
    type Solution,
    type SolutionCreateInput,
    TABLE_NAMES,
} from '../types.js';
import { deleteItem, getItem, putItem, updateItem } from './base.js';

export async function createSolution(
    input: SolutionCreateInput,
): Promise<Solution> {
    const id = createEntityId('SOLUTION', createId());
    const now = new Date().toISOString();

    const solution: Solution = {
        id,
        sk: METADATA_SK,
        solutionText: input.solutionText,
        createdAt: now,
        updatedAt: now,
    };

    await putItem(TABLE_NAMES.SOLUTIONS, solution);
    return solution;
}

export async function getSolutionById(
    solutionId: string,
): Promise<Solution | undefined> {
    return getItem<Solution>(TABLE_NAMES.SOLUTIONS, solutionId);
}

export async function updateSolution(
    solutionId: string,
    updates: Partial<Omit<Solution, 'id' | 'sk' | 'createdAt'>>,
): Promise<void> {
    const updatesWithTimestamp = {
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await updateItem(
        TABLE_NAMES.SOLUTIONS,
        solutionId,
        METADATA_SK,
        updatesWithTimestamp,
    );
}

export async function deleteSolution(solutionId: string): Promise<void> {
    await updateItem(TABLE_NAMES.SOLUTIONS, solutionId, METADATA_SK, {
        deletedAt: new Date().toISOString(),
    });
}

export async function hardDeleteSolution(solutionId: string): Promise<void> {
    await deleteItem(TABLE_NAMES.SOLUTIONS, solutionId);
}
