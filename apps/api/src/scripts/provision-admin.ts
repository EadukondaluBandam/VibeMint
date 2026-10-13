import { PrismaClient } from '@prisma/client';
import * as argon2 from '@node-rs/argon2';
import { isValidEmail, isValidPassword, normalizeEmail } from '@vibemint/validation';

export interface ProvisionAdminOptions {
  email?: string;
  password?: string;
}

export async function provisionAdmin(
  options: ProvisionAdminOptions = {},
  prismaClient?: PrismaClient,
): Promise<{ success: boolean; message: string; userId?: string }> {
  let email = options.email || process.env.ADMIN_EMAIL;
  let password = options.password || process.env.ADMIN_PASSWORD;

  // Read CLI arguments if not supplied in options
  if (!email || !password) {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--email' && args[i + 1]) {
        email = args[i + 1];
        i++;
      } else if (args[i] === '--password' && args[i + 1]) {
        password = args[i + 1];
        i++;
      }
    }
  }

  if (!email) {
    throw new Error(
      'Provisioning failed: Administrator email is required (--email or ADMIN_EMAIL)',
    );
  }

  const normalizedEmail = normalizeEmail(email);
  if (!isValidEmail(normalizedEmail)) {
    throw new Error(`Provisioning failed: "${email}" is not a valid email address`);
  }

  const prisma = prismaClient || new PrismaClient();

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      if (existingUser.role === 'ADMIN') {
        const msg = `User [${normalizedEmail}] is already an active administrator (ID: ${existingUser.id}).`;
        return { success: true, message: msg, userId: existingUser.id };
      }

      // Promote existing user to ADMIN
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: { role: 'ADMIN' },
      });

      const msg = `Successfully promoted existing user [${normalizedEmail}] to administrator role (ID: ${updated.id}).`;
      return { success: true, message: msg, userId: updated.id };
    }

    // Creating a new administrator requires a valid password
    if (!password) {
      throw new Error(
        'Provisioning failed: A password is required to create a new administrator account (--password or ADMIN_PASSWORD)',
      );
    }

    if (!isValidPassword(password)) {
      throw new Error('Provisioning failed: Password must be at least 8 characters long');
    }

    const passwordHash = await argon2.hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const newAdmin = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
      },
    });

    const msg = `Successfully created new administrator [${normalizedEmail}] (ID: ${newAdmin.id}).`;
    return { success: true, message: msg, userId: newAdmin.id };
  } finally {
    if (!prismaClient) {
      await prisma.$disconnect();
    }
  }
}

// Execute directly if run via CLI
if (process.argv[1]?.includes('provision-admin')) {
  provisionAdmin()
    .then((result) => {
      console.log(`[VibeMint Admin Provisioning] ${result.message}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(
        `[VibeMint Admin Provisioning ERROR] ${err instanceof Error ? err.message : String(err)}`,
      );
      process.exit(1);
    });
}
