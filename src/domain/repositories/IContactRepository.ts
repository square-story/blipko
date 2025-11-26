import { Contact } from '@prisma/client';

export interface CreateContactDTO {
    userId: string;
    name: string;
}

export interface IContactRepository {
    create(data: CreateContactDTO): Promise<Contact>;
    findByName(userId: string, name: string): Promise<Contact | null>;
    findById(id: string): Promise<Contact | null>;
    findAllByUser(userId: string): Promise<Contact[]>;
}
