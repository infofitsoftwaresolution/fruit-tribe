import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class InventoryCleanupService {
    private readonly logger = new Logger(InventoryCleanupService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Professional Cleanup: 
     * Every minute, check for expired stock reservations and release them.
     */
    @Cron(CronExpression.EVERY_MINUTE)
    async handleExpiredReservations() {
        this.logger.debug('Checking for expired stock reservations...');
        
        try {
            const expiredReservations = await this.prisma.stockReservation.findMany({
                where: {
                    status: 'PENDING',
                    expiresAt: { lt: new Date() }
                }
            });

            if (expiredReservations.length === 0) return;

            this.logger.log(`Found ${expiredReservations.length} expired reservations. Releasing stock...`);

            for (const res of expiredReservations) {
                await this.prisma.$transaction(async (tx) => {
                    // Mark as EXPIRED
                    await tx.stockReservation.update({
                        where: { id: res.id },
                        data: { status: 'EXPIRED' }
                    });

                    // Restore Available stock
                    await tx.productVariant.update({
                        where: { id: res.variantId },
                        data: {
                            reservedQuantity: { decrement: res.quantity },
                            availableQuantity: { increment: res.quantity }
                        }
                    });

                    // If it was part of an order, check if we should expire the order
                    if (res.orderId) {
                        const remainingActive = await tx.stockReservation.count({
                            where: { orderId: res.orderId, status: 'PENDING' }
                        });
                        
                        // If no more pending reservations for this order, mark order as EXPIRED
                        if (remainingActive === 0) {
                            await tx.order.update({
                                where: { id: res.orderId },
                                data: { status: 'CANCELLED' } // Or add an 'EXPIRED' status if schema allows
                            });
                            
                            await tx.orderStatusLog.create({
                                data: {
                                    orderId: res.orderId,
                                    status: 'CANCELLED',
                                    changedByRole: 'SYSTEM',
                                    changedByName: 'Inventory Cleanup Worker (Timeout)'
                                }
                            });
                        }
                    }

                    await tx.inventoryLog.create({
                        data: {
                            variantId: res.variantId,
                            changeAmount: res.quantity,
                            reason: 'RESERVATION_EXPIRED',
                            referenceId: res.id
                        }
                    });
                });
            }
            
            this.logger.log(`Successfully released ${expiredReservations.length} reservations.`);
        } catch (error) {
            this.logger.error(`Error during inventory cleanup: ${error.message}`, error.stack);
        }
    }
}
