import React, { useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';

const TranscriptionPanel: React.FC = () => {
  const { transcriptions, currentTranscription } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptions]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 floating-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Live Transcription
        </h2>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {transcriptions.length} segments
        </span>
      </div>

      <div 
        ref={scrollRef}
        className="h-64 overflow-y-auto space-y-3 bg-gray-50 dark:bg-gray-900 rounded-lg p-4"
      >
        {transcriptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm">No transcription yet</p>
            <p className="text-xs mt-1">Start a session to begin</p>
          </div>
        ) : (
          transcriptions.map((segment, index) => (
            <div
              key={segment.segment_id}
              className={`p-3 rounded-lg transition-all ${
                segment.is_final
                  ? 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  : 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <p className={`text-sm ${
                  segment.is_final 
                    ? 'text-gray-900 dark:text-white' 
                    : 'text-blue-700 dark:text-blue-300 italic'
                }`}>
                  {segment.text}
                  {!segment.is_final && (
                    <span className="inline-block w-2 h-4 ml-1 bg-blue-500 animate-pulse" />
                  )}
                </p>
                <div className="flex items-center space-x-2 ml-3">
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(segment.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    segment.language === 'en-US' 
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : segment.language === 'zh-TW'
                      ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                      : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  }`}>
                    {segment.language}
                  </span>
                </div>
              </div>
              
              {/* Confidence indicator */}
              <div className="mt-2 flex items-center space-x-2">
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${
                      segment.confidence > 0.8 
                        ? 'bg-green-500' 
                        : segment.confidence > 0.6 
                        ? 'bg-yellow-500' 
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${segment.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {Math.round(segment.confidence * 100)}%
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Current partial transcription highlight */}
      {currentTranscription && !currentTranscription.is_final && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-xs text-yellow-700 dark:text-yellow-300 flex items-center">
            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </p>
        </div>
      )}
    </div>
  );
};

export default TranscriptionPanel;
