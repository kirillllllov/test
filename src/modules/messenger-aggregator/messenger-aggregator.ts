import type { Connector } from './interfaces/connector.js';
import type {
    Actions,
    BaseInf,
    Commands,
    InputKeyboard,
    messageImage,
    userMessage,
} from './types.js';

export type ParsedMessage =
    | { type: 'action'; data: Actions }
    | { type: 'command'; data: Commands }
    | { type: 'image'; data: messageImage }
    | { type: 'keyboard'; data: InputKeyboard }
    | { type: 'user_message'; data: userMessage };

export class MessengerAggregator {
    private connectors: Map<string, Connector> = new Map();

    registerConnector(connector: Connector) {
        if (this.connectors.has(connector.name)) {
            console.warn(
                `Коннектор ${connector.name} уже зарегистрирован. Перезапись.`,
            );
        }
        this.connectors.set(connector.name, connector);
        console.log(`✅ Коннектор зарегистрирован: ${connector.name}`);
    }

    getConnector(name: string): Connector | undefined {
        return this.connectors.get(name);
    }

    private async parse(payload: any): Promise<any> {
        const connector = this.connectors.get(payload.source || 'default');
        if (connector?.parse) {
            return connector.parse(payload);
        }
        return payload;
    }

    async parseCommand(payload: any): Promise<Commands> {
        return (await this.parse(payload)) as Commands;
    }

    async parseAction(payload: any): Promise<Actions> {
        return (await this.parse(payload)) as Actions;
    }

    async parseId(payload: any): Promise<BaseInf> {
        return (await this.parse(payload)) as BaseInf;
    }

    async parseMessageImage(payload: any): Promise<messageImage> {
        return (await this.parse(payload)) as messageImage;
    }

    async parseKeyboard(payload: any): Promise<InputKeyboard> {
        return (await this.parse(payload)) as InputKeyboard;
    }

    async parseUserMessage(payload: any): Promise<userMessage> {
        return (await this.parse(payload)) as userMessage;
    }
}

export const messengerAggregator = new MessengerAggregator();
