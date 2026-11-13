import { PrismaClient, UserRole, AccountStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

async function main() {
  const phone = process.env.ADMIN_PHONE;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME || 'Administrador principal';
  if (!phone || !password || password.length < 14) {
    throw new Error('Define ADMIN_PHONE, ADMIN_PASSWORD (mínimo 14 caracteres) y opcionalmente ADMIN_NAME.');
  }
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { phone: phone.replace(/[\\s()-]/g, '') },
      update: { fullName, passwordHash, role: UserRole.ADMIN, status: AccountStatus.ACTIVE },
      create: { phone: phone.replace(/[\\s()-]/g, ''), fullName, passwordHash, role: UserRole.ADMIN, status: AccountStatus.ACTIVE },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exit(1); });
