import { Module } from '@nestjs/common';
import { ProductService } from './application/product.service';
import { CategoryService } from './application/category.service';
import { InventoryCleanupService } from './application/inventory-cleanup.service';
import { ProductController } from './interface/product.controller';
import { CategoryController } from './interface/category.controller';

@Module({
    providers: [ProductService, CategoryService, InventoryCleanupService],
    controllers: [ProductController, CategoryController],
    exports: [ProductService, CategoryService],
})
export class CatalogModule { }
