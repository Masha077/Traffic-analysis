import { Router, type IRouter, type Request } from "express";
import { getAuth } from "@clerk/express";
import { desc, eq } from "drizzle-orm";
import {
  GetAnalysisSummaryQueryParams,
  GetModelResultsQueryParams,
  PredictTrafficBody,
  PredictTrafficResponse,
  QueryRagBody,
  QueryRagResponse,
  TrainModelsBody,
  TrainModelsResponse,
} from "@workspace/api-zod";
import {
  db,
  isDbAvailable,
  users as usersTable,
  datasets as datasetsTable,
  modelTrainings as modelTrainingsTable,
  predictionHistory as predictionHistoryTable,
  ragQueryHistory as ragQueryHistoryTable,
} from "@workspace/db";
import {
  buildRagAnswer,
  createDemoDataset,
  parseUploadedDataset,
  predictDataset,
  profileDataset,
  retrieveRagSources,
  trainDataset,
  type DatasetProfileData,
  type PredictionData,
  type TrainingData,
  type TrafficRow,
} from "../lib/traffic-analysis";

type DatasetRecord = {
  profile: DatasetProfileData;
  rows: TrafficRow[];
  training?: TrainingData;
  model?: ReturnType<typeof trainDataset>["model"];
  latestPrediction?: PredictionData;
};

const datasets = new Map<string, DatasetRecord>();

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function getUserId(req: Request): string {
  if (!process.env.CLERK_SECRET_KEY) {
    return (req as any).auth?.userId || "local-dev-user";
  }
  try {
    const auth = getAuth(req) as any;
    if (auth?.userId && typeof auth.userId === "string") return auth.userId;
    if (auth?.sessionClaims?.userId && typeof auth.sessionClaims.userId === "string") {
      return auth.sessionClaims.userId;
    }
  } catch {
    // ignore
  }
  return "anonymous";
}

async function syncUserActivity(req: Request) {
  if (!isDbAvailable()) return;
  const userId = getUserId(req);
  if (!userId || userId === "anonymous") return;
  try {
    await db
      .insert(usersTable)
      .values({
        id: userId,
        lastLoginAt: new Date(),
      })
      .onConflictDoUpdate({
        target: usersTable.id,
        set: { lastLoginAt: new Date() },
      });
  } catch (err) {
    // Non-fatal logging
    console.warn("DB user sync skipped:", (err as Error)?.message);
  }
}

async function saveDatasetToDb(userId: string, record: DatasetRecord) {
  if (!isDbAvailable()) return;
  try {
    await db.insert(datasetsTable).values({
      id: record.profile.datasetId,
      userId,
      name: record.profile.name,
      isDemo: record.profile.isDemo,
      profile: record.profile,
      rows: record.rows,
    });
  } catch (err) {
    console.warn("DB dataset persist skipped:", (err as Error)?.message);
  }
}

async function saveTrainingToDb(userId: string, datasetId: string, training: TrainingData) {
  if (!isDbAvailable()) return;
  try {
    await db.insert(modelTrainingsTable).values({
      datasetId,
      userId,
      targetColumn: training.targetColumn,
      bestModel: training.bestModel,
      metrics: training.metrics,
      confusionMatrix: training.confusionMatrix,
      featureImportance: training.featureImportance,
      classDistribution: training.classDistribution,
    });
  } catch (err) {
    console.warn("DB training persist skipped:", (err as Error)?.message);
  }
}

async function savePredictionToDb(userId: string, prediction: PredictionData) {
  if (!isDbAvailable()) return;
  try {
    await db.insert(predictionHistoryTable).values({
      datasetId: prediction.datasetId,
      userId,
      condition: prediction.condition,
      confidence: prediction.confidence,
      model: prediction.model,
      factors: prediction.factors,
      inputSummary: prediction.inputSummary,
    });
  } catch (err) {
    console.warn("DB prediction persist skipped:", (err as Error)?.message);
  }
}

async function saveRagQueryToDb(
  userId: string,
  question: string,
  result: ReturnType<typeof buildRagAnswer>,
  datasetId?: string | null,
) {
  if (!isDbAvailable()) return;
  try {
    await db.insert(ragQueryHistoryTable).values({
      userId,
      datasetId: datasetId || null,
      question,
      answer: result.answer,
      retrievedFacts: result.retrievedFacts,
      modelContext: result.modelContext,
      sources: result.sources,
    });
  } catch (err) {
    console.warn("DB RAG persist skipped:", (err as Error)?.message);
  }
}

