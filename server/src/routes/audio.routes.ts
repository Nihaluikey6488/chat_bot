import { Router } from "express";
import {
  uploadAudio,
  transcribeAudioOnly,
} from "../controllers/audio.controller.js";

import { authUserMiddleware } from "../middlewares/auth-user.middleware.js";

const audioRouter = Router();
// audioRouter.use(authUserMiddleware);
// Endpoint for voice typing / audio transcription
audioRouter.post(
  "/transcribe",
  uploadAudio.single("audio"),
  transcribeAudioOnly,
);

export default audioRouter;
