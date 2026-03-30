export interface Button {
    text: string;
}

export interface PlaceResponse {
    chat_id: string;
    message_id: string;
}

export interface Connector {
    name: string;

    /**
     * Опционально: кастомный парсинг входящего payload коннектором.
     * Если не задан — payload используется как есть.
     */
    parse?(payload: any): Promise<any>;

    sendMessage(params: {
        userId: string;
        chatId: string;
        text: string;
    }): Promise<PlaceResponse>;

    createKeyboard(params: {
        userId: string;
        chatId: string;
        title: string;
        buttons: Button[];
    }): Promise<PlaceResponse>;

    updateKeyboard(params: {
        userId: string;
        chatId: string;
        messageId: string;
        title: string;
        buttons: Button[];
    }): Promise<void>;
}
