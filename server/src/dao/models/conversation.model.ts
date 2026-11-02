import { Schema, model, type InferSchemaType, Types } from "mongoose";

const conversationSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 3
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    }
}, {
    timestamps: true
})

export type ConversationDocument = InferSchemaType<typeof conversationSchema> & {
    _id: Types.ObjectId;
};

export const ConversationModel = model("Conversation", conversationSchema);

