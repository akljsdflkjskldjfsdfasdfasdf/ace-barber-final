export default function Hero() {
  const scrollToBooking = () => {
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-black to-black opacity-50"></div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <div className="animate-fade-in-down mb-8"></div>

        <h1 className="text-6xl md:text-8xl font-bold mb-6 text-white tracking-tight animate-fade-in-up">
          ACE STUDIO
        </h1>

        <p className="text-xl md:text-2xl text-neutral-400 mb-12 max-w-2xl mx-auto animate-fade-in-up animation-delay-200">
          Where precision meets style. Timeless luxury.
        </p>

        <button
          onClick={scrollToBooking}
          className="fixed border-2 text-center border-black shadow-md shadow-white bottom-20 left-1/2 -translate-x-1/2 z-[9999] rounded-full px-10 py-4 bg-white text-black font-semibold text-lg hover:bg-neutral-200 shadow-2xl hover:shadow-red-600 hover:shadow-lg hover:font-bold transition-all duration-300 transform hover:scale-105"
        >
          BOOK NOW
        </button>
      </div>

      {/* SPOLJNI DIV SAMO CENTRIRA */}
      <div className="absolute bottom-40 left-1/2 -translate-x-1/2">
        {/* UNUTRAŠNJI DIV SAMO ANIMIRA (BOUNCE) */}
        <div className="animate-bounce">
          <div className="w-6 h-10 border-2 border-neutral-600 rounded-full flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-neutral-600 rounded-full"></div>
          </div>
        </div>
      </div>
    </section>
  );
}
