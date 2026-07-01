import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { resolve } from 'path';

function normalizeDatabaseUrl(raw: string | undefined): string {
    if (!raw) return '';
    const certKey = 'sslrootcert=';
    const idx = raw.indexOf(certKey);
    if (idx === -1) return raw;

    const valueStart = idx + certKey.length;
    const valueEnd = raw.indexOf('&', valueStart);
    const certRef = valueEnd === -1 ? raw.slice(valueStart) : raw.slice(valueStart, valueEnd);
    const suffix = valueEnd === -1 ? '' : raw.slice(valueEnd);

    const isRelative =
        certRef.startsWith('./') ||
        certRef.startsWith('.\\') ||
        (!/^[a-zA-Z]:/.test(certRef) && !certRef.startsWith('/'));
    const certPath = (isRelative ? resolve(process.cwd(), certRef) : certRef).replace(/\\/g, '/');

    if (!existsSync(certPath)) {
        // Prisma on Windows often fails with relative sslrootcert paths; require still encrypts traffic.
        return raw
            .replace(/([?&])sslmode=verify-full(&|$)/, '$1sslmode=require$2')
            .replace(/([?&])sslrootcert=[^&]*&?/, '$1')
            .replace(/[?&]$/, '');
    }

    return `${raw.slice(0, valueStart)}${certPath}${suffix}`;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    constructor() {
        super({
            datasources: {
                db: {
                    url: normalizeDatabaseUrl(process.env.DATABASE_URL),
                },
            },
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }
}
