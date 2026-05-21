type IconProps = React.SVGProps<SVGSVGElement>;

export function GoogleDriveIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 2 .5 12l3 5 5.5-10L6 2Z" fill="#0066DA" />
      <path d="M6 2h12l-3 5H9L6 2Z" fill="#00AC47" />
      <path d="M23.5 12 18 2l-3 5 5 10 3.5-5Z" fill="#EA4335" />
      <path d="m3.5 17 3 5h11l3-5h-17Z" fill="#FFBA00" />
      <path d="m20 17-3-5H9.5L6.5 17H20Z" fill="#2684FC" />
    </svg>
  );
}

export function NotionIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447ZM5.252 7.3v13.913c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.234-.933-.748-.887l-15.177.887c-.561.047-.747.327-.747.933v.013Zm14.337.747c.093.42 0 .84-.42.887l-.7.14v10.27c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.222.187c-.094-.187 0-.654.327-.747l.84-.234v-9.196l-1.168-.094c-.094-.42.14-1.027.794-1.073l3.456-.234 4.764 7.279V8.794l-1.215-.14c-.093-.514.28-.887.747-.934l3.222-.186.002.114Z"/>
    </svg>
  );
}

export function CanvasIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="11" fill="#E72429" />
      <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="2" />
      <circle cx="12" cy="5" r="1.4" fill="white" />
      <circle cx="12" cy="19" r="1.4" fill="white" />
      <circle cx="5" cy="12" r="1.4" fill="white" />
      <circle cx="19" cy="12" r="1.4" fill="white" />
    </svg>
  );
}

export function MoodleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <rect x="1" y="1" width="22" height="22" rx="2" fill="#F98012" />
      <path
        d="M5 17v-6c0-1.5 1-2.5 2.4-2.5 1 0 1.6.4 2.1 1.1.5-.7 1.3-1.1 2.3-1.1 1.4 0 2.4 1 2.4 2.5V17h-2v-5.5c0-.7-.4-1.1-1-1.1s-1 .4-1 1.1V17h-2v-5.5c0-.7-.4-1.1-1-1.1s-1 .4-1 1.1V17H5Z"
        fill="white"
      />
      <circle cx="17" cy="14" r="3" fill="white" />
      <circle cx="17" cy="14" r="1.5" fill="#F98012" />
    </svg>
  );
}

export function ObsidianIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M14.5 1.5 21 8v8l-6.5 6.5H12L4 17l1-7 3-8h6.5Z"
        fill="#7C3AED"
      />
      <path
        d="M14 2 9 9l5 2 5-3-5-6Zm-5 8 3 9 6-1V12l-9-2Zm-4 7 4-7-1-3-4 6 1 4Z"
        fill="#A78BFA"
      />
    </svg>
  );
}

export function CurrentPageIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1" />
      <path d="M3 9h18" />
      <circle cx="6" cy="6.5" r="0.5" fill="currentColor" />
      <circle cx="8" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
