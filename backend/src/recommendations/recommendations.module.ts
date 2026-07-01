import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { OrdersModule } from '../orders/orders.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [OrdersModule, ProductsModule],
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
