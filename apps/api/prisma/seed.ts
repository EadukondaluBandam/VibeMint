import { PrismaClient } from '@prisma/client';
import { INITIAL_INTERESTS } from '../src/modules/interests/interests.seed-data.js';

const prisma = new PrismaClient();

export async function seedInterests(): Promise<number> {
  let count = 0;
  for (const item of INITIAL_INTERESTS) {
    await prisma.interest.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        category: item.category,
        description: item.description,
        icon: item.icon ?? null,
        sortOrder: item.sortOrder,
        isActive: true,
      },
      create: {
        name: item.name,
        slug: item.slug,
        category: item.category,
        description: item.description,
        icon: item.icon ?? null,
        sortOrder: item.sortOrder,
        isActive: true,
      },
    });
    count++;
  }
  return count;
}

async function main() {
  try {
    console.log('Seeding initial interests...');
    const count = await seedInterests();
    console.log(`Successfully seeded ${count} interests across 18 categories.`);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Only execute if called directly
if (process.argv[1]?.includes('seed')) {
  void main();
}
