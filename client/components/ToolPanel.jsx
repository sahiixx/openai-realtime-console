import { useEffect, useState } from "react";

const functionDescription = `
Call this function when a user asks for a color palette.
`;

const DEFAULT_INSTRUCTIONS = `You are a collaborative design partner. Offer concise, practical suggestions grounded in the latest design, accessibility, and branding best practices. Encourage follow-up questions and never invent color values that were not provided.`;

const VOICE_OPTIONS = [
  { label: "Marin (friendly)", value: "marin" },
  { label: "Alloy (balanced)", value: "alloy" },
  { label: "Sol (energetic)", value: "sol" },
  { label: "Verse (narrative)", value: "verse" },
];

const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    tools: [
      {
        type: "function",
        name: "display_color_palette",
        description: functionDescription,
        parameters: {
          type: "object",
          strict: true,
          properties: {
            theme: {
              type: "string",
              description: "Description of the theme for the color scheme.",
            },
            colors: {
              type: "array",
              description: "Array of five hex color codes based on the theme.",
              items: {
                type: "string",
                description: "Hex color code",
              },
            },
          },
          required: ["theme", "colors"],
        },
      },
    ],
    tool_choice: "auto",
  },
};

function FunctionCallOutput({ functionCallOutput }) {
  const { theme, colors } = JSON.parse(functionCallOutput.arguments);

  const colorBoxes = colors.map((color) => (
    <div
      key={color}
      className="w-full h-16 rounded-md flex items-center justify-center border border-gray-200"
      style={{ backgroundColor: color }}
    >
      <p className="text-sm font-bold text-black bg-slate-100 rounded-md p-2 border border-black">
        {color}
      </p>
    </div>
  ));

  return (
    <div className="flex flex-col gap-2">
      <p>Theme: {theme}</p>
      {colorBoxes}
      <pre className="text-xs bg-gray-100 rounded-md p-2 overflow-x-auto">
        {JSON.stringify(functionCallOutput, null, 2)}
      </pre>
    </div>
  );
}

export default function ToolPanel({
  isSessionActive,
  sendClientEvent,
  events,
}) {
  const [functionAdded, setFunctionAdded] = useState(false);
  const [functionCallOutput, setFunctionCallOutput] = useState(null);
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [voice, setVoice] = useState(VOICE_OPTIONS[0].value);
  const [lastSessionUpdate, setLastSessionUpdate] = useState(null);

  function handleSessionUpdateSubmit(event) {
    event.preventDefault();
    if (!isSessionActive) return;

    const trimmedInstructions = instructions.trim();

    sendClientEvent({
      type: "session.update",
      session: {
        instructions: trimmedInstructions || DEFAULT_INSTRUCTIONS,
        audio: {
          output: { voice },
        },
      },
    });

    setLastSessionUpdate(new Date().toLocaleTimeString());
  }

  useEffect(() => {
    if (!events || events.length === 0) return undefined;

    const firstEvent = events[events.length - 1];
    if (!functionAdded && firstEvent.type === "session.created") {
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    let timeoutId;
    const mostRecentEvent = events[0];
    if (
      mostRecentEvent.type === "response.done" &&
      mostRecentEvent.response.output
    ) {
      mostRecentEvent.response.output.forEach((output) => {
        if (
          output.type === "function_call" &&
          output.name === "display_color_palette"
        ) {
          setFunctionCallOutput(output);
          timeoutId = window.setTimeout(() => {
            sendClientEvent({
              type: "response.create",
              response: {
                instructions: `
                ask for feedback about the color palette - don't repeat
                the colors, just ask if they like the colors.
              `,
              },
            });
          }, 500);
        }
      });
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [events, functionAdded, sendClientEvent]);

  useEffect(() => {
    if (!isSessionActive) {
      setFunctionAdded(false);
      setFunctionCallOutput(null);
      setLastSessionUpdate(null);
      setInstructions(DEFAULT_INSTRUCTIONS);
      setVoice(VOICE_OPTIONS[0].value);
    }
  }, [isSessionActive]);

  return (
    <section className="h-full w-full flex flex-col gap-4">
      <div className="bg-white border border-gray-200 rounded-md p-4 flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold">Session tuning</h2>
          <p className="text-sm text-gray-500">
            Update the realtime session with fresh instructions or a different
            voice. Changes apply instantly once the session is active.
          </p>
        </div>
        <form className="flex flex-col gap-3" onSubmit={handleSessionUpdateSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Guidance for the assistant
            <textarea
              className="border border-gray-200 rounded-md p-2 text-sm"
              rows={4}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              placeholder="Describe tone, goals, or data sources to ground the model."
              disabled={!isSessionActive}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Voice for audio replies
            <select
              className="border border-gray-200 rounded-md p-2 text-sm"
              value={voice}
              onChange={(event) => setVoice(event.target.value)}
              disabled={!isSessionActive}
            >
              {VOICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between text-xs text-gray-500">
            {lastSessionUpdate ? (
              <span>Updated at {lastSessionUpdate}</span>
            ) : (
              <span>No customizations sent yet</span>
            )}
            {!isSessionActive && <span>Start a session to enable controls</span>}
          </div>
          <button
            type="submit"
            disabled={!isSessionActive}
            className={`rounded-md px-3 py-2 text-sm font-semibold text-white transition ${
              isSessionActive ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-400"
            }`}
          >
            Apply session update
          </button>
        </form>
      </div>
      <div className="h-full bg-gray-50 rounded-md p-4">
        <h2 className="text-lg font-bold">Color Palette Tool</h2>
        {isSessionActive
          ? (
            functionCallOutput
              ? <FunctionCallOutput functionCallOutput={functionCallOutput} />
              : <p>Ask for advice on a color palette...</p>
          )
          : <p>Start the session to use this tool...</p>}
      </div>
    </section>
  );
}
