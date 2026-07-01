import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
  ) {}

  @Get('products/:productId')
  getRelatedToProduct(
    @Param('productId') productId: string,
    @Query('limit') limit?: string,
  ) {
    return this.recommendationsService.getRelatedToProduct(
      productId,
      parseLimit(limit),
    );
  }

  @Get('trending')
  getTrending(@Query('limit') limit?: string) {
    return this.recommendationsService.getTrending(parseLimit(limit));
  }

  @Get('for-me')
  @UseGuards(JwtAuthGuard)
  getForMe(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
  ) {
    return this.recommendationsService.getPersonalizedForUser(
      user.userId,
      parseLimit(limit),
    );
  }
}

function parseLimit(limit?: string): number | undefined {
  const parsed = Number(limit);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
