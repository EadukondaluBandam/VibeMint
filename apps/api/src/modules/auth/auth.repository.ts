import { PrismaClient, User, Session, UserStatus, UserRole } from '@prisma/client';
import crypto from 'node:crypto';

export interface CreateUserData {
  email: string;
  passwordHash: string;
  status?: UserStatus;
  role?: UserRole;
}

export interface CreateSessionData {
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface SessionWithUser extends Session {
  user: User;
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createUser(data: CreateUserData): Promise<User>;
  updateUserLastLogin(id: string, date: Date): Promise<User>;
  updateUserStatus(id: string, status: UserStatus): Promise<User>;
  updateUserRole(id: string, role: UserRole): Promise<User>;
  createSession(data: CreateSessionData): Promise<Session>;
  findSessionByToken(token: string): Promise<SessionWithUser | null>;
  revokeSession(token: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
  updateUserSuspension(
    id: string,
    data: {
      status: UserStatus;
      suspendedAt?: Date | null;
      suspendedUntil?: Date | null;
      suspensionReason?: string | null;
    },
  ): Promise<User>;
  setOnboardingCompleted(id: string, completed: boolean): Promise<User>;
}

export class PrismaAuthRepository implements IAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async createUser(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        status: data.status ?? 'ACTIVE',
        role: data.role ?? 'USER',
        emailVerified: false,
      },
    });
  }

  async updateUserLastLogin(id: string, date: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: date },
    });
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { status },
    });
  }

  async updateUserSuspension(
    id: string,
    data: {
      status: UserStatus;
      suspendedAt?: Date | null;
      suspendedUntil?: Date | null;
      suspensionReason?: string | null;
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        status: data.status,
        suspendedAt: data.suspendedAt !== undefined ? data.suspendedAt : null,
        suspendedUntil: data.suspendedUntil !== undefined ? data.suspendedUntil : null,
        suspensionReason: data.suspensionReason !== undefined ? data.suspensionReason : null,
      },
    });
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { role },
    });
  }

  async createSession(data: CreateSessionData): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findSessionByToken(token: string): Promise<SessionWithUser | null> {
    return this.prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });
  }

  async revokeSession(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { token },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async setOnboardingCompleted(id: string, completed: boolean): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { onboardingCompleted: completed },
    });
  }
}

export class InMemoryAuthRepository implements IAuthRepository {
  public users: Map<string, User> = new Map();
  public sessions: Map<string, Session> = new Map();

  async findUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return { ...user };
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<User | null> {
    const user = this.users.get(id);
    return user ? { ...user } : null;
  }

  async createUser(data: CreateUserData): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      email: data.email,
      passwordHash: data.passwordHash,
      status: data.status ?? ('ACTIVE' as UserStatus),
      role: data.role ?? ('USER' as UserRole),
      emailVerified: false,
      onboardingCompleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
    };
    this.users.set(user.id, user);
    return { ...user };
  }

  async updateUserLastLogin(id: string, date: Date): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    user.lastLoginAt = date;
    user.updatedAt = new Date();
    this.users.set(id, user);
    return { ...user };
  }

  async updateUserStatus(id: string, status: UserStatus): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    user.status = status;
    user.updatedAt = new Date();
    this.users.set(id, user);
    return { ...user };
  }

  async updateUserRole(id: string, role: UserRole): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    user.role = role;
    user.updatedAt = new Date();
    this.users.set(id, user);
    return { ...user };
  }

  async setOnboardingCompleted(id: string, completed: boolean): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    user.onboardingCompleted = completed;
    user.updatedAt = new Date();
    this.users.set(id, user);
    return { ...user };
  }

  async createSession(data: CreateSessionData): Promise<Session> {
    const session: Session = {
      id: crypto.randomUUID(),
      userId: data.userId,
      token: data.token,
      expiresAt: data.expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    };
    this.sessions.set(session.token, session);
    return { ...session };
  }

  async findSessionByToken(token: string): Promise<SessionWithUser | null> {
    const session = this.sessions.get(token);
    if (!session) return null;
    const user = this.users.get(session.userId);
    if (!user) return null;
    return {
      ...session,
      user: { ...user },
    };
  }

  async updateUserSuspension(
    id: string,
    data: {
      status: UserStatus;
      suspendedAt?: Date | null;
      suspendedUntil?: Date | null;
      suspensionReason?: string | null;
    },
  ): Promise<User> {
    const user = this.users.get(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    user.status = data.status;
    user.suspendedAt = data.suspendedAt !== undefined ? data.suspendedAt : null;
    user.suspendedUntil = data.suspendedUntil !== undefined ? data.suspendedUntil : null;
    user.suspensionReason = data.suspensionReason !== undefined ? data.suspensionReason : null;
    user.updatedAt = new Date();
    this.users.set(id, user);
    return { ...user };
  }

  async revokeSession(token: string): Promise<void> {
    const session = this.sessions.get(token);
    if (session) {
      session.revokedAt = new Date();
      this.sessions.set(token, session);
    }
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date();
        this.sessions.set(token, session);
      }
    }
  }

  clear(): void {
    this.users.clear();
    this.sessions.clear();
  }
}
