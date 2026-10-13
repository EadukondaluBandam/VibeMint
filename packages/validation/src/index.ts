export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Standard email format regex adhering to RFC 5322 simplified pattern.
 */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Normalizes email by trimming surrounding whitespace and converting to lowercase.
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

/**
 * Checks whether the given value is a valid email string.
 */
export const isValidEmail = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 254) return false;
  return EMAIL_REGEX.test(trimmed);
};

export interface PasswordRequirements {
  minLength?: number;
  maxLength?: number;
}

export const DEFAULT_PASSWORD_REQUIREMENTS: Required<PasswordRequirements> = {
  minLength: 8,
  maxLength: 128,
};

/**
 * Validates password meets production security constraints without unreasonable complexity.
 */
export const isValidPassword = (
  value: unknown,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS,
): value is string => {
  if (typeof value !== 'string') return false;
  const minLength = requirements.minLength ?? DEFAULT_PASSWORD_REQUIREMENTS.minLength;
  const maxLength = requirements.maxLength ?? DEFAULT_PASSWORD_REQUIREMENTS.maxLength;
  return value.length >= minLength && value.length <= maxLength;
};

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
}

export interface SignupInput {
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const validateSignupInput = (
  input: unknown,
  requirements: PasswordRequirements = DEFAULT_PASSWORD_REQUIREMENTS,
): ValidationResult<SignupInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { form: 'Invalid request body' } };
  }

  const payload = input as Record<string, unknown>;

  if (!isValidEmail(payload.email)) {
    errors.email = 'A valid email address is required';
  }

  if (!isValidPassword(payload.password, requirements)) {
    const min = requirements.minLength ?? DEFAULT_PASSWORD_REQUIREMENTS.minLength;
    errors.password = `Password must be between ${min} and ${DEFAULT_PASSWORD_REQUIREMENTS.maxLength} characters`;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: normalizeEmail(payload.email as string),
      password: payload.password as string,
    },
  };
};

export const validateLoginInput = (input: unknown): ValidationResult<LoginInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { form: 'Invalid request body' } };
  }

  const payload = input as Record<string, unknown>;

  if (!isValidEmail(payload.email)) {
    errors.email = 'A valid email address is required';
  }

  if (typeof payload.password !== 'string' || payload.password.length === 0) {
    errors.password = 'Password is required';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      email: normalizeEmail(payload.email as string),
      password: payload.password as string,
    },
  };
};

// ==================== Username & Profile Validation ====================

/**
 * Username constraints:
 * - 3 to 30 characters
 * - Letters, numbers, and underscores only
 */
export const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

/**
 * Normalizes username by trimming surrounding whitespace and converting to lowercase.
 */
export const normalizeUsername = (username: string): string => {
  return username.trim().toLowerCase();
};

/**
 * Checks whether the candidate username adheres to format and length constraints.
 */
export const isValidUsername = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return USERNAME_REGEX.test(trimmed);
};

/**
 * Validates web URLs (http or https).
 */
export const isValidUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export interface ValidatedProfileUpdateData {
  username?: string;
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  coverImageUrl?: string | null;
  dateOfBirth?: Date | null;
  gender?: string | null;
  location?: string | null;
  profileVisibility?: 'PUBLIC' | 'PRIVATE';
  mediaAssetId?: string | null;
}

const PROTECTED_FIELDS = new Set([
  'id',
  'userId',
  'user_id',
  'email',
  'password',
  'passwordHash',
  'password_hash',
  'status',
  'role',
  'isAdmin',
  'is_admin',
  'emailVerified',
  'email_verified',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
  'lastLoginAt',
  'last_login_at',
  'suspendedAt',
  'suspended_at',
  'suspendedUntil',
  'suspended_until',
  'suspensionReason',
  'suspension_reason',
]);

