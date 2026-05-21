import { buildWhatsappUrl } from "@/lib/contact-config";

export default function WhatsappFloatingButton({ message }: { message?: string }) {
  return (
    <a
      href={buildWhatsappUrl(message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-50 h-[60px] w-[60px] rounded-full grid place-items-center shadow-[0_8px_24px_rgba(37,211,102,0.45)] hover:scale-105 active:scale-95 transition-transform"
      style={{ backgroundColor: "#25D366" }}
    >
      <svg viewBox="0 0 32 32" className="h-8 w-8" fill="white" aria-hidden="true">
        <path d="M19.11 17.21c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.14-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.79.37-.27.3-1.03 1.01-1.03 2.46 0 1.45 1.06 2.86 1.21 3.06.15.2 2.09 3.2 5.07 4.48.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM16.04 5.33c-5.91 0-10.71 4.8-10.71 10.7 0 1.88.49 3.72 1.43 5.35L5.27 27l5.78-1.51c1.57.86 3.33 1.31 5.13 1.31 5.91 0 10.71-4.8 10.71-10.7 0-2.86-1.11-5.55-3.13-7.57a10.66 10.66 0 00-7.58-3.13zm0 19.6c-1.6 0-3.16-.43-4.52-1.24l-.32-.19-3.36.88.9-3.28-.21-.34a8.86 8.86 0 11 7.51 4.17z" />
      </svg>
    </a>
  );
}