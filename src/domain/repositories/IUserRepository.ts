import { User } from '@prisma/client';

export interface CreateUserDTO {
    phoneNumber: string;
    email?: string;
    name?: string;
}

export interface IUserRepository {
    create(data: CreateUserDTO): Promise<User>;
    findByPhone(phoneNumber: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
}
