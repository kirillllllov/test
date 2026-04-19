import axios from 'axios';
import { Router } from 'express';

import { aiAgentController } from './controllers/ai-agent-controller.js';
import { mainBotController } from './controllers/main-bot-controller.js';
import { extractConnectorName } from './middleware/connector-name.js';

export const apiV1Router = Router();

apiV1Router.get('/health-check', (_req, res) => {
    res.status(200).json({ status: 'OK' });
});

apiV1Router.post('/ai-agent', aiAgentController.handleAiAgent.bind(aiAgentController));

// ============================================================================
// Входящие маршруты: Коннектор → Модуль
// Все требуют заголовок X-Connector-Name для идентификации источника
// ============================================================================

apiV1Router.post(
    '/keyboard/input',
    extractConnectorName,
    mainBotController.handleKeyboardInput.bind(mainBotController),
);

apiV1Router.post(
    '/image',
    extractConnectorName,
    mainBotController.handleImage.bind(mainBotController),
);

apiV1Router.post(
    '/command',
    extractConnectorName,
    mainBotController.handleCommand.bind(mainBotController),
);

apiV1Router.post(
    '/user_message',
    extractConnectorName,
    mainBotController.handleUserMessage.bind(mainBotController),
);

apiV1Router.post(
    '/message/action',
    extractConnectorName,
    mainBotController.handleAction.bind(mainBotController),
);


// ============================================================================
// Appeal Agent API
// ============================================================================

// apiV1Router.post('/appeal-agent', async (req, res) => {
//     try {
//         const agentUrl = process.env.AGENT_URL;
//         if (!agentUrl) {
//             res.status(503).json({ code: 503, message: 'AGENT_URL не настроен' });
//             return;
//         }

//         const response = await axios.post(`${agentUrl}/appeal-agent`, req.body, {
//             headers: { Authorization: req.headers.authorization ?? '' },
//         });

//         res.status(200).json(response.data);
//     } catch (error: any) {
//         console.error('❌ /appeal-agent POST error:', error.message);
//         const status = error.response?.status ?? 500;
//         res.status(status).json(
//             error.response?.data ?? { code: status, message: 'Ошибка агента' },
//         );
//     }
// });

// apiV1Router.get('/appeal-agent', async (req, res) => {
//     try {
//         const agentUrl = process.env.AGENT_URL;
//         if (!agentUrl) {
//             res.status(503).json({ code: 503, message: 'AGENT_URL не настроен' });
//             return;
//         }

//         const executionId = req.query.executionId as string;
//         if (!executionId) {
//             res.status(400).json({ code: 400, message: 'Отсутствует параметр executionId' });
//             return;
//         }

//         const response = await axios.get(`${agentUrl}/appeal-agent`, {
//             params: { executionId },
//             headers: { Authorization: req.headers.authorization ?? '' },
//         });

//         res.status(200).json(response.data);
//     } catch (error: any) {
//         console.error('❌ /appeal-agent GET error:', error.message);
//         const status = error.response?.status ?? 500;
//         res.status(status).json(
//             error.response?.data ?? { code: status, message: 'Ошибка агента' },
//         );
//     }
// });

// ============================================================================
// Catch-all 404
// ============================================================================

apiV1Router.use('*', (_req, res) => {
    res.status(404).json({ code: 404, message: 'Маршрут не найден' });
});
