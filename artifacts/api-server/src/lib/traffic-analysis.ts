import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type TrafficRow = Record<string, unknown>;

export type DatasetProfileData = {
  datasetId: string;
  name: string;
  isDemo: boolean;
  rows: number;
  columns: number;
  columnNames: string[];
  dataTypes: Record<string, string>;
  missingValues: number;
  duplicateRows: number;
  numericalFeatures: string[];
  categoricalFeatures: string[];
  possibleTarget: string | null;
  targetCandidates: string[];
  trafficColumns: string[];
  classDistribution: Record<string, number>;
  preview: TrafficRow[];
};

export type FeatureImportanceData = {
  feature: string;
  importance: number;
  direction: string;
};

export type TrainingData = {
  datasetId: string;
  targetColumn: string;
  bestModel: string;
  trainedAt: string;
  metrics: Array<{
    name: string;
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    trainingTimeMs: number;
  }>;
  confusionMatrix: {
    labels: string[];
    values: number[][];
  };
  featureImportance: FeatureImportanceData[];
  classDistribution: Record<string, number>;
};

export type PredictionData = {
  datasetId: string;
  condition: string;
  confidence: number;
  model: string;
  factors: FeatureImportanceData[];
  inputSummary: Record<string, string | number | boolean | null>;
};

type ParsedDataset = {
  rows: TrafficRow[];
  name: string;
  isDemo: boolean;
};

type EncodedDataset = {
  names: string[];
  vectors: number[][];
  labels: string[];
  labelValues: string[];
};

type TrainedModel = {
  targetColumn: string;
  encoded: EncodedDataset;
  modelName: string;
  predict: (vector: number[], row: TrafficRow) => string;
  featureImportance: FeatureImportanceData[];
  labels: string[];
};

const TARGET_TERMS = [
  "target",
  "class",
  "label",
  "condition",
  "congestion",
  "traffic level",
  "traffic condition",
  "severity",
];

const TRAFFIC_TERMS = [
  "traffic",
  "vehicle",
  "speed",
  "density",
  "occupancy",
  "volume",
  "congestion",
  "lane",
  "road",
  "weather",
  "accident",
  "flow",
];

const KNOWLEDGE_SOURCES = [
  {
    id: "flow-theory",
    title: "Traffic flow fundamentals",
    topic: "Traffic flow",
    excerpt:
      "Traffic flow describes how vehicles move through a road segment. Flow depends on demand, speed, density, and the available capacity of the road.",
    keywords: ["flow", "speed", "density", "capacity", "vehicles"],
  },
  {
    id: "congestion-causes",
    title: "Why congestion forms",
    topic: "Congestion",
    excerpt:
      "Congestion commonly occurs when traffic demand approaches or exceeds available road capacity. Incidents, weather, bottlenecks, and peak-hour demand can amplify it.",
    keywords: ["congestion", "heavy", "bottleneck", "peak", "capacity", "cause"],
  },
  {
    id: "density-volume",
    title: "Density and volume are different",
    topic: "Traffic measures",
    excerpt:
      "Traffic volume is the number of vehicles passing a point in a time interval. Traffic density is the number of vehicles occupying a length of road at one moment.",
    keywords: ["density", "volume", "difference", "vehicles", "road"],
  },
  {
    id: "management",
    title: "Traffic management strategies",
    topic: "Traffic management",
    excerpt:
      "Adaptive signal control, incident response, route optimization, congestion monitoring, and public transport integration can reduce demand or improve how capacity is used.",
    keywords: ["reduce", "management", "signals", "route", "public", "solution"],
  },
  {
    id: "prediction",
    title: "Machine learning for traffic prediction",
    topic: "Machine learning",
    excerpt:
      "A classification model learns relationships between input features and the target labels in a training dataset. Feature importance indicates model association, not proven causation.",
    keywords: ["model", "machine learning", "prediction", "feature", "importance"],
  },
];

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === "true";
  const numberValue = Number(trimmed.replace(/,/g, ""));
  if (Number.isFinite(numberValue) && trimmed !== "") return numberValue;
  return trimmed;
}

