import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { NestExpressApplication } from "@nestjs/platform-express";
import { join } from "path";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(join(process.cwd(), "public"));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`resolve listening on :${port}`);
}
bootstrap();
