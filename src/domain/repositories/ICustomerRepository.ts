import { Customer } from '../entities/Customer';

export interface CreateCustomerDTO {
  phoneNumber: string;
  name: string;
  initialBalance?: number;
}

export interface ICustomerRepository {
  findByPhone(phoneNumber: string): Promise<Customer | null>;
  findByName(name: string): Promise<Customer | null>;
  create(data: CreateCustomerDTO): Promise<Customer>;
  updateBalance(customerId: string, balance: number): Promise<Customer>;
}

