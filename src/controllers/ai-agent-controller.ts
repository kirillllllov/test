import type { Request, Response } from 'express';

interface AgentResponse {
    Result: string;
    chatId: number;
}

interface ReqBody {
    status: string;
}

export interface AgentResult {
    message: string;
    chatId: number;
    escalation: boolean;
}

class AiAgentController {
    async handleAiAgent(req: Request<void, ReqBody, AgentResponse>, res: Response): Promise<AgentResult> {
        try {
            const requestData: AgentResponse = req.body;
            const result = this.parseAgentResult(requestData.Result, requestData.chatId);
            const request: ReqBody = {status: "OK"};
            res.status(200).json(request);
            return result;
        } catch (error) {
            const request: ReqBody = {status: "ERROR"};
            res.status(500).json(request);
            throw error;
        }
    }

    parseAgentResult(raw: string, chatId: number): AgentResult {
        const escalationMarker = '\nЭскалация:';
        const index = raw.indexOf(escalationMarker);

        if (index === -1) {
            throw new Error('Не найдено поле "Эскалация" в ответе агента');
        }

        const message = raw.slice(0, index).trim();
        const escalationPart = raw.slice(index + escalationMarker.length).trim();
        const escalation = escalationPart.toLowerCase().startsWith('true');

        return {
            message,
            chatId,
            escalation,
        };
    }
}

export default AiAgentController;
export const aiAgentController = new AiAgentController();
