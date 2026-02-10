import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-6">
      <div className="max-w-2xl text-center space-y-8">
        <h1 className="text-5xl font-bold tracking-tight text-white">
          Access<span className="text-editor-accent">Code</span>
        </h1>
        <p className="text-xl text-gray-400 leading-relaxed">
          An eye-tracking-enabled Python IDE for people with motor impairments.
          Gaze input, single-button access, and AI-powered autocomplete.
        </p>
        <div className="flex gap-4 justify-center pt-4">
          <Link
            href="/editor"
            className="px-8 py-3 bg-editor-accent hover:bg-blue-500 text-white text-lg font-semibold rounded-lg transition-colors"
          >
            Start Coding
          </Link>
        </div>
        <p className="text-sm text-gray-600">
          Chrome required &middot; Webcam needed for eye tracking
        </p>
      </div>
    </div>
  );
}
