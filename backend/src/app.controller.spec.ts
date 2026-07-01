import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const appServiceMock = {
    getHealth: jest.fn().mockReturnValue({
      status: 'ok',
      timestamp: '2026-01-01T00:00:00.000Z',
      mongo: 'connected',
    }),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appServiceMock }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        timestamp: '2026-01-01T00:00:00.000Z',
        mongo: 'connected',
      });
    });
  });
});
