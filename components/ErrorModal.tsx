"use client";

interface ErrorModalProps {
  transactionId: string;
  processName: string;
  day: number;
  errorMessage: string;
  screenshotPath: string | null;
  onClose: () => void;
}

export default function ErrorModal({
  transactionId,
  processName,
  day,
  errorMessage,
  screenshotPath,
  onClose,
}: ErrorModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-red-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-red-400">Error Detail</p>
            <h2 className="mt-1 text-lg font-bold text-white">{processName}</h2>
            <p className="text-sm text-gray-400">Day {day} &middot; TX: {transactionId}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none mt-1"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Error message */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Error Message</p>
          <p className="text-sm text-red-300 whitespace-pre-wrap break-words">{errorMessage}</p>
        </div>

        {/* Screenshot link */}
        {screenshotPath ? (
          <div className="mt-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Screenshot</p>
            <a
              href={screenshotPath}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm underline underline-offset-2 break-all"
            >
              {screenshotPath}
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-600 italic">No screenshot attached</p>
        )}

        <button
          onClick={onClose}
          className="mt-6 w-full bg-gray-800 hover:bg-gray-700 text-gray-200 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
