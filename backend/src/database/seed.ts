import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model, Types } from 'mongoose';
import { AppModule } from '../app.module';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'Admin123!';
const CUSTOMER_EMAIL = 'customer@example.com';
const CUSTOMER_PASSWORD = 'Customer123!';

const CATEGORY_NAMES = ['Electronics', 'Home & Kitchen', 'Books', 'Sportswear'];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const userModel = app.get<Model<UserDocument>>(getModelToken(User.name));
  const categoryModel = app.get<Model<CategoryDocument>>(getModelToken(Category.name));
  const productModel = app.get<Model<ProductDocument>>(getModelToken(Product.name));
  const cartModel = app.get<Model<CartDocument>>(getModelToken(Cart.name));
  const orderModel = app.get<Model<OrderDocument>>(getModelToken(Order.name));

  console.log('Clearing existing users, categories, products, carts, and orders...');
  await Promise.all([
    userModel.deleteMany({}),
    categoryModel.deleteMany({}),
    productModel.deleteMany({}),
    cartModel.deleteMany({}),
    orderModel.deleteMany({}),
  ]);

  console.log('Seeding categories...');
  const categories = await categoryModel.insertMany(
    CATEGORY_NAMES.map((name) => ({ name })),
  );

  console.log('Seeding products...');
  const productNames = [
    'Wireless Headphones',
    'Bluetooth Speaker',
    '4K Monitor',
    'Mechanical Keyboard',
    'USB-C Hub',
    'Non-Stick Frying Pan',
    'Ceramic Mug Set',
    'Electric Kettle',
    'Cutting Board Set',
    'Air Fryer',
    'The Pragmatic Programmer',
    'Clean Code',
    'Atomic Habits',
    'A Brief History of Time',
    'Running Shoes',
    'Yoga Mat',
    'Adjustable Dumbbells',
    'Cycling Helmet',
  ];

  const products: Array<Partial<Product> & { categoryId: Types.ObjectId }> =
    productNames.map((name, i) => ({
      name,
      description: `${name} — a great addition to your ${pick(CATEGORY_NAMES, Math.floor(i / 5)).toLowerCase()} collection.`,
      priceCents: 1999 + i * 731,
      imageUrl: `https://picsum.photos/seed/${encodeURIComponent(name)}/600/600`,
      categoryId: (pick(categories, Math.floor(i / 5)) as { _id: Types.ObjectId })._id,
      stock: (i % 6) * 5 + (i % 3 === 0 ? 0 : 10),
    }));

  await productModel.insertMany(products);

  console.log('Seeding users...');
  const [adminPasswordHash, customerPasswordHash] = await Promise.all([
    bcrypt.hash(ADMIN_PASSWORD, 10),
    bcrypt.hash(CUSTOMER_PASSWORD, 10),
  ]);

  await userModel.insertMany([
    { email: ADMIN_EMAIL, passwordHash: adminPasswordHash, role: 'admin' },
    { email: CUSTOMER_EMAIL, passwordHash: customerPasswordHash, role: 'customer' },
  ]);

  console.log('\nSeed complete.');
  console.log('----------------------------------------');
  console.log('Seeded login credentials:');
  console.log(`  Admin:    ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log(`  Customer: ${CUSTOMER_EMAIL} / ${CUSTOMER_PASSWORD}`);
  console.log('----------------------------------------');
  console.log(`Seeded ${categories.length} categories and ${products.length} products.`);

  await app.close();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