export const validateProfileUpdate = (
  input: unknown,
): ValidationResult<ValidatedProfileUpdateData> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { form: 'Invalid request body' } };
  }

  const payload = input as Record<string, unknown>;

  // Check for attempt to modify protected User/System fields
  for (const field of Object.keys(payload)) {
    if (PROTECTED_FIELDS.has(field)) {
      errors[field] = `Cannot modify protected field: ${field}`;
    }
  }

  const resultData: ValidatedProfileUpdateData = {};

  // 1. Username
  if ('username' in payload && payload.username !== undefined) {
    if (!isValidUsername(payload.username)) {
      errors.username =
        'Username must be 3-30 characters long and contain only letters, numbers, and underscores';
    } else {
      resultData.username = normalizeUsername(payload.username);
    }
  }

  // 2. Display Name
  if ('displayName' in payload && payload.displayName !== undefined) {
    if (
      typeof payload.displayName !== 'string' ||
      payload.displayName.trim().length < 1 ||
      payload.displayName.trim().length > 50
    ) {
      errors.displayName = 'Display name must be between 1 and 50 characters';
    } else {
      resultData.displayName = payload.displayName.trim();
    }
  }

  // 3. Bio
  if ('bio' in payload && payload.bio !== undefined) {
    if (payload.bio === null || payload.bio === '') {
      resultData.bio = null;
    } else if (typeof payload.bio === 'string') {
      if (payload.bio.length > 500) {
        errors.bio = 'Bio cannot exceed 500 characters';
      } else {
        resultData.bio = payload.bio.trim();
      }
    } else {
      errors.bio = 'Bio must be a string or null';
    }
  }

  // 4. Avatar URL
  if ('avatarUrl' in payload && payload.avatarUrl !== undefined) {
    if (payload.avatarUrl === null || payload.avatarUrl === '') {
      resultData.avatarUrl = null;
    } else if (typeof payload.avatarUrl === 'string') {
      if (!isValidUrl(payload.avatarUrl)) {
        errors.avatarUrl = 'Avatar URL must be a valid HTTP or HTTPS URL';
      } else if (payload.avatarUrl.length > 2048) {
        errors.avatarUrl = 'Avatar URL is too long';
      } else {
        resultData.avatarUrl = payload.avatarUrl.trim();
      }
    } else {
      errors.avatarUrl = 'Avatar URL must be a valid URL string or null';
    }
  }

  // 5. Cover Image URL
  if ('coverImageUrl' in payload && payload.coverImageUrl !== undefined) {
    if (payload.coverImageUrl === null || payload.coverImageUrl === '') {
      resultData.coverImageUrl = null;
    } else if (typeof payload.coverImageUrl === 'string') {
      if (!isValidUrl(payload.coverImageUrl)) {
        errors.coverImageUrl = 'Cover image URL must be a valid HTTP or HTTPS URL';
      } else if (payload.coverImageUrl.length > 2048) {
        errors.coverImageUrl = 'Cover image URL is too long';
      } else {
        resultData.coverImageUrl = payload.coverImageUrl.trim();
      }
    } else {
      errors.coverImageUrl = 'Cover image URL must be a valid URL string or null';
    }
  }

  // 6. Date of Birth
  if ('dateOfBirth' in payload && payload.dateOfBirth !== undefined) {
    if (payload.dateOfBirth === null || payload.dateOfBirth === '') {
      resultData.dateOfBirth = null;
    } else {
      const parsedDate = new Date(payload.dateOfBirth as string | number | Date);
      if (isNaN(parsedDate.getTime())) {
        errors.dateOfBirth = 'Date of birth must be a valid date';
      } else if (parsedDate > new Date()) {
        errors.dateOfBirth = 'Date of birth cannot be in the future';
      } else {
        resultData.dateOfBirth = parsedDate;
      }
    }
  }

  // 7. Gender
  if ('gender' in payload && payload.gender !== undefined) {
    if (payload.gender === null || payload.gender === '') {
      resultData.gender = null;
    } else if (typeof payload.gender === 'string') {
      if (payload.gender.trim().length > 50) {
        errors.gender = 'Gender cannot exceed 50 characters';
      } else {
        resultData.gender = payload.gender.trim();
      }
    } else {
      errors.gender = 'Gender must be a string or null';
    }
  }

  // 8. Location
  if ('location' in payload && payload.location !== undefined) {
    if (payload.location === null || payload.location === '') {
      resultData.location = null;
    } else if (typeof payload.location === 'string') {
      if (payload.location.trim().length > 100) {
        errors.location = 'Location cannot exceed 100 characters';
      } else {
        resultData.location = payload.location.trim();
      }
    } else {
      errors.location = 'Location must be a string or null';
    }
  }

  // 9. Profile Visibility
  if ('profileVisibility' in payload && payload.profileVisibility !== undefined) {
    if (payload.profileVisibility === 'PUBLIC' || payload.profileVisibility === 'PRIVATE') {
      resultData.profileVisibility = payload.profileVisibility;
    } else {
      errors.profileVisibility = "Profile visibility must be either 'PUBLIC' or 'PRIVATE'";
    }
  }

  // 10. Media Asset ID (for verified avatar attachment)
  if ('mediaAssetId' in payload && payload.mediaAssetId !== undefined) {
    if (payload.mediaAssetId === null || payload.mediaAssetId === '') {
      resultData.mediaAssetId = null;
    } else if (typeof payload.mediaAssetId === 'string') {
      resultData.mediaAssetId = payload.mediaAssetId.trim();
    } else {
      errors.mediaAssetId = 'Media asset ID must be a string or null';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: resultData };
};

