import { pgTable, text, timestamp, boolean, jsonb, doublePrecision, uuid, serial } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

/**
 * Users table: stores user profiles and login timestamps synced from Clerk
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user_id
  email: text("email"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Datasets table: stores uploaded and demo traffic datasets with their profiles and row data
 */
export const datasets = pgTable("datasets", {
  id: text("id").primaryKey(), // UUID string
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  isDemo: boolean("is_demo").default(false).notNull(),
  profile: jsonb("profile").notNull(),
  rows: jsonb("rows").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertDatasetSchema = createInsertSchema(datasets);
export const selectDatasetSchema = createSelectSchema(datasets);
export type Dataset = typeof datasets.$inferSelect;
export type InsertDataset = typeof datasets.$inferInsert;

/**
 * Model Trainings table: stores ML training runs, metrics, and confusion matrices
 */
export const modelTrainings = pgTable("model_trainings", {
  id: serial("id").primaryKey(),
  datasetId: text("dataset_id").notNull(),
  userId: text("user_id").notNull(),
  targetColumn: text("target_column").notNull(),
  bestModel: text("best_model").notNull(),
  metrics: jsonb("metrics").notNull(),
  confusionMatrix: jsonb("confusion_matrix").notNull(),
  featureImportance: jsonb("feature_importance").notNull(),
  classDistribution: jsonb("class_distribution").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertModelTrainingSchema = createInsertSchema(modelTrainings);
export const selectModelTrainingSchema = createSelectSchema(modelTrainings);
export type ModelTraining = typeof modelTrainings.$inferSelect;
export type InsertModelTraining = typeof modelTrainings.$inferInsert;

/**
 * Prediction History table: logs every prediction with feature inputs, confidence, and output
 */
export const predictionHistory = pgTable("prediction_history", {
  id: serial("id").primaryKey(),
  datasetId: text("dataset_id").notNull(),
  userId: text("user_id").notNull(),
  condition: text("condition").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  model: text("model").notNull(),
  factors: jsonb("factors").notNull(),
  inputSummary: jsonb("input_summary").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertPredictionHistorySchema = createInsertSchema(predictionHistory);
export const selectPredictionHistorySchema = createSelectSchema(predictionHistory);
export type PredictionHistoryRecord = typeof predictionHistory.$inferSelect;
export type InsertPredictionHistoryRecord = typeof predictionHistory.$inferInsert;

/**
 * RAG Query History table: logs traffic questions, retrieved excerpts, and synthesized answers
 */
export const ragQueryHistory = pgTable("rag_query_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  datasetId: text("dataset_id"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  retrievedFacts: jsonb("retrieved_facts"),
  modelContext: jsonb("model_context"),
  sources: jsonb("sources"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRagQueryHistorySchema = createInsertSchema(ragQueryHistory);
export const selectRagQueryHistorySchema = createSelectSchema(ragQueryHistory);
export type RagQueryHistoryRecord = typeof ragQueryHistory.$inferSelect;
export type InsertRagQueryHistoryRecord = typeof ragQueryHistory.$inferInsert;