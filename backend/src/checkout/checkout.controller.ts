import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { CheckoutService } from './checkout.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/types/authenticated-user';

@ApiTags('checkout')
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post('session')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  createSession(@CurrentUser() user: AuthenticatedUser) {
    return this.checkoutService.createCheckoutSession(user.userId, user.email);
  }

  @Get('session/:sessionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  getSessionStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.checkoutService.getSessionStatus(user.userId, sessionId);
  }

  // Called by Stripe, not a human tester -- excluded from the interactive API docs.
  @Post('webhook')
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody || !signature) {
      throw new BadRequestException('Missing Stripe signature or raw body');
    }
    await this.checkoutService.handleWebhookEvent(req.rawBody, signature);
    return { received: true };
  }
}
