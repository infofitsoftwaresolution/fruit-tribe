import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './application/auth.service';
import { AuthController } from './interface/auth.controller';
import { JwtStrategy } from './interface/strategies/jwt.strategy';
import { MailService } from '../../common/mail/mail.service';
import { SmsService } from '../../common/sms/sms.service';
import { WhatsappModule } from '../../common/whatsapp/whatsapp.module';

@Module({
    imports: [
        WhatsappModule,
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (config: ConfigService) => ({
                secret: config.get<string>('JWT_SECRET'),
                signOptions: { expiresIn: (config.get<string>('JWT_EXPIRY') || '1d') as any },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AuthService, JwtStrategy, MailService, SmsService],
    controllers: [AuthController],
    exports: [JwtModule, PassportModule],
})
export class AuthModule { }
