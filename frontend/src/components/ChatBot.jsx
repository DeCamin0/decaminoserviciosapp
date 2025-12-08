import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import axios from 'axios';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import './ChatBot.css';

// Configurare pentru chatbot
const botName = 'DeCamino AI Assistant';

const ChatBot = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Extrage numele utilizatorului
  const userName = user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator';

  // Verifică dacă utilizatorul este manager, supervisor sau developer
  const isManagerOrSupervisor = user?.GRUPO === 'Manager' || 
                               user?.GRUPO === 'Supervisor' || 
                               user?.GRUPO === 'Developer' ||
                               user?.isManager;

  useEffect(() => {
    console.log('🔍 ChatBot Debug:', { 
      user, 
      isManagerOrSupervisor, 
      userName, 
      isVisible,
      userGroup: user?.GRUPO 
    });

    if (isManagerOrSupervisor) {
      console.log('✅ Setez chatbot-ul ca vizibil');
      setIsVisible(true);
    } else {
      console.log('❌ Utilizatorul nu are permisiuni pentru chat');
    }
  }, [isManagerOrSupervisor, userName, setIsVisible, isVisible, user]);

  // Funcție pentru procesarea mesajelor
  const handleUserMessage = async (message) => {
    try {
      const requestData = {
        mensaje: message,
        usuario: {
          id: user?.CODIGO || user?.id || 'N/A',
          nombre: user?.['NOMBRE / APELLIDOS'] || user?.name || 'Utilizator',
          rol: user?.GRUPO || user?.role || 'manager'
        }
      };

      console.log('📤 Trimite mesaj către AI:', requestData);

      const response = await axios.post(routes.chatAI, requestData, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Răspuns AI complet:', response.data);

      // Procesare flexibilă a răspunsului
      let aiResponse = '';
      
      if (response.data) {
        // Încearcă diferite formate posibile
        if (typeof response.data === 'string') {
          aiResponse = response.data;
        } else if (response.data.respuesta) {
          aiResponse = response.data.respuesta;
        } else if (response.data.message) {
          aiResponse = response.data.message;
        } else if (response.data.content) {
          aiResponse = response.data.content;
        } else if (response.data.text) {
          aiResponse = response.data.text;
        } else if (response.data.choices && response.data.choices[0] && response.data.choices[0].message) {
          aiResponse = response.data.choices[0].message.content;
        } else {
          aiResponse = JSON.stringify(response.data);
        }
      }

      // Curăță răspunsul de HTML/iframe
      if (aiResponse && aiResponse.includes('<iframe')) {
        const textMatch = aiResponse.match(/srcdoc="([^"]+)"/);
        if (textMatch && textMatch[1]) {
          aiResponse = textMatch[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        } else {
          aiResponse = aiResponse.replace(/<[^>]*>/g, '').trim();
        }
      }
      
      // Curăță și alte tag-uri HTML
      if (aiResponse) {
        aiResponse = aiResponse
          .replace(/<[^>]*>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
      }

      return aiResponse || '❌ Nu am putut procesa răspunsul de la AI. Te rog să încerci din nou.';

    } catch (error) {
      console.error('❌ Eroare la trimiterea mesajului:', error);
      
      let errorMessage = '❌ Eroare la comunicarea cu AI.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = '⏰ Timeout - răspunsul a durat prea mult. Te rog să încerci din nou.';
      } else if (error.response?.status === 404) {
        errorMessage = '🔍 Endpoint-ul nu a fost găsit. Verifică configurația.';
      } else if (error.response?.status === 500) {
        errorMessage = '⚡ Eroare internă a serverului. Te rog să încerci din nou.';
      } else if (error.response?.status) {
        errorMessage = `❌ Eroare ${error.response.status}: ${error.response.statusText}`;
      }
      
      return errorMessage;
    }
  };

  // Action Provider pentru chatbot
  const ActionProvider = ({ createChatBotMessage, setState, children }) => {
    const handleMessage = async (message) => {
      const botMessage = createChatBotMessage('⏳ Procesez mesajul...');
      
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, botMessage],
      }));

      const response = await handleUserMessage(message);
      
      const botResponse = createChatBotMessage(response);
      
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages.slice(0, -1), botResponse],
      }));
    };

    return (
      <div>
        {React.Children.map(children, (child) => {
          return React.cloneElement(child, {
            actions: {
              handleMessage,
            },
          });
        })}
      </div>
    );
  };

  // Message Parser pentru chatbot
  const MessageParser = ({ children, actions }) => {
    const parse = (message) => {
      actions.handleMessage(message);
    };

    return (
      <div>
        {React.Children.map(children, (child) => {
          return React.cloneElement(child, {
            parse: parse,
            actions,
          });
        })}
      </div>
    );
  };

  // Configurare pentru chatbot
  const config = {
    initialMessages: [
      {
        id: 1,
        message: `¡Hola ${userName}! Soy el asistente AI de DeCamino. Estoy aquí para ayudarte con cualquier duda sobre la empresa, el equipo, los horarios o las estadísticas. Pregunta lo que necesites, pero por favor evita enviar spam o mensajes repetidos.`,
        trigger: 'user_input'
      }
    ],
    botName: botName,
    customStyles: {
      botMessageBox: {
        backgroundColor: '#E53935',
        color: '#FFFFFF'
      },
      chatButton: {
        backgroundColor: '#E53935',
        color: '#FFFFFF'
      }
    },
    customComponents: {
      botMessageBox: (props) => (
        <div className="custom-bot-message">
          {props.message}
        </div>
      )
    }
  };

  console.log('🎯 ChatBot Render:', { isVisible, isManagerOrSupervisor, isOpen });

  if (!isVisible) {
    console.log('❌ ChatBot nu este vizibil');
    return null;
  }

  console.log('✅ ChatBot se randează');

  return (
    <div className="chatbot-container">
      {/* Buton mare pentru deschiderea chat-ului */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="chatbot-toggle-button"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Fereastra chat */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div>
              <div className="chatbot-title">
                {botName}
              </div>
              <div className="chatbot-subtitle">
                Estoy aquí para ayudarte. Pregunta sobre horarios, fichajes o cualquier otro tema.
              </div>
            </div>
            <img 
              src={window.location.hostname.includes('ngrok') 
                ? 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo='
                : './logo.svg'
              }
              alt="Logo" 
              className="chatbot-logo"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
          
          <div className="chatbot-content">
            <Chatbot
              config={config}
              actionProvider={ActionProvider}
              messageParser={MessageParser}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBot; 