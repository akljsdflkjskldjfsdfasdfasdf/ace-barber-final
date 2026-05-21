import { useState, useEffect } from "react";

const images = [
  "/slike/1.jpeg",
  "/slike/2.jpeg",
  "/slike/3.jpeg",
  "/slike/4.jpeg",
  "/slike/5.jpeg",
  "/slike/7.jpeg",
  "/slike/8.jpeg",
  "/slike/9.jpeg",
];

const ImageCarousel = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentIndex((prevIndex) =>
        prevIndex === images.length - 1 ? 0 : prevIndex + 1,
      );
    }, 2100);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="relative w-full !h-[85vh] md:h-[600px] overflow-hidden bg-black border-b border-neutral-900">
      {images.map((imgUrl, index) => (
        <div
          key={index}
          className={`absolute inset-0 !transition-opacity !duration-1000 ease-in-out ${
            index === currentIndex ? "opacity-100" : "opacity-0 z-0"
          }`}
        >
          <img
            src={imgUrl}
            alt={`Barber slide ${index + 1}`}
            className="h-full w-auto mx-auto object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80"></div>
        </div>
      ))}

      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 space-x-2">
        {images.map((_, index) => (
          <div
            key={index}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              index === currentIndex ? "bg-white w-20" : "bg-white/40 w-5"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageCarousel;
