import { ShieldAlert } from 'lucide-react';

export default function ModerationGate() {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between border-b border-[#1A1A1A] pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Moderation Gate</h1>
          <p className="text-sm text-[#666]">Monitor public vibes, posts, and comments flags to safeguard user interactions.</p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl bg-[#111] p-6 border border-[#1A1A1A] hover:border-red-500/10 transition-all">
          <div className="flex items-center justify-between text-[#666] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Flagged Posts</span>
            <ShieldAlert size={16} className="text-red-400" />
          </div>
          <h2 className="text-3xl font-extrabold text-red-400">0</h2>
          <p className="text-[10px] text-gray-500 mt-2">Zero reported post content</p>
        </div>
      </div>

      <div className="rounded-2xl bg-[#111] p-8 border border-[#1A1A1A] flex flex-col items-center justify-center min-h-[300px] text-center">
        <ShieldAlert size={48} className="text-gray-600 mb-4 animate-pulse" />
        <h3 className="text-lg font-bold text-gray-300">Moderation Feed Empty</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-2">
          Awesome! No content flags have been logged or reported. If content is reported, the incident logs will appear here.
        </p>
      </div>
    </div>
  );
}
