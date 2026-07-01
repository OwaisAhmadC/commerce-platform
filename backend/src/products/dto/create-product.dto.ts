import { IsInt, IsMongoId, IsString, IsUrl, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  description: string;

  @IsInt()
  @Min(0)
  priceCents: number;

  @IsUrl({ require_tld: false })
  imageUrl: string;

  @IsMongoId()
  categoryId: string;

  @IsInt()
  @Min(0)
  stock: number;
}
