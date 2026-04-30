import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateCategoryDto } from '../interface/dtos/create-category.dto';

@Injectable()
export class CategoryService {
    constructor(private readonly prisma: PrismaService) {}

    async findAll() {
        return this.prisma.category.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, slug: true, description: true, imageUrl: true },
        });
    }

    async create(dto: CreateCategoryDto) {
        const name = String(dto.name || '').trim();
        if (!name) throw new BadRequestException('Category name is required');
        const slug = name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        if (!slug) throw new BadRequestException('Invalid category name');

        const existing = await this.prisma.category.findFirst({
            where: {
                OR: [
                    { name: { equals: name, mode: 'insensitive' } },
                    { slug },
                ],
            },
            select: { id: true },
        });
        if (existing) throw new BadRequestException('Category already exists');

        return this.prisma.category.create({
            data: {
                name,
                slug,
                description: dto.description?.trim() || null,
                imageUrl: dto.imageUrl?.trim() || null,
            },
            select: { id: true, name: true, slug: true, description: true, imageUrl: true },
        });
    }
}
