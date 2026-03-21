import { createRoot } from "react-dom/client";
import ChatWidget from "./components/ChatWidget";

const script = document.currentScript as HTMLScriptElement;
const apiUrl = script?.dataset.api ?? "http://localhost:8000";
const clientId = script?.dataset.client ?? "portfolio";

const container = document.createElement("div");
container.id = "izu-chat-root";
document.body.appendChild(container);

createRoot(container).render(
  <ChatWidget apiUrl={apiUrl} clientId={clientId} />
);