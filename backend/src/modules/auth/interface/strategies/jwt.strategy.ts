import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        const jwtSecret = config.get<string>('JWT_SECRET');
        if (!jwtSecret) {
            throw new Error('JWT_SECRET is required');
        }
        const cookieExtractor = (req: { headers?: { cookie?: string } } | undefined): string | null => {
            const raw = req?.headers?.cookie;
            if (!raw) return null;
            const tokenCookie = raw
                .split(';')
                .map((part) => part.trim())
                .find((part) => part.startsWith('ft_access_token='));
            if (!tokenCookie) return null;
            return decodeURIComponent(tokenCookie.substring('ft_access_token='.length));
        };
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                cookieExtractor,
            ]),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: { sub: string; email: string; role: string }) {
        const user = await this.prisma.user.findUnique({
            where: { id: payload.sub },
            include: { role: true },
        });

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Invalid or inactive user');
        }

        return { id: user.id, email: user.email, role: user.role?.name };
    }
}
