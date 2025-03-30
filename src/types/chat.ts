export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export interface UserData {
  budget: number | null;
  city: string | null;
  investmentType: string | null;
  targetAudience: string | null;
}