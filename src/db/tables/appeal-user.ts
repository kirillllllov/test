import { DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createId } from '@paralleldrive/cuid2';

import { docClient } from '../dynamodb.js';
import {
    type AppealUser,
    type AppealUserCreateInput,
    createEntityId,
    TABLE_NAMES,
} from '../types.js';
import { putItem, validateFKExists } from './base.js';

export async function createAppealUser(
    input: AppealUserCreateInput,
): Promise<AppealUser> {
    // Validate FKs
    const [appealExists, userExists, relationExists] = await Promise.all([
        validateFKExists(TABLE_NAMES.APPEALS, input.appealId),
        validateFKExists(TABLE_NAMES.USERS, input.userId),
        validateFKExists(TABLE_NAMES.USER_RELATIONS, input.relationId),
    ]);

    if (!appealExists || !userExists || !relationExists) {
        throw new Error('Invalid foreign key reference');
    }

    const id = createEntityId('APPEAL_USER', createId());
    const sk = `${input.userId}#RELATION#${input.relationId}`;

    const appealUser: AppealUser = {
        id,
        appealId: input.appealId,
        sk,
        userId: input.userId,
        userMessengerId: input.userMessengerId,
        relationId: input.relationId,
        createdAt: new Date().toISOString(),
    };

    await putItem(TABLE_NAMES.APPEAL_USERS, appealUser);
    return appealUser;
}

// Get users for an appeal
export async function getUsersForAppeal(
    appealId: string,
): Promise<AppealUser[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAMES.APPEAL_USERS,
            KeyConditionExpression: 'appealId = :appealId',
            ExpressionAttributeValues: { ':appealId': appealId },
        }),
    );
    return (result.Items as AppealUser[]) || [];
}

// Get appeals for a user (using GSI)
export async function getAppealsForUser(userId: string): Promise<AppealUser[]> {
    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAMES.APPEAL_USERS,
            IndexName: 'UserAppealsIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: { ':userId': userId },
        }),
    );
    return (result.Items as AppealUser[]) || [];
}

// Remove user from appeal
export async function removeUserFromAppeal(
    appealId: string,
    userId: string,
    relationId: string,
): Promise<void> {
    const sk = `${userId}#RELATION#${relationId}`;
    await docClient.send(
        new DeleteCommand({
            TableName: TABLE_NAMES.APPEAL_USERS,
            Key: { appealId, sk },
        }),
    );
}
