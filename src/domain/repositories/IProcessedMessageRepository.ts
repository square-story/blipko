export interface IProcessedMessageRepository {
    exists(messageId: string): Promise<boolean>;
    create(messageId: string): Promise<void>;
}
