import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class WarehouseService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll(activeOnly = true) {
        return this.prisma.warehouse.findMany({
            where: activeOnly ? { isActive: true } : undefined,
            orderBy: { name: 'asc' },
        });
    }

    async create(data: { name: string; address: string; latitude: number; longitude: number; isActive?: boolean }) {
        return this.prisma.warehouse.create({
            data: {
                name: data.name,
                address: data.address,
                latitude: data.latitude,
                longitude: data.longitude,
                isActive: data.isActive ?? true,
            },
        });
    }

    async update(id: string, data: { name?: string; address?: string; latitude?: number; longitude?: number; isActive?: boolean }) {
        await this.prisma.warehouse.findUniqueOrThrow({ where: { id } });
        return this.prisma.warehouse.update({
            where: { id },
            data: {
                ...(data.name != null && { name: data.name }),
                ...(data.address != null && { address: data.address }),
                ...(data.latitude != null && { latitude: data.latitude }),
                ...(data.longitude != null && { longitude: data.longitude }),
                ...(data.isActive != null && { isActive: data.isActive }),
            },
        });
    }

    async remove(id: string) {
        try {
            return await this.prisma.warehouse.delete({ where: { id } });
        } catch {
            throw new NotFoundException('Warehouse not found');
        }
    }
}