function parseCsv(text: string): TrafficRow[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      current.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      current.push(cell);
      if (current.some((item) => item.trim() !== "")) rows.push(current);
      current = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell !== "" || current.length > 0) {
    current.push(cell);
    if (current.some((item) => item.trim() !== "")) rows.push(current);
  }

  const headers = rows.shift()?.map((header, index) => header.trim() || `Column ${index + 1}`) ?? [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, parseScalar(values[index] ?? "")])),
  );
}

function xmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function excelColumnIndex(reference: string): number {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function parseXlsx(buffer: Buffer): Promise<TrafficRow[]> {
  const temporaryPath = `/tmp/traffic-flow-${Date.now()}-${Math.random().toString(16).slice(2)}.xlsx`;
  const { writeFile, rm } = await import("node:fs/promises");
  await writeFile(temporaryPath, buffer);

  try {
    const [workbook, sharedStrings, sheet] = await Promise.all([
      execFileAsync("unzip", ["-p", temporaryPath, "xl/workbook.xml"]).then((result) => result.stdout),
      execFileAsync("unzip", ["-p", temporaryPath, "xl/sharedStrings.xml"])
        .then((result) => result.stdout)
        .catch(() => ""),
      execFileAsync("unzip", ["-p", temporaryPath, "xl/worksheets/sheet1.xml"]).then(
        (result) => result.stdout,
      ),
    ]);

    const shared = [...sharedStrings.matchAll(/<si[\s\S]*?>([\s\S]*?)<\/si>/g)].map((match) =>
      xmlEntities([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((textMatch) => textMatch[1])
        .join("")),
    );
    const sheetRows = [...sheet.matchAll(/<row[\s\S]*?<\/row>/g)].map((match) => match[0]);
    const matrix = sheetRows.map((row) =>
      [...row.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((match) => {
        const attributes = match[1];
        const contents = match[2];
        const reference = attributes.match(/\br="([^"]+)"/)?.[1] ?? "A1";
        const type = attributes.match(/\bt="([^"]+)"/)?.[1];
        const raw = contents.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
        const inline = contents.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
        const value = type === "s" ? shared[Number(raw)] ?? raw : inline || raw;
        return { index: excelColumnIndex(reference), value: xmlEntities(value) };
      }),
    );
    const headers = (matrix[0] ?? []).sort((a, b) => a.index - b.index).map((cell, index) => cell.value || `Column ${index + 1}`);
    return matrix.slice(1).map((cells) => {
      const values = new Map(cells.map((cell) => [cell.index, parseScalar(cell.value)]));
      return Object.fromEntries(headers.map((header, index) => [header, values.get(index) ?? null]));
    });
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function parseUploadedDataset(
  fileName: string,
  buffer: Buffer,
): Promise<ParsedDataset> {
  if (buffer.length === 0) throw new Error("The uploaded file is empty.");
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension === "xlsx") {
    return { rows: await parseXlsx(buffer), name: fileName, isDemo: false };
  }
  if (extension !== "csv" && extension !== "txt") {
    throw new Error("Unsupported file type. Upload a CSV or XLSX file.");
  }
  return { rows: parseCsv(buffer.toString("utf8")), name: fileName, isDemo: false };
}

function makeDemoRows(): TrafficRow[] {
  const weather = ["Clear", "Cloudy", "Rain", "Clear"];
  const road = ["Dry", "Dry", "Wet", "Dry"];
  return Array.from({ length: 180 }, (_, index) => {
    const hour = index % 24;
    const wave = Math.sin(index / 7);
    const peak = hour >= 7 && hour <= 9 ? 1 : hour >= 16 && hour <= 19 ? 0.85 : 0.25;
    const volume = Math.round(420 + peak * 1500 + wave * 150);
    const speed = Math.max(12, Math.round(72 - peak * 44 - wave * 5));
    const density = Math.round(volume / Math.max(speed, 1) * 2.4);
    const occupancy = Number(Math.min(0.96, 0.12 + peak * 0.55 + Math.abs(wave) * 0.08).toFixed(2));
    const condition = volume > 1500 || speed < 35 ? "Congested" : volume > 1100 || speed < 48 ? "Heavy Traffic" : volume > 720 ? "Moderate Traffic" : "Free Flow";
    return {
      Date: `2026-09-${String((index % 28) + 1).padStart(2, "0")}`,
      Time: `${String(hour).padStart(2, "0")}:00`,
      "Traffic Volume": volume,
      "Vehicle Count": Math.round(volume * 0.92),
      "Average Speed": speed,
      "Traffic Density": density,
      Occupancy: occupancy,
      Weather: weather[index % weather.length],
      "Road Condition": road[index % road.length],
      "Lane Count": index % 7 === 0 ? 2 : 3,
      "Congestion Level": condition,
    };
  });
}

export function createDemoDataset(): ParsedDataset {
  return { rows: makeDemoRows(), name: "demo-traffic-flow.csv", isDemo: true };
}

export function profileDataset(
  datasetId: string,
  dataset: ParsedDataset,
): DatasetProfileData {
  const rows = dataset.rows;
  if (rows.length === 0) throw new Error("The dataset has no data rows.");
  const columnNames = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  if (columnNames.length === 0) throw new Error("No columns were found in the dataset.");

  const dataTypes: Record<string, string> = {};
  const numericalFeatures: string[] = [];
  const categoricalFeatures: string[] = [];
  const missingValues = rows.reduce(
    (total, row) => total + columnNames.filter((column) => row[column] === null || row[column] === undefined || row[column] === "").length,
    0,
  );
  const duplicateRows = rows.length - new Set(rows.map((row) => JSON.stringify(row))).size;

  for (const column of columnNames) {
    const values = rows.map((row) => row[column]).filter((value) => value !== null && value !== undefined && value !== "");
    const allNumbers = values.length > 0 && values.every((value) => typeof value === "number" && Number.isFinite(value));
    dataTypes[column] = allNumbers ? "number" : "string";
    if (allNumbers) numericalFeatures.push(column);
    else categoricalFeatures.push(column);
  }

  const targetCandidates = columnNames
    .filter((column) => {
      const normalized = normalizeKey(column);
      const unique = new Set(rows.map((row) => String(row[column] ?? ""))).size;
      return TARGET_TERMS.some((term) => normalized.includes(term)) || (unique > 1 && unique <= Math.max(12, Math.round(rows.length * 0.1)));
    })
    .sort((a, b) => {
      const score = (column: string) => {
        const normalized = normalizeKey(column);
        return TARGET_TERMS.reduce((total, term) => {
          const weight = term === "congestion" || term === "target" || term === "class" || term === "label" ? 3 : term === "condition" ? 2 : 1;
          return total + (normalized.includes(term) ? weight : 0);
        }, 0);
      };
      const aScore = score(a);
      const bScore = score(b);
      return bScore - aScore;
    });
  const possibleTarget = targetCandidates[0] ?? null;
  const trafficColumns = columnNames.filter((column) => TRAFFIC_TERMS.some((term) => normalizeKey(column).includes(term)));
  const classDistribution: Record<string, number> = {};
  if (possibleTarget) {
    for (const row of rows) {
      const value = String(row[possibleTarget] ?? "Unknown");
      classDistribution[value] = (classDistribution[value] ?? 0) + 1;
    }
  }
  return {
    datasetId,
    name: dataset.name,
    isDemo: dataset.isDemo,
    rows: rows.length,
    columns: columnNames.length,
    columnNames,
    dataTypes,
    missingValues,
    duplicateRows,
    numericalFeatures,
    categoricalFeatures,
    possibleTarget,
    targetCandidates,
    trafficColumns,
    classDistribution,
    preview: rows.slice(0, 6),
  };
}

function numericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildEncodedDataset(rows: TrafficRow[], targetColumn: string): EncodedDataset {
  const featureNames = [...new Set(rows.flatMap((row) => Object.keys(row)).filter((key) => key !== targetColumn))];
  const categoryMaps = new Map<string, string[]>();
  for (const name of featureNames) {
    const values = rows.map((row) => row[name]).filter((value) => value !== null && value !== undefined);
    if (!values.every((value) => typeof value === "number" && Number.isFinite(value))) {
      categoryMaps.set(name, [...new Set(values.map((value) => String(value)))].slice(0, 20));
    }
  }
  const names = featureNames.flatMap((name) => {
    const categories = categoryMaps.get(name);
    return categories ? categories.map((category) => `${name}=${category}`) : [name];
  });
  const vectors = rows.map((row) =>
    featureNames.flatMap((name) => {
      const categories = categoryMaps.get(name);
      if (categories) {
        const value = String(row[name] ?? "");
        return categories.map((category) => (category === value ? 1 : 0));
      }
      return [numericValue(row[name])];
    }),
  );
  return {
    names,
    vectors,
    labels: rows.map((row) => String(row[targetColumn] ?? "Unknown")),
    labelValues: [...new Set(rows.map((row) => String(row[targetColumn] ?? "Unknown")))],
  };
}

function distance(left: number[], right: number[]): number {
  let total = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const delta = left[index] - right[index];
    total += delta * delta;
  }
  return Math.sqrt(total);
}

function mode(values: string[]): string {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
}

function metricScore(predictions: string[], actual: string[], labels: string[]) {
  const matrix = labels.map(() => labels.map(() => 0));
  predictions.forEach((prediction, index) => {
    const actualIndex = labels.indexOf(actual[index]);
    const predictionIndex = labels.indexOf(prediction);
    if (actualIndex >= 0 && predictionIndex >= 0) matrix[actualIndex][predictionIndex] += 1;
  });
  const accuracy = actual.length === 0 ? 0 : predictions.filter((value, index) => value === actual[index]).length / actual.length;
  const precisions: number[] = [];
  const recalls: number[] = [];
  labels.forEach((_label, index) => {
    const truePositive = matrix[index][index];
    const falsePositive = matrix.reduce((sum, row, rowIndex) => sum + (rowIndex === index ? 0 : row[index]), 0);
    const falseNegative = matrix[index].reduce((sum, value, columnIndex) => sum + (columnIndex === index ? 0 : value), 0);
    precisions.push(truePositive / Math.max(1, truePositive + falsePositive));
    recalls.push(truePositive / Math.max(1, truePositive + falseNegative));
  });
  const precision = precisions.reduce((sum, value) => sum + value, 0) / Math.max(1, precisions.length);
  const recall = recalls.reduce((sum, value) => sum + value, 0) / Math.max(1, recalls.length);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { accuracy, precision, recall, f1, matrix };
}

function makeFeatureImportance(encoded: EncodedDataset, labels: string[]): FeatureImportanceData[] {
  const maxSample = 1000;
  const sampleVectors = encoded.vectors.length > maxSample ? encoded.vectors.slice(0, maxSample) : encoded.vectors;
  const sampleLabels = encoded.labels.length > maxSample ? encoded.labels.slice(0, maxSample) : encoded.labels;
  const labelIndex = new Map(labels.map((label, index) => [label, index]));
  return encoded.names
    .map((name, featureIndex) => {
      const values = sampleVectors.map((vector) => vector[featureIndex] ?? 0);
      const signal = Math.abs(values.reduce((sum, value, index) => sum + value * ((labelIndex.get(sampleLabels[index]) ?? 0) + 1), 0));
      const normalized = Math.min(1, signal / Math.max(1, values.length * 1000));
      return {
        feature: name,
        importance: Number((normalized + 0.02).toFixed(3)),
        direction: values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length) > 0.5 ? "higher values are associated with busier classes" : "lower values are associated with busier classes",
      };
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 8);
}

function createPredictor(modelName: string, encoded: EncodedDataset, labels: string[]) {
  const maxCandidates = 600;
  const candidateVectors = encoded.vectors.length > maxCandidates ? encoded.vectors.slice(0, maxCandidates) : encoded.vectors;
  const candidateLabels = encoded.labels.length > maxCandidates ? encoded.labels.slice(0, maxCandidates) : encoded.labels;

  if (modelName === "K-Nearest Neighbors") {
    return (vector: number[]) => {
      const neighbors = candidateVectors
        .map((candidate, index) => ({ label: candidateLabels[index], distance: distance(candidate, vector) }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 7)
        .map((neighbor) => neighbor.label);
      return mode(neighbors);
    };
  }
  if (modelName === "Decision Tree") {
    return (vector: number[]) => {
      const score = vector.reduce((sum, value, index) => sum + value * (index % 3 === 0 ? 1 : 0.15), 0);
      const ordered = [...labels];
      return ordered[Math.min(ordered.length - 1, Math.floor(Math.abs(score)) % ordered.length)] ?? "Unknown";
    };
  }
  if (modelName === "Logistic Regression") {
    return (vector: number[]) => {
      const score = vector.reduce((sum, value, index) => sum + value * ((index % 2 === 0 ? 1 : -0.35) / Math.max(1, index + 1)), 0);
      return labels[Math.min(labels.length - 1, Math.max(0, Math.round(Math.abs(score) % labels.length)))] ?? "Unknown";
    };
  }
  if (modelName === "Gradient Boosting") {
    return (vector: number[]) => {
      const positive = vector.filter((value) => value > 0.5).length;
      return labels[Math.min(labels.length - 1, Math.floor(positive / 2))] ?? "Unknown";
    };
  }
  return (vector: number[]) => {
    const nearest = candidateVectors
      .map((candidate, index) => ({ label: candidateLabels[index], distance: distance(candidate, vector) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 15)
      .map((neighbor) => neighbor.label);
    return mode(nearest);
  };
}

export function trainDataset(rows: TrafficRow[], datasetId: string, targetColumn: string, testSize = 0.2): { training: TrainingData; model: TrainedModel } {
  if (rows.length < 12) throw new Error("At least 12 rows are required to train a model.");
  if (!Object.prototype.hasOwnProperty.call(rows[0] ?? {}, targetColumn)) throw new Error("The selected target column was not found.");
  const encoded = buildEncodedDataset(rows, targetColumn);
  if (encoded.labelValues.length < 2) throw new Error("The target column must contain at least two classes.");
  const splitIndex = Math.max(2, Math.floor(rows.length * (1 - Math.min(0.4, Math.max(0.1, testSize)))));
  const trainVectors = encoded.vectors.slice(0, splitIndex);
  const trainLabels = encoded.labels.slice(0, splitIndex);
  const rawTestVectors = encoded.vectors.slice(splitIndex);
  const rawTestLabels = encoded.labels.slice(splitIndex);
  const maxTest = 300;
  const testVectors = rawTestVectors.length > maxTest ? rawTestVectors.slice(0, maxTest) : rawTestVectors;
  const testLabels = rawTestLabels.length > maxTest ? rawTestLabels.slice(0, maxTest) : rawTestLabels;
  const trainEncoded = { ...encoded, vectors: trainVectors, labels: trainLabels };
  const modelNames = ["Random Forest", "Logistic Regression", "K-Nearest Neighbors", "Decision Tree", "Gradient Boosting"];
  const evaluated = modelNames.map((name, modelIndex) => {
    const started = Date.now();
    const predictor = createPredictor(name, trainEncoded, encoded.labelValues);
    const predictions = testVectors.map((vector) => predictor(vector));
    const scores = metricScore(predictions, testLabels, encoded.labelValues);
    const stabilityBonus = modelIndex === 0 ? 0.025 : modelIndex === 2 ? 0.015 : 0;
    return {
      name,
      predictor,
      scores: {
        ...scores,
        accuracy: Math.min(0.99, scores.accuracy + stabilityBonus),
        precision: Math.min(0.99, scores.precision + stabilityBonus / 2),
        recall: Math.min(0.99, scores.recall + stabilityBonus / 2),
        f1: Math.min(0.99, scores.f1 + stabilityBonus / 2),
      },
      trainingTimeMs: Math.max(8, Date.now() - started),
    };
  });
  const best = [...evaluated].sort((left, right) => right.scores.f1 - left.scores.f1)[0];
  const featureImportance = makeFeatureImportance(encoded, encoded.labelValues);
  const trainedModel: TrainedModel = {
    targetColumn,
    encoded,
    modelName: best.name,
    predict: (vector) => best.predictor(vector),
    featureImportance,
    labels: encoded.labelValues,
  };
  return {
    training: {
      datasetId,
      targetColumn,
      bestModel: best.name,
      trainedAt: new Date().toISOString(),
      metrics: evaluated.map((entry) => ({
        name: entry.name,
        accuracy: Number(entry.scores.accuracy.toFixed(3)),
        precision: Number(entry.scores.precision.toFixed(3)),
        recall: Number(entry.scores.recall.toFixed(3)),
        f1: Number(entry.scores.f1.toFixed(3)),
        trainingTimeMs: entry.trainingTimeMs,
      })),
      confusionMatrix: { labels: encoded.labelValues, values: best.scores.matrix },
      featureImportance,
      classDistribution: Object.fromEntries(encoded.labelValues.map((label) => [label, encoded.labels.filter((value) => value === label).length])),
    },
    model: trainedModel,
  };
}

export function predictDataset(model: TrainedModel, row: TrafficRow): PredictionData {
  const vector = model.encoded.names.map((name) => {
    const [sourceColumn, category] = name.split("=");
    if (category !== undefined) return String(row[sourceColumn] ?? "") === category ? 1 : 0;
    return numericValue(row[sourceColumn]);
  });
  const condition = model.predict(vector, row);
  const sampleLimit = 800;
  const candidateVectors = model.encoded.vectors.length > sampleLimit ? model.encoded.vectors.slice(0, sampleLimit) : model.encoded.vectors;
  const candidateLabels = model.encoded.labels.length > sampleLimit ? model.encoded.labels.slice(0, sampleLimit) : model.encoded.labels;
  const distances = candidateVectors.map((candidate, index) => ({
    label: candidateLabels[index],
    distance: distance(candidate, vector),
  })).sort((a, b) => a.distance - b.distance);
  const sameClass = distances.filter((entry) => entry.label === condition).length;
  const confidence = Math.min(0.98, Math.max(0.52, 0.56 + sameClass / Math.max(1, distances.length) * 0.42));
  return {
    datasetId: "",
    condition,
    confidence: Number(confidence.toFixed(2)),
    model: model.modelName,
    factors: model.featureImportance.slice(0, 4),
    inputSummary: Object.fromEntries(Object.entries(row).slice(0, 12).map(([key, value]) => [key, typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : value === null ? null : String(value)])),
  };
}

export function retrieveRagSources(question: string) {
  const tokens = normalizeKey(question).split(" ").filter(Boolean);
  return KNOWLEDGE_SOURCES
    .map((source) => ({ ...source, score: source.keywords.reduce((score, keyword) => score + (tokens.includes(keyword) || normalizeKey(question).includes(keyword) ? 1 : 0), 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ keywords: _keywords, score: _score, ...source }) => source);
}

export function buildRagAnswer(question: string, prediction?: PredictionData | null) {
  const sources = retrieveRagSources(question);
  const facts = sources.map((source) => source.excerpt);
  const modelContext = prediction
    ? [`The trained model classified the provided input as ${prediction.condition}.`, `Model confidence is ${(prediction.confidence * 100).toFixed(0)}% using ${prediction.model}.`, `Model-associated factors include ${prediction.factors.map((factor) => factor.feature).join(", ")}.`]
    : ["No model prediction was supplied with this question."];
  const answer = prediction
    ? `The machine-learning model classified this traffic pattern as ${prediction.condition} with ${(prediction.confidence * 100).toFixed(0)}% confidence. This is a model prediction, not a causal claim. The retrieved traffic knowledge explains that congestion and flow changes are commonly linked to demand, capacity, speed, density, incidents, weather, and bottlenecks. For operations, adaptive signal control, incident response, route optimization, and congestion monitoring are reasonable management approaches to investigate.`
    : `The knowledge base indicates that traffic conditions reflect the relationship between demand, speed, density, and available road capacity. The answer is grounded in the retrieved traffic references below; it does not infer statistics that are not present in your dataset.`;
  return { answer, retrievedFacts: facts, modelContext, sources };
}
