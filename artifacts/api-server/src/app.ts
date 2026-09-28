import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
} else {
  app.use((req, _res, next) => {
    (req as any).auth = { userId: "local-dev-user" };
    next();
  });
}

import fs from "fs";
import path from "path";

app.use("/api", router);

const candidateDirs = [
  path.resolve(process.cwd(), "artifacts/traffic-flow-analysis/dist/public"),
  path.resolve(import.meta.dirname, "../../traffic-flow-analysis/dist/public"),
  import.meta.dirname,
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "public"),
];
const frontendDist = candidateDirs.find((d) => fs.existsSync(path.join(d, "index.html")));
if (frontendDist) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(frontendDist, "index.html"));
    }
    next();
  });
} else {
  app.get("/", (_req, res) => {
    res.redirect("http://localhost:3000");
  });
}

export default app;

