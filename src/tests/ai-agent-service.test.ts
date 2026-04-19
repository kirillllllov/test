import { describe, expect, it } from 'vitest';

import type { AgentRequest } from '../services/ai-agent-service.js';
import { postAppealToAgent } from '../services/ai-agent-service.js';

const testPayload: AgentRequest = {
    message: 'У меня проблема, отправь специалисту обращение',
    escalate: false,
    category: 'ТехПоддержка',
    chatId: 1,
    software: 'ККМ',
    criticality: 'проблема',
    image: ['https://storage.example.com/screen.png'],
    context: [{ user_id: 'usr_123', content: 'ККМ не печатает чеки' }],
};

describe('postAppealToAgent — интеграционный тест', () => {
    
    it('должен получить executionId от Yandex Cloud Workflow', async () => {
        const executionId = await postAppealToAgent(testPayload);

        expect(executionId).toBeDefined();
        expect(typeof executionId).toBe('string');
        expect(executionId.length).toBeGreaterThan(0);
        
        console.log('Получен executionId:', executionId);
    }, 15_000);
});