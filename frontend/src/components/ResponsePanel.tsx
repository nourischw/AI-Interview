import React from 'react';
import { useAppStore } from '../store/appStore';
import { LLMResponse } from '@ai-interview/shared';

const ResponsePanel: React.FC = () => {
  const { response, isGenerating } = useAppStore();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 floating-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          AI Response Suggestion
        </h2>
        {isGenerating && (
          <span className="flex items-center text-sm text-blue-500">
            <svg className="w-4 h-4 mr-2 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Generating...
          </span>
        )}
      </div>

      <div className="min-h-[300px]">
        {!response && !isGenerating ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">Waiting for question...</p>
            <p className="text-xs mt-1">AI will generate suggestions automatically</p>
          </div>
        ) : isGenerating ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
          </div>
        ) : response ? (
          <ResponseContent response={response} />
        ) : null}
      </div>
    </div>
  );
};

interface ResponseContentProps {
  response: LLMResponse;
}

const ResponseContent: React.FC<ResponseContentProps> = ({ response }) => {
  return (
    <div className="space-y-4">
      {/* Main Answer */}
      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
        <p className="text-gray-900 dark:text-white leading-relaxed">
          {response.answer.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={i} className="font-semibold text-blue-700 dark:text-blue-400">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return part;
          })}
        </p>
      </div>

      {/* Keywords */}
      {response.keywords && response.keywords.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Key Points
          </h3>
          <div className="flex flex-wrap gap-2">
            {response.keywords.map((keyword, index) => (
              <span
                key={index}
                className="px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confidence & Sources */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">Confidence:</span>
          <div className="flex items-center space-x-2">
            <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  response.confidence > 0.8
                    ? 'bg-green-500'
                    : response.confidence > 0.6
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${response.confidence * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {Math.round(response.confidence * 100)}%
            </span>
          </div>
        </div>

        {response.latency && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Generated in {Math.round(response.latency)}ms
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-3 pt-2">
        <button className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
          Copy Answer
        </button>
        <button className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors">
          Regenerate
        </button>
      </div>
    </div>
  );
};

export default ResponsePanel;
