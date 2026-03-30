import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import serverless from 'serverless-http';

import { apiV1Router } from './routes.js';

const environment = process.env.NODE_ENV || 'development';

if (environment == 'development') {
    dotenv.config();
}

const serverPort: number = Number(process.env.PORT) || 5000;
const serverUrl: string = process.env.BOT_BASE_URL || '0.0.0.0';

const app = express();

app.use(apiV1Router);
app.use(express.json());

if (environment == 'development') {
    app.use(morgan('dev'));

    app.listen(serverPort, serverUrl, () => {
        console.log(
            `🚀 API Сервер запущен по адресу ${serverUrl}:${serverPort}`,
        );
    });

    app.use('*', (req, res) => {
        res.status(404).json({ error: 'Маршрут не найден' });
    });
}

export const handler = serverless(app);
