import { useEffect } from 'react';

export default function RedirectToPublic() {
  useEffect(() => {
    window.location.replace('https://fluntr.com');
  }, []);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#080808] text-white">
      <div className="text-center">
        <p className="text-xs text-gray-500 font-mono tracking-widest uppercase animate-pulse">
          Routing back to public domain...
        </p>
      </div>
    </div>
  );
}
