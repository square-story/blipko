import { PrismaClient, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Start seeding ...');

    // Create Customer 1
    const customer1 = await prisma.customer.create({
        data: {
            name: 'Alice Johnson',
            phoneNumber: '+1234567890',
            currentBalance: 100.00,
            transactions: {
                create: [
                    {
                        amount: 150.00,
                        type: TransactionType.CREDIT,
                        description: 'Initial deposit',
                    },
                    {
                        amount: 50.00,
                        type: TransactionType.DEBIT,
                        description: 'Grocery shopping',
                    },
                ],
            },
        },
    });
    console.log(`Created customer with id: ${customer1.id}`);

    // Create Customer 2
    const customer2 = await prisma.customer.create({
        data: {
            name: 'Bob Smith',
            phoneNumber: '+0987654321',
            currentBalance: 500.50,
            transactions: {
                create: [
                    {
                        amount: 500.50,
                        type: TransactionType.CREDIT,
                        description: 'Salary',
                    },
                ],
            },
        },
    });
    console.log(`Created customer with id: ${customer2.id}`);

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
