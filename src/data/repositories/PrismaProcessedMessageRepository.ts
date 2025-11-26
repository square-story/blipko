import { PrismaClient } from '@prisma/client';
import { IProcessedMessageRepository } from '../../domain/repositories/IProcessedMessageRepository';

export class PrismaProcessedMessageRepository implements IProcessedMessageRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async exists(messageId: string): Promise<boolean> {
        const count = await this.prisma.processedMessage.count({
            where: { messageId },
        });
        return count > 0;
    }

    async create(messageId: string): Promise<void> {
        await this.prisma.processedMessage.create({
            data: { messageId },
        });
    }
}
