import { Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { Customer } from '../../domain/entities/Customer';
import {
  CreateCustomerDTO,
  ICustomerRepository,
} from '../../domain/repositories/ICustomerRepository';

const toCustomer = (record: {
  id: string;
  phoneNumber: string;
  name: string;
  currentBalance: Prisma.Decimal;
  createdAt: Date;
}): Customer => ({
  id: record.id,
  phoneNumber: record.phoneNumber,
  name: record.name,
  currentBalance: record.currentBalance.toNumber(),
  createdAt: record.createdAt,
});

export class PrismaCustomerRepository implements ICustomerRepository {
  async findByPhone(phoneNumber: string): Promise<Customer | null> {
    const record = await prisma.customer.findUnique({ where: { phoneNumber } });
    return record ? toCustomer(record) : null;
  }

  async findByName(name: string): Promise<Customer | null> {
    const record = await prisma.customer.findFirst({ where: { name } });
    return record ? toCustomer(record) : null;
  }

  async create(data: CreateCustomerDTO): Promise<Customer> {
    const record = await prisma.customer.create({
      data: {
        phoneNumber: data.phoneNumber,
        name: data.name,
        currentBalance: new Prisma.Decimal(data.initialBalance ?? 0),
      },
    });

    return toCustomer(record);
  }

  async updateBalance(customerId: string, balance: number): Promise<Customer> {
    const record = await prisma.customer.update({
      where: { id: customerId },
      data: { currentBalance: new Prisma.Decimal(balance) },
    });

    return toCustomer(record);
  }
}


