import Fastify, { FastifyInstance, FastifyError } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';
import { AppError } from './errors/app-error.js';
import { getPrismaClient } from './db/prisma.js';
import {
  AuthService,
  AuthController,
  authRoutes,
  IAuthRepository,
  PrismaAuthRepository,
  InMemoryAuthRepository,
} from './modules/auth/index.js';
import {
  ProfilesService,
  ProfilesController,
  profilesRoutes,
  IProfileRepository,
  PrismaProfileRepository,
  InMemoryProfileRepository,
} from './modules/profiles/index.js';
import {
  InterestsService,
  InterestsController,
  interestsRoutes,
  IInterestsRepository,
  PrismaInterestsRepository,
  InMemoryInterestsRepository,
} from './modules/interests/index.js';
import {
  OnboardingService,
  OnboardingController,
  onboardingRoutes,
} from './modules/onboarding/index.js';
import {
  PostsService,
  PostsController,
  postsRoutes,
  feedRoutes,
  IPostsRepository,
  PrismaPostsRepository,
  InMemoryPostsRepository,
} from './modules/posts/index.js';
import {
  CommentsService,
  CommentsController,
  commentsRoutes,
  ICommentsRepository,
  PrismaCommentsRepository,
  InMemoryCommentsRepository,
} from './modules/comments/index.js';
import {
  FollowsService,
  FollowsController,
  followsRoutes,
  IFollowsRepository,
  PrismaFollowsRepository,
  InMemoryFollowsRepository,
} from './modules/follows/index.js';
import {
  NotificationsService,
  NotificationsController,
  notificationsRoutes,
  INotificationsRepository,
  PrismaNotificationsRepository,
  InMemoryNotificationsRepository,
} from './modules/notifications/index.js';
import {
  BlocksService,
  BlocksController,
  blocksRoutes,
  IBlocksRepository,
  PrismaBlocksRepository,
  InMemoryBlocksRepository,
} from './modules/blocks/index.js';
import {
  ReportsService,
  ReportsController,
  reportsRoutes,
  IReportsRepository,
  PrismaReportsRepository,
  InMemoryReportsRepository,
} from './modules/reports/index.js';
import {
  MediaService,
  MediaController,
  mediaRoutes,
  IMediaRepository,
  PrismaMediaRepository,
  InMemoryMediaRepository,
  IStorageProvider,
  createStorageProvider,
} from './modules/media/index.js';
import {
  IModerationRepository,
  PrismaModerationRepository,
  InMemoryModerationRepository,
  ModerationService,
} from './modules/moderation/index.js';
import { adminRoutes } from './modules/admin/index.js';
import { requireAuth } from './middleware/auth.js';

