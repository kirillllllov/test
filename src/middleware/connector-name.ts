import type { NextFunction, Request, Response } from 'express';

declare global {
    namespace Express {
        interface Request {
            connectorName: string;
        }
    }
}

/**
 * Middleware: извлекает имя коннектора из заголовка X-Connector-Name.
 * Если заголовок отсутствует или пуст — возвращает 400.
 */
export function extractConnectorName(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const headerValue = req.headers['x-connector-name'];
    const connectorName = Array.isArray(headerValue)
        ? headerValue[0]
        : headerValue;

    if (!connectorName || typeof connectorName !== 'string') {
        res.status(400).json({
            code: 400,
            message:
                'Отсутствует обязательный заголовок X-Connector-Name',
        });
        return;
    }

    req.connectorName = connectorName.toLowerCase().trim();
    next();
}
