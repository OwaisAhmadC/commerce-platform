import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { User, UserDocument } from '../src/users/schemas/user.schema';
import {
  Category,
  CategoryDocument,
} from '../src/categories/schemas/category.schema';
import {
  Product,
  ProductDocument,
} from '../src/products/schemas/product.schema';
import { Cart, CartDocument } from '../src/cart/schemas/cart.schema';

interface CartResponseBody {
  items: Array<{ productId: string; quantity: number }>;
  totalCents: number;
}

interface LoginResponseBody {
  accessToken: string;
}

interface ErrorResponseBody {
  message: string;
}

/**
 * Verifies the cart's server-side stock enforcement -- the actual authority,
 * not just the client-side quantity caps in the UI.
 */
describe('Cart (e2e)', () => {
  let app: INestApplication<App>;
  let userModel: Model<UserDocument>;
  let categoryModel: Model<CategoryDocument>;
  let productModel: Model<ProductDocument>;
  let cartModel: Model<CartDocument>;

  let accessToken: string;
  let userId: string;
  let productId: string;
  const testEmail = `cart-e2e-test-${Date.now()}@example.com`;
  const STOCK = 3;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    userModel = moduleFixture.get(getModelToken(User.name));
    categoryModel = moduleFixture.get(getModelToken(Category.name));
    productModel = moduleFixture.get(getModelToken(Product.name));
    cartModel = moduleFixture.get(getModelToken(Cart.name));

    const passwordHash = await bcrypt.hash('password123', 10);
    const user = await userModel.create({
      email: testEmail,
      passwordHash,
      role: 'customer',
    });
    userId = user.id;

    const category = await categoryModel.create({
      name: `Cart Test Category ${Date.now()}`,
    });
    const product = await productModel.create({
      name: 'Cart Test Product',
      description: 'test',
      priceCents: 500,
      imageUrl: 'https://example.com/x.png',
      categoryId: category._id,
      stock: STOCK,
    });
    productId = product.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'password123' });
    accessToken = (loginRes.body as LoginResponseBody).accessToken;
  });

  afterAll(async () => {
    await cartModel.deleteMany({ userId });
    await productModel.deleteMany({ name: 'Cart Test Product' });
    await categoryModel.deleteMany({ name: /^Cart Test Category/ });
    await userModel.deleteOne({ _id: userId });
    await app.close();
  });

  it('rejects requests with no auth token', async () => {
    await request(app.getHttpServer()).get('/api/cart').expect(401);
  });

  it('adds an item within stock and merges quantities on repeat add', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 2 })
      .expect(201);
    expect((first.body as CartResponseBody).items[0].quantity).toBe(2);

    const second = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 1 })
      .expect(201);
    const secondBody = second.body as CartResponseBody;
    expect(secondBody.items[0].quantity).toBe(3); // merged, not a second line item
    expect(secondBody.items).toHaveLength(1);
  });

  it('rejects adding more than available stock', async () => {
    // cart already holds 3 (== STOCK); one more should be rejected, not silently overflow.
    const res = await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 1 })
      .expect(409);
    expect((res.body as ErrorResponseBody).message).toContain('in stock');

    const cart = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((cart.body as CartResponseBody).items[0].quantity).toBe(3); // unchanged after the rejected request
  });

  it('rejects updating quantity above available stock', async () => {
    await request(app.getHttpServer())
      .patch(`/api/cart/items/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: STOCK + 1 })
      .expect(409);
  });

  it('allows updating quantity down to a valid amount, then removes the item', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/cart/items/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: 1 })
      .expect(200);
    expect((updated.body as CartResponseBody).items[0].quantity).toBe(1);

    const afterRemove = await request(app.getHttpServer())
      .delete(`/api/cart/items/${productId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect((afterRemove.body as CartResponseBody).items).toHaveLength(0);
  });

  it('rejects adding a non-positive quantity', async () => {
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 0 })
      .expect(400);
  });
});