// ==================== Interests & Onboarding Validation ====================

export const MIN_INTERESTS_SELECTION = 3;
export const MAX_INTERESTS_SELECTION = 10;

export interface InterestsSelectionInput {
  interestIds: string[];
}

export const validateInterestsSelection = (
  input: unknown,
  min = MIN_INTERESTS_SELECTION,
  max = MAX_INTERESTS_SELECTION,
): ValidationResult<InterestsSelectionInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { form: 'Invalid request body' } };
  }

  const payload = input as Record<string, unknown>;
  const ids = Array.isArray(payload.interestIds)
    ? payload.interestIds
    : Array.isArray(input)
      ? (input as unknown[])
      : null;

  if (!ids) {
    errors.interestIds = 'interestIds must be an array of interest IDs';
    return { success: false, errors };
  }

  const cleanedIds: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < ids.length; i++) {
    const item = ids[i];
    if (typeof item !== 'string' || item.trim().length === 0) {
      errors.interestIds = 'All interest IDs must be non-empty strings';
      return { success: false, errors };
    }
    const trimmed = item.trim();
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      cleanedIds.push(trimmed);
    }
  }

  if (cleanedIds.length < min) {
    errors.interestIds = `Please select at least ${min} interests`;
  } else if (cleanedIds.length > max) {
    errors.interestIds = `You can select at most ${max} interests`;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: { interestIds: cleanedIds } };
};

// ==================== Social Post Validation ====================

export const MAX_POST_CAPTION_LENGTH = 1000;

export const isValidHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export interface ValidatedPostInput {
  caption?: string | null;
  imageUrl?: string | null;
  mediaAssetId?: string | null;
}

export const validateCreatePost = (input: unknown): ValidationResult<ValidatedPostInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      success: false,
      errors: { body: 'Invalid request body' },
    };
  }

  const raw = input as Record<string, unknown>;
  let caption: string | null = null;
  let imageUrl: string | null = null;
  let mediaAssetId: string | null = null;

  if (raw.caption !== undefined && raw.caption !== null) {
    if (typeof raw.caption !== 'string') {
      errors.caption = 'Caption must be a string';
    } else {
      const trimmedCaption = raw.caption.trim();
      if (trimmedCaption.length > MAX_POST_CAPTION_LENGTH) {
        errors.caption = `Caption cannot exceed ${MAX_POST_CAPTION_LENGTH} characters`;
      } else if (trimmedCaption.length > 0) {
        caption = trimmedCaption;
      }
    }
  }

  if (raw.imageUrl !== undefined && raw.imageUrl !== null) {
    if (typeof raw.imageUrl !== 'string') {
      errors.imageUrl = 'Image URL must be a string';
    } else {
      const trimmedUrl = raw.imageUrl.trim();
      if (trimmedUrl.length > 0) {
        if (!isValidHttpUrl(trimmedUrl)) {
          errors.imageUrl = 'Image URL must be a valid http or https URL';
        } else {
          imageUrl = trimmedUrl;
        }
      }
    }
  }

  if (raw.mediaAssetId !== undefined && raw.mediaAssetId !== null) {
    if (typeof raw.mediaAssetId !== 'string') {
      errors.mediaAssetId = 'Media asset ID must be a string';
    } else {
      const trimmedAssetId = raw.mediaAssetId.trim();
      if (trimmedAssetId.length > 0) {
        mediaAssetId = trimmedAssetId;
      }
    }
  }

  if (!caption && !imageUrl && !mediaAssetId && Object.keys(errors).length === 0) {
    errors.content = 'Post must contain a caption or an image URL';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      caption,
      imageUrl,
      mediaAssetId,
    },
  };
};

