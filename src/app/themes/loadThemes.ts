// Bundles every palette in this folder: a new theme is its CSS file plus its entry in shared/domain/themes.ts.
import.meta.glob("./*.css", { eager: true });
