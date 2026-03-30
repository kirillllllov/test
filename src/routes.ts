import { Router } from 'express';

import { mainBotController } from './controllers/main-bot-controller.js';

export const apiV1Router = Router();

apiV1Router.get('/health-check', (_req, res) => {
    res.status(200).json({ status: 'OK' });
});
apiV1Router.post('/ai-agent', (_req, res) => {
    res.sendStatus(200);
});

// apiV1Router.use('/health-check', healthCheckRoutes);
apiV1Router.use('/image', mainBotController.handleImage.bind(mainBotController));
apiV1Router.use('/command', mainBotController.handleCommand.bind(mainBotController));
apiV1Router.use('/user_message', mainBotController.handleUserMessage.bind(mainBotController));
apiV1Router.use('/message/action', mainBotController.handleAction.bind(mainBotController));
apiV1Router.use('/keyboard/input', mainBotController.handleKeyboardInput.bind(mainBotController));
