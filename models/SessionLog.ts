import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITranscriptMessage {
  sender: string;
  message: string;
}

export interface ISessionMetrics {
  technicalScore: number;
  communicationScore: number;
  confidenceScore: number;
}

export interface ISessionReport {
  overallScore?: number;
  summary?: string;
  progress?: string;
  strengths?: string;
  improvements?: string;
}

export interface ISessionLog extends Document {
  userId: mongoose.Types.ObjectId;
  sessionType: "technical" | "group-discussion";
  transcript: ITranscriptMessage[];
  metrics: ISessionMetrics;
  report?: ISessionReport;
  createdAt: Date;
}

const TranscriptMessageSchema = new Schema<ITranscriptMessage>(
  {
    sender: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const SessionMetricsSchema = new Schema<ISessionMetrics>(
  {
    technicalScore: { type: Number, required: true },
    communicationScore: { type: Number, required: true },
    confidenceScore: { type: Number, required: true },
  },
  { _id: false },
);

const SessionLogSchema: Schema<ISessionLog> = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  sessionType: {
    type: String,
    enum: [
      "technical",
      "group-discussion",
      "interview",
      "debate",
      "debate-room",
      "friend-call",
    ],
    required: true,
  },
  transcript: [TranscriptMessageSchema],
  metrics: SessionMetricsSchema,
  report: {
    type: {
      overallScore: { type: Number },
      summary: { type: String },
      progress: { type: String },
      strengths: { type: String },
      improvements: { type: String },
    },
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

export const SessionLog: Model<ISessionLog> =
  mongoose.models.SessionLog ||
  mongoose.model<ISessionLog>("SessionLog", SessionLogSchema);
