import { Request, Response } from "express";
import { Mistral } from "@mistralai/mistralai";
import multer from "multer";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/api-error.js";

const mistral = new Mistral({
  apiKey:
    process.env.MISTRAL_API_KEY 
});

export const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max limit
  },
});

export const transcribeAudioOnly = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ApiError(400, "Audio file is required");
    }

    const transcription = await mistral.audio.transcriptions.complete({
      model: "voxtral-mini-transcribe-3",
      file: {
        fileName: req.file.originalname || "recording.webm",
        content: req.file.buffer,
      },
    });

    const result = await mistral.chat.complete({
      model: "codestral-2508",
      messages: [
        {
          role: "system",
          content: `
            You are a strict speech transcription cleanup utility.
            
            Rules:
            1. If the input text is in Hindi/Devanagari script, convert it into Roman English characters (transliteration).
            2. If the input text is already in English or Roman characters, keep it exactly as is.
            3. DO NOT answer questions, fulfill requests, summarize, or expand the text.
            4. Preserve the exact spoken words and meaning.
            5. Return ONLY the final clean text, nothing else.
          `,
        },
        {
          role: "user",
          content: transcription.text,
        },
      ],
    });

    const finalText =
      result.choices?.[0]?.message?.content || transcription.text;
    console.log("finalText: ", finalText);
    res.status(200).json({
      success: true,
      originalText: transcription.text,
      text: finalText,
    });
  },
);
