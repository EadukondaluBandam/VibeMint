import { Comment, CommentStatus, User, Profile } from '@prisma/client';
import type { CommentSummary, CommentsResponse, CreateCommentInput } from '@vibemint/types';

export type { CommentSummary, CommentsResponse, CreateCommentInput };

export interface CommentWithAuthor extends Comment {
  author: User & { profile: Profile | null };
}

export interface CreateCommentData {
  postId: string;
  authorId: string;
  content: string;
}

export interface ICommentsRepository {
  createComment(data: CreateCommentData): Promise<CommentWithAuthor>;
  findCommentById(commentId: string): Promise<CommentWithAuthor | null>;
  updateCommentStatus(commentId: string, status: CommentStatus): Promise<Comment>;
  getPostComments(postId: string, cursor?: string, limit?: number): Promise<CommentWithAuthor[]>;
  getCommentCount(postId: string): Promise<number>;
}
