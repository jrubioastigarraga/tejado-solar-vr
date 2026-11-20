/** Escena activa: se elige desde la portada y viaja en la URL (?theme=pagoda). */
export const THEMES = ['villa', 'pagoda'];

const requested = new URLSearchParams(location.search).get('theme');
export const theme = THEMES.includes(requested) ? requested : 'villa';
export const isPagoda = theme === 'pagoda';

export const THEME_LABELS = {
  villa: 'Villa mediterránea',
  pagoda: 'Isla de la pagoda',
};
