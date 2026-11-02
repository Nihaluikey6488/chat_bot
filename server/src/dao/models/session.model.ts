import { Schema, model, type InferSchemaType, Types } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    refreshTokenHash: {
      type: String,
      required: true
    },
    userAgent: {
      type: String,
      default: "unknown"
    },
    ipAddress: {
      type: String,
      default: "unknown"
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true
    },
    lastUsedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);


export type SessionDocument = InferSchemaType<typeof sessionSchema> & {
  _id: Types.ObjectId;
};

export const SessionModel = model("Session", sessionSchema);