
import { Request, Response } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { RequestMessage } from "../types/chat.js";
import { getConversationTitle, getStream } from "../service/ai.service.js";
import { conversationDao } from "../dao/conversation.dao.js";
import { messageDao } from "../dao/message.dao.js";
import { ApiError } from "../utils/api-error.js";
import { AIMessage, ToolMessage } from "langchain";

/**
 * Extract readable text from LangChain content.
 *
 * Handles:
 * 1. "Hello"
 * 2. [{ type: "text", text: "Hello" }]
 * 3. [{ text: "Hello" }]
 * 4. Nested content arrays
 */
function extractText(content: unknown): string {
    if (typeof content === "string") {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map((block) => extractText(block))
            .join("");
    }

    if (content && typeof content === "object") {
        const block = content as Record<string, unknown>;

        if (typeof block.text === "string") {
            return block.text;
        }

        if (block.content !== undefined) {
            return extractText(block.content);
        }
    }

    return "";
}

/**
 * Convert message content into a safe string for MongoDB.
 */
function serializeContent(content: unknown): string {
    if (typeof content === "string") {
        return content;
    }

    return JSON.stringify(content ?? "");
}

export const listConversations = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const user = req.user;

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const conversations =
            await conversationDao.findConversationsByUser(user.userId);

        res.status(200).json({
            conversations: conversations.map((conversation) => ({
                id: conversation._id.toString(),
                title: conversation.title,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
            })),
        });
    }
);

export const getConversation = asyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        const user = req.user;

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const conversation =
            await conversationDao.findConversationByIdAndUser(
                String(req.params.conversationId),
                user.userId
            );

        if (!conversation) {
            throw new ApiError(404, "Conversation not found");
        }

        const messages = (
            await messageDao.findMessagesByConversation(
                conversation._id.toString()
            )
        ).filter(
            (message) =>
                message.author === "user" ||
                (message.author === "ai" &&
                    message.toolCalls?.length === 0)
        );

        res.status(200).json({
            conversation: {
                id: conversation._id.toString(),
                title: conversation.title,
                createdAt: conversation.createdAt,
                updatedAt: conversation.updatedAt,
                messages: messages.map((message) => ({
                    id: message._id.toString(),
                    author: message.author,
                    content: message.content,
                    createdAt: message.createdAt,
                })),
            },
        });
    }
);

export const chatController = asyncHandler(
    async (
        req: Request<{}, {}, RequestMessage>,
        res: Response
    ): Promise<void> => {
        let { message, conversationId } = req.body;
        let conversationTitle: string;

        const user = req.user;

        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        if (!message || typeof message !== "string") {
            throw new ApiError(400, "Message must be a non-empty string");
        }

        // 1. Create or validate conversation
        if (!conversationId) {
            conversationTitle = await getConversationTitle({ message });

            const newConversation =
                await conversationDao.createConversation({
                    user: user.userId,
                    title: conversationTitle,
                });

            conversationId = newConversation._id.toString();
        } else {
            const conversation =
                await conversationDao.findConversationByIdAndUser(
                    conversationId,
                    user.userId
                );

            if (!conversation) {
                throw new ApiError(404, "Conversation not found");
            }

            conversationTitle = conversation.title;
        }

        // 2. Save user message
        await messageDao.createMessage({
            content: message,
            author: "user",
            conversation: conversationId,
        });

        // 3. Fetch conversation history
        const messages =
            await messageDao.findMessagesByConversation(conversationId);

        // 4. Start LangChain stream
        const stream = await getStream({
            messages,
            userId: user.userId,
        });

        // 5. Configure SSE
        res.setHeader(
            "Content-Type",
            "text/event-stream; charset=utf-8"
        );
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("X-Conversation-Id", conversationId);
        res.setHeader(
            "X-Conversation-Title",
            encodeURIComponent(conversationTitle)
        );

        res.flushHeaders?.();

        const sendEvent = (data: object) => {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        };

        // Existing messages should not be saved again.
        let processedCount = messages.length;

        try {
            for await (const [mode, data] of stream) {
                // --------------------------------
                // A. STREAM GENERATED TEXT
                // --------------------------------
                if (mode === "messages") {
                    // LangGraph messages mode returns:
                    // [messageChunk, metadata]
                    const token = Array.isArray(data)
                        ? data[0]
                        : data;

                    const messageType =
                        token?.getType?.() ?? token?.type;

                    if (messageType !== "ai") {
                        continue;
                    }

                    const contentText =
                        extractText(token?.content) ||
                        (typeof token?.text === "string"
                            ? token.text
                            : "");

                    if (contentText.length > 0) {
                        console.log(
                            "[STREAM TEXT]",
                            contentText
                        );

                        sendEvent({
                            type: "text",
                            content: contentText,
                        });
                    } else {
                        console.log(
                            "[STREAM NON-TEXT CHUNK]",
                            JSON.stringify(token?.content)
                        );
                    }
                }

                // --------------------------------
                // B. SAVE COMPLETED AGENT MESSAGES
                // --------------------------------
                else if (mode === "values") {
                    const currentMessages = data?.messages;

                    if (!Array.isArray(currentMessages)) {
                        continue;
                    }

                    for (
                        let i = processedCount;
                        i < currentMessages.length;
                        i++
                    ) {
                        const newMessage = currentMessages[i];

                        // Completed AI message
                        if (newMessage instanceof AIMessage) {
                            const content =
                                extractText(newMessage.content) ||
                                serializeContent(newMessage.content);

                            await messageDao.createMessage({
                                content,
                                author: "ai",
                                conversation: conversationId,
                                toolCalls:
                                    newMessage.tool_calls?.map(
                                        (call) => ({
                                            arguments: call.args,
                                            id: call.id ?? "",
                                            name: call.name,
                                        })
                                    ) ?? [],
                            });
                        }

                        // Tool result
                        else if (newMessage instanceof ToolMessage) {
                            const content = serializeContent(
                                newMessage.content
                            );

                            await messageDao.createMessage({
                                content,
                                author: "tool",
                                conversation: conversationId,
                                toolCallId: newMessage.tool_call_id,
                            });

                            // Check whether tool returned an image
                            try {
                                const imageData = JSON.parse(content);

                                if (
                                    imageData?.type === "image" &&
                                    typeof imageData.url === "string"
                                ) {
                                    sendEvent({
                                        type: "image",
                                        url: imageData.url,
                                        prompt:
                                            imageData.prompt ?? message,
                                    });
                                }
                            } catch {
                                // Normal tool response
                            }
                        }
                    }

                    processedCount = currentMessages.length;
                }
            }

            // --------------------------------
            // C. STREAM COMPLETION
            // --------------------------------
            console.log("[STREAM COMPLETED]");

            sendEvent({
                type: "done",
                conversationId,
            });
        } catch (error) {
            console.error("[CHAT STREAM ERROR]", error);

            sendEvent({
                type: "error",
                message:
                    "Something went wrong while generating the response.",
            });
        } finally {
            res.end();
        }
    }
);
