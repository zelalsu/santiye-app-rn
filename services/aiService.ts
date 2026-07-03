import { ai } from "@/firebaseConfig";
import { ChatSession, getGenerativeModel } from "firebase/ai";

const MODEL_NAME = "gemini-2.0-flash";

const SYSTEM_INSTRUCTION = `Sen "Şantiyen Cebinde" uygulamasının yapay zeka asistanısın.
Türkçe yanıt ver. İnşaat şantiyesi yönetimi, proje maliyeti, belge süreçleri, ruhsat, zemin etüdü,
statik proje, tesisat ve yapı aşamaları konularında yardımcı ol.
Yanıtlarını kısa, net ve uygulanabilir tut. Emin olmadığın konularda bunu belirt.
Profesyonel ama samimi bir dil kullan.`;

let chatSession: ChatSession | null = null;

function createChatSession(projectName?: string): ChatSession {
  const context = projectName
    ? `${SYSTEM_INSTRUCTION}\n\nKullanıcının aktif projesi: "${projectName}".`
    : SYSTEM_INSTRUCTION;

  const model = getGenerativeModel(ai, {
    model: MODEL_NAME,
    systemInstruction: context,
  });

  return model.startChat();
}

export function getChatSession(projectName?: string): ChatSession {
  if (!chatSession) {
    chatSession = createChatSession(projectName);
  }
  return chatSession;
}

export async function sendAiMessage(
  message: string,
  projectName?: string,
): Promise<string> {
  const chat = getChatSession(projectName);
  const result = await chat.sendMessage(message);
  return result.response.text();
}

export function resetChatSession() {
  chatSession = null;
}
