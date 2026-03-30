import axios from 'axios';

import type { Button, Connector, PlaceResponse } from '../modules/messenger-aggregator/interfaces/connector.js';

export class HttpConnector implements Connector {
    name: string;
    private baseUrl: string;

    constructor(name: string, baseUrl: string) {
        this.name = name;
        this.baseUrl = baseUrl.replace(/\/$/, '');
    }

    async sendMessage(params: {
        userId: string;
        chatId: string;
        text: string;
    }): Promise<PlaceResponse> {
        const body = {
            user_id: params.userId,
            place: { chat_id: params.chatId },
            text: params.text,
            date_time: new Date().toISOString(),
        };

        const response = await axios.post(`${this.baseUrl}/message`, body);
        return (
            response.data?.place ?? {
                chat_id: params.chatId,
                message_id: '',
            }
        );
    }

    async createKeyboard(params: {
        userId: string;
        chatId: string;
        title: string;
        buttons: Button[];
    }): Promise<PlaceResponse> {
        const body = {
            user_id: params.userId,
            place: { chat_id: params.chatId },
            title: params.title,
            buttons: params.buttons,
        };

        const response = await axios.post(
            `${this.baseUrl}/keyboard/create`,
            body,
        );
        return (
            response.data?.place ?? {
                chat_id: params.chatId,
                message_id: '',
            }
        );
    }

    async updateKeyboard(params: {
        userId: string;
        chatId: string;
        messageId: string;
        title: string;
        buttons: Button[];
    }): Promise<void> {
        const body = {
            user_id: params.userId,
            place: { chat_id: params.chatId, message_id: params.messageId },
            title: params.title,
            buttons: params.buttons,
        };

        await axios.post(`${this.baseUrl}/keyboard/update`, body);
    }
}
