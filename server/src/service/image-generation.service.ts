import { Mistral } from "@mistralai/mistralai";
import { env } from "../config/env.js";

const mistralClient = new Mistral({
  apiKey: env.mistralApiKey,
});

// Create the image agent once, not on every request.
const imageAgentPromise = mistralClient.beta.agents.create({
  model: "mistral-medium-latest",
  name: "Image Generation Agent",
  description: "Generates images based on user prompts.",
  instructions: `
        You are an image generation agent.
        Generate images based on the user's description.
        Use the image_generation tool whenever an image is requested.
    `,
  tools: [
    {
      type: "image_generation",
    },
  ],
});

export async function generateImage(prompt: string) {
  const imageAgent = await imageAgentPromise;

  const response = await mistralClient.beta.conversations.start({
    agentId: imageAgent.id,
    inputs: prompt,
  });

  // Find image-generation execution.
  const imageOutput = response.outputs.find(
    (output) =>
      "info" in output &&
      "name" in output &&
      output.name === "image_generation",
  );

  if (!imageOutput || !("info" in imageOutput) || !imageOutput.info) {
    throw new Error("Image generation result not found.");
  }

  const rawResult = imageOutput.info.result;

  if (typeof rawResult !== "string") {
    throw new Error("Invalid image generation result.");
  }

  const result = JSON.parse(rawResult);

  if (!result.url || typeof result.url !== "string") {
    throw new Error("Generated image URL not found.");
  }

  return {
    type: "image" as const,
    url: result.url,
    prompt,
  };
}
