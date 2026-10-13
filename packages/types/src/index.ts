export type Identifier = string;

export type ProfileVisibility = 'PUBLIC' | 'PRIVATE';

export interface UserProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  location?: string | null;
  profileVisibility: ProfileVisibility;
  followerCount?: number;
  followingCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicUserProfile {
  id: string;
  userId?: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  profileVisibility: ProfileVisibility;
  isRestricted?: boolean;
  bio?: string | null;
  coverImageUrl?: string | null;
  location?: string | null;
  followerCount?: number;
  followingCount?: number;
  followStatus?: FollowRelationshipStatus;
  isBlocked?: boolean;
  isBlockedByViewer?: boolean;
  createdAt?: string;
}

export interface UpdateProfileInput {
  username?: string;
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  dateOfBirth?: string | null;
  gender?: string | null;
  location?: string | null;
  profileVisibility?: ProfileVisibility;
  mediaAssetId?: string | null;
}

export interface UsernameAvailabilityResponse {
  username: string;
  available: boolean;
  reason?: string;
}

// ==================== Interests & Onboarding Types ====================

export interface Interest {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  category: string;
  icon?: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface InterestCategory {
  category: string;
  interests: Interest[];
}

export interface UpdateUserInterestsInput {
  interestIds: string[];
}

export type OnboardingStep = 'PROFILE' | 'INTERESTS' | 'COMPLETED';

export interface OnboardingStatus {
  profileComplete: boolean;
  interestsCount: number;
  interestsComplete: boolean;
  minInterestsRequired?: number;
  isCompleted: boolean;
  nextStep: OnboardingStep;
}

export interface OnboardingCompleteResponse {
  isCompleted: boolean;
  message: string;
  status: OnboardingStatus;
}

// ==================== Social Feed & Posts Types ====================

export type PostStatus = 'PUBLISHED' | 'REMOVED';

export interface CreatePostInput {
  caption?: string | null;
  imageUrl?: string | null;
  mediaAssetId?: string | null;
}

export interface PostAuthorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface PostSummary {
  id: string;
  authorId: string;
  author: PostAuthorSummary;
  caption?: string | null;
  imageUrl?: string | null;
  mediaAssetId?: string | null;
  status: PostStatus;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  isSaved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeedPagination {
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
}

export interface FeedResponse {
  posts: PostSummary[];
  pagination: FeedPagination;
}

export interface PostLikeResponse {
  postId: string;
  isLiked: boolean;
  likeCount: number;
}

export interface SavedPostResponse {
  postId: string;
  isSaved: boolean;
}

export interface SavedPostsResponse {
  posts: PostSummary[];
  pagination: FeedPagination;
}

// ==================== Comments Types ====================

export type CommentStatus = 'PUBLISHED' | 'REMOVED';

export interface CreateCommentInput {
  content: string;
}

export interface CommentAuthorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface CommentSummary {
  id: string;
  postId: string;
  authorId: string;
  author: CommentAuthorSummary;
  content: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CommentsPagination {
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
}

export interface CommentsResponse {
  comments: CommentSummary[];
  pagination: CommentsPagination;
}

// ==================== Follow & Follower Types ====================

export type FollowRelationshipStatus = 'FOLLOWING' | 'PENDING' | 'NOT_FOLLOWING' | 'SELF';

export interface FollowStatusResponse {
  userId: string;
  status: FollowRelationshipStatus;
  isFollowing: boolean;
  isPending: boolean;
}

export interface FollowUserSummary {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  createdAt: string;
}

export interface FollowListPagination {
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
}

export interface FollowersResponse {
  followers: FollowUserSummary[];
  pagination: FollowListPagination;
}

export interface FollowingResponse {
  following: FollowUserSummary[];
  pagination: FollowListPagination;
}

export interface FollowRequestItem {
  id: string;
  followerId: string;
  follower: FollowUserSummary;
  createdAt: string;
}

export interface FollowRequestsResponse {
  requests: FollowRequestItem[];
  pagination: FollowListPagination;
}

// ==================== Notification Types ====================

export type NotificationType =
  | 'NEW_FOLLOWER'
  | 'FOLLOW_REQUEST_RECEIVED'
  | 'FOLLOW_REQUEST_ACCEPTED'
  | 'POST_LIKED'
  | 'POST_COMMENTED';

export type NotificationResourceType = 'POST' | 'COMMENT' | 'USER' | 'FOLLOW_REQUEST';

export interface NotificationActorSummary {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface NotificationItem {
  id: string;
  recipientId: string;
  actorId?: string | null;
  actor?: NotificationActorSummary | null;
  type: NotificationType;
  resourceType?: NotificationResourceType | string | null;
  resourceId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationsPagination {
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  pagination: NotificationsPagination;
}

export interface UnreadNotificationCountResponse {
  unreadCount: number;
}

export interface MarkNotificationReadResponse {
  id: string;
  isRead: boolean;
  readAt?: string | null;
}

export interface MarkAllNotificationsReadResponse {
  success: boolean;
  markedCount: number;
}

// ==================== User Blocking & Safety Types ====================

export interface BlockStatusResponse {
  userId: string;
  isBlockedByViewer: boolean;
  hasBlockedViewer: boolean;
  isBlocked: boolean;
}

export interface BlockUserResponse {
  userId: string;
  isBlocked: boolean;
  message?: string;
}

export interface BlockedUserSummary {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  blockedAt: string;
}

export interface BlockedUsersPagination {
  nextCursor?: string | null;
  hasMore: boolean;
  limit: number;
}

export interface BlockedUsersResponse {
  blockedUsers: BlockedUserSummary[];
  pagination: BlockedUsersPagination;
}

// ==================== Content Reporting Types ====================

export type ReportTargetType = 'USER' | 'POST' | 'COMMENT';

export type ReportReason =
  | 'HARASSMENT_OR_BULLYING'
  | 'HATE_OR_ABUSE'
  | 'SEXUAL_CONTENT'
  | 'SPAM_OR_SCAM'
  | 'IMPERSONATION'
  | 'VIOLENCE_OR_THREAT'
  | 'UNDERAGE_OR_SAFETY'
  | 'FRAUD_OR_MISLEADING'
  | 'OTHER';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description?: string | null;
}

export interface CreateReportResponse {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: string;
  message?: string;
  isDuplicate?: boolean;
}

export interface ReportReasonOption {
  value: ReportReason;
  label: string;
}

export const REPORT_REASONS: readonly ReportReasonOption[] = [
  { value: 'HARASSMENT_OR_BULLYING', label: 'Harassment or bullying' },
  { value: 'HATE_OR_ABUSE', label: 'Hate or abusive behavior' },
  { value: 'SEXUAL_CONTENT', label: 'Sexual or inappropriate content' },
  { value: 'SPAM_OR_SCAM', label: 'Spam or scams' },
  { value: 'IMPERSONATION', label: 'Impersonation' },
  { value: 'VIOLENCE_OR_THREAT', label: 'Threats or violence' },
  { value: 'UNDERAGE_OR_SAFETY', label: 'Underage user or age-safety concern' },
  { value: 'FRAUD_OR_MISLEADING', label: 'Fraud or misleading activity' },
  { value: 'OTHER', label: 'Other' },
] as const;

// ==================== User Role & Admin Types ====================

export type UserRole = 'USER' | 'ADMIN';

export interface SafeAdminUser {
  id: string;
  email: string;
  role: UserRole;
  status: string;
  emailVerified?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  suspendedAt?: string | null;
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
}

export interface AdminMeResponse {
  user: SafeAdminUser;
}

// ==================== Admin Moderation Types ====================

export interface AdminReportQueueFilters {
  status?: ReportStatus;
  targetType?: ReportTargetType;
  reason?: ReportReason;
  search?: string;
  cursor?: string;
  limit?: number;
}

export interface AdminReportSummary {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  reporter: {
    id: string;
    email: string;
  };
  targetSummary: {
    title: string;
    subtitle?: string;
    authorUsername?: string;
    isUnavailable?: boolean;
  };
}

export interface AdminReportListResponse {
  reports: AdminReportSummary[];
  pagination: {
    hasMore: boolean;
    nextCursor: string | null;
  };
  totalCount?: number;
}

export interface AdminReportStatsResponse {
  counts: {
    pending: number;
    underReview: number;
    resolved: number;
    dismissed: number;
    total: number;
  };
}

export interface ReportAuditLogSummary {
  id: string;
  reportId: string;
  adminId: string;
  adminEmail?: string;
  action: string;
  previousStatus: ReportStatus;
  newStatus: ReportStatus;
  decisionNote: string | null;
  createdAt: string;
}

export interface TargetUserDetail {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  status: string;
  bio?: string | null;
  createdAt: string;
  suspendedAt?: string | null;
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
}

export interface TargetPostDetail {
  id: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  caption?: string | null;
  imageUrl?: string | null;
  isRemoved: boolean;
  createdAt: string;
}

export interface TargetCommentDetail {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  content: string;
  isRemoved: boolean;
  createdAt: string;
}

export type ReportedTargetDetail =
  | { type: 'USER'; exists: boolean; isUnavailable: boolean; data: TargetUserDetail | null }
  | { type: 'POST'; exists: boolean; isUnavailable: boolean; data: TargetPostDetail | null }
  | { type: 'COMMENT'; exists: boolean; isUnavailable: boolean; data: TargetCommentDetail | null };

export interface AdminReportDetailResponse {
  report: {
    id: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    description: string | null;
    status: ReportStatus;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
  };
  reporter: {
    id: string;
    email: string;
    createdAt: string;
  };
  target: ReportedTargetDetail;
  auditLogs: ReportAuditLogSummary[];
}

export interface UpdateReportStatusRequest {
  status: ReportStatus;
  decisionNote?: string | null;
  expectedStatus?: ReportStatus;
}

export interface UpdateReportStatusResponse {
  report: {
    id: string;
    status: ReportStatus;
    resolvedAt: string | null;
    updatedAt: string;
  };
  auditLog: ReportAuditLogSummary;
  message: string;
}

// ==================== Moderation Enforcement Types ====================

export type ModerationActionType =
  | 'REMOVE_POST'
  | 'RESTORE_POST'
  | 'REMOVE_COMMENT'
  | 'RESTORE_COMMENT'
  | 'SUSPEND_USER'
  | 'UNSUSPEND_USER';

export interface ModerationActionSummary {
  id: string;
  adminId: string;
  adminEmail?: string;
  adminUsername?: string;
  targetType: ReportTargetType;
  targetId: string;
  actionType: ModerationActionType;
  reason: string;
  reportId?: string | null;
  suspendedUntil?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface ModerationHistoryResponse {
  targetType: ReportTargetType;
  targetId: string;
  actions: ModerationActionSummary[];
  total: number;
}

export interface AdminRemoveContentRequest {
  reason: string;
  reportId?: string;
}

export interface AdminRestoreContentRequest {
  reason: string;
  reportId?: string;
}

export interface AdminSuspendUserRequest {
  reason: string;
  durationDays?: number | null;
  reportId?: string;
}

export interface AdminUnsuspendUserRequest {
  reason: string;
  reportId?: string;
}

export interface AdminEnforcementActionResult {
  success: boolean;
  message: string;
  action: ModerationActionSummary;
  targetState: {
    id: string;
    status: string;
    suspendedUntil?: string | null;
    isRemoved?: boolean;
  };
}

// ==================== Media Upload & Asset Management Types ====================

export type MediaStatus = 'PENDING_UPLOAD' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED';

export type MediaPurpose = 'AVATAR' | 'POST_IMAGE';

export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface MediaAssetSummary {
  id: string;
  ownerId: string;
  mediaType: string;
  purpose: MediaPurpose;
  storageKey: string;
  mimeType: string;
  fileSize: number;
  width?: number | null;
  height?: number | null;
  status: MediaStatus;
  deliveryUrl?: string | null;
  checksum?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUploadInitRequest {
  mimeType: SupportedImageMimeType;
  fileSize: number;
  purpose: MediaPurpose;
  fileName?: string;
}

export interface MediaUploadInitResponse {
  uploadId: string;
  assetId: string;
  uploadUrl: string;
  uploadMethod: 'PUT' | 'POST';
  uploadHeaders?: Record<string, string>;
  storageKey: string;
  expiresAt: string;
  maxSizeBytes: number;
  mimeType: SupportedImageMimeType;
  status: MediaStatus;
}

export interface MediaUploadCompleteRequest {
  checksum?: string;
}

export interface MediaUploadCompleteResponse {
  asset: MediaAssetSummary;
  message: string;
}
