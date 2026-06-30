export const INSTAGRAM_URL = "https://www.instagram.com/ace_barberstudio/";
export const TIKTOK_URL = "https://www.tiktok.com/@barberstudio.ace";

export function InstagramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function TikTokIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.5 3c.3 2.1 1.5 3.6 3.5 4v2.6c-1.3.1-2.5-.2-3.6-.8v5.9c0 3.3-2.4 5.8-5.6 5.8-3 0-5.3-2.3-5.3-5.2 0-3 2.4-5.3 5.5-5.1v2.7c-.4-.1-.8-.2-1.2-.1-1.3.1-2.2 1.1-2.1 2.5 0 1.3 1 2.3 2.3 2.3 1.4 0 2.3-1 2.3-2.6V3h2.8z" />
    </svg>
  );
}

export function SocialLinks({
  className = "",
  iconClass = "h-4 w-4",
}: {
  className?: string;
  iconClass?: string;
}) {
  return (
    <div className={className}>
      <a
        href={INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Instagram"
        className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <InstagramIcon className={iconClass} />
      </a>
      <a
        href={TIKTOK_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="TikTok"
        className="grid h-10 w-10 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-accent hover:text-accent"
      >
        <TikTokIcon className={iconClass} />
      </a>
    </div>
  );
}
