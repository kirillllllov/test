import axios from 'axios';

export interface AgentRequest {
    message: string;
    escalate: boolean;
    chatId: number;
    category: string;
    software: string;
    criticality: string;
    image?: string[];
    context?: { user_id: string; content: string }[];
}

interface ExecutionResponse {
    executionId: string;
}

const WORKFLOW_ID = 'dfq0jc2purufolepkm26';

const client = axios.create({
    baseURL:
        'https://serverless-workflows.api.cloud.yandex.net/workflows/v1/execution',
    headers: {
        'Content-Type': 'application/json',
    },
});

export async function postAppealToAgent(payload: AgentRequest): Promise<string> {
    const response = await client.post<ExecutionResponse>(
        `/${WORKFLOW_ID}/start`,
        payload,
    );
    const executionId = response.data.executionId;
    if (!executionId) throw new Error('AI агент не вернул executionId');
    return executionId;
}
