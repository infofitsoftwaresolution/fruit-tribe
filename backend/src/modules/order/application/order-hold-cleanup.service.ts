import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OrderService } from './order.service';

@Injectable()
export class OrderHoldCleanupService {
    private readonly logger = new Logger(OrderHoldCleanupService.name);

    constructor(private readonly orderService: OrderService) {}

    /** Every minute: cancel unpaid ON_HOLD orders older than hold TTL (10 min). */
    @Cron(CronExpression.EVERY_MINUTE)
    async cleanupExpiredOnHoldOrders() {
        try {
            const count = await this.orderService.expireUnpaidOnHoldOrders();
            if (count > 0) {
                this.logger.log(`Auto-cancelled ${count} unpaid order(s) after hold expiry.`);
            }
        } catch (e: any) {
            this.logger.error(`Failed to cleanup expired ON_HOLD orders: ${e?.message || e}`);
        }
    }
}

