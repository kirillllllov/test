import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import serverless from 'serverless-http';

import { initConnectors } from './connectors/connector-registry.js';
import { apiV1Router } from './routes.js';

const environment = process.env.NODE_ENV || 'development';

if (environment === 'development') {
    dotenv.config();
}

initConnectors();

const serverPort: number = Number(process.env.PORT) || 3007;
const serverHost: string = process.env.BOT_BASE_URL || 'localhost';

const app = express();

app.use(express.json());

if (environment === 'development') {
    app.use(morgan('dev'));
}

app.use(apiV1Router);

if (environment === 'development') {
    app.listen(serverPort, serverHost, () => {
        console.log(`🚀 API Сервер запущен по адресу ${serverHost}:${serverPort}`);
    });
}

export const handler = serverless(app);
