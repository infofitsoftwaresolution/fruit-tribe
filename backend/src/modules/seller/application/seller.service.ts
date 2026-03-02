import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class SellerService {
    private readonly logger = new Logger(SellerService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.seller.findMany({
            include: {
                user: {
                    select: { id: true, email: true, firstName: true, lastName: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async apply(userId: string, sellerData: any) {
        // Check if user already has a pending or active seller account
        const existing = await this.prisma.seller.findUnique({ where: { userId } });
        if (existing) {
            throw new BadRequestException('Seller application already exists for this user');
        }

        return this.prisma.seller.create({
            data: {
                userId,
                storeName: sellerData.storeName,
                description: sellerData.description,
                gstNumber: sellerData.gstNumber,
                bankDetails: sellerData.bankDetails || {},
                address: sellerData.address || {},
                status: 'PENDING',
            },
        });
    }

    async approve(sellerId: string, adminUserId: string) {
        // Principal Engineer Review Comment: 
        // This is a critical transition. We must ensure the user role is also updated 
        // to SELLER upon approval.
        return this.prisma.$transaction(async (tx) => {
            const seller = await tx.seller.findUnique({ where: { id: sellerId } });
            if (!seller) throw new BadRequestException('Seller not found');
            if (seller.status !== 'PENDING') throw new BadRequestException('Seller is not in PENDING status');

            // Update Seller Status
            const updatedSeller = await tx.seller.update({
                where: { id: sellerId },
                data: { status: 'APPROVED' },
            });

            // Update User Role to SELLER
            // Optimization: Fetch the role ID for 'SELLER'
            const sellerRole = await tx.role.findUnique({ where: { name: 'SELLER' } });
            if (!sellerRole) throw new Error('SELLER role not configured in DB');

            await tx.user.update({
                where: { id: seller.userId },
                data: { roleId: sellerRole.id },
            });

            this.logger.log(`Seller ${sellerId} approved by Admin ${adminUserId}`);

            return updatedSeller;
        });
    }
}
