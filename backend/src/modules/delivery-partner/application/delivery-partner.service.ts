import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class DeliveryPartnerService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        return this.prisma.deliveryPartner.findMany({
            orderBy: { name: 'asc' },
            include: { user: { select: { email: true } } },
        });
    }

    async create(data: { name: string; phone: string; vehicle?: string; status?: string }) {
        return this.prisma.deliveryPartner.create({
            data: {
                name: data.name,
                phone: data.phone,
                vehicle: data.vehicle ?? null,
                status: data.status ?? 'ACTIVE',
            },
        });
    }

    async update(id: string, data: { name?: string; phone?: string; vehicle?: string; status?: string }) {
        await this.prisma.deliveryPartner.findUniqueOrThrow({ where: { id } });
        return this.prisma.deliveryPartner.update({
            where: { id },
            data: {
                ...(data.name != null && { name: data.name }),
                ...(data.phone != null && { phone: data.phone }),
                ...(data.vehicle !== undefined && { vehicle: data.vehicle || null }),
                ...(data.status != null && { status: data.status }),
            },
        });
    }

    async remove(id: string) {
        try {
            return await this.prisma.deliveryPartner.delete({ where: { id } });
        } catch {
            throw new NotFoundException('Delivery partner not found');
        }
    }
}
