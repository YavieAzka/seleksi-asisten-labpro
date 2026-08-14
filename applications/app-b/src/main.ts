import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.use(cookieParser());
  app.setBaseViewsDir(join(process.cwd(), 'views'));
  app.setViewEngine('ejs');
  await app.listen(3002);
  console.log(`App B (Edunek) is running on: http://localhost:3002`);
}
bootstrap();
