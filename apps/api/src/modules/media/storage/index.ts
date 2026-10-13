import type { IStorageProvider } from './storage.interface.js';
import { LocalStorageProvider } from './local.storage.js';
import { S3StorageProvider } from './s3.storage.js';
import { InMemoryStorageProvider } from './memory.storage.js';

export * from './storage.interface.js';
export * from './local.storage.js';
export * from './s3.storage.js';
export * from './memory.storage.js';

export function createStorageProvider(providerType?: string): IStorageProvider {
  const chosenType = providerType || process.env.STORAGE_PROVIDER || 'local';

  switch (chosenType.toLowerCase()) {
    case 's3':
      return new S3StorageProvider();
    case 'memory':
      return new InMemoryStorageProvider();
    case 'local':
    default:
      if (process.env.NODE_ENV === 'production' && chosenType.toLowerCase() === 'local') {
        throw new Error(
          'Configuration Error: STORAGE_PROVIDER cannot be "local" in production environments. Please configure S3-compatible cloud object storage.',
        );
      }
      return new LocalStorageProvider();
  }
}
