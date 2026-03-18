import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { wsService } from './services/websocket';
import { audioService } from './services/audio';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import TranscriptionPanel from './components/TranscriptionPanel';
import ResponsePanel from './components/ResponsePanel';
import DocumentManager from './components/DocumentManager';
import SettingsModal from './components/SettingsModal';
import ComplianceModal from './components/ComplianceModal';

function App() {
  const {
    session,
    isRecording,
    isHidden,
    isStealthEnabled,
    currentResponse,
    startSession,
    endSession,
    addTranscription,
    setResponse,
    setGenerating,
    setRecording,
    setAudioLevel,
  } = useAppStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showCompliance, setShowCompliance] = useState(true);
  const [showDocuments, setShowDocuments] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const connectWS = async () => {
      try {
        await wsService.connect();
        
        // Setup listeners
        const unsubTranscription = wsService.on('transcription', (msg) => {
          if (msg.data) {
            addTranscription(msg.data as any);
          }
        });

        const unsubResponse = wsService.on('response', (msg) => {
          if (msg.data) {
            setResponse(msg.data as any);
          }
        });

        const unsubQuestion = wsService.on('question_detected', (msg) => {
          if (msg.trigger) {
            setGenerating(true);
          }
        });

        return () => {
          unsubTranscription();
          unsubResponse();
          unsubQuestion();
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    };

    connectWS();

    return () => {
      wsService.disconnect();
    };
  }, [addTranscription, setResponse]);

  const handleStartSession = async () => {
    try {
      await audioService.initialize();
      await audioService.startCapture(false); // false = use microphone
      
      audioService.onAudioLevelChange((level) => {
        setAudioLevel(level);
      });

      startSession();
      wsService.send({ type: 'start_session' });
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  const handleEndSession = async () => {
    await audioService.stopCapture();
    endSession();
    
    if (session.id) {
      wsService.send({ type: 'end_session', payload: { sessionId: session.id } });
    }
  };

  const handleToggleStealth = () => {
    const root = document.getElementById('root');
    if (isHidden) {
      root?.classList.remove('ai-assistant-stealth');
      root?.removeAttribute('data-stealth-hidden');
    } else {
      root?.classList.add('ai-assistant-stealth');
      root?.setAttribute('data-stealth-hidden', 'true');
    }
    useAppStore.getState().toggleStealth();
  };

  // Keyboard shortcut for emergency hide
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleToggleStealth();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHidden]);

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 transition-opacity duration-100 ${isHidden ? 'opacity-0' : 'opacity-100'}`}>
      <Header 
        isActive={session.isActive}
        onSettingsClick={() => setShowSettings(true)}
        onStealthToggle={handleToggleStealth}
        isHidden={isHidden}
      />

      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            <ControlPanel
              isActive={session.isActive}
              isRecording={isRecording}
              audioLevel={useAppStore.getState().audioLevel}
              onStart={handleStartSession}
              onStop={handleEndSession}
              onStealthToggle={handleToggleStealth}
              isStealthEnabled={isStealthEnabled}
              isHidden={isHidden}
            />

            <TranscriptionPanel />
          </div>

          {/* Right Column - Documents & Response */}
          <div className="space-y-6">
            {showDocuments ? (
              <DocumentManager />
            ) : (
              <ResponsePanel
                response={currentResponse}
                isGenerating={useAppStore.getState().isGenerating}
              />
            )}
          </div>
        </div>

        {/* Toggle Documents Button */}
        <div className="fixed bottom-6 right-6">
          <button
            onClick={() => setShowDocuments(!showDocuments)}
            className={`p-4 rounded-full shadow-lg transition-all ${
              showDocuments
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            title={showDocuments ? 'Show Responses' : 'Manage Documents'}
          >
            {showDocuments ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            )}
          </button>
        </div>
      </main>

      {/* Modals */}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showCompliance && (
        <ComplianceModal onClose={() => setShowCompliance(false)} />
      )}
    </div>
  );
}

export default App;
