import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import healthRouter from "./health";
import trafficRouter from "./traffic";

const router: IRouter = Router();

router.use(healthRouter);

const requireAuth: RequestHandler = (req, res, next) => {
  if (!process.env.CLERK_SECRET_KEY) {
    return next();
  }
  const auth = getAuth(req);
  const userId = (auth as any)?.userId || (auth as any)?.sessionClaims?.userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in is required to use the analysis workspace." });
    return;
  }
  next();
};

router.use(requireAuth, trafficRouter);

export default router;
