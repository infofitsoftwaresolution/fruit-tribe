import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseService.name);
    private enabled = false;

    constructor(private readonly config: ConfigService) { }

    onModuleInit() {
        if (getApps().length > 0) {
            this.enabled = true;
            return;
        }

        const configuredPath = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
        const defaultPath = resolve(
            process.cwd(),
            '../the-fruit-tribe-firebase-adminsdk-fbsvc-b6b0b8ef9a.json',
        );
        const serviceAccountPath = configuredPath
            ? resolve(process.cwd(), configuredPath)
            : defaultPath;

        if (!existsSync(serviceAccountPath)) {
            this.logger.warn(
                `Firebase service account not found at ${serviceAccountPath}; Firebase login disabled.`,
            );
            return;
        }

        try {
            const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
            initializeApp({
                credential: cert(serviceAccount),
            });
            this.enabled = true;
            this.logger.log('Firebase Admin initialized for auth.');
        } catch (err: any) {
            this.logger.error(`Firebase Admin init failed: ${err?.message || err}`);
        }
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    async verifyIdToken(idToken: string) {
        if (!this.enabled) {
            throw new Error('Firebase is not configured');
        }
        return getAuth().verifyIdToken(idToken);
    }
}
