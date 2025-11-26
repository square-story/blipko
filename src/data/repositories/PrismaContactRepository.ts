import { PrismaClient, Contact } from '@prisma/client';
import { IContactRepository, CreateContactDTO } from '../../domain/repositories/IContactRepository';

export class PrismaContactRepository implements IContactRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async create(data: CreateContactDTO): Promise<Contact> {
        return this.prisma.contact.create({
            data: {
                userId: data.userId,
                name: data.name,
            },
        });
    }

    async findByName(userId: string, name: string): Promise<Contact | null> {
        return this.prisma.contact.findUnique({
            where: {
                userId_name: {
                    userId,
                    name,
                },
            },
        });
    }

    async findById(id: string): Promise<Contact | null> {
        return this.prisma.contact.findUnique({
            where: { id },
        });
    }

    async findAllByUser(userId: string): Promise<Contact[]> {
        return this.prisma.contact.findMany({
            where: { userId },
        });
    }
}
