import { useApp } from '../../store/appStore';
import { tap } from '../../lib/feedback';

/**
 * Переключатель вида доски.
 *
 * Живёт на самой доске, а не в настройках и не в общем ряду кнопок: если
 * телефон начал захлёбываться, идти за этой кнопкой через два экрана —
 * последнее, чего хочется. Здесь она видна всегда, даже когда снизу открыта
 * карточка хода.
 */
export function BoardToggle() {
  const quality = useApp((s) => s.boardQuality);
  const setBoardQuality = useApp((s) => s.setBoardQuality);
  const plain = quality === 'fast';

  return (
    <button
      className="board-tool"
      onClick={() => {
        tap();
        setBoardQuality(plain ? 'rich' : 'fast');
      }}
    >
      {plain ? '🧊 Объёмная' : '🔲 Плоская'}
    </button>
  );
}
