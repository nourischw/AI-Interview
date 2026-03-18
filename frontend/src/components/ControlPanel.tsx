import React from 'react';

interface ControlPanelProps {
  isActive: boolean;
  isRecording: boolean;
  audioLevel: number;
  onStart: () => void;
  onStop: () => void;
  onStealthToggle: () => void;
  isStealthEnabled: boolean;
  isHidden: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  isActive,
  isRecording,
  audioLevel,
  onStart,
  onStop,
  onStealthToggle,
  isStealthEnabled,
  isHidden,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 floating-panel">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Session Control
      </h2>

      {/* Start/Stop Button */}
      <div className="mb-6">
        {!isActive ? (
          <button
            onClick={onStart}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Start Interview Session</span>
            </div>
          </button>
        ) : (
          <button
            onClick={onStop}
            className="w-full py-4 px-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl shadow-lg transform transition hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex items-center justify-center space-x-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
              </svg>
              <span>End Session</span>
            </div>
          </button>
        )}
      </div>

      {/* Audio Level Indicator */}
      {isActive && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Audio Level</span>
            <span className={`text-sm font-medium ${isRecording ? 'text-green-500' : 'text-gray-500'}`}>
              {isRecording ? 'Recording' : 'Paused'}
            </span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                audioLevel > 0.7 ? 'bg-red-500' : audioLevel > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${audioLevel * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onStealthToggle}
          disabled={!isStealthEnabled}
          className={`py-3 px-4 rounded-lg font-medium transition-colors ${
            isHidden
              ? 'bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
            <span>{isHidden ? 'Hidden' : 'Visible'}</span>
          </div>
        </button>

        <button
          className="py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          onClick={() => {/* Manual trigger */}}
        >
          <div className="flex items-center justify-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Generate</span>
          </div>
        </button>
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Ctrl</kbd>+<kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Shift</kbd>+<kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">X</kbd> to quickly hide/show
        </p>
      </div>
    </div>
  );
};

export default ControlPanel;
