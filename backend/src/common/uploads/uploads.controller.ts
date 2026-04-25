import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    UploadedFiles,
    BadRequestException,
    UseGuards,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../../modules/auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/interface/guards/roles.guard';
import { Roles } from '../../modules/auth/interface/decorators/roles.decorator';

@ApiTags('Uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SELLER')
@Controller('uploads')
export class UploadsController {
    constructor() {
        // Ensure uploads directory exists
        const uploadPath = './uploads';
        if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath);
        }
    }

    @Post('single')
    @ApiOperation({ summary: 'Upload a single biological asset' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @UseInterceptors(
        FileInterceptor('file', {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
            fileFilter: (req, file, cb) => {
                const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedMime.includes(String(file.mimetype).toLowerCase())) {
                    return cb(new BadRequestException('Only JPG, PNG, GIF, and WEBP images are allowed.'), false);
                }
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    return cb(new BadRequestException('Only image files are allowed!'), false);
                }
                cb(null, true);
            },
        }),
    )
    uploadFile(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('File is missing');
        }
        return {
            url: `/uploads/${file.filename}`,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
        };
    }

    @Post('multiple')
    @ApiOperation({ summary: 'Upload multiple biological assets' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                files: {
                    type: 'array',
                    items: {
                        type: 'string',
                        format: 'binary',
                    },
                },
            },
        },
    })
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            limits: { fileSize: 5 * 1024 * 1024 }, // 5MB each
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
                },
            }),
            fileFilter: (req, file, cb) => {
                const allowedMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedMime.includes(String(file.mimetype).toLowerCase())) {
                    return cb(new BadRequestException('Only JPG, PNG, GIF, and WEBP images are allowed.'), false);
                }
                if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    return cb(new BadRequestException('Only image files are allowed!'), false);
                }
                cb(null, true);
            },
        }),
    )
    uploadMultipleFiles(@UploadedFiles() files: Express.Multer.File[]) {
        if (!files || files.length === 0) {
            throw new BadRequestException('Files are missing');
        }
        return files.map((file) => ({
            url: `/uploads/${file.filename}`,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
        }));
    }
}
