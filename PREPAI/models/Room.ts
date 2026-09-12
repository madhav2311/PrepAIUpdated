import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRoomTurn {
  speaker: "host" | "guest";
  text: string;
}

export interface IRoomTranscript {
  by: "host" | "guest";
  text: string;
}

export interface IRoomSignal {
  by: string;
  kind: "offer" | "answer" | "ice" | "hangup";
  payload: any;
  at?: Date;
}

export interface IRoom extends Document {
  type: "debate" | "call";
  code: string;
  host: mongoose.Types.ObjectId;
  guest?: mongoose.Types.ObjectId;
  status: "waiting" | "active" | "ended";
  topic?: string;
  hostSide?: string;
  guestSide?: string;
  turns: IRoomTurn[];
  transcripts: IRoomTranscript[];
  verdict?: any;
  signals: IRoomSignal[];
  createdAt: Date;
  updatedAt: Date;
}

const TurnSchema = new Schema<IRoomTurn>(
  {
    speaker: { type: String, enum: ["host", "guest"], required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const TranscriptSchema = new Schema<IRoomTranscript>(
  {
    by: { type: String, enum: ["host", "guest"], required: true },
    text: { type: String, required: true },
  },
  { _id: false },
);

const SignalSchema = new Schema<IRoomSignal>(
  {
    by: { type: String, required: true },
    kind: {
      type: String,
      enum: ["offer", "answer", "ice", "hangup"],
      required: true,
    },
    payload: Schema.Types.Mixed,
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const RoomSchema = new Schema<IRoom>(
  {
    type: { type: String, enum: ["debate", "call"], required: true },
    code: { type: String, required: true, unique: true },
    host: { type: Schema.Types.ObjectId, ref: "User", required: true },
    guest: { type: Schema.Types.ObjectId, ref: "User" },
    status: {
      type: String,
      enum: ["waiting", "active", "ended"],
      default: "waiting",
    },
    topic: { type: String },
    hostSide: { type: String, default: "For" },
    guestSide: { type: String, default: "Against" },
    turns: { type: [TurnSchema], default: [] },
    transcripts: { type: [TranscriptSchema], default: [] },
    verdict: Schema.Types.Mixed,
    signals: { type: [SignalSchema], default: [] },
  },
  { timestamps: true },
);

export const Room: Model<IRoom> =
  (mongoose.models.Room as Model<IRoom>) ||
  mongoose.model<IRoom>("Room", RoomSchema);

export function makeCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