async function getOrRestoreRecord(datasetId: string): Promise<DatasetRecord | undefined> {
  const existing = datasets.get(datasetId);
  if (existing) return existing;
  if (!isDbAvailable()) return undefined;
  try {
    const rows = await db
      .select()
      .from(datasetsTable)
      .where(eq(datasetsTable.id, datasetId))
      .limit(1);
    if (rows.length > 0) {
      const dbRow = rows[0];
      const record: DatasetRecord = {
        profile: dbRow.profile as DatasetProfileData,
        rows: dbRow.rows as TrafficRow[],
      };
      datasets.set(datasetId, record);
      return record;
    }
  } catch (err) {
    console.warn("DB dataset restore skipped:", (err as Error)?.message);
  }
  return undefined;
}

async function readMultipartFile(req: Request): Promise<{ fileName: string; buffer: Buffer }> {
  const contentType = req.headers["content-type"] ?? "";
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];
  if (!boundary) throw new Error("Upload must be sent as multipart form data.");
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const body = Buffer.concat(chunks);
  const delimiter = Buffer.from(`--${boundary}`);
  let cursor = body.indexOf(delimiter);
  while (cursor >= 0) {
    const headerStart = cursor + delimiter.length + 2;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), headerStart);
    if (headerEnd < 0) break;
    const headers = body.subarray(headerStart, headerEnd).toString("utf8");
    const contentStart = headerEnd + 4;
    const nextBoundary = body.indexOf(delimiter, contentStart);
    if (nextBoundary < 0) break;
    if (/name="file"/i.test(headers)) {
      const fileName = headers.match(/filename="([^"]+)"/i)?.[1] ?? "uploaded-dataset.csv";
      return { fileName, buffer: body.subarray(contentStart, Math.max(contentStart, nextBoundary - 2)) };
    }
    cursor = nextBoundary;
  }
  throw new Error("No file was found in the upload.");
}

function createRecord(dataset: ReturnType<typeof createDemoDataset> | Awaited<ReturnType<typeof parseUploadedDataset>>) {
  const datasetId = crypto.randomUUID();
  const profile = profileDataset(datasetId, dataset);
  const record: DatasetRecord = { profile, rows: dataset.rows };
  datasets.set(datasetId, record);
  return record;
}

const router: IRouter = Router();

router.post("/dataset/upload", async (req, res) => {
  try {
    await syncUserActivity(req);
    const file = await readMultipartFile(req);
    const record = createRecord(await parseUploadedDataset(file.fileName, file.buffer));
    const userId = getUserId(req);
    await saveDatasetToDb(userId, record);
    res.json(record.profile);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/dataset/demo", async (req, res) => {
  try {
    await syncUserActivity(req);
    const record = createRecord(createDemoDataset());
    const userId = getUserId(req);
    await saveDatasetToDb(userId, record);
    res.json(record.profile);
  } catch (error) {
    res.status(400).json({ error: errorMessage(error) });
  }
});

router.post("/model/train", async (req, res) => {
  const parsed = TrainModelsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide a dataset ID and target column." });
  const record = await getOrRestoreRecord(parsed.data.datasetId);
  if (!record) return res.status(404).json({ error: "Dataset not found. Load a demo or upload a dataset first." });
  try {
    await syncUserActivity(req);
    const result = trainDataset(record.rows, parsed.data.datasetId, parsed.data.targetColumn, parsed.data.testSize);
    record.training = result.training;
    record.model = result.model;
    record.latestPrediction = undefined;

    const userId = getUserId(req);
    void saveTrainingToDb(userId, parsed.data.datasetId, result.training);

    return res.json(TrainModelsResponse.parse(result.training));
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error) });
  }
});

