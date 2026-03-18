import React, { useState } from 'react';

interface ComplianceModalProps {
  onClose: () => void;
}

const ComplianceModal: React.FC<ComplianceModalProps> = ({ onClose }) => {
  const [accepted, setAccepted] = useState(false);

  const handleAccept = () => {
    localStorage.setItem('compliance-accepted', 'true');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500">
          <div className="flex items-center space-x-3">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Important Notice</h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="prose dark:prose-invert max-w-none">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Terms of Use & Compliance
            </h3>

            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4">
              <p className="text-red-800 dark:text-red-200 font-medium">
                This tool is for <u>interview practice and preparation only</u>.
              </p>
            </div>

            <p className="text-gray-700 dark:text-gray-300">
              Using this AI assistant during actual interviews may:
            </p>

            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Violate the interview platform's terms of service</li>
              <li>Breach employment or academic integrity policies</li>
              <li>Potentially violate local laws and regulations</li>
              <li>Result in disqualification from the hiring process</li>
            </ul>

            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 mt-4">
              <p className="text-blue-800 dark:text-blue-200 text-sm">
                <strong>Intended Use:</strong> Practice interviews, preparation, learning, and skill development.
              </p>
            </div>

            <h4 className="text-md font-semibold text-gray-900 dark:text-white mt-4">
              Privacy & Data Protection
            </h4>

            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 text-sm">
              <li>By default, no audio or transcription data is stored</li>
              <li>Practice mode data is encrypted and stored locally</li>
              <li>All data is automatically deleted after 7 days</li>
              <li>No data is sent to third parties without consent</li>
            </ul>

            <h4 className="text-md font-semibold text-gray-900 dark:text-white mt-4">
              Regional Compliance
            </h4>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">EU Users</p>
                <p className="text-gray-600 dark:text-gray-400">GDPR compliant data handling</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="font-medium text-gray-900 dark:text-white">HK Users</p>
                <p className="text-gray-600 dark:text-gray-400">PDPO compliant design</p>
              </div>
            </div>
          </div>

          {/* Checkbox */}
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I acknowledge that this tool is for practice purposes only. I understand the potential risks 
              and agree to use this software responsibly and in compliance with applicable laws and policies.
            </span>
          </label>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={handleAccept}
            disabled={!accepted}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              accepted
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
          >
            I Understand & Accept
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceModal;
