import type { Button, PlaceResponse } from '../modules/messenger-aggregator/interfaces/connector.js';
import { messengerAggregator } from '../modules/messenger-aggregator/messenger-aggregator.js';

/**
 * MessagingService — единая точка отправки всех исходящих сообщений.
 *
 * Маршрутизирует запросы к нужному коннектору по его имени
 * и вызывает соответствующий метод его API.
 */
class MessagingService {
    private getConnector(connectorName: string) {
        const connector = messengerAggregator.getConnector(connectorName);
        if (!connector) {
            throw new Error(
                `Коннектор "${connectorName}" не зарегистрирован`,
            );
        }
        return connector;
    }

    /**
     * Отправить текстовое сообщение пользователю.
     */
    async sendText(
        connectorName: string,
        userId: string,
        chatId: string,
        text: string,
    ): Promise<PlaceResponse> {
        const connector = this.getConnector(connectorName);
        return connector.sendMessage({ userId, chatId, text });
    }

    /**
     * Создать клавиатуру (интерактивное меню) для пользователя.
     * Возвращает { chat_id, message_id } — нужно для последующего обновления.
     */
    async sendKeyboard(
        connectorName: string,
        userId: string,
        chatId: string,
        title: string,
        buttons: Button[],
    ): Promise<PlaceResponse> {
        const connector = this.getConnector(connectorName);
        return connector.createKeyboard({ userId, chatId, title, buttons });
    }

    /**
     * Обновить существующую клавиатуру (редактировать сообщение с кнопками).
     */
    async updateKeyboard(
        connectorName: string,
        userId: string,
        chatId: string,
        messageId: string,
        title: string,
        buttons: Button[],
    ): Promise<void> {
        const connector = this.getConnector(connectorName);
        return connector.updateKeyboard({
            userId,
            chatId,
            messageId,
            title,
            buttons,
        });
    }

    /**
     * Вспомогательный метод: пожаловаться если коннектор не найден, но не упасть.
     */
    async safeSendText(
        connectorName: string,
        userId: string,
        chatId: string,
        text: string,
    ): Promise<void> {
        try {
            await this.sendText(connectorName, userId, chatId, text);
        } catch (err) {
            console.error(
                `[MessagingService] Ошибка отправки сообщения через "${connectorName}":`,
                err,
            );
        }
    }

    /**
     * Вспомогательный метод: создать клавиатуру без выброса исключения.
     */
    async safeSendKeyboard(
        connectorName: string,
        userId: string,
        chatId: string,
        title: string,
        buttons: Button[],
    ): Promise<PlaceResponse | undefined> {
        try {
            return await this.sendKeyboard(
                connectorName,
                userId,
                chatId,
                title,
                buttons,
            );
        } catch (err) {
            console.error(
                `[MessagingService] Ошибка создания клавиатуры через "${connectorName}":`,
                err,
            );
            return undefined;
        }
    }
}

export default new MessagingService();