// ==================== Comment Validation ====================

export const MAX_COMMENT_LENGTH = 500;

export interface ValidatedCommentInput {
  content: string;
}

export const validateCreateComment = (input: unknown): ValidationResult<ValidatedCommentInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      success: false,
      errors: { body: 'Invalid request body' },
    };
  }

  const raw = input as Record<string, unknown>;

  if (raw.content === undefined || raw.content === null) {
    errors.content = 'Comment content is required';
  } else if (typeof raw.content !== 'string') {
    errors.content = 'Comment content must be a string';
  } else {
    const trimmed = raw.content.trim();
    if (trimmed.length === 0) {
      errors.content = 'Comment content cannot be empty';
    } else if (trimmed.length > MAX_COMMENT_LENGTH) {
      errors.content = `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`;
    } else {
      return {
        success: true,
        data: {
          content: trimmed,
        },
      };
    }
  }

  return { success: false, errors };
};

// ==================== Content Reporting Validation ====================

export const VALID_REPORT_TARGET_TYPES = ['USER', 'POST', 'COMMENT'] as const;

export const VALID_REPORT_REASONS = [
  'HARASSMENT_OR_BULLYING',
  'HATE_OR_ABUSE',
  'SEXUAL_CONTENT',
  'SPAM_OR_SCAM',
  'IMPERSONATION',
  'VIOLENCE_OR_THREAT',
  'UNDERAGE_OR_SAFETY',
  'FRAUD_OR_MISLEADING',
  'OTHER',
] as const;

export const MAX_REPORT_DESCRIPTION_LENGTH = 1000;

export interface ValidatedReportInput {
  targetType: 'USER' | 'POST' | 'COMMENT';
  targetId: string;
  reason:
    | 'HARASSMENT_OR_BULLYING'
    | 'HATE_OR_ABUSE'
    | 'SEXUAL_CONTENT'
    | 'SPAM_OR_SCAM'
    | 'IMPERSONATION'
    | 'VIOLENCE_OR_THREAT'
    | 'UNDERAGE_OR_SAFETY'
    | 'FRAUD_OR_MISLEADING'
    | 'OTHER';
  description?: string | null;
}

export const validateCreateReport = (input: unknown): ValidationResult<ValidatedReportInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      success: false,
      errors: { body: 'Invalid request body' },
    };
  }

  const raw = input as Record<string, unknown>;

  if (!raw.targetType || typeof raw.targetType !== 'string') {
    errors.targetType = 'Target type is required';
  } else if (
    !VALID_REPORT_TARGET_TYPES.includes(
      raw.targetType as (typeof VALID_REPORT_TARGET_TYPES)[number],
    )
  ) {
    errors.targetType = `Target type must be one of: ${VALID_REPORT_TARGET_TYPES.join(', ')}`;
  }

  if (!raw.targetId || typeof raw.targetId !== 'string' || raw.targetId.trim().length === 0) {
    errors.targetId = 'Target ID is required';
  }

  if (!raw.reason || typeof raw.reason !== 'string') {
    errors.reason = 'Report reason is required';
  } else if (!VALID_REPORT_REASONS.includes(raw.reason as (typeof VALID_REPORT_REASONS)[number])) {
    errors.reason = `Report reason must be one of: ${VALID_REPORT_REASONS.join(', ')}`;
  }

  let description: string | null = null;
  if (raw.description !== undefined && raw.description !== null) {
    if (typeof raw.description !== 'string') {
      errors.description = 'Description must be a string';
    } else {
      const trimmed = raw.description.trim();
      if (trimmed.length > MAX_REPORT_DESCRIPTION_LENGTH) {
        errors.description = `Description cannot exceed ${MAX_REPORT_DESCRIPTION_LENGTH} characters`;
      } else if (trimmed.length > 0) {
        description = trimmed;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      targetType: raw.targetType as ValidatedReportInput['targetType'],
      targetId: (raw.targetId as string).trim(),
      reason: raw.reason as ValidatedReportInput['reason'],
      description,
    },
  };
};

