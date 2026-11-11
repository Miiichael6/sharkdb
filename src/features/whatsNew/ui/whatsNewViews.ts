import { openModalWindow } from "../../../shared/ui/modalWindow";
import { RELEASE_NOTES, unseenNotes, type ReleaseNote } from "../domain/releaseNotes";

/** The "Novedades" window: gets the notes to list, answers nothing. */
export const WHATS_NEW_VIEW = "whats-new";

export interface WhatsNewData {
  notes: ReleaseNote[];
  /** The version the app runs, marked in the list. */
  current: string;
}

/** The last version whose notes were shown (or that started without any to show). */
const LAST_SEEN_KEY = "sharkdb.whatsNew.lastSeen";

// As tall as its notes, up to the list's max-height (App.css), then the list scrolls.
const WINDOW = { title: "Novedades", width: 560, height: 360, resizable: false, fitContent: true };

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function saveLastSeen(version: string) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // Without storage it shows again next start; nothing breaks.
  }
}

/** From the settings menu: every version's notes. */
export async function openWhatsNewWindow() {
  await openModalWindow<null>(WHATS_NEW_VIEW, { notes: RELEASE_NOTES, current: __APP_VERSION__ } satisfies WhatsNewData, WINDOW);
}

/** On start: the notes of the versions not seen yet, once per version. */
export async function showWhatsNewOnUpdate() {
  const current = __APP_VERSION__;
  const notes = unseenNotes(current, readLastSeen());
  saveLastSeen(current);
  if (notes.length) await openModalWindow<null>(WHATS_NEW_VIEW, { notes, current } satisfies WhatsNewData, WINDOW);
}
