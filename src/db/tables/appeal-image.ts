import { createId } from '@paralleldrive/cuid2';

import {
    type AppealImage,
    type AppealImageCreateInput,
    createEntityId,
    TABLE_NAMES,
} from '../types.js';
import { putItem, queryByGSI } from './base.js';

export async function createAppealImage(
    input: AppealImageCreateInput,
): Promise<AppealImage> {
    const id = createEntityId('IMAGE', createId());
    const sk = `IMAGE#${createId()}`; // Unique SK for image

    const image: AppealImage = {
        id,
        appealId: input.appealId,
        sk,
        fileName: input.fileName,
        createdAt: new Date().toISOString(),
    };

    await putItem(TABLE_NAMES.APPEAL_IMAGES, image);
    return image;
}

export async function getAppealImageById(
    imageId: string,
): Promise<AppealImage | undefined> {
    // Note: This might be tricky if PK is appealId.
    // If we need to get by ImageId, we should use GSI.
    const images = await queryByGSI<AppealImage>(
        TABLE_NAMES.APPEAL_IMAGES,
        'ImageIndex',
        'id = :id',
        { ':id': imageId },
    );
    return images[0] || undefined;
}

export async function getImagesForAppeal(
    appealId: string,
): Promise<AppealImage[]> {
    // Query by PK (appealId)
    // We need a direct query here, not GSI, because appealId is PK.
    // But our generic queryByGSI is for GSIs.
    // We can use a direct query helper or just use base getItem if we knew the SK, but we don't.
    // We need a generic queryByPK helper or use queryByGSI if we treat PK as an index (which it is).
    // Actually, let's just use docClient directly or add queryByPK to base.ts.
    // For now, I'll assume queryByGSI can be used if I pass the table name as index name? No.
    // I'll import docClient and do a direct query.
    const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
    const { docClient } = await import('../dynamodb.js');

    const result = await docClient.send(
        new QueryCommand({
            TableName: TABLE_NAMES.APPEAL_IMAGES,
            KeyConditionExpression: 'appealId = :appealId',
            ExpressionAttributeValues: { ':appealId': appealId },
        }),
    );
    return (result.Items as AppealImage[]) || [];
}

export async function deleteAppealImage(
    appealId: string,
    sk: string,
): Promise<void> {
    const { DeleteCommand } = await import('@aws-sdk/lib-dynamodb');
    const { docClient } = await import('../dynamodb.js');

    await docClient.send(
        new DeleteCommand({
            TableName: TABLE_NAMES.APPEAL_IMAGES,
            Key: { appealId, sk },
        }),
    );
}
