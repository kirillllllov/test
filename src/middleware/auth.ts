import type { NextFunction, Request, Response } from 'express';
import { isSupportStaff } from '../db/tables/support-staff.js';


export async function authenticateSupport(
    request: Request,
    response: Response,
    next: NextFunction,
) {
    const login = request.headers['x-support-login'] as string;
    if (!login) {
        return response
            .status(401)
            .json({ message: 'Требуется логин сотрудника' });
    }

    try {
        const isStaff = await isSupportStaff(login);
        if (!isStaff) {
            return response
                .status(403)
                .json({ message: 'Доступ запрещен: вы не являетесь сотрудником техподдержки' });
        }
        (request as any).user = { login };
        next();
    } catch (error) {
        return response
            .status(500)
            .json({ message: 'Ошибка проверки прав доступа' });
    }
}