// ==================== Moderation Validation ====================

export const VALID_REPORT_STATUSES = ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;

export type ValidReportStatus = (typeof VALID_REPORT_STATUSES)[number];

export const MAX_DECISION_NOTE_LENGTH = 1000;
export const MIN_DECISION_NOTE_LENGTH = 3;

export const ALLOWED_STATUS_TRANSITIONS: Record<ValidReportStatus, readonly ValidReportStatus[]> = {
  PENDING: ['UNDER_REVIEW', 'RESOLVED', 'DISMISSED'],
  UNDER_REVIEW: ['RESOLVED', 'DISMISSED', 'PENDING'],
  RESOLVED: ['UNDER_REVIEW', 'PENDING'],
  DISMISSED: ['UNDER_REVIEW', 'PENDING'],
};

export interface ValidatedUpdateReportStatusInput {
  status: ValidReportStatus;
  decisionNote?: string | null;
  expectedStatus?: ValidReportStatus;
}

export const validateUpdateReportStatus = (
  currentStatus: ValidReportStatus,
  input: unknown,
): ValidationResult<ValidatedUpdateReportStatusInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return {
      success: false,
      errors: { body: 'Invalid request body' },
    };
  }

  const raw = input as Record<string, unknown>;

  if (!raw.status || typeof raw.status !== 'string') {
    errors.status = 'Status is required';
  } else if (!VALID_REPORT_STATUSES.includes(raw.status as ValidReportStatus)) {
    errors.status = `Status must be one of: ${VALID_REPORT_STATUSES.join(', ')}`;
  }

  const targetStatus = raw.status as ValidReportStatus;

  if (targetStatus && VALID_REPORT_STATUSES.includes(targetStatus)) {
    if (targetStatus !== currentStatus) {
      const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(targetStatus)) {
        errors.status = `Cannot transition report from ${currentStatus} to ${targetStatus}`;
      }
    }
  }

  let decisionNote: string | null = null;
  if (raw.decisionNote !== undefined && raw.decisionNote !== null) {
    if (typeof raw.decisionNote !== 'string') {
      errors.decisionNote = 'Decision note must be a string';
    } else {
      const trimmed = raw.decisionNote.trim();
      if (trimmed.length > MAX_DECISION_NOTE_LENGTH) {
        errors.decisionNote = `Decision note cannot exceed ${MAX_DECISION_NOTE_LENGTH} characters`;
      } else if (trimmed.length > 0) {
        decisionNote = trimmed;
      }
    }
  }

  // Enforce decision note requirement:
  if (!errors.decisionNote) {
    if (targetStatus === 'RESOLVED' || targetStatus === 'DISMISSED') {
      if (!decisionNote || decisionNote.length < MIN_DECISION_NOTE_LENGTH) {
        errors.decisionNote = `A decision note of at least ${MIN_DECISION_NOTE_LENGTH} characters is required when resolving or dismissing a report`;
      }
    } else if (currentStatus === 'RESOLVED' || currentStatus === 'DISMISSED') {
      // Reopening a resolved or dismissed report requires a note
      if (!decisionNote || decisionNote.length < MIN_DECISION_NOTE_LENGTH) {
        errors.decisionNote = 'A decision note explaining the reason for reopening is required';
      }
    }
  }

  let expectedStatus: ValidReportStatus | undefined;
  if (raw.expectedStatus !== undefined && raw.expectedStatus !== null) {
    if (
      typeof raw.expectedStatus === 'string' &&
      VALID_REPORT_STATUSES.includes(raw.expectedStatus as ValidReportStatus)
    ) {
      expectedStatus = raw.expectedStatus as ValidReportStatus;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      status: targetStatus,
      decisionNote,
      expectedStatus,
    },
  };
};

