import { PrismaClient, Comment, CommentStatus, User, Profile } from '@prisma/client';
import crypto from 'node:crypto';
import { ICommentsRepository, CommentWithAuthor, CreateCommentData } from './comments.types.js';

export class PrismaCommentsRepository implements ICommentsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createComment(data: CreateCommentData): Promise<CommentWithAuthor> {
    return this.prisma.comment.create({
      data: {
        postId: data.postId,
        authorId: data.authorId,
        content: data.content,
        status: 'PUBLISHED',
      },
      include: {
        author: {
          include: { profile: true },
        },
      },
    });
  }

  async findCommentById(commentId: string): Promise<CommentWithAuthor | null> {
    return this.prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        author: {
          include: { profile: true },
        },
      },
    });
  }

  async updateCommentStatus(commentId: string, status: CommentStatus): Promise<Comment> {
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { status },
    });
  }

  async getPostComments(postId: string, cursor?: string, limit = 20): Promise<CommentWithAuthor[]> {
    return this.prisma.comment.findMany({
      where: {
        postId,
        status: 'PUBLISHED',
      },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        author: {
          include: { profile: true },
        },
      },
    });
  }

  async getCommentCount(postId: string): Promise<number> {
    return this.prisma.comment.count({
      where: {
        postId,
        status: 'PUBLISHED',
      },
    });
  }
}

export class InMemoryCommentsRepository implements ICommentsRepository {
  public comments: Map<string, Comment>;
  public users: Map<string, User>;
  public profiles: Map<string, Profile>;

  constructor(
    comments?: Map<string, Comment>,
    users?: Map<string, User>,
    profiles?: Map<string, Profile>,
  ) {
    this.comments = comments || new Map();
    this.users = users || new Map();
    this.profiles = profiles || new Map();
  }

  private buildCommentWithAuthor(comment: Comment): CommentWithAuthor {
    const authorUser = this.users.get(comment.authorId) || {
      id: comment.authorId,
      email: 'user@example.com',
      passwordHash: '',
      status: 'ACTIVE',
      role: 'USER',
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      suspendedAt: null,
      suspendedUntil: null,
      suspensionReason: null,
    };

    const authorProfile = this.profiles.get(comment.authorId) || null;

    return {
      ...comment,
      author: {
        ...authorUser,
        profile: authorProfile,
      },
    };
  }

  async createComment(data: CreateCommentData): Promise<CommentWithAuthor> {
    const id = crypto.randomUUID();
    const now = new Date();
    const comment: Comment = {
      id,
      postId: data.postId,
      authorId: data.authorId,
      content: data.content,
      status: 'PUBLISHED',
      createdAt: now,
      updatedAt: now,
    };
    this.comments.set(id, comment);
    return this.buildCommentWithAuthor(comment);
  }

  async findCommentById(commentId: string): Promise<CommentWithAuthor | null> {
    const comment = this.comments.get(commentId);
    if (!comment) return null;
    return this.buildCommentWithAuthor(comment);
  }

  async updateCommentStatus(commentId: string, status: CommentStatus): Promise<Comment> {
    const comment = this.comments.get(commentId);
    if (!comment) throw new Error('Comment not found');
    const updated: Comment = {
      ...comment,
      status,
      updatedAt: new Date(),
    };
    this.comments.set(commentId, updated);
    return updated;
  }

  async getPostComments(postId: string, cursor?: string, limit = 20): Promise<CommentWithAuthor[]> {
    const matching = Array.from(this.comments.values())
      .filter((c) => c.postId === postId && c.status === 'PUBLISHED')
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = matching.findIndex((c) => c.id === cursor);
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1;
      }
    }

    const sliced = matching.slice(startIndex, startIndex + limit + 1);
    return sliced.map((c) => this.buildCommentWithAuthor(c));
  }

  async getCommentCount(postId: string): Promise<number> {
    return Array.from(this.comments.values()).filter(
      (c) => c.postId === postId && c.status === 'PUBLISHED',
    ).length;
  }
}
