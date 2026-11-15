// Minimal Google Identity Services typings — only what Login.tsx uses.
// (The GIS script is loaded at runtime; no official bundled types are used.)
interface GoogleAccountsId {
  initialize(options: {
    client_id: string;
    callback: (response: { credential?: string }) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: { theme?: string; size?: string; width?: number }
  ): void;
}

interface Window {
  google?: {
    accounts: { id: GoogleAccountsId };
  };
}