export interface ValidatedAdminReportQueueFilters {
  status?: ValidReportStatus;
  targetType?: (typeof VALID_REPORT_TARGET_TYPES)[number];
  reason?: (typeof VALID_REPORT_REASONS)[number];
  search?: string;
  cursor?: string;
  limit?: number;
}

export const validateAdminReportQueueFilters = (
  query: unknown,
): ValidationResult<ValidatedAdminReportQueueFilters> => {
  const errors: Record<string, string> = {};
  const raw = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>;
  const data: ValidatedAdminReportQueueFilters = {};

  if (raw.status !== undefined && raw.status !== '') {
    if (
      typeof raw.status === 'string' &&
      VALID_REPORT_STATUSES.includes(raw.status as ValidReportStatus)
    ) {
      data.status = raw.status as ValidReportStatus;
    } else {
      errors.status = `Status filter must be one of: ${VALID_REPORT_STATUSES.join(', ')}`;
    }
  }

  if (raw.targetType !== undefined && raw.targetType !== '') {
    if (
      typeof raw.targetType === 'string' &&
      VALID_REPORT_TARGET_TYPES.includes(
        raw.targetType as (typeof VALID_REPORT_TARGET_TYPES)[number],
      )
    ) {
      data.targetType = raw.targetType as (typeof VALID_REPORT_TARGET_TYPES)[number];
    } else {
      errors.targetType = `Target type filter must be one of: ${VALID_REPORT_TARGET_TYPES.join(', ')}`;
    }
  }

  if (raw.reason !== undefined && raw.reason !== '') {
    if (
      typeof raw.reason === 'string' &&
      VALID_REPORT_REASONS.includes(raw.reason as (typeof VALID_REPORT_REASONS)[number])
    ) {
      data.reason = raw.reason as (typeof VALID_REPORT_REASONS)[number];
    } else {
      errors.reason = `Reason filter must be one of: ${VALID_REPORT_REASONS.join(', ')}`;
    }
  }

  if (raw.search !== undefined && raw.search !== '') {
    if (typeof raw.search === 'string') {
      const trimmed = raw.search.trim();
      if (trimmed.length > 100) {
        errors.search = 'Search query cannot exceed 100 characters';
      } else if (trimmed.length > 0) {
        data.search = trimmed;
      }
    }
  }

  if (raw.cursor !== undefined && raw.cursor !== '') {
    if (typeof raw.cursor === 'string') {
      data.cursor = raw.cursor.trim();
    }
  }

  if (raw.limit !== undefined && raw.limit !== '') {
    const parsedLimit = Number(raw.limit);
    if (Number.isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      errors.limit = 'Limit must be a number between 1 and 50';
    } else {
      data.limit = Math.floor(parsedLimit);
    }
  } else {
    data.limit = 20;
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return { success: true, data };
};

// ==================== Media Upload & Asset Validation ====================

export const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10 Megabytes

export const VALID_MEDIA_PURPOSES = ['AVATAR', 'POST_IMAGE'] as const;

export type ValidMediaPurpose = (typeof VALID_MEDIA_PURPOSES)[number];

export interface ValidatedMediaUploadInitInput {
  mimeType: AllowedImageMimeType;
  fileSize: number;
  purpose: ValidMediaPurpose;
  fileName?: string | null;
}

export const validateMediaUploadInit = (
  input: unknown,
): ValidationResult<ValidatedMediaUploadInitInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { body: 'Invalid request body' } };
  }

  const raw = input as Record<string, unknown>;

  // 1. MIME Type validation
  if (!raw.mimeType || typeof raw.mimeType !== 'string') {
    errors.mimeType = 'MIME type is required';
  } else {
    const normalizedMime = raw.mimeType.toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime as AllowedImageMimeType)) {
      errors.mimeType = `Unsupported MIME type: "${raw.mimeType}". Allowed formats: JPEG, PNG, WebP`;
    }
  }

  // 2. File Size validation
  const rawSize = raw.fileSize ?? raw.fileSizeBytes;
  if (rawSize === undefined || rawSize === null) {
    errors.fileSize = 'File size is required';
  } else {
    const parsedSize = Number(rawSize);
    if (Number.isNaN(parsedSize) || parsedSize <= 0) {
      errors.fileSize = 'File size must be a positive integer';
    } else if (parsedSize > MAX_IMAGE_FILE_SIZE) {
      errors.fileSize = `File size exceeds the 10 MB maximum limit (received: ${(parsedSize / (1024 * 1024)).toFixed(2)} MB)`;
    }
  }

  // 3. Purpose validation
  if (!raw.purpose || typeof raw.purpose !== 'string') {
    errors.purpose = 'Upload purpose is required';
  } else {
    const purposeUpper = raw.purpose.toUpperCase().trim();
    if (!VALID_MEDIA_PURPOSES.includes(purposeUpper as ValidMediaPurpose)) {
      errors.purpose = `Purpose must be one of: ${VALID_MEDIA_PURPOSES.join(', ')}`;
    }
  }

  // 4. File name (optional sanitization)
  let fileName: string | null = null;
  const rawFileName = raw.fileName ?? raw.originalFilename;
  if (rawFileName !== undefined && rawFileName !== null) {
    if (typeof rawFileName === 'string') {
      const trimmed = rawFileName.trim();
      if (trimmed.length > 255) {
        errors.fileName = 'File name cannot exceed 255 characters';
      } else if (trimmed.length > 0) {
        fileName = trimmed;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      mimeType: (raw.mimeType as string).toLowerCase().trim() as AllowedImageMimeType,
      fileSize: Math.floor(Number(rawSize)),
      purpose: (raw.purpose as string).toUpperCase().trim() as ValidMediaPurpose,
      fileName,
    },
  };
};