router.get("/model/results", async (req, res) => {
  const parsed = GetModelResultsQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "A dataset ID is required." });
  const record = await getOrRestoreRecord(parsed.data.datasetId);
  if (!record?.training) {
    // Attempt to load latest training from DB
    if (isDbAvailable()) {
      try {
        const rows = await db
          .select()
          .from(modelTrainingsTable)
          .where(eq(modelTrainingsTable.datasetId, parsed.data.datasetId))
          .orderBy(desc(modelTrainingsTable.createdAt))
          .limit(1);
        if (rows.length > 0) {
          const row = rows[0];
          const training: TrainingData = {
            datasetId: row.datasetId,
            targetColumn: row.targetColumn,
            bestModel: row.bestModel,
            trainedAt: row.createdAt.toISOString(),
            metrics: row.metrics as TrainingData["metrics"],
            confusionMatrix: row.confusionMatrix as TrainingData["confusionMatrix"],
            featureImportance: row.featureImportance as TrainingData["featureImportance"],
            classDistribution: row.classDistribution as TrainingData["classDistribution"],
          };
          if (record) record.training = training;
          return res.json(training);
        }
      } catch (err) {
        console.warn("DB training fetch skipped:", (err as Error)?.message);
      }
    }
    return res.status(404).json({ error: "No trained model is available for this dataset." });
  }
  return res.json(record.training);
});

router.post("/predict", async (req, res) => {
  const parsed = PredictTrafficBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide a dataset ID and traffic feature values." });
  const record = await getOrRestoreRecord(parsed.data.datasetId);
  if (!record?.model) {
    // If we have dataset rows and target column, retrain model on the fly
    if (record?.training) {
      const retrained = trainDataset(record.rows, parsed.data.datasetId, record.training.targetColumn);
      record.model = retrained.model;
    } else {
      return res.status(400).json({ error: "Train a model before requesting a prediction." });
    }
  }
  const prediction = predictDataset(record.model, parsed.data.features);
  prediction.datasetId = parsed.data.datasetId;
  record.latestPrediction = prediction;

  const userId = getUserId(req);
  await savePredictionToDb(userId, prediction);

  return res.json(PredictTrafficResponse.parse(prediction));
});

router.get("/analysis/summary", async (req, res) => {
  const parsed = GetAnalysisSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "A dataset ID is required." });
  const record = await getOrRestoreRecord(parsed.data.datasetId);
  if (!record) return res.status(404).json({ error: "Dataset not found." });
  return res.json({ profile: record.profile, training: record.training ?? null, latestPrediction: record.latestPrediction ?? null });
});

router.post("/rag/query", async (req, res) => {
  const parsed = QueryRagBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Ask a question to retrieve traffic knowledge." });
  const result = buildRagAnswer(parsed.data.question, parsed.data.prediction);
  const userId = getUserId(req);
  await saveRagQueryToDb(userId, parsed.data.question, result, parsed.data.datasetId);
  return res.json(QueryRagResponse.parse(result));
});

router.get("/rag/sources", (_req, res) => {
  return res.json(retrieveRagSources("traffic flow congestion density speed capacity management"));
});

// ==========================================
// HISTORY & DATABASE AUDIT ENDPOINTS
// ==========================================

router.get("/history/status", async (_req, res) => {
  return res.json({
    connected: isDbAvailable(),
    provider: isDbAvailable() ? "Supabase PostgreSQL" : "In-Memory (Ephemeral)",
  });
});

router.get("/history/predictions", async (req, res) => {
  if (!isDbAvailable()) {
    return res.json({ available: false, history: [] });
  }
  const userId = getUserId(req);
  try {
    const history = await db
      .select()
      .from(predictionHistoryTable)
      .where(eq(predictionHistoryTable.userId, userId))
      .orderBy(desc(predictionHistoryTable.createdAt))
      .limit(50);
    return res.json({ available: true, history });
  } catch (err) {
    return res.status(500).json({ error: errorMessage(err) });
  }
});

router.get("/history/trainings", async (req, res) => {
  if (!isDbAvailable()) {
    return res.json({ available: false, history: [] });
  }
  const userId = getUserId(req);
  try {
    const history = await db
      .select()
      .from(modelTrainingsTable)
      .where(eq(modelTrainingsTable.userId, userId))
      .orderBy(desc(modelTrainingsTable.createdAt))
      .limit(20);
    return res.json({ available: true, history });
  } catch (err) {
    return res.status(500).json({ error: errorMessage(err) });
  }
});

router.get("/history/rag", async (req, res) => {
  if (!isDbAvailable()) {
    return res.json({ available: false, history: [] });
  }
  const userId = getUserId(req);
  try {
    const history = await db
      .select()
      .from(ragQueryHistoryTable)
      .where(eq(ragQueryHistoryTable.userId, userId))
      .orderBy(desc(ragQueryHistoryTable.createdAt))
      .limit(30);
    return res.json({ available: true, history });
  } catch (err) {
    return res.status(500).json({ error: errorMessage(err) });
  }
});

export default router;