import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateAddressDto } from '../interface/dtos/create-address.dto';
import { UpdateAddressDto } from '../interface/dtos/update-address.dto';

@Injectable()
export class AddressService {
    constructor(private readonly prisma: PrismaService) {}

    async findAllForUser(userId: string) {
        return this.prisma.userAddress.findMany({
            where: { userId },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        });
    }

    async create(userId: string, dto: CreateAddressDto) {
        const pin = String(dto.pincode || '').replace(/\D/g, '');
        if (pin.length !== 6) {
            throw new BadRequestException('PIN code must be 6 digits.');
        }

        return this.prisma.$transaction(async (tx) => {
            if (dto.isDefault) {
                await tx.userAddress.updateMany({
                    where: { userId },
                    data: { isDefault: false },
                });
            }
            return tx.userAddress.create({
                data: {
                    userId,
                    label: dto.label?.trim() || null,
                    name: dto.name.trim(),
                    phone: dto.phone.trim(),
                    addressLine1: dto.addressLine1.trim(),
                    addressLine2: dto.addressLine2?.trim() || null,
                    city: dto.city.trim(),
                    state: dto.state.trim(),
                    pincode: pin,
                    isDefault: dto.isDefault ?? false,
                },
            });
        });
    }

    async update(userId: string, id: string, dto: UpdateAddressDto) {
        const existing = await this.prisma.userAddress.findFirst({
            where: { id, userId },
        });
        if (!existing) throw new NotFoundException('Address not found');

        const pin =
            dto.pincode != null ? String(dto.pincode).replace(/\D/g, '') : undefined;
        if (pin != null && pin.length !== 6) {
            throw new BadRequestException('PIN code must be 6 digits.');
        }

        return this.prisma.$transaction(async (tx) => {
            if (dto.isDefault === true) {
                await tx.userAddress.updateMany({
                    where: { userId },
                    data: { isDefault: false },
                });
            }
            return tx.userAddress.update({
                where: { id },
                data: {
                    ...(dto.label !== undefined && { label: dto.label?.trim() || null }),
                    ...(dto.name !== undefined && { name: dto.name.trim() }),
                    ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
                    ...(dto.addressLine1 !== undefined && { addressLine1: dto.addressLine1.trim() }),
                    ...(dto.addressLine2 !== undefined && {
                        addressLine2: dto.addressLine2?.trim() || null,
                    }),
                    ...(dto.city !== undefined && { city: dto.city.trim() }),
                    ...(dto.state !== undefined && { state: dto.state.trim() }),
                    ...(pin != null && { pincode: pin }),
                    ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
                },
            });
        });
    }

    async remove(userId: string, id: string) {
        const existing = await this.prisma.userAddress.findFirst({
            where: { id, userId },
        });
        if (!existing) throw new NotFoundException('Address not found');

        await this.prisma.userAddress.delete({ where: { id } });

        if (existing.isDefault) {
            const next = await this.prisma.userAddress.findFirst({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            });
            if (next) {
                await this.prisma.userAddress.update({
                    where: { id: next.id },
                    data: { isDefault: true },
                });
            }
        }
        return { ok: true };
    }

    async setDefault(userId: string, id: string) {
        const existing = await this.prisma.userAddress.findFirst({
            where: { id, userId },
        });
        if (!existing) throw new NotFoundException('Address not found');

        await this.prisma.$transaction([
            this.prisma.userAddress.updateMany({
                where: { userId },
                data: { isDefault: false },
            }),
            this.prisma.userAddress.update({
                where: { id },
                data: { isDefault: true },
            }),
        ]);

        return this.prisma.userAddress.findUnique({ where: { id } });
    }

    /** Verify the row belongs to the user (for order linkage). */
    async assertOwned(userId: string, id: string) {
        const row = await this.prisma.userAddress.findFirst({
            where: { id, userId },
        });
        if (!row) throw new BadRequestException('Saved address not found.');
        return row;
    }
}
