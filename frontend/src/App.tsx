import { useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import { wsService } from './services/websocket';
import { audioService } from './services/audio';
import Header from './components/Header';
import ControlPanel from './components/ControlPanel';
import TranscriptionPanel from './components/TranscriptionPanel';
import ResponsePanel from './components/ResponsePanel';
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
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

          {/* Right Column */}
          <div className="space-y-6">
            <ResponsePanel 
              response={currentResponse}
              isGenerating={useAppStore.getState().isGenerating}
            />
          </div>
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