export interface ValidatedMediaUploadCompleteInput {
  checksum?: string | null;
}

export const validateMediaUploadComplete = (
  input: unknown,
): ValidationResult<ValidatedMediaUploadCompleteInput> => {
  const errors: Record<string, string> = {};

  if (input !== undefined && input !== null && typeof input !== 'object') {
    return { success: false, errors: { body: 'Invalid request body' } };
  }

  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  let checksum: string | null = null;

  if (raw.checksum !== undefined && raw.checksum !== null) {
    if (typeof raw.checksum === 'string') {
      const trimmed = raw.checksum.trim();
      if (trimmed.length > 128) {
        errors.checksum = 'Checksum cannot exceed 128 characters';
      } else if (trimmed.length > 0) {
        checksum = trimmed;
      }
    } else {
      errors.checksum = 'Checksum must be a string';
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      checksum,
    },
  };
};

// ==================== Moderation Enforcement Validation ====================

export const MIN_ENFORCEMENT_REASON_LENGTH = 3;
export const MAX_ENFORCEMENT_REASON_LENGTH = 1000;

export interface ValidatedRemoveContentInput {
  reason: string;
  reportId?: string | null;
}

export const validateAdminRemoveContent = (
  input: unknown,
): ValidationResult<ValidatedRemoveContentInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { body: 'Invalid request body' } };
  }

  const raw = input as Record<string, unknown>;

  if (!raw.reason || typeof raw.reason !== 'string' || raw.reason.trim().length === 0) {
    errors.reason = 'Enforcement reason is required';
  } else {
    const trimmed = raw.reason.trim();
    if (trimmed.length < MIN_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason must be at least ${MIN_ENFORCEMENT_REASON_LENGTH} characters long`;
    } else if (trimmed.length > MAX_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason cannot exceed ${MAX_ENFORCEMENT_REASON_LENGTH} characters`;
    }
  }

  let reportId: string | null = null;
  if (raw.reportId !== undefined && raw.reportId !== null) {
    if (typeof raw.reportId === 'string') {
      const trimmedId = raw.reportId.trim();
      if (trimmedId.length > 0) {
        reportId = trimmedId;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      reason: (raw.reason as string).trim(),
      reportId,
    },
  };
};

export interface ValidatedRestoreContentInput {
  reason: string;
  reportId?: string | null;
}

