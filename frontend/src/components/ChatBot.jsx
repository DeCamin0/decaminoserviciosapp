import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContextBase';
import { routes } from '../utils/routes';
import Chatbot from 'react-chatbot-kit';
import 'react-chatbot-kit/build/main.css';
import './ChatBot.css';

// Configurare pentru chatbot
const botName = 'DeCamino AI Assistant';

const ChatBot = () => {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Store actions per message ID using ref (nu trigger re-render)
  const messageActionsRef = useRef(new Map());
  // State pentru a forța re-render când se adaugă acțiuni
  const [lastMessageWithActions, setLastMessageWithActions] = useState(null);

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

      // Obține JWT token pentru autentificare
      const token = localStorage.getItem('auth_token');
      const headers = {
        'Content-Type': 'application/json',
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(routes.chatAI, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      try {
        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          data = text;
        }
      } catch (_) {
        data = await response.text().catch(() => null);
      }

      console.log('📥 Răspuns AI complet:', data);

      // Procesare flexibilă a răspunsului
      let aiResponse = '';
      let acciones = [];
      
      if (data) {
        // Extrage acțiunile dacă există
        if (data.acciones && Array.isArray(data.acciones)) {
          acciones = data.acciones;
          console.log('✅ Acțiuni găsite:', acciones.length, acciones);
        } else {
          console.log('⚠️ Nu s-au găsit acțiuni în răspuns');
        }
        
        // Încearcă diferite formate posibile
        if (typeof data === 'string') {
          aiResponse = data;
        } else if (data.respuesta) {
          aiResponse = data.respuesta;
        } else if (data.message) {
          aiResponse = data.message;
        } else if (data.content) {
          aiResponse = data.content;
        } else if (data.text) {
          aiResponse = data.text;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
          aiResponse = data.choices[0].message.content;
        } else {
          aiResponse = JSON.stringify(data);
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

      // Returnează răspunsul și acțiunile
      return {
        respuesta: aiResponse || '❌ No he podido procesar la respuesta del AI. Por favor, intenta de nuevo.',
        acciones: acciones,
      };

    } catch (error) {
      console.error('❌ Eroare la trimiterea mesajului:', error);
      
      let errorMessage = '❌ Error al comunicarse con el AI.';
      
      if (error.message?.includes('HTTP')) {
        errorMessage = `❌ ${error.message}`;
      } else if (error.name === 'AbortError') {
        errorMessage = '⏰ Timeout - la respuesta tardó demasiado. Por favor, intenta de nuevo.';
      }
      
      return errorMessage;
    }
  };

  // Funcție pentru descărcare Excel
  const downloadAsExcel = useCallback(async (datos, intent) => {
    // Import dinamic pentru exceljs (dacă nu e deja importat)
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos');

    // Headers
    if (datos && datos.length > 0) {
      const headers = Object.keys(datos[0]);
      worksheet.addRow(headers);
      
      // Date
      datos.forEach(item => {
        const row = headers.map(header => item[header] || '');
        worksheet.addRow(row);
      });
    }

    // Generează buffer și descarcă
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `registros_${intent}_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  // Funcție pentru descărcare TXT
  const downloadAsTxt = useCallback((datos, intent) => {
    if (!datos || datos.length === 0) return;

    const headers = Object.keys(datos[0]);
    let content = headers.join('\t') + '\n';
    
    datos.forEach(item => {
      const row = headers.map(header => item[header] || '').join('\t');
      content += row + '\n';
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `registros_${intent}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    window.URL.revokeObjectURL(url);
  }, []);

  // Funcție pentru descărcare PDF
  const downloadAsPdf = useCallback(async (datos, intent) => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Título
      doc.setFontSize(16);
      doc.text(`Registros de ${intent}`, 14, 20);
      
      // Headers și date
      if (datos && datos.length > 0) {
        const headers = Object.keys(datos[0]);
        let yPos = 30;
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const colWidth = (pageWidth - 2 * margin) / headers.length;
        
        // Headers
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        headers.forEach((header, idx) => {
          doc.text(header.substring(0, 15), margin + idx * colWidth, yPos);
        });
        yPos += 7;
        
        // Date (limitează la 50 de rânduri pentru a evita probleme)
        doc.setFont(undefined, 'normal');
        const maxRows = Math.min(50, datos.length);
        datos.slice(0, maxRows).forEach((item) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          headers.forEach((header, colIdx) => {
            const value = String(item[header] || '').substring(0, 15);
            doc.text(value, margin + colIdx * colWidth, yPos);
          });
          yPos += 7;
        });
        
        if (datos.length > maxRows) {
          doc.text(`... y ${datos.length - maxRows} registros más`, margin, yPos + 5);
        }
      }

      doc.save(`registros_${intent}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      // Fallback: descarcă ca TXT dacă PDF nu e disponibil
      downloadAsTxt(datos, intent);
    }
  }, [downloadAsTxt]);

  // Funcție pentru descărcare Excel/TXT/PDF
  const handleDownload = useCallback(async (accion) => {
    const { payload } = accion;
    const { datos, formato, intent } = payload;

    try {
      if (formato === 'excel') {
        await downloadAsExcel(datos, intent);
      } else if (formato === 'txt') {
        await downloadAsTxt(datos, intent);
      } else if (formato === 'pdf') {
        await downloadAsPdf(datos, intent);
      }
    } catch (error) {
      console.error('❌ Error al descargar:', error);
      alert('Error al generar el archivo. Por favor, intenta de nuevo.');
    }
  }, [downloadAsExcel, downloadAsTxt, downloadAsPdf]);

  // Action Provider pentru chatbot
  const ActionProvider = ({ createChatBotMessage, setState, children }) => {
    const handleMessage = async (message) => {
      const botMessage = createChatBotMessage('⏳ Procesando mensaje...');
      
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages, botMessage],
      }));

      const response = await handleUserMessage(message);
      
      // Procesează răspunsul (poate fi string sau obiect cu respuesta și acciones)
      let respuestaText = '';
      let acciones = [];
      
      if (typeof response === 'string') {
        respuestaText = response;
      } else if (response && response.respuesta) {
        respuestaText = response.respuesta;
        acciones = response.acciones || [];
      } else {
        respuestaText = 'Error procesando respuesta';
      }

      // Creează mesajul cu acțiuni dacă există
      let botResponse;
      if (acciones && acciones.length > 0) {
        console.log('🔘 Creând mesaj cu acțiuni:', acciones.length);
        // Adaugă un marker special în text pentru a identifica mesajul cu acțiuni
        const marker = `__ACCIONES_${Date.now()}__`;
        const messageWithMarker = `${respuestaText}\n\n${marker}`;
        botResponse = createChatBotMessage(messageWithMarker);
        // Store actions in ref using message ID
        const messageId = botResponse.id || Date.now().toString();
        messageActionsRef.current.set(messageId, acciones);
        messageActionsRef.current.set(marker, acciones); // Store by marker too
        // Force re-render by updating state
        setLastMessageWithActions({ messageId, marker, acciones, timestamp: Date.now() });
        console.log('💾 Stocat acțiuni pentru mesaj:', messageId, marker, acciones);
        // Adaugă acțiunile ca proprietate custom (backup)
        botResponse.acciones = acciones;
        botResponse.messageId = messageId;
        botResponse.marker = marker;
        console.log('✅ Mesaj creat cu acțiuni:', botResponse);
      } else {
        console.log('⚠️ Nu sunt acțiuni, creând mesaj simplu');
        botResponse = createChatBotMessage(respuestaText);
      }
      
      setState((prev) => ({
        ...prev,
        messages: [...prev.messages.slice(0, -1), botResponse],
      }));
      
      // Force re-render pentru a adăuga butoanele după ce mesajul este renderizat
      if (acciones && acciones.length > 0) {
        const currentMarker = botResponse.marker;
        const actionsToAdd = acciones; // Salvează acțiunile pentru a le folosi mai târziu
        
        // Funcție helper pentru a adăuga butoanele
        const addButtonsToMessage = (element) => {
          if (element.querySelector('.download-buttons-container')) {
            console.log('⚠️ Butoanele sunt deja adăugate pentru acest element');
            return; // Butoanele sunt deja adăugate
          }
          
          console.log('✅ Adăugare butoane pentru mesaj:', currentMarker);
          const buttonsContainer = document.createElement('div');
          buttonsContainer.className = 'download-buttons-container';
          
          actionsToAdd.forEach((accion) => {
            const button = document.createElement('button');
            button.textContent = accion.label;
            button.onclick = () => {
              console.log('🔘 Click pe buton:', accion);
              handleDownload(accion);
            };
            buttonsContainer.appendChild(button);
          });
          
          // Elimină marker-ul din text (caută în toate formatele posibile)
          const markerVariants = [
            currentMarker, // __ACCIONES_...__
            currentMarker.replace(/__/g, '_'), // _ACCIONES_..._
            currentMarker.replace(/^__/, '_').replace(/__$/, '_'), // _ACCIONES_...__
            currentMarker.replace(/^_/, '').replace(/_$/, ''), // ACCIONES_...
          ];
          
          const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
          let node;
          while ((node = walker.nextNode())) {
            let textChanged = false;
            markerVariants.forEach(marker => {
              if (node.textContent.includes(marker)) {
                node.textContent = node.textContent.replace(marker, '').trim();
                textChanged = true;
                console.log('✅ Marker eliminat din text:', marker);
              }
            });
            if (textChanged) break;
          }
          
          // Adaugă butoanele după elementul de mesaj
          element.appendChild(buttonsContainer);
          console.log('✅ Butoane adăugate cu succes la element:', element.className || element.tagName);
        };
        
        // Funcție pentru căutarea marker-ului în DOM
        const findAndInjectButtons = () => {
          const chatContainer = document.querySelector('.react-chatbot-kit-chat-container') ||
                               document.querySelector('[class*="chat-container"]') ||
                               document.querySelector('.react-chatbot-kit-chat-message-container') ||
                               document.querySelector('.react-chatbot-kit-chat-inner-container');
          
          if (!chatContainer) {
            console.warn('⚠️ Container chat nu găsit');
            return false;
          }
          
          // Caută marker-ul în toate formatele posibile
          const markerVariants = [
            currentMarker, // __ACCIONES_...__
            currentMarker.replace(/__/g, '_'), // _ACCIONES_..._
            currentMarker.replace(/^__/, '_').replace(/__$/, '_'), // _ACCIONES_...__
          ];
          
          // Caută în toate elementele din container
          const allElements = chatContainer.querySelectorAll('*');
          console.log(`🔍 Căutare marker în ${allElements.length} elemente`);
          
          // Caută mai întâi în text nodes pentru a găsi marker-ul exact
          const walker = document.createTreeWalker(
            chatContainer,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          let textNode;
          while ((textNode = walker.nextNode())) {
            const textContent = textNode.textContent || '';
            const hasMarker = markerVariants.some(marker => textContent.includes(marker));
            
            if (hasMarker) {
              console.log('✅ Marker găsit în text node');
              // Găsește container-ul de mesaj bot (caută în sus în DOM)
              let messageContainer = textNode.parentElement;
              let found = false;
              
              // Caută până la 10 niveluri în sus pentru a găsi container-ul de mesaj
              for (let i = 0; i < 10 && messageContainer && messageContainer !== chatContainer; i++) {
                const classList = messageContainer.classList || [];
                const className = messageContainer.className || '';
                
                // Verifică dacă este un container de mesaj bot
                if (
                  classList.contains('react-chatbot-kit-chat-bot-message-container') ||
                  classList.contains('react-chatbot-kit-chat-bot-message') ||
                  classList.contains('custom-bot-message') ||
                  (className.includes('bot-message') && !className.includes('inner-container')) ||
                  (className.includes('message-container') && className.includes('bot'))
                ) {
                  // Verifică dacă nu are deja butoane
                  if (!messageContainer.querySelector('.download-buttons-container')) {
                    console.log('✅ Container de mesaj bot găsit:', className);
                    addButtonsToMessage(messageContainer);
                    found = true;
                    break;
                  } else {
                    console.log('⚠️ Container-ul are deja butoane, continuăm căutarea...');
                  }
                }
                messageContainer = messageContainer.parentElement;
              }
              
              if (found) return true;
            }
          }
          
          // Fallback: caută în toate elementele (metoda veche)
          for (const element of allElements) {
            const messageText = element.textContent || element.innerText || '';
            
            // Verifică dacă elementul conține oricare dintre variantele marker-ului
            const hasMarker = markerVariants.some(marker => messageText.includes(marker));
            
            if (hasMarker && !element.querySelector('.download-buttons-container')) {
              // Skip container-ul general
              const className = element.className || '';
              if (className.includes('inner-container') || className.includes('chat-container')) {
                continue;
              }
              
              // Găsește container-ul de mesaj bot (caută în sus în DOM)
              let messageContainer = element;
              let found = false;
              
              // Caută până la 10 niveluri în sus pentru a găsi container-ul de mesaj
              for (let i = 0; i < 10 && messageContainer && messageContainer !== chatContainer; i++) {
                const classList = messageContainer.classList || [];
                const containerClassName = messageContainer.className || '';
                
                // Skip container-ul general
                if (containerClassName.includes('inner-container') || containerClassName.includes('chat-container')) {
                  messageContainer = messageContainer.parentElement;
                  continue;
                }
                
                if (
                  classList.contains('react-chatbot-kit-chat-bot-message-container') ||
                  classList.contains('react-chatbot-kit-chat-bot-message') ||
                  classList.contains('custom-bot-message') ||
                  (containerClassName.includes('bot-message') && !containerClassName.includes('inner-container')) ||
                  (containerClassName.includes('message-container') && containerClassName.includes('bot'))
                ) {
                  console.log('✅ Container de mesaj bot găsit (fallback):', containerClassName);
                  addButtonsToMessage(messageContainer);
                  found = true;
                  break;
                }
                messageContainer = messageContainer.parentElement;
              }
              
              if (found) return true;
            }
          }
          
          return false;
        };
        
        // Folosește multiple timeout-uri pentru a asigura injectarea butoanelor
        // RequestAnimationFrame pentru a aștepta ca DOM-ul să fie complet renderizat
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (findAndInjectButtons()) {
              console.log('✅ Butoane injectate cu succes (attempt 1)');
            } else {
              console.log('⚠️ Butoanele nu au fost găsite (attempt 1), încercare din nou...');
              // Încercare 2 după 500ms
              setTimeout(() => {
                if (findAndInjectButtons()) {
                  console.log('✅ Butoane injectate cu succes (attempt 2)');
                } else {
                  console.log('⚠️ Butoanele nu au fost găsite (attempt 2), încercare finală...');
                  // Încercare 3 după încă 1 secundă
                  setTimeout(() => {
                    if (findAndInjectButtons()) {
                      console.log('✅ Butoane injectate cu succes (attempt 3)');
                    } else {
                      console.error('❌ Nu s-au putut injecta butoanele după 3 încercări');
                    }
                  }, 1000);
                }
              }, 500);
            }
          }, 100);
        });
      }
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

  // Configurare pentru chatbot (mutat după definirea funcțiilor pentru a avea acces la handleDownload și messageActions)
  const config = React.useMemo(() => ({
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
      botMessageBox: (props) => {
        // Extrage acțiunile din mesaj dacă există
        // react-chatbot-kit pasează mesajul în props.message ca obiect cu proprietatea 'message'
        const messageObj = props.message;
        const messageText = typeof messageObj === 'string' 
          ? messageObj 
          : messageObj?.message || messageObj?.text || JSON.stringify(messageObj);
        
        // Încearcă să extragă acțiunile din diferite locații
        let acciones = messageObj?.acciones || props.acciones || [];
        
        // Dacă nu găsim acțiunile direct, încercăm din ref
        if (acciones.length === 0 && messageObj?.messageId) {
          const storedActions = messageActionsRef.current.get(messageObj.messageId);
          if (storedActions) {
            acciones = storedActions;
          }
        }
        
        // Fallback: încercăm să găsim acțiunile din toate mesajele (ultimul mesaj cu acțiuni)
        // Dar doar dacă mesajul curent este de tip 'bot' și este ultimul mesaj cu acțiuni
        if (acciones.length === 0) {
          // Verifică dacă mesajul curent este ultimul mesaj cu acțiuni (compară ID-ul)
          const currentMessageId = messageObj?.id || messageObj?.messageId;
          if (lastMessageWithActions && 
              lastMessageWithActions.messageId && 
              currentMessageId && 
              String(currentMessageId) === String(lastMessageWithActions.messageId)) {
            acciones = lastMessageWithActions.acciones;
            console.log('✅ Găsit acțiuni pentru mesajul curent din lastMessageWithActions:', acciones.length);
          } else if (lastMessageWithActions && lastMessageWithActions.acciones) {
            // Dacă mesajul curent nu are ID sau nu se potrivește, verifică dacă este ultimul mesaj bot
            // (doar pentru ultimul mesaj bot afișăm acțiunile)
            const isLastBotMessage = messageObj?.type === 'bot' || messageObj?.message?.type === 'bot';
            if (isLastBotMessage) {
              // Verifică dacă există un mesaj mai recent cu acțiuni
              const timeDiff = Date.now() - (lastMessageWithActions.timestamp || 0);
              // Dacă mesajul cu acțiuni a fost creat în ultimele 5 secunde, probabil este pentru acest mesaj
              if (timeDiff < 5000) {
                acciones = lastMessageWithActions.acciones;
                console.log('✅ Găsit acțiuni din lastMessageWithActions (recent):', acciones.length);
              }
            }
          }
          
          // Ultimul fallback: căutăm în ref
          if (acciones.length === 0) {
            const allActions = Array.from(messageActionsRef.current.values());
            if (allActions.length > 0) {
              acciones = allActions[allActions.length - 1];
              console.log('✅ Găsit acțiuni din ref (ultimul):', acciones.length);
            }
          }
        }
        
        console.log('🎨 botMessageBox render:', {
          messageObj,
          messageText: messageText.substring(0, 50),
          acciones: acciones.length,
          hasAcciones: acciones.length > 0,
          messageActionsSize: messageActionsRef.current.size,
          lastMessageWithActions: lastMessageWithActions?.acciones?.length || 0,
        });
        
        // Debug: verifică toate props-urile
        console.log('🔍 botMessageBox props complete:', {
          props,
          messageObj,
          messageObjKeys: messageObj ? Object.keys(messageObj) : [],
          allPropsKeys: Object.keys(props),
        });
        
        return (
        <div className="custom-bot-message">
            <div>{messageText}</div>
            {acciones && acciones.length > 0 ? (
              <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {acciones.map((accion, idx) => {
                  console.log('🎨 Rendering button:', idx, accion);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        console.log('🔘 Click pe buton:', accion);
                        handleDownload(accion);
                      }}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#E53935',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        marginTop: '5px',
                      }}
                    >
                      {accion.label || `Button ${idx + 1}`}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: '#999', marginTop: '5px' }}>
                ⚠️ Debug: No acciones found (length: {acciones.length})
              </div>
            )}
        </div>
        );
      }
    }
  }), [userName, handleDownload, lastMessageWithActions]);

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