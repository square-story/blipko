import { PrismaClient, User } from '@prisma/client';
import { IUserRepository, CreateUserDTO } from '../../domain/repositories/IUserRepository';

export class PrismaUserRepository implements IUserRepository {
    constructor(private readonly prisma: PrismaClient) { }

    async create(data: CreateUserDTO): Promise<User> {
        console.log(data);
        return this.prisma.user.create({
            data: {
                phoneNumber: data.phoneNumber,
                email: data.email ?? null,
                name: data.name ?? null,
            },
        });
    }

    async findByPhone(phoneNumber: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { phoneNumber },
        });
    }

    async findById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }
}