export interface BuildAppOptions {
  authRepository?: IAuthRepository;
  profileRepository?: IProfileRepository;
  interestsRepository?: IInterestsRepository;
  postsRepository?: IPostsRepository;
  commentsRepository?: ICommentsRepository;
  followsRepository?: IFollowsRepository;
  notificationsRepository?: INotificationsRepository;
  blocksRepository?: IBlocksRepository;
  reportsRepository?: IReportsRepository;
  moderationRepository?: IModerationRepository;
  mediaRepository?: IMediaRepository;
  storageProvider?: IStorageProvider;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: false,
  });

  // CORS support for web and mobile clients
  void app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return cb(null, true);
      // In development allow localhost origins
      if (!config.isProduction) return cb(null, true);
      return cb(null, true);
    },
    credentials: true,
  });

  // Cookie support
  void app.register(fastifyCookie, {
    secret: config.cookieSecret,
    parseOptions: {},
  });

  // Rate limiting to mitigate brute-force attacks
  void app.register(fastifyRateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Initialize Auth repository and service
  const repository: IAuthRepository =
    options.authRepository ||
    (config.databaseUrl
      ? new PrismaAuthRepository(getPrismaClient())
      : new InMemoryAuthRepository());

  const authService = new AuthService(repository);
  const authController = new AuthController(authService);

  // Initialize Profiles repository and service
  const profileRepo: IProfileRepository =
    options.profileRepository ||
    (config.databaseUrl
      ? new PrismaProfileRepository(getPrismaClient())
      : new InMemoryProfileRepository());

  // Initialize Posts repository and service
  const postsRepo: IPostsRepository =
    options.postsRepository ||
    (config.databaseUrl
      ? new PrismaPostsRepository(getPrismaClient())
      : new InMemoryPostsRepository());

  // Initialize Follows repository and service
  const followsRepo: IFollowsRepository =
    options.followsRepository ||
    (config.databaseUrl
      ? new PrismaFollowsRepository(getPrismaClient())
      : new InMemoryFollowsRepository(
          undefined,
          (postsRepo as InMemoryPostsRepository).users,
          (postsRepo as InMemoryPostsRepository).profiles,
        ));

  // Initialize Blocks repository and service
  const blocksRepo: IBlocksRepository =
    options.blocksRepository ||
    (config.databaseUrl
      ? new PrismaBlocksRepository(getPrismaClient())
      : new InMemoryBlocksRepository(
          undefined,
          (followsRepo as InMemoryFollowsRepository).follows,
          (postsRepo as InMemoryPostsRepository).users,
          (postsRepo as InMemoryPostsRepository).profiles,
        ));

  const blocksService = new BlocksService(blocksRepo, repository);
  const blocksController = new BlocksController(blocksService);

  // Initialize Notifications repository and service
  const notificationsRepo: INotificationsRepository =
    options.notificationsRepository ||
    (config.databaseUrl
      ? new PrismaNotificationsRepository(getPrismaClient())
      : new InMemoryNotificationsRepository(
          undefined,
          (postsRepo as InMemoryPostsRepository).users,
          (postsRepo as InMemoryPostsRepository).profiles,
        ));

  const notificationsService = new NotificationsService(notificationsRepo, blocksRepo);
  const notificationsController = new NotificationsController(notificationsService);

  // Initialize Storage and Media repository/service
  const storageProvider: IStorageProvider = options.storageProvider || createStorageProvider();

  const mediaRepo: IMediaRepository =
    options.mediaRepository ||
    (config.databaseUrl
      ? new PrismaMediaRepository(getPrismaClient())
      : new InMemoryMediaRepository());

  const mediaService = new MediaService(mediaRepo, storageProvider);
  const mediaController = new MediaController(mediaService, storageProvider);

  const postsService = new PostsService(postsRepo, notificationsService, blocksRepo, mediaService);
  const postsController = new PostsController(postsService);

  const followsService = new FollowsService(
    followsRepo,
    repository,
    profileRepo,
    notificationsService,
    blocksRepo,
  );
  const followsController = new FollowsController(followsService);

  // Initialize Profiles repository and service with follows and blocks integration
  const profilesService = new ProfilesService(profileRepo, followsRepo, blocksRepo, mediaService);
  const profilesController = new ProfilesController(profilesService);

  // Initialize Comments repository and service
  const commentsRepo: ICommentsRepository =
    options.commentsRepository ||
    (config.databaseUrl
      ? new PrismaCommentsRepository(getPrismaClient())
      : new InMemoryCommentsRepository(
          (postsRepo as InMemoryPostsRepository).comments,
          (postsRepo as InMemoryPostsRepository).users,
          (postsRepo as InMemoryPostsRepository).profiles,
        ));

  const commentsService = new CommentsService(
    commentsRepo,
    postsRepo,
    notificationsService,
    blocksRepo,
  );
  const commentsController = new CommentsController(commentsService);

  // Initialize Interests repository and service
  const interestsRepo: IInterestsRepository =
    options.interestsRepository ||
    (config.databaseUrl
      ? new PrismaInterestsRepository(getPrismaClient())
      : new InMemoryInterestsRepository());

  const interestsService = new InterestsService(interestsRepo);
  const interestsController = new InterestsController(interestsService);

  // Initialize Onboarding service and controller
  const onboardingService = new OnboardingService(repository, profileRepo, interestsRepo);
  const onboardingController = new OnboardingController(onboardingService);

  // Initialize Reports repository and service
  const reportsRepo: IReportsRepository =
    options.reportsRepository ||
    (config.databaseUrl
      ? new PrismaReportsRepository(getPrismaClient())
      : new InMemoryReportsRepository(undefined, (postsRepo as InMemoryPostsRepository).users));

  const reportsService = new ReportsService(
    reportsRepo,
    repository,
    postsRepo,
    commentsRepo,
    profileRepo,
  );
  const reportsController = new ReportsController(reportsService);

  // Initialize Moderation repository and service
  const moderationRepo: IModerationRepository =
    options.moderationRepository ||
    (config.databaseUrl
      ? new PrismaModerationRepository(getPrismaClient())
      : new InMemoryModerationRepository());

  const moderationService = new ModerationService(
    moderationRepo,
    repository,
    postsRepo,
    commentsRepo,
    reportsRepo,
  );

  // Health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      service: config.serviceName,
    };
  });

  // Authentication routes
  void app.register(authRoutes, {
    prefix: '/api/v1/auth',
    controller: authController,
  });

  // Profile routes
  void app.register(profilesRoutes, {
    prefix: '/api/v1/profiles',
    controller: profilesController,
    authService,
  });

  // Interests routes
  void app.register(interestsRoutes, {
    prefix: '/api/v1/interests',
    controller: interestsController,
    authService,
  });

  // Onboarding routes
  void app.register(onboardingRoutes, {
    prefix: '/api/v1/onboarding',
    controller: onboardingController,
    authService,
  });

  // Posts routes
  void app.register(postsRoutes, {
    prefix: '/api/v1/posts',
    controller: postsController,
    authService,
  });

  // Feed routes
  void app.register(feedRoutes, {
    prefix: '/api/v1/feed',
    controller: postsController,
    authService,
  });

  // Comments routes
  void app.register(commentsRoutes, {
    prefix: '/api/v1',
    controller: commentsController,
    authService,
  });

  // Follows / Users relationship routes
  void app.register(followsRoutes, {
    prefix: '/api/v1/users',
    controller: followsController,
    authService,
  });

  // Blocks routes
  void app.register(blocksRoutes, {
    prefix: '/api/v1/users',
    controller: blocksController,
    authService,
  });

  // Reports routes
  void app.register(reportsRoutes, {
    prefix: '/api/v1/reports',
    controller: reportsController,
    authService,
  });

  // Notifications routes
  void app.register(notificationsRoutes, {
    prefix: '/api/v1/notifications',
    controller: notificationsController,
    authService,
  });

  // Media routes
  void app.register(mediaRoutes, {
    prefix: '/api/v1/media',
    controller: mediaController,
    authService,
  });

  // Admin routes
  void app.register(adminRoutes(authService, reportsService, moderationService), {
    prefix: '/api/v1/admin',
  });

  // Protected route demonstrating auth middleware
  app.get(
    '/api/v1/auth/protected',
    {
      preHandler: [requireAuth(authService)],
    },
    async (request) => {
      return {
        message: 'Protected access granted',
        user: request.user,
      };
    },
  );

  // Centralized Error Handler
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
      });
    }

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      statusCode,
      error: error.name ?? 'InternalServerError',
      message: error.message || 'An unexpected error occurred',
    });
  });

  return app;
}
