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
  // Dupliramo niz da bi se petlja vrtela beskonačno bez "skoka".
  const loop = [...images, ...images];

  return (
    <section
      id="gallery"
      className="overflow-hidden border-y border-border bg-background py-10"
    >
      <div className="flex w-max animate-marquee">
        {loop.map((imgUrl, index) => (
          <div
            key={index}
            className="mr-4 h-[340px] w-[255px] shrink-0 overflow-hidden rounded-2xl border border-border md:h-[440px] md:w-[330px]"
          >
            <img
              src={imgUrl}
              alt={`ACE Studio galerija ${(index % images.length) + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  );
};

export default ImageCarousel;
