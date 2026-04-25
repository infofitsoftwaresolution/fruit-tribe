import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService } from '../application/settings.service';
import { ContactFormDto, NewsletterSubscribeDto } from './dtos/public-engagement.dto';

@ApiTags('Public')
@Controller()
export class PublicEngagementController {
    constructor(private readonly settingsService: SettingsService) {}

    @ApiOperation({ summary: 'Receive a contact form submission' })
    @Post('contact')
    async submitContact(@Body() dto: ContactFormDto) {
        return this.settingsService.submitContactMessage(dto);
    }

    @ApiOperation({ summary: 'Subscribe an email to newsletter updates' })
    @Post('newsletter/subscribe')
    async subscribeNewsletter(@Body() dto: NewsletterSubscribeDto) {
        return this.settingsService.subscribeNewsletter(dto.email, dto.source);
    }
}