export const validateAdminRestoreContent = (
  input: unknown,
): ValidationResult<ValidatedRestoreContentInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { body: 'Invalid request body' } };
  }

  const raw = input as Record<string, unknown>;

  if (!raw.reason || typeof raw.reason !== 'string' || raw.reason.trim().length === 0) {
    errors.reason = 'Restoration reason is required';
  } else {
    const trimmed = raw.reason.trim();
    if (trimmed.length < MIN_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason must be at least ${MIN_ENFORCEMENT_REASON_LENGTH} characters long`;
    } else if (trimmed.length > MAX_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason cannot exceed ${MAX_ENFORCEMENT_REASON_LENGTH} characters`;
    }
  }

  let reportId: string | null = null;
  if (raw.reportId !== undefined && raw.reportId !== null) {
    if (typeof raw.reportId === 'string') {
      const trimmedId = raw.reportId.trim();
      if (trimmedId.length > 0) {
        reportId = trimmedId;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      reason: (raw.reason as string).trim(),
      reportId,
    },
  };
};

export interface ValidatedSuspendUserInput {
  reason: string;
  durationDays?: number | null;
  reportId?: string | null;
}

export const validateAdminSuspendUser = (
  input: unknown,
): ValidationResult<ValidatedSuspendUserInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { body: 'Invalid request body' } };
  }

  const raw = input as Record<string, unknown>;

  if (!raw.reason || typeof raw.reason !== 'string' || raw.reason.trim().length === 0) {
    errors.reason = 'Suspension reason is required';
  } else {
    const trimmed = raw.reason.trim();
    if (trimmed.length < MIN_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason must be at least ${MIN_ENFORCEMENT_REASON_LENGTH} characters long`;
    } else if (trimmed.length > MAX_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason cannot exceed ${MAX_ENFORCEMENT_REASON_LENGTH} characters`;
    }
  }

  let durationDays: number | null = null;
  if (raw.durationDays !== undefined && raw.durationDays !== null && raw.durationDays !== '') {
    const parsedDays = Number(raw.durationDays);
    if (Number.isNaN(parsedDays) || parsedDays <= 0 || !Number.isInteger(parsedDays)) {
      errors.durationDays = 'Duration in days must be a positive integer';
    } else if (parsedDays > 365) {
      errors.durationDays = 'Temporary suspension cannot exceed 365 days';
    } else {
      durationDays = parsedDays;
    }
  }

  let reportId: string | null = null;
  if (raw.reportId !== undefined && raw.reportId !== null) {
    if (typeof raw.reportId === 'string') {
      const trimmedId = raw.reportId.trim();
      if (trimmedId.length > 0) {
        reportId = trimmedId;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      reason: (raw.reason as string).trim(),
      durationDays,
      reportId,
    },
  };
};

export interface ValidatedUnsuspendUserInput {
  reason: string;
  reportId?: string | null;
}

export const validateAdminUnsuspendUser = (
  input: unknown,
): ValidationResult<ValidatedUnsuspendUserInput> => {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== 'object') {
    return { success: false, errors: { body: 'Invalid request body' } };
  }

  const raw = input as Record<string, unknown>;

  if (!raw.reason || typeof raw.reason !== 'string' || raw.reason.trim().length === 0) {
    errors.reason = 'Unsuspension reason is required';
  } else {
    const trimmed = raw.reason.trim();
    if (trimmed.length < MIN_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason must be at least ${MIN_ENFORCEMENT_REASON_LENGTH} characters long`;
    } else if (trimmed.length > MAX_ENFORCEMENT_REASON_LENGTH) {
      errors.reason = `Reason cannot exceed ${MAX_ENFORCEMENT_REASON_LENGTH} characters`;
    }
  }

  let reportId: string | null = null;
  if (raw.reportId !== undefined && raw.reportId !== null) {
    if (typeof raw.reportId === 'string') {
      const trimmedId = raw.reportId.trim();
      if (trimmedId.length > 0) {
        reportId = trimmedId;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      reason: (raw.reason as string).trim(),
      reportId,
    },
  };
};
