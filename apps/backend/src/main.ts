import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.enableCors();

  const apiToken = process.env.API_TOKEN?.trim();
  if (apiToken) {
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (request.path === "/health") {
        return next();
      }

      const header = request.headers.authorization ?? "";
      const expected = `Bearer ${apiToken}`;

      if (header !== expected) {
        response.status(401).json({ ok: false, message: "Unauthorized" });
        return;
      }

      next();
    });
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  console.log(`Backend API listening on http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error("Failed to bootstrap NestJS backend", error);
  process.exit(1);
});
