import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  username?: string; // unique @handle used for friend requests
  passwordHash?: string;
  provider?: string; // 'google' | 'github' | 'linkedin' | 'credentials'
  providerId?: string;
  targetRole?: string;
  resumeText?: string;
  jdText?: string;
  avatar?: string; // base64 data URL
  linkedin?: string;
  github?: string;
  continent?: string;
  xp: number;
  streak: number;
  lastSessionDate?: Date;
  createdAt: Date;
}

const UserSchema: Schema<IUser> = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true, sparse: true, lowercase: true },
  passwordHash: { type: String, required: false },
  provider: { type: String, required: false },
  providerId: { type: String, required: false },
  targetRole: { type: String, required: false },
  resumeText: { type: String, required: false },
  jdText: { type: String, required: false },
  avatar: { type: String, required: false },
  linkedin: { type: String, required: false },
  github: { type: String, required: false },
  continent: { type: String, required: false },
  xp: { type: Number, default: 0 },
  streak: { type: Number, default: 0 },
  lastSessionDate: { type: Date, required: false },
  createdAt: { type: Date, default: Date.now },
});

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
