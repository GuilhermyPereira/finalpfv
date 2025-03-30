import React, { useState, useEffect } from 'react';
import { MessageSquareCode } from 'lucide-react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Message, ChatState, UserData } from './types/chat';

function App() {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    isLoading: false,
  });

  const [userData, setUserData] = useState<UserData>({
    budget: null,
    city: null,
    investmentType: null,
    targetAudience: null,
  });

  useEffect(() => {
    if (chatState.messages.length === 0) {
      const initialMessages: Message[] = [
        {
          id: '1',
          content: 'Olá, seja bem-vindo ao assistente do LocalAItycs! Vamos buscar a melhor opção de localização para seu negócio. Para isso, precisamos de alguns dados.',
          role: 'assistant',
          timestamp: new Date(),
        },
        {
          id: '2',
          content: 'Para começar, qual o seu orçamento?',
          role: 'assistant',
          timestamp: new Date(),
        },
      ];

      setChatState(prev => ({
        ...prev,
        messages: initialMessages,
      }));
    }
  }, []);

  const saveUserData = async (data: UserData) => {
    if (!data.budget || !data.city || !data.investmentType || !data.targetAudience) {
      return null;
    }

    try {
      // Save to local database
      const dbResponse = await fetch('http://localhost:3000/api/user-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget: data.budget,
          city: data.city,
          investmentType: data.investmentType,
          targetAudience: data.targetAudience
        })
      });
      
      if (!dbResponse.ok) {
        throw new Error('Failed to save user data');
      }

      const savedData = await dbResponse.json();

      // Make the API call through our proxy with the updated format
      const inputValue = `Orçamento: ${data.budget}, Cidade: ${data.city}, Tipo de Investimento: ${data.investmentType}, Público Alvo: ${data.targetAudience}`;
      
      const apiResponse = await fetch(
        "http://localhost:3000/api/proxy/ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input_value: inputValue
          })
        }
      );

      if (!apiResponse.ok) {
        throw new Error('Failed to get AI response');
      }

      const apiData = await apiResponse.json();
      
      // Add API response to chat
      const apiResponseMessage: Message = {
        id: Date.now().toString(),
        content: typeof apiData === 'string' ? apiData : JSON.stringify(apiData, null, 2),
        role: 'assistant',
        timestamp: new Date(),
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, apiResponseMessage],
      }));
      
      return savedData;
    } catch (error) {
      console.error('Error processing data:', error);
      throw error;
    }
  };

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMessage],
      isLoading: true,
    }));

    let responseMessage = '';
    let shouldUpdateUserData = true;

    if (userData.budget === null) {
      const budgetValue = content.trim().match(/^\d+(\.\d+)?$/) ? parseFloat(content) : NaN;

      if (isNaN(budgetValue) || budgetValue <= 0) {
        responseMessage = 'Por favor, insira um valor numérico válido para o orçamento.';
        shouldUpdateUserData = false;
      } else {
        responseMessage = 'Em qual cidade seu negócio será localizado?';
      }
    } else if (userData.city === null) {
      responseMessage = 'Obrigado! Agora, qual o tipo de investimento? Exemplo: Sorveteria, Escola de idiomas, Lanchonete, etc.';
    } else if (userData.investmentType === null) {
      responseMessage = 'Ótimo! Agora, qual será o público-alvo do seu negócio? Exemplo: Jovens universitários, famílias, profissionais liberais, etc.';
    } else if (userData.targetAudience === null) {
      responseMessage = 'Obrigado! Estamos processando suas informações...';
    } else {
      responseMessage = 'Suas informações foram registradas. Aguarde enquanto processamos os dados...';
    }

    if (shouldUpdateUserData) {
      setUserData(prev => {
        let newUserData;
        if (prev.budget === null) {
          const budgetValue = parseFloat(content.trim());
          newUserData = { ...prev, budget: isNaN(budgetValue) ? null : budgetValue };
        } else if (prev.city === null) {
          newUserData = { ...prev, city: content.trim() };
        } else if (prev.investmentType === null) {
          newUserData = { ...prev, investmentType: content.trim() };
        } else if (prev.targetAudience === null) {
          newUserData = { ...prev, targetAudience: content.trim() };
        } else {
          newUserData = prev;
        }

        // Only save if we have all the data
        if (newUserData.budget && newUserData.city && newUserData.investmentType && newUserData.targetAudience) {
          saveUserData(newUserData).catch(error => {
            console.error('Failed to save data:', error);
            setChatState(prev => ({
              ...prev,
              messages: [...prev.messages, {
                id: Date.now().toString(),
                content: 'Desculpe, ocorreu um erro ao processar suas informações. Por favor, tente novamente.',
                role: 'assistant',
                timestamp: new Date(),
              }],
            }));
          });
        }

        return newUserData;
      });
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: responseMessage,
      role: 'assistant',
      timestamp: new Date(),
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, assistantMessage],
      isLoading: false,
    }));
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: `url('/media/background.jpg')`,
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900/70 to-gray-900/90 backdrop-blur-[2px]" />
      <div className="relative max-w-3xl mx-auto p-4">
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-t-lg p-4 border-b border-gray-700 flex items-center gap-2">
          <div className="bg-blue-500 p-2 rounded-full">
            <MessageSquareCode className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-semibold text-white">LocalAItycs Assistant</h1>
        </div>
        <div className="bg-gray-800/80 backdrop-blur-sm h-[600px] overflow-y-auto p-4 flex flex-col gap-4">
          {chatState.messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              Envie uma mensagem para iniciar a conversa
            </div>
          ) : (
            chatState.messages.map((message, index) => (
              <div
                key={message.id}
                className="message-appear"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <ChatMessage message={message} />
              </div>
            ))
          )}
        </div>
        <div className="bg-gray-800/80 backdrop-blur-sm rounded-b-lg p-4 border-t border-gray-700">
          <ChatInput
            onSendMessage={sendMessage}
            disabled={chatState.isLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default App;