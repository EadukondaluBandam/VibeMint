import { Post, User, Profile, PostLike, SavedPost, PostStatus, Comment } from '@prisma/client';
import type {
  PostSummary,
  FeedResponse,
  PostLikeResponse,
  SavedPostResponse,
  SavedPostsResponse,
} from '@vibemint/types';

export type { PostSummary, FeedResponse, PostLikeResponse, SavedPostResponse, SavedPostsResponse };

export interface PostWithRelations extends Post {
  author: User & { profile: Profile | null };
  likes?: PostLike[];
  savedBy?: SavedPost[];
  comments?: Array<Pick<Comment, 'id' | 'status'> | Comment>;
  _count?: {
    likes?: number;
    comments?: number;
  };
}

export interface SavedPostWithRelations extends SavedPost {
  post: PostWithRelations;
}

export interface CreatePostData {
  caption?: string | null;
  imageUrl?: string | null;
  mediaAssetId?: string | null;
}

export interface IPostsRepository {
  createPost(authorId: string, data: CreatePostData): Promise<PostWithRelations>;
  findPostById(postId: string): Promise<PostWithRelations | null>;
  updatePostStatus(postId: string, status: PostStatus): Promise<Post>;
  getFeed(cursor?: string, limit?: number): Promise<PostWithRelations[]>;
  getSavedPosts(userId: string, cursor?: string, limit?: number): Promise<SavedPostWithRelations[]>;
  likePost(userId: string, postId: string): Promise<boolean>;
  unlikePost(userId: string, postId: string): Promise<boolean>;
  savePost(userId: string, postId: string): Promise<boolean>;
  unsavePost(userId: string, postId: string): Promise<boolean>;
  getLikeCount(postId: string): Promise<number>;
  isPostLikedByUser(userId: string, postId: string): Promise<boolean>;
  isPostSavedByUser(userId: string, postId: string): Promise<boolean>;
}
