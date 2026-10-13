export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || '0.0.0.0',
  serviceName: 'vibemint-api',
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL || '',
  authSecret: process.env.AUTH_SECRET || 'vibemint_auth_secret_development_min_32_chars_ok!',
  cookieSecret: process.env.COOKIE_SECRET || 'vibemint_cookie_secret_development_key_32_chars!',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS) || 168,
  passwordMinLength: Number(process.env.PASSWORD_MIN_LENGTH) || 8,
};
