import { useEffect, useRef, useState } from 'react';
import { hospitals } from '../data/hospitals';
import { BotTurn, Button, initialState, menu, nextTurn } from '../services/conversation';
import { PRIORITY_INFO } from '../services/triage';
import { useTriages } from './useTriages';

export type Message = { id: string; text: string; fromMe: boolean; fichaId?: string };

const TYPING_MS = 700; // pausa de "digitando…" para parecer uma conversa real
let counter = 0;
const message = (text: string, fromMe: boolean, fichaId?: string): Message => ({ id: String(counter++), text, fromMe, fichaId });

// Controla a conversa (useState): mensagens, botões e o indicador "digitando…".
export function useChat() {
  const { saveTriage } = useTriages();
  const [messages, setMessages] = useState<Message[]>([]);
  const [buttons, setButtons] = useState<Button[]>([]);
  const [typing, setTyping] = useState(false);
  const state = useRef(initialState());

  // Mostra as respostas do atendimento uma de cada vez, com pausa.
  const showTurn = (turn: BotTurn) => {
    state.current = turn.state;
    setTyping(true);
    setTimeout(() => {
      const replies = turn.replies.map((text) => message(text, false));
      if (turn.finished) {
        const ficha = saveTriage(turn.finished);
        const priority = PRIORITY_INFO[ficha.priority];
        const hospital = hospitals.find((item) => item.id === ficha.hospitalId);
        const lines = [
          '✅ *Pré-triagem enviada!*',
          `📋 Protocolo: *${ficha.id}*`,
          `${priority.emoji} Prioridade: *${priority.label}*`,
          `🩺 Encaminhamento: *${ficha.specialty}*`,
          `🏥 Destino: *${hospital?.name}* — ${hospital?.address}, ${hospital?.neighborhood}`,
          '',
          ficha.advice,
          '',
          'Na recepção, informe seu *CPF* ou o protocolo.',
        ];
        replies.push(message(lines.join('\n'), false, ficha.id));
      }
      setMessages((current) => [...current, ...replies]);
      setButtons(turn.finished ? [{ value: '0', title: 'Nova conversa' }] : turn.buttons);
      setTyping(false);
    }, TYPING_MS);
  };

  const send = (text: string, label?: string) => {
    if (!text.trim() || typing) return;
    setMessages((current) => [...current, message(label ?? text, true)]);
    setButtons([]);
    showTurn(nextTurn(state.current, text));
  };

  const restart = () => {
    setMessages([]);
    showTurn(menu());
  };

  // Ao abrir a tela, o atendimento já cumprimenta e mostra o menu.
  useEffect(() => {
    const welcome = menu();
    state.current = welcome.state;
    const timer = setTimeout(() => {
      setMessages(welcome.replies.map((text) => message(text, false)));
      setButtons(welcome.buttons);
    }, TYPING_MS);
    return () => clearTimeout(timer);
  }, []);

  return { messages, buttons, typing, send, restart };
}
