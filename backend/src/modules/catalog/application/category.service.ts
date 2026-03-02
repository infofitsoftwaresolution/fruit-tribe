import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

@Injectable()
export class CategoryService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        return this.prisma.category.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, slug: true, description: true, imageUrl: true },
        });
    }
}
