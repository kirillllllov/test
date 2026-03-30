import type { NextFunction, Request, Response } from 'express';

/**
 * Middleware-заглушка для будущей аутентификации пользователей.
 *
 * В текущей архитектуре проекта аутентификация сотрудников реализована
 * через authenticateSupport (src/middleware/auth.ts), которая принимает
 * userId из заголовка x-user-id и сверяет его с таблицей SupportStaff.
 *
 * Если в будущем понадобится сессионная или cookie-аутентификация,
 * логику следует добавить сюда.
 */
export function requireAuthentication(
    _request: Request,
    _response: Response,
    next: NextFunction,
): void {
    next();
}
