import {
  PrismaClient,
  Post,
  PostStatus,
  PostLike,
  SavedPost,
  User,
  Profile,
  Comment,
} from '@prisma/client';
import crypto from 'node:crypto';
import {
  IPostsRepository,
  PostWithRelations,
  SavedPostWithRelations,
  CreatePostData,
} from './posts.types.js';

export class PrismaPostsRepository implements IPostsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createPost(authorId: string, data: CreatePostData): Promise<PostWithRelations> {
    return this.prisma.post.create({
      data: {
        authorId,
        caption: data.caption ?? null,
        imageUrl: data.imageUrl ?? null,
        mediaAssetId: data.mediaAssetId ?? null,
        status: 'PUBLISHED',
      },
      include: {
        author: {
          include: { profile: true },
        },
        likes: true,
        savedBy: true,
        comments: {
          where: { status: 'PUBLISHED' },
          select: { id: true, status: true },
        },
      },
    });
  }

  async findPostById(postId: string): Promise<PostWithRelations | null> {
    return this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          include: { profile: true },
        },
        likes: true,
        savedBy: true,
        comments: {
          where: { status: 'PUBLISHED' },
          select: { id: true, status: true },
        },
      },
    });
  }

  async updatePostStatus(postId: string, status: PostStatus): Promise<Post> {
    return this.prisma.post.update({
      where: { id: postId },
      data: { status },
    });
  }

  async getFeed(cursor?: string, limit = 20): Promise<PostWithRelations[]> {
    return this.prisma.post.findMany({
      where: {
        status: 'PUBLISHED',
      },
      orderBy: { createdAt: 'desc' },
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
        likes: true,
        savedBy: true,
        comments: {
          where: { status: 'PUBLISHED' },
          select: { id: true, status: true },
        },
      },
    });
  }

  async getSavedPosts(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<SavedPostWithRelations[]> {
    return this.prisma.savedPost.findMany({
      where: {
        userId,
        post: {
          status: 'PUBLISHED',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        post: {
          include: {
            author: {
              include: { profile: true },
            },
            likes: true,
            savedBy: true,
            comments: {
              where: { status: 'PUBLISHED' },
              select: { id: true, status: true },
            },
          },
        },
      },
    });
  }

  async likePost(userId: string, postId: string): Promise<boolean> {
    try {
      await this.prisma.postLike.upsert({
        where: {
          userId_postId: { userId, postId },
        },
        update: {},
        create: {
          userId,
          postId,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async unlikePost(userId: string, postId: string): Promise<boolean> {
    try {
      await this.prisma.postLike.deleteMany({
        where: { userId, postId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async savePost(userId: string, postId: string): Promise<boolean> {
    try {
      await this.prisma.savedPost.upsert({
        where: {
          userId_postId: { userId, postId },
        },
        update: {},
        create: {
          userId,
          postId,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async unsavePost(userId: string, postId: string): Promise<boolean> {
    try {
      await this.prisma.savedPost.deleteMany({
        where: { userId, postId },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getLikeCount(postId: string): Promise<number> {
    return this.prisma.postLike.count({
      where: { postId },
    });
  }

  async isPostLikedByUser(userId: string, postId: string): Promise<boolean> {
    const like = await this.prisma.postLike.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });
    return Boolean(like);
  }

  async isPostSavedByUser(userId: string, postId: string): Promise<boolean> {
    const saved = await this.prisma.savedPost.findUnique({
      where: {
        userId_postId: { userId, postId },
      },
    });
    return Boolean(saved);
  }
}

export class InMemoryPostsRepository implements IPostsRepository {
  private posts: Map<string, Post> = new Map();
  private likes: Map<string, PostLike> = new Map(); // key: `${userId}:${postId}`
  private savedPosts: Map<string, SavedPost> = new Map(); // key: `${userId}:${postId}`
  public comments: Map<string, Comment> = new Map();
  public users: Map<string, User> = new Map();
  public profiles: Map<string, Profile> = new Map();

  private buildPostWithRelations(post: Post): PostWithRelations {
    const authorUser = this.users.get(post.authorId) || {
      id: post.authorId,
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

    const authorProfile = this.profiles.get(post.authorId) || null;

    const postLikes = Array.from(this.likes.values()).filter((l) => l.postId === post.id);
    const postSaved = Array.from(this.savedPosts.values()).filter((s) => s.postId === post.id);
    const postComments = Array.from(this.comments.values()).filter(
      (c) => c.postId === post.id && c.status === 'PUBLISHED',
    );

    return {
      ...post,
      author: {
        ...authorUser,
        profile: authorProfile,
      },
      likes: postLikes,
      savedBy: postSaved,
      comments: postComments,
      _count: {
        likes: postLikes.length,
        comments: postComments.length,
      },
    };
  }

  private postSequence = 0;

  async createPost(authorId: string, data: CreatePostData): Promise<PostWithRelations> {
    const id = crypto.randomUUID();
    const now = new Date(Date.now() + this.postSequence++);
    const post: Post = {
      id,
      authorId,
      caption: data.caption ?? null,
      imageUrl: data.imageUrl ?? null,
      mediaAssetId: data.mediaAssetId ?? null,
      status: 'PUBLISHED',
      createdAt: now,
      updatedAt: now,
    };
    this.posts.set(id, post);
    return this.buildPostWithRelations(post);
  }

  async findPostById(postId: string): Promise<PostWithRelations | null> {
    const post = this.posts.get(postId);
    if (!post) return null;
    return this.buildPostWithRelations(post);
  }

  async updatePostStatus(postId: string, status: PostStatus): Promise<Post> {
    const post = this.posts.get(postId);
    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }
    post.status = status;
    post.updatedAt = new Date();
    this.posts.set(postId, post);
    return { ...post };
  }

  async getFeed(cursor?: string, limit = 20): Promise<PostWithRelations[]> {
    const published = Array.from(this.posts.values())
      .filter((p) => p.status === 'PUBLISHED')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = published.findIndex((p) => p.id === cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const sliced = published.slice(startIndex, startIndex + limit + 1);
    return sliced.map((p) => this.buildPostWithRelations(p));
  }

  async getSavedPosts(
    userId: string,
    cursor?: string,
    limit = 20,
  ): Promise<SavedPostWithRelations[]> {
    const userSaves = Array.from(this.savedPosts.values())
      .filter((s) => {
        if (s.userId !== userId) return false;
        const post = this.posts.get(s.postId);
        return post && post.status === 'PUBLISHED';
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor) {
      const cursorIndex = userSaves.findIndex((s) => s.id === cursor || s.postId === cursor);
      if (cursorIndex >= 0) {
        startIndex = cursorIndex + 1;
      }
    }

    const sliced = userSaves.slice(startIndex, startIndex + limit + 1);
    return sliced.map((s) => {
      const post = this.posts.get(s.postId)!;
      return {
        ...s,
        post: this.buildPostWithRelations(post),
      };
    });
  }

  async likePost(userId: string, postId: string): Promise<boolean> {
    const key = `${userId}:${postId}`;
    if (!this.likes.has(key)) {
      this.likes.set(key, {
        id: crypto.randomUUID(),
        userId,
        postId,
        createdAt: new Date(),
      });
    }
    return true;
  }

  async unlikePost(userId: string, postId: string): Promise<boolean> {
    const key = `${userId}:${postId}`;
    this.likes.delete(key);
    return true;
  }

  async savePost(userId: string, postId: string): Promise<boolean> {
    const key = `${userId}:${postId}`;
    if (!this.savedPosts.has(key)) {
      this.savedPosts.set(key, {
        id: crypto.randomUUID(),
        userId,
        postId,
        createdAt: new Date(),
      });
    }
    return true;
  }

  async unsavePost(userId: string, postId: string): Promise<boolean> {
    const key = `${userId}:${postId}`;
    this.savedPosts.delete(key);
    return true;
  }

  async getLikeCount(postId: string): Promise<number> {
    let count = 0;
    for (const like of this.likes.values()) {
      if (like.postId === postId) count++;
    }
    return count;
  }

  async isPostLikedByUser(userId: string, postId: string): Promise<boolean> {
    return this.likes.has(`${userId}:${postId}`);
  }

  async isPostSavedByUser(userId: string, postId: string): Promise<boolean> {
    return this.savedPosts.has(`${userId}:${postId}`);
  }

  clear(): void {
    this.posts.clear();
    this.likes.clear();
    this.savedPosts.clear();
    this.users.clear();
    this.profiles.clear();
  }
}